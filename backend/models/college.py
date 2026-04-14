"""
院校模型
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime
from sqlalchemy.sql import func
from db.database import Base


class College(Base):
    """院校基础信息"""
    __tablename__ = "colleges"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, index=True, comment="院校代码")
    name = Column(String(100), index=True, comment="院校名称")
    short_name = Column(String(50), comment="院校简称")

    # 基本信息
    province = Column(String(20), comment="所在地")
    city = Column(String(50), comment="所在城市")
    level = Column(String(20), comment="办学层次：本科/专科")
    type = Column(String(50), comment="院校类型：综合/理工/师范...")

    # 层次标签
    is_985 = Column(Boolean, default=False, comment="是否985")
    is_211 = Column(Boolean, default=False, comment="是否211")
    is_double_first = Column(Boolean, default=False, comment="是否双一流")

    # 排名
    ranking = Column(Integer, comment="全国排名")
    ranking_type = Column(String(20), comment="排名类型")

    # 特性
    has_master = Column(Boolean, default=False, comment="是否有硕士点")
    has_doctor = Column(Boolean, default=False, comment="是否有博士点")

    # 学费
    avg_tuition = Column(Integer, comment="平均学费(元/年)")

    # 其他
    website = Column(String(200), comment="官网")
    description = Column(Text, comment="简介")

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
