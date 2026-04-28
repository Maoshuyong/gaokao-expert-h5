"""
API 路由
"""
from .chat import router as tools_router
from .colleges import router as colleges_router
from .report import router as report_router

__all__ = ["tools_router", "colleges_router", "report_router"]
