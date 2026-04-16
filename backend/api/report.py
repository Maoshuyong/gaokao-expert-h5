"""
综合志愿分析报告 API
根据考生信息一次性生成完整的冲稳保报告
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List, Dict, Any
import logging

from db import get_db
from services.scoring_service import ScoringService
from models import College, Score

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/report", tags=["report"])


@router.get("/generate")
async def generate_report(
    province: str = Query(..., description="省份"),
    category: str = Query(..., description="科类"),
    score: int = Query(..., description="高考分数"),
    rank: int = Query(..., description="省排名"),
    db: Session = Depends(get_db)
):
    """
    生成综合志愿分析报告
    
    一次性返回：分数段定位、省控线对比、冲稳保院校推荐（含三年趋势）
    """
    scoring = ScoringService(db)

    # ========== 1. 省控线 ==========
    control_scores = db.query(Score).filter(
        Score.province == province,
        Score.year == 2024
    ).distinct(Score.category, Score.batch).all()

    control_map = {}
    for s in control_scores:
        key = f"{s.category}_{s.batch}"
        if key not in control_map or (s.control_score and s.control_score > control_map[key].get("score", 0)):
            control_map[key] = {
                "category": s.category,
                "batch": s.batch,
                "score": s.control_score
            }

    yiben_score = control_map.get(f"{category}_本科一批", {}).get("score")
    erben_score = control_map.get(f"{category}_本科二批", {}).get("score")
    yiben_diff = score - yiben_score if yiben_score else None
    erben_diff = score - erben_score if erben_score else None

    # 分数段定位
    position = _get_position(yiben_diff, erben_diff)

    # ========== 2. 查找匹配院校（本一批） ==========
    # 找所有有该省该科类录取数据的院校，按最新位次排序
    latest_rank_sub = db.query(
        Score.college_code,
        func.min(Score.min_rank).label("min_rank_val")
    ).filter(
        Score.province == province,
        Score.category == category,
        Score.batch == "本科一批",
        Score.min_rank.isnot(None)
    ).group_by(Score.college_code).subquery()

    # 扩大搜索范围：rank 上下 50%
    rank_upper = int(rank * 0.3)  # 冲刺区上界
    rank_lower = int(rank * 2.0)  # 保底区下界

    batch1_colleges = db.query(
        College,
        latest_rank_sub.c.min_rank_val.label("latest_rank")
    ).join(
        latest_rank_sub, College.code == latest_rank_sub.c.college_code
    ).filter(
        latest_rank_sub.c.min_rank_val >= rank_upper,
        latest_rank_sub.c.min_rank_val <= rank_lower
    ).order_by(latest_rank_sub.c.min_rank_val.asc()).all()

    # ========== 3. 分类为冲稳保 ==========
    chong_list = []   # 冲刺
    wen_list = []     # 稳妥
    bao_list = []     # 保底

    for college, latest_rank in batch1_colleges:
        # 使用 ScoringService 的加权平均位次（偏向最差年份，保守估计）
        history = db.query(Score).filter(
            Score.college_code == college.code,
            Score.province == province,
            Score.category == category,
            Score.batch == "本科一批"
        ).order_by(Score.year.desc()).limit(3).all()

        avg_rank = scoring.calculate_avg_rank(history)
        if avg_rank is None:
            avg_rank = latest_rank  # 降级到 MIN 位次

        # 用加权平均位次计算概率（而非 MIN 位次）
        prob, level, explanation = scoring.calculate_admission_probability(rank, avg_rank)

        college_data = {
            "code": college.code,
            "name": college.name,
            "province": college.province,
            "city": college.city,
            "type": college.type,
            "is_985": college.is_985,
            "is_211": college.is_211,
            "is_double_first": college.is_double_first,
            "latest_rank": latest_rank,
            "probability": round(prob, 2),
            "level": level,
            "margin": rank - latest_rank,  # 正=你位次比学校差(落后)，负=你位次比学校好(领先)
            "history": [
                {
                    "year": h.year,
                    "min_score": h.min_score,
                    "min_rank": h.min_rank,
                    "enrollment": h.enrollment
                }
                for h in history
            ]
        }

        # 直接用 ScoringService 返回的 level 分类（阈值逻辑正确，无需反转）
        if level == "冲刺":
            chong_list.append(college_data)
        elif level == "稳妥":
            wen_list.append(college_data)
        elif level == "保底":
            bao_list.append(college_data)
        # "不建议" 的跳过

    # 每个梯度取前 8 所
    chong_top = chong_list[:8]
    wen_top = wen_list[:8]
    bao_top = bao_list[:8]

    # ========== 4. 本二批保底 ==========
    erben_rank_sub = db.query(
        Score.college_code,
        func.min(Score.min_rank).label("min_rank_val")
    ).filter(
        Score.province == province,
        Score.category == category,
        Score.batch == "本科二批",
        Score.min_rank.isnot(None)
    ).group_by(Score.college_code).subquery()

    erben_results = db.query(
        College,
        erben_rank_sub.c.min_rank_val.label("latest_rank")
    ).join(
        erben_rank_sub, College.code == erben_rank_sub.c.college_code
    ).filter(
        erben_rank_sub.c.min_rank_val >= rank,
        erben_rank_sub.c.min_rank_val <= rank * 2.5
    ).order_by(erben_rank_sub.c.min_rank_val.asc()).limit(6).all()

    erben_list = []
    for college, latest_rank in erben_results:
        history = db.query(Score).filter(
            Score.college_code == college.code,
            Score.province == province,
            Score.category == category,
            Score.batch == "本科二批"
        ).order_by(Score.year.desc()).limit(3).all()

        prob, level, _ = scoring.calculate_admission_probability(rank, latest_rank)
        erben_list.append({
            "code": college.code,
            "name": college.name,
            "province": college.province,
            "city": college.city,
            "type": college.type,
            "is_985": college.is_985,
            "is_211": college.is_211,
            "is_double_first": college.is_double_first,
            "latest_rank": latest_rank,
            "probability": round(prob, 2),
            "level": level,
            "margin": rank - latest_rank,
            "batch": "本科二批",
            "history": [
                {"year": h.year, "min_score": h.min_score, "min_rank": h.min_rank, "enrollment": h.enrollment}
                for h in history
            ]
        })

    # ========== 5. 统计 ==========
    total_matched = len(batch1_colleges)

    return {
        "profile": {
            "province": province,
            "category": category,
            "score": score,
            "rank": rank,
            "position": position,
        },
        "control_scores": {
            "yiben": yiben_score,
            "erben": erben_score,
            "yiben_diff": yiben_diff,
            "erben_diff": erben_diff,
        },
        "statistics": {
            "total_matched": total_matched,
            "chong_count": len(chong_list),
            "wen_count": len(wen_list),
            "bao_count": len(bao_list),
        },
        "recommendations": {
            "chong": chong_top,
            "wen": wen_top,
            "bao": bao_top,
        },
        "erben_fallback": erben_list,
        "tips": _generate_tips(position, yiben_diff, len(chong_list), len(wen_list), len(bao_list)),
    }


def _get_position(yiben_diff, erben_diff):
    """分数段定位"""
    if yiben_diff is None:
        return {"label": "数据不足", "desc": "暂无该省省控线数据", "emoji": "❓"}
    if yiben_diff >= 80:
        return {"label": "高分段", "desc": "远超一本线，可冲击中流985/强势211", "emoji": "🏆"}
    if yiben_diff >= 50:
        return {"label": "中高分段", "desc": "超一本线较多，选择空间较大", "emoji": "🌟"}
    if yiben_diff >= 20:
        return {"label": "中等偏上", "desc": "超一本线不多，建议在专业和城市之间取舍", "emoji": "📊"}
    if yiben_diff >= 0:
        return {"label": "压线段", "desc": "刚过一本线，需注意滑档风险，做好二批保底", "emoji": "⚡"}
    if erben_diff is not None and erben_diff >= 0:
        return {"label": "二本高分段", "desc": "未达一本线但超二本线较多，二批有好学校", "emoji": "📈"}
    return {"label": "二本段", "desc": "建议关注二批优势院校和特色专业", "emoji": "📋"}


def _generate_tips(position, yiben_diff, chong_count, wen_count, bao_count):
    """生成填报建议"""
    tips = []
    if yiben_diff is not None and yiben_diff >= 0 and yiben_diff < 30:
        tips.append(f"你超一本线仅 {yiben_diff} 分，211 机会有限，建议关注强势双非和中外合办")
    elif yiben_diff is not None and yiben_diff >= 30:
        tips.append(f"你超一本线 {yiben_diff} 分，有一定选择空间")
    if bao_count == 0:
        tips.append("⚠️ 保底院校不足，建议增加保底志愿或考虑本二批")
    if chong_count > wen_count * 2:
        tips.append("冲刺院校远多于稳妥院校，建议适当增加稳妥志愿")
    tips.append("稳妥志愿安全余量建议 ≥1500 名")
    tips.append("记得同时填报本科二批作为保底")
    return tips
