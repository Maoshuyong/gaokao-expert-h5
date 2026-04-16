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

# 前端静态文件目录
STATIC_DIR = Path(__file__).parent / "static"
# API / 文档路径前缀（不由 SPA 处理）
_API_PREFIXES = ("/api", "/docs", "/redoc", "/openapi.json")

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

    # 自动填充一分一段表（仅当数据为空时）
    try:
        from db import SessionLocal
        from models.score_rank_table import ScoreRankTable
        db = SessionLocal()
        count = db.query(ScoreRankTable).count()
        db.close()
        if count == 0:
            logger.info("一分一段表为空，开始填充种子数据...")
            import subprocess
            result = subprocess.run(
                [sys.executable, "seed_score_rank.py"],
                capture_output=True, text=True, timeout=60,
                cwd=str(Path(__file__).parent)
            )
            if result.returncode == 0:
                logger.info(f"一分一段表种子数据填充成功: {result.stdout.strip()}")
            else:
                logger.warning(f"一分一段表种子数据填充失败: {result.stderr.strip()}")
        else:
            logger.info(f"一分一段表已有 {count} 条数据，跳过填充")
    except Exception as e:
        logger.warning(f"一分一段表自动填充异常: {e}")


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
