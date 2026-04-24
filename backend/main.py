"""
FastAPI 应用入口 - 高考志愿填报数据服务 + 前端静态托管
"""
import os
import sys
from pathlib import Path
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import logging

from config import settings
from db import init_db
from api import tools_router, colleges_router, report_router
from api.llm_proxy import router as llm_proxy_router

# 前端静态文件目录
STATIC_DIR = Path(__file__).parent / "static"
# API / 文档路径前缀（不由 SPA 处理）
_API_PREFIXES = ("/api", "/v1", "/docs", "/redoc", "/openapi.json", "/health")

# 配置日志
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# 创建应用
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="高考志愿填报数据服务 API - 为 AI Agent 提供院校查询、录取概率计算等工具接口",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS 配置 — 生产环境可通过 CORS_ORIGINS 环境变量限制
cors_origins = os.environ.get("CORS_ORIGINS", "*")
if cors_origins != "*":
    cors_origins = [o.strip() for o in cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if isinstance(cors_origins, list) else [cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """启动事件"""
    logger.info("应用启动中...")
    init_db()
    logger.info("数据库初始化完成")

    # 自动填充院校 + 录取数据（仅当 College 表为空时）
    try:
        from db import SessionLocal
        from models.college import College
        db = SessionLocal()
        college_count = db.query(College).count()
        db.close()
        if college_count == 0:
            logger.info("院校数据为空，开始填充种子数据...")
            import subprocess
            result = subprocess.run(
                [sys.executable, "seed_gaokao_data.py"],
                capture_output=True, text=True, timeout=120,
                cwd=str(Path(__file__).parent)
            )
            if result.returncode == 0:
                logger.info(f"院校数据填充成功: {result.stdout.strip()}")
            else:
                logger.warning(f"院校数据填充失败: {result.stderr.strip()}")
        else:
            logger.info(f"院校表已有 {college_count} 条数据，跳过填充")
    except Exception as e:
        logger.warning(f"院校数据自动填充异常: {e}")

    # 自动填充一分一段表
    try:
        from db import SessionLocal
        from models.score_rank_table import ScoreRankTable
        from sqlalchemy import func as sa_func
        db = SessionLocal()
        count = db.query(ScoreRankTable).count()
        # 检查是否有多年度数据（旧版只有 2024）
        years = [r[0] for r in db.query(ScoreRankTable.year).distinct().all()]
        db.close()

        need_seed = (count == 0) or (len(years) < 3)
        if need_seed:
            reason = "为空" if count == 0 else f"仅有 {years}，需升级"
            logger.info(f"一分一段表{reason}，开始填充种子数据...")
            import subprocess
            seed_script = "seed_score_rank_csv.py"
            seed_args = [sys.executable, seed_script, "--from-csv"]
            csv_dir = Path(__file__).parent / "score_rank_data"
            csv_files = list(csv_dir.glob("20*.csv")) if csv_dir.exists() else []
            if not csv_files:
                json_file = Path(__file__).parent / "seed_score_rank_data.json"
                if json_file.exists():
                    seed_args = [sys.executable, seed_script, "--from-json"]
                else:
                    seed_script = "seed_score_rank.py"
                    seed_args = [sys.executable, seed_script]

            result = subprocess.run(
                seed_args,
                capture_output=True, text=True, timeout=180,
                cwd=str(Path(__file__).parent)
            )
            if result.returncode == 0:
                logger.info(f"一分一段表种子数据填充成功: {result.stdout.strip()}")
            else:
                logger.warning(f"一分一段表种子数据填充失败: {result.stderr.strip()}")
        else:
            logger.info(f"一分一段表已有 {count} 条数据 ({years}年)，跳过填充")
    except Exception as e:
        logger.warning(f"一分一段表自动填充异常: {e}")

    # 自动填充省控线（检查覆盖率，低于 80% 则重新填充）
    try:
        from db import SessionLocal
        from models.score import Score
        from sqlalchemy import func as sa_func
        db = SessionLocal()
        total = db.query(Score).count()
        filled = db.query(Score).filter(Score.control_score.isnot(None)).count()
        db.close()

        need_fill = (total > 0 and filled / total < 0.8) or filled == 0
        if need_fill:
            logger.info(f"省控线覆盖率 {filled}/{total}，开始填充...")
            import subprocess
            result = subprocess.run(
                [sys.executable, "fill_control_scores.py"],
                capture_output=True, text=True, timeout=120,
                cwd=str(Path(__file__).parent)
            )
            if result.returncode == 0:
                logger.info(f"省控线填充成功: {result.stdout.strip()}")
            else:
                logger.warning(f"省控线填充失败: {result.stderr.strip()}")
        else:
            logger.info(f"省控线覆盖率 {filled}/{total} ({filled*100//total}%)，跳过填充")
    except Exception as e:
        logger.warning(f"省控线自动填充异常: {e}")


@app.get("/")
async def root():
    """根路径 — 有前端时返回 SPA，否则返回 API 信息"""
    if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
        return FileResponse(str(STATIC_DIR / "index.html"))
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "running",
        "type": "data-service",
        "docs": "/docs",
        "description": "为 AI Agent 提供高考志愿填报数据工具"
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}


# 注册路由
app.include_router(tools_router)
app.include_router(colleges_router)
app.include_router(report_router)
app.include_router(llm_proxy_router)  # LLM 代理（小程序 AI 对话）


# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"全局异常: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "服务器内部错误，请稍后重试"}
    )


# ========== 前端静态文件托管（中间件方式） ==========
if STATIC_DIR.exists():
    class SPAMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next):
            path = request.url.path
            # API / 文档路径交给正常处理
            if any(path.startswith(p) for p in _API_PREFIXES):
                return await call_next(request)
            # 静态文件存在则直接返回
            file_path = STATIC_DIR / path.lstrip("/")
            if file_path.is_file():
                return FileResponse(str(file_path))
            # 否则返回 index.html（SPA 路由）
            return FileResponse(str(STATIC_DIR / "index.html"))

    app.add_middleware(SPAMiddleware)
    logger.info(f"前端静态文件已挂载 (SPA 中间件): {STATIC_DIR}")
else:
    logger.warning(f"前端静态文件目录不存在，仅提供 API 服务: {STATIC_DIR}")


if __name__ == "__main__":
    import uvicorn
    debug = os.environ.get("DEBUG", "true").lower() == "true"
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=debug)
