"""
API 路由
"""
from .chat import router as tools_router
from .colleges import router as colleges_router

__all__ = ["tools_router", "colleges_router"]
