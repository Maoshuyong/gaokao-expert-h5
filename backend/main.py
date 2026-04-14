"""
FastAPI 应用入口 - 高考志愿填报数据服务
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from config import settings
from db import init_db
from api import tools_router, colleges_router

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


@app.get("/")
async def root():
    """根路径"""
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


# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"全局异常: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "服务器内部错误，请稍后重试"}
    )


if __name__ == "__main__":
    import uvicorn
    debug = os.environ.get("DEBUG", "true").lower() == "true"
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=debug)
