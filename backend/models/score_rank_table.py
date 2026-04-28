"""
一分一段表模型
存储各省份各科类的分数-位次对应关系
"""
from sqlalchemy import Column, Integer, String, Index, UniqueConstraint
from db.database import Base


class ScoreRankTable(Base):
    """一分一段表 - 每行代表一个分数对应的累计人数（位次）"""
    __tablename__ = "score_rank_tables"

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, index=True, comment="年份")
    province = Column(String(20), index=True, comment="省份")
    category = Column(String(20), index=True, comment="科类：文科/理科/物理类/历史类")
    score = Column(Integer, comment="分数")
    cumulative_count = Column(Integer, comment="该分数及以上累计人数（即省排名）")
    count_this_score = Column(Integer, comment="本分数段人数")

    __table_args__ = (
        UniqueConstraint("year", "province", "category", "score", name="uq_score_rank"),
        Index("idx_year_province_category_score", "year", "province", "category", "score"),
    )
