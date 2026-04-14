"""
考生画像模型
"""
from sqlalchemy import Column, Integer, String, Text, JSON, DateTime
from sqlalchemy.sql import func
from db.database import Base


class UserProfile(Base):
    """考生画像"""
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, index=True, comment="会话ID")

    # 基本信息
    province = Column(String(20), comment="所在省份")
    category = Column(String(10), comment="科类：文科/理科/物理类/历史类")
    is_new_gaokao = Column(Integer, default=0, comment="是否新高考")

    # 成绩信息
    score = Column(Integer, comment="高考成绩")
    rank = Column(Integer, comment="省排名")

    # 选科（新高改革省份）
    subjects = Column(String(50), comment="选科组合")

    # 偏好设置
    preferred_provinces = Column(String(200), comment="想去省份(逗号分隔)")
    preferred_types = Column(String(100), comment="院校类型偏好")
    preferred_levels = Column(String(100), comment="层次偏好：985/211/双一流")
    avoid_provinces = Column(String(200), comment="不想去省份")

    # 专业偏好
    preferred_majors = Column(String(500), comment="感兴趣专业")
    avoid_majors = Column(String(500), comment="不想学专业")
    interest_type = Column(String(50), comment="兴趣类型：RIASEC")

    # 其他偏好
    tuition_range = Column(String(50), comment="学费范围")
    dormitory_required = Column(Integer, default=1, comment="是否需要住宿")
    city_size = Column(String(20), comment="城市大小偏好")

    # 状态
    profile_complete = Column(Integer, default=0, comment="画像完整度(0-100)")

    # 原始对话数据
    raw_profile = Column(Text, comment="原始画像数据(JSON)")

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
