"""
院校查询 API
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import Optional, List
from typing import Dict

from db import get_db
from models import College, Score

router = APIRouter(prefix="/api/v1/colleges", tags=["colleges"])


class CollegeResponse(BaseModel):
    """院校响应"""
    code: str
    name: str
    province: str
    city: str
    level: str
    type: str
    is_985: bool
    is_211: bool
    is_double_first: bool
    ranking: Optional[int]
    avg_tuition: Optional[int]
    description: Optional[str]


class ScoreResponse(BaseModel):
    """录取分数线响应"""
    year: int
    province: str
    batch: str
    category: str
    min_score: int
    min_rank: Optional[int]
    avg_score: Optional[int]
    control_score: Optional[int]


@router.get("/", response_model=List[CollegeResponse])
async def search_colleges(
    q: Optional[str] = Query(None, description="搜索关键词"),
    province: Optional[str] = Query(None, description="省份"),
    level: Optional[str] = Query(None, description="办学层次"),
    college_type: Optional[str] = Query(None, description="院校类型"),
    is_985: Optional[bool] = Query(None, description="是否985"),
    is_211: Optional[bool] = Query(None, description="是否211"),
    ranking_top: Optional[int] = Query(None, description="排名前N"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db)
):
    """搜索院校"""
    query = db.query(College)

    # 关键词搜索
    if q:
        query = query.filter(
            or_(
                College.name.contains(q),
                College.short_name.contains(q),
                College.code.contains(q)
            )
        )

    # 筛选条件
    if province:
        query = query.filter(College.province == province)
    if level:
        query = query.filter(College.level == level)
    if college_type:
        query = query.filter(College.type == college_type)
    if is_985 is not None:
        query = query.filter(College.is_985 == is_985)
    if is_211 is not None:
        query = query.filter(College.is_211 == is_211)
    if ranking_top:
        query = query.filter(College.ranking <= ranking_top)

    # 排序
    query = query.order_by(College.ranking.asc().nullslast())

    # 分页
    offset = (page - 1) * page_size
    colleges = query.offset(offset).limit(page_size).all()

    return [
        CollegeResponse(
            code=c.code,
            name=c.name,
            province=c.province,
            city=c.city,
            level=c.level,
            type=c.type,
            is_985=c.is_985,
            is_211=c.is_211,
            is_double_first=c.is_double_first,
            ranking=c.ranking,
            avg_tuition=c.avg_tuition,
            description=c.description
        )
        for c in colleges
    ]


@router.get("/meta/available-provinces")
async def get_available_provinces(db: Session = Depends(get_db)):
    """获取有分数线数据的省份列表（供前端省份切换）"""
    from sqlalchemy import func, text
    rows = db.execute(
        text("SELECT province, COUNT(*) as cnt FROM scores WHERE province != '' GROUP BY province ORDER BY cnt DESC")
    ).fetchall()
    return {
        "provinces": [{"name": r[0], "count": r[1]} for r in rows],
        "total": len(rows)
    }


@router.get("/{code}", response_model=CollegeResponse)
async def get_college(code: str, db: Session = Depends(get_db)):
    """获取院校详情"""
    college = db.query(College).filter(College.code == code).first()
    if not college:
        raise HTTPException(status_code=404, detail="院校不存在")

    return CollegeResponse(
        code=college.code,
        name=college.name,
        province=college.province,
        city=college.city,
        level=college.level,
        type=college.type,
        is_985=college.is_985,
        is_211=college.is_211,
        is_double_first=college.is_double_first,
        ranking=college.ranking,
        avg_tuition=college.avg_tuition,
        description=college.description
    )


@router.get("/{code}/scores", response_model=List[ScoreResponse])
async def get_college_scores(
    code: str,
    year: Optional[int] = None,
    province: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取院校历年录取分数线"""
    query = db.query(Score).filter(Score.college_code == code)

    if year:
        query = query.filter(Score.year == year)
    if province:
        query = query.filter(Score.province == province)
    if category:
        query = query.filter(Score.category == category)

    scores = query.order_by(Score.year.desc()).limit(10).all()

    return [
        ScoreResponse(
            year=s.year,
            province=s.province,
            batch=s.batch,
            category=s.category,
            min_score=s.min_score,
            min_rank=s.min_rank,
            avg_score=s.avg_score,
            control_score=s.control_score
        )
        for s in scores
    ]
