"""
数据库连接与会话管理
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from config import settings
from typing import Generator

import os

# 创建引擎（生产环境关闭 SQL echo）
debug = os.environ.get("DEBUG", "false").lower() == "true"
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    echo=debug
)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 基础模型
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """初始化数据库"""
    from models import college, score, profile, conversation, score_rank_table
    Base.metadata.create_all(bind=engine)
