"""
应用配置
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """应用配置"""

    # 项目基础
    PROJECT_NAME: str = "高考志愿填报专家 - 数据服务"
    VERSION: str = "2.0.0"
    DEBUG: bool = True

    # 数据库
    DATABASE_URL: str = "sqlite:///./data/gaokao.db"

    # 数据路径
    DATA_DIR: str = "./data"

    # 服务端口
    PORT: int = 8000

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
