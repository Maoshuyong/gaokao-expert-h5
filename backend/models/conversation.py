"""
对话记录模型
"""
from sqlalchemy import Column, Integer, String, Text, JSON, DateTime
from sqlalchemy.sql import func
from db.database import Base


class Conversation(Base):
    """对话会话"""
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, index=True, comment="会话ID")

    # 用户信息
    user_id = Column(String(100), index=True, comment="用户标识")

    # 状态
    state = Column(String(30), default="init", comment="当前状态")
    profile_complete = Column(Integer, default=0, comment="画像完整度")
    recommendations_count = Column(Integer, default=0, comment="推荐次数")

    # 结果
    final_recommendations = Column(Text, comment="最终推荐结果(JSON)")

    # 元信息
    source = Column(String(50), comment="来源：web/miniapp/api")
    extra_data = Column(JSON, comment="扩展数据")

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Message(Base):
    """对话消息"""
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), index=True, comment="会话ID")
    message_id = Column(String(100), index=True, comment="消息ID")

    # 角色
    role = Column(String(20), comment="角色：user/assistant/system")

    # 内容
    content = Column(Text, comment="消息内容")
    content_type = Column(String(20), default="text", comment="内容类型：text/html/json")

    # 附件
    attachments = Column(JSON, comment="附件(JSON)")

    # 工具调用
    tool_calls = Column(JSON, comment="工具调用记录")
    tool_results = Column(JSON, comment="工具返回结果")

    # 反馈
    feedback = Column(Integer, comment="用户反馈：1喜欢/-1不喜欢")

    created_at = Column(DateTime, server_default=func.now())
