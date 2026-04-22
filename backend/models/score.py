"""
录取分数线模型
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Index, Text
from sqlalchemy.sql import func
from db.database import Base


class Score(Base):
    """历年录取分数线"""
    __tablename__ = "scores"

    id = Column(Integer, primary_key=True, index=True)

    # 关联信息
    college_id = Column(Integer, index=True)
    college_code = Column(String(10), index=True)
    college_name = Column(String(100), index=True)

    # 年份和省份
    year = Column(Integer, index=True)
    province = Column(String(20), index=True)
    batch = Column(String(20), comment="批次：本科一批/本科二批...")

    # 科类
    category = Column(String(10), comment="科类：文科/理科/物理类/历史类...")

    # 分数线
    min_score = Column(Integer, comment="最低分")
    min_rank = Column(Integer, comment="最低排名")
    avg_score = Column(Integer, comment="平均分")
    control_score = Column(Integer, comment="控制线/一本线")

    # 专业线（JSON存储）
    major_scores = Column(Text, comment="各专业分数线JSON")

    # 招生
    enrollment = Column(Integer, comment="招生人数")
    plan_count = Column(Integer, comment="计划招生")

    # 备注
    note = Column(String(200), comment="备注")

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 复合索引
    __table_args__ = (
        Index('idx_province_year_batch', 'province', 'year', 'batch'),
        Index('idx_college_year', 'college_code', 'year'),
    )
