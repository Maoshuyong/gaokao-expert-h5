"""
工具 API 路由 - 为 WorkBuddy Agent 提供数据工具接口
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
import uuid

from sqlalchemy import func
from db import get_db
from services.scoring_service import ScoringService
from models import College, Score, ScoreRankTable

router = APIRouter(prefix="/api/v1", tags=["tools"])


# ========== 画像管理工具 ==========

class ProfileCreate(BaseModel):
    """创建画像请求"""
    province: str = Field(..., description="所在省份")
    category: str = Field(..., description="科类：文科/理科/物理类/历史类")
    score: int = Field(..., description="高考成绩")
    rank: Optional[int] = Field(None, description="省排名")
    subjects: Optional[str] = Field(None, description="选科组合（新高考）")
    preferred_provinces: Optional[List[str]] = Field(None, description="想去的省份")
    preferred_majors: Optional[List[str]] = Field(None, description="感兴趣的专业")
    preferred_levels: Optional[List[str]] = Field(None, description="院校层次偏好")
    avoid_provinces: Optional[List[str]] = Field(None, description="不想去的省份")
    avoid_majors: Optional[List[str]] = Field(None, description="不想学的专业")
    tuition_range: Optional[str] = Field(None, description="学费范围")


class ProfileUpdate(BaseModel):
    """更新画像请求"""
    province: Optional[str] = None
    category: Optional[str] = None
    score: Optional[int] = None
    rank: Optional[int] = None
    subjects: Optional[str] = None
    preferred_provinces: Optional[List[str]] = None
    preferred_majors: Optional[List[str]] = None
    preferred_levels: Optional[List[str]] = None
    avoid_provinces: Optional[List[str]] = None
    avoid_majors: Optional[List[str]] = None
    tuition_range: Optional[str] = None


@router.post("/profile", tags=["profile"])
async def create_profile(data: ProfileCreate, db: Session = Depends(get_db)):
    """
    创建考生画像

    由 WorkBuddy Agent 在信息采集完成后调用，创建完整的考生画像。
    """
    session_id = str(uuid.uuid4())
    profile = {
        "session_id": session_id,
        "province": data.province,
        "category": data.category,
        "score": data.score,
        "rank": data.rank,
        "subjects": data.subjects,
        "preferred_provinces": data.preferred_provinces or [],
        "preferred_majors": data.preferred_majors or [],
        "preferred_levels": data.preferred_levels or [],
        "avoid_provinces": data.avoid_provinces or [],
        "avoid_majors": data.avoid_majors or [],
        "tuition_range": data.tuition_range,
        "completeness": _calc_completeness(data)
    }
    return {"success": True, "profile": profile}


@router.put("/profile/{session_id}", tags=["profile"])
async def update_profile(session_id: str, updates: ProfileUpdate, db: Session = Depends(get_db)):
    """
    更新考生画像

    用于修正信息或补充偏好。
    """
    updates_dict = updates.dict(exclude_none=True)
    return {
        "success": True,
        "session_id": session_id,
        "updated_fields": list(updates_dict.keys())
    }


# ========== 录取概率计算工具 ==========

class ProbabilityRequest(BaseModel):
    """概率计算请求"""
    score: int = Field(..., description="高考成绩")
    rank: int = Field(..., description="省排名")
    province: str = Field(..., description="所在省份")
    category: str = Field(..., description="科类")
    college_codes: List[str] = Field(..., description="院校代码列表")
    year: int = Field(2025, description="参考年份")


@router.post("/probability", tags=["scoring"])
async def calculate_probability(req: ProbabilityRequest, db: Session = Depends(get_db)):
    """
    批量计算录取概率

    根据考生排名和院校历史录取数据，计算每所院校的录取概率。
    返回每所院校的：概率值、档位（冲刺/稳妥/保底/不建议）、说明。
    """
    scoring = ScoringService(db)
    results = scoring.batch_calculate_probability(
        user_rank=req.rank,
        college_codes=req.college_codes,
        province=req.province,
        year=req.year,
        category=req.category
    )

    # 补充院校名称信息
    for r in results:
        if r.get("college_code"):
            college = db.query(College).filter(College.code == r["college_code"]).first()
            if college:
                r["college_name"] = college.name
                r["province"] = college.province
                r["city"] = college.city
                r["is_985"] = college.is_985
                r["is_211"] = college.is_211
                r["type"] = college.type
                r["ranking"] = college.ranking

    return {
        "user_score": req.score,
        "user_rank": req.rank,
        "category": req.category,
        "results": results
    }


class ScoreLookupRequest(BaseModel):
    """分数线查询请求"""
    college_code: str = Field(..., description="院校代码")
    province: str = Field(..., description="所在省份")
    category: str = Field(..., description="科类")


@router.post("/scores/lookup", tags=["scoring"])
async def lookup_scores(req: ScoreLookupRequest, db: Session = Depends(get_db)):
    """
    查询某所院校在某省某科类的历年录取分数线

    返回最近5年的录取数据，包含最低分、最低排名、平均分等。
    """
    scores = db.query(Score).filter(
        Score.college_code == req.college_code,
        Score.province == req.province,
        Score.category == req.category
    ).order_by(Score.year.desc()).limit(5).all()

    college = db.query(College).filter(College.code == req.college_code).first()

    return {
        "college": {
            "code": college.code,
            "name": college.name,
            "short_name": college.short_name,
            "province": college.province,
            "city": college.city,
            "is_985": college.is_985,
            "is_211": college.is_211
        } if college else None,
        "province": req.province,
        "category": req.category,
        "history": [
            {
                "year": s.year,
                "batch": s.batch,
                "min_score": s.min_score,
                "min_rank": s.min_rank,
                "avg_score": s.avg_score,
                "control_score": s.control_score,
                "enrollment": s.enrollment
            }
            for s in scores
        ]
    }


# ========== 院校筛选工具 ==========

@router.get("/colleges/recommend", tags=["recommend"])
async def recommend_colleges(
    province: str = Query(..., description="考生省份"),
    category: str = Query(..., description="科类"),
    score: int = Query(..., description="高考成绩"),
    rank: int = Query(..., description="省排名"),
    level: Optional[str] = Query(None, description="院校层次"),
    college_type: Optional[str] = Query(None, description="院校类型"),
    target_provinces: Optional[str] = Query(None, description="目标省份（逗号分隔）"),
    is_985: Optional[bool] = Query(None),
    is_211: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    根据考生条件筛选合适的院校

    基于 rank 查找有该省该科类录取数据的院校，并按排名排序。
    Agent 可用此接口获取候选院校列表，再调用 /probability 计算具体概率。
    """
    # 查找有该省该科类历史数据的院校，取最新一年的录取位次作为排序依据
    latest_scores = db.query(
        Score.college_code,
        func.min(Score.min_rank).label("latest_rank")
    ).filter(
        Score.province == province,
        Score.category == category,
        Score.min_rank.isnot(None)
    ).group_by(Score.college_code).subquery()

    query = db.query(College).filter(
        College.code.in_(
            db.query(Score.college_code).filter(
                Score.province == province,
                Score.category == category
            ).distinct()
        )
    )

    # 筛选条件
    if level:
        query = query.filter(College.level == level)
    if college_type:
        query = query.filter(College.type == college_type)
    if is_985 is not None:
        query = query.filter(College.is_985 == is_985)
    if is_211 is not None:
        query = query.filter(College.is_211 == is_211)
    if target_provinces:
        provinces = [p.strip() for p in target_provinces.split(",")]
        query = query.filter(College.province.in_(provinces))

    # 按录取位次排序（位次越低越好），无位次数据的放后面
    query = query.outerjoin(latest_scores, College.code == latest_scores.c.college_code)
    query = query.order_by(latest_scores.c.latest_rank.asc().nullslast())

    # 分页
    offset = (page - 1) * page_size
    colleges = query.offset(offset).limit(page_size).all()

    return {
        "query": {
            "province": province,
            "category": category,
            "score": score,
            "rank": rank
        },
        "total": query.count(),
        "page": page,
        "page_size": page_size,
        "colleges": [
            {
                "code": c.code,
                "name": c.name,
                "short_name": c.short_name,
                "province": c.province,
                "city": c.city,
                "level": c.level,
                "type": c.type,
                "is_985": c.is_985,
                "is_211": c.is_211,
                "is_double_first": c.is_double_first,
                "ranking": c.ranking,
                "avg_tuition": c.avg_tuition,
                "description": c.description
            }
            for c in colleges
        ]
    }


# ========== 一分一段表工具（预留） ==========

@router.get("/control-scores", tags=["reference"])
async def get_control_scores(
    province: str = Query(..., description="省份"),
    year: int = Query(..., description="年份"),
    db: Session = Depends(get_db)
):
    """
    查询某省某年的控制分数线（一本线/二本线）

    从录取数据中提取控制分数线信息。
    """
    scores = db.query(Score).filter(
        Score.province == province,
        Score.year == year
    ).distinct(Score.category, Score.batch).all()

    result = {}
    for s in scores:
        key = f"{s.category}_{s.batch}"
        if key not in result or (s.control_score and s.control_score > result[key].get("control_score", 0)):
            result[key] = {
                "category": s.category,
                "batch": s.batch,
                "control_score": s.control_score
            }

    return {
        "province": province,
        "year": year,
        "control_scores": list(result.values())
    }


# ========== 一分一段表工具 ==========

@router.get("/score-to-rank", tags=["reference"])
async def score_to_rank(
    province: str = Query(..., description="省份"),
    category: str = Query(..., description="科类：文科/理科/物理类/历史类"),
    score: int = Query(..., ge=0, le=750, description="高考分数"),
    year: int = Query(2024, description="年份"),
    db: Session = Depends(get_db)
):
    """
    分数转省排名（基于一分一段表）

    根据省份、科类和分数，查询对应年份的官方一分一段表，
    返回精确的省排名（位次）。

    如果该分数没有精确匹配，返回下一个较低分数的位次。
    """
    # 科类别名映射（兼容新旧高考命名）
    # 新高考: 物理类/历史类; 旧高考: 理科/文科
    category_alias = {
        "历史类": "文科", "文科": "历史类",
        "物理类": "理科", "理科": "物理类",
    }
    alias_category = category_alias.get(category)

    # 先用原始 category 查，再尝试别名
    row = db.query(ScoreRankTable).filter(
        ScoreRankTable.year == year,
        ScoreRankTable.province == province,
        ScoreRankTable.category == category,
        ScoreRankTable.score == score
    ).first()
    query_category = category
    if not row and alias_category:
        row = db.query(ScoreRankTable).filter(
            ScoreRankTable.year == year,
            ScoreRankTable.province == province,
            ScoreRankTable.category == alias_category,
            ScoreRankTable.score == score
        ).first()
        query_category = alias_category

    if row:
        return {
            "province": province,
            "category": category,
            "score": score,
            "rank": row.cumulative_count,
            "count_this_score": row.count_this_score,
            "total": _get_total_test_takers(db, year, province, query_category),
            "year": year,
            "method": "exact"
        }

    # 没有精确匹配时，找低于该分数的最高分对应的位次
    nearest = db.query(ScoreRankTable).filter(
        ScoreRankTable.year == year,
        ScoreRankTable.province == province,
        ScoreRankTable.category == query_category,
        ScoreRankTable.score < score
    ).order_by(ScoreRankTable.score.desc()).first()

    if nearest:
        return {
            "province": province,
            "category": category,
            "score": score,
            "rank": nearest.cumulative_count,
            "matched_score": nearest.score,
            "count_this_score": nearest.count_this_score,
            "total": _get_total_test_takers(db, year, province, query_category),
            "year": year,
            "method": "nearest_lower"
        }

    # 完全无数据
    return {
        "province": province,
        "category": category,
        "score": score,
        "rank": None,
        "total": None,
        "year": year,
        "method": "none",
        "message": f"暂无 {province} {query_category} {year} 年的一分一段表数据"
    }


def _get_total_test_takers(db: Session, year: int, province: str, category: str) -> Optional[int]:
    """获取该省该科类考生总数（取最低分的累计人数）"""
    row = db.query(ScoreRankTable).filter(
        ScoreRankTable.year == year,
        ScoreRankTable.province == province,
        ScoreRankTable.category == category,
        ScoreRankTable.cumulative_count.isnot(None)
    ).order_by(ScoreRankTable.score.asc()).first()
    return row.cumulative_count if row else None


# ========== 辅助函数 ==========

def _calc_completeness(data: ProfileCreate) -> int:
    """计算画像完整度"""
    fields = ["province", "category", "score", "rank", "subjects",
              "preferred_provinces", "preferred_majors", "preferred_levels"]
    filled = sum(1 for f in fields if getattr(data, f, None))
    return int(filled / len(fields) * 100)
