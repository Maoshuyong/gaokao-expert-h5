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

    # ========== 1. 省控线（取最近有数据的年份） ==========
    max_year = db.query(func.max(Score.year)).filter(
        Score.province == province,
        Score.control_score.isnot(None)
    ).scalar() or 2024

    control_scores = db.query(Score).filter(
        Score.province == province,
        Score.year == max_year,
        Score.control_score.isnot(None)
    ).all()

    control_map = {}
    for s in control_scores:
        key = f"{s.category}_{s.batch}"
        if key not in control_map or (s.control_score and s.control_score > control_map[key].get("score", 0)):
            control_map[key] = {
                "category": s.category,
                "batch": s.batch,
                "score": s.control_score
            }

    # 兼容传统高考（本科一批/二批）和新高考（本科批）
    yiben_score = control_map.get(f"{category}_本科一批", {}).get("score")
    if not yiben_score:
        yiben_score = control_map.get(f"{category}_本科批", {}).get("score")
    erben_score = control_map.get(f"{category}_本科二批", {}).get("score")
    yiben_diff = score - yiben_score if yiben_score else None
    erben_diff = score - erben_score if erben_score else None

    # 分数段定位
    position = _get_position(yiben_diff, erben_diff)

    # ========== 2. 查找匹配院校（本一批） ==========
    # 动态确定批次名称：优先使用"本科一批"，如果没有则用"本科批"
    # 2025 年第五批新高考省份合并为"本科批"
    batch1_name = "本科一批"
    batch1_count = db.query(Score).filter(
        Score.province == province,
        Score.category == category,
        Score.batch == "本科一批",
        Score.min_rank.isnot(None),
        ~Score.college_name.startswith("__省控线__")
    ).count()
    if batch1_count == 0:
        batch1_name = "本科批"

    # 用历史「最差年份位次」(MAX min_rank) 作为院校入池基准。
    # 理由：概率计算也用最差年份加权值，两步标准必须一致；
    #       用 MIN 会把院校门槛刷到最乐观值，导致低层次院校错误入池。
    worst_rank_sub = db.query(
        Score.college_code,
        func.max(Score.min_rank).label("worst_rank_val")  # 最差年份位次（数字最大）
    ).filter(
        Score.province == province,
        Score.category == category,
        Score.batch == batch1_name,
        Score.min_rank.isnot(None),
        ~Score.college_name.startswith("__省控线__")
    ).group_by(Score.college_code).subquery()

    # 搜索范围基于「最差年份位次」：
    # - 冲刺上界：院校最差年份位次 >= rank * 0.75（院校门槛比你好，但不超过 25%）
    # - 保底下界：院校最差年份位次 <= rank * 1.5（院校门槛比你差，最多差 50%）
    rank_upper = int(rank * 0.75)   # 冲刺区上界（院校比你好最多25%）
    rank_lower = int(rank * 1.5)    # 保底区下界（院校比你差最多50%）

    batch1_colleges = db.query(
        College,
        worst_rank_sub.c.worst_rank_val.label("worst_rank")
    ).join(
        worst_rank_sub, College.code == worst_rank_sub.c.college_code
    ).filter(
        worst_rank_sub.c.worst_rank_val >= rank_upper,
        worst_rank_sub.c.worst_rank_val <= rank_lower
    ).order_by(worst_rank_sub.c.worst_rank_val.asc()).all()

    # ========== 3. 分类为冲稳保 ==========
    chong_list = []   # 冲刺
    wen_list = []     # 稳妥
    bao_list = []     # 保底

    for college, worst_rank in batch1_colleges:
        # 获取三年历史数据（兼容本科一批/本科批两种批次名）
        from sqlalchemy import or_
        history = db.query(Score).filter(
            Score.college_code == college.code,
            Score.province == province,
            Score.category == category,
            or_(Score.batch == "本科一批", Score.batch == "本科批"),
            ~Score.college_name.startswith("__省控线__")
        ).order_by(Score.year.desc()).limit(3).all()

        # 用加权平均位次（偏向最差年份）计算概率
        avg_rank = scoring.calculate_avg_rank(history)
        if avg_rank is None:
            avg_rank = worst_rank  # 降级：用最差年份位次（语义一致）

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
            "latest_rank": worst_rank,  # 对外暴露最差年份位次，更保守
            "probability": round(prob, 2),
            "level": level,
            "margin": rank - worst_rank,  # 正=你位次比学校差(落后)，负=你位次比学校好(领先)
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

        # ScoringService 的 level 直接对应冲稳保（无需反转）
        if level == "冲刺":
            chong_list.append(college_data)
        elif level == "稳妥":
            wen_list.append(college_data)
        elif level == "保底":
            bao_list.append(college_data)
        # "不建议" 院校跳过（不在有效候选范围内）

    # 每个梯度取前 8 所
    chong_top = chong_list[:8]
    wen_top = wen_list[:8]
    bao_top = bao_list[:8]

    # ========== 4. 本二批保底 ==========
    # 动态确定二批批次名称：优先"本科二批"，合并后无二批则用"本科批"
    batch2_name = "本科二批"
    batch2_count = db.query(Score).filter(
        Score.province == province,
        Score.category == category,
        Score.batch == "本科二批",
        Score.min_rank.isnot(None),
        ~Score.college_name.startswith("__省控线__")
    ).count()
    if batch2_count == 0:
        batch2_name = "本科批"  # 合并后的本科批也用于保底
        # 如果一保已经用了本科批，跳过二批查询（避免重复）
        if batch1_name == "本科批":
            erben_list = []
        else:
            # 查找本科批中位次高于考生的院校作为保底
            erben_rank_sub = db.query(
                Score.college_code,
                func.max(Score.min_rank).label("worst_rank_val")
            ).filter(
                Score.province == province,
                Score.category == category,
                Score.batch == batch2_name,
                Score.min_rank.isnot(None),
                ~Score.college_name.startswith("__省控线__")
            ).group_by(Score.college_code).subquery()

            erben_results = db.query(
                College,
                erben_rank_sub.c.worst_rank_val.label("worst_rank")
            ).join(
                erben_rank_sub, College.code == erben_rank_sub.c.college_code
            ).filter(
                erben_rank_sub.c.worst_rank_val >= rank,
                erben_rank_sub.c.worst_rank_val <= rank * 2.0
            ).order_by(erben_rank_sub.c.worst_rank_val.asc()).limit(6).all()

            erben_list = _build_erben_list(erben_results, db, province, category, batch2_name)
    else:
        # 同样用最差年份位次（MAX）作为基准
        erben_rank_sub = db.query(
            Score.college_code,
            func.max(Score.min_rank).label("worst_rank_val")
        ).filter(
            Score.province == province,
            Score.category == category,
            Score.batch == batch2_name,
            Score.min_rank.isnot(None),
            ~Score.college_name.startswith("__省控线__")
        ).group_by(Score.college_code).subquery()

        erben_results = db.query(
            College,
            erben_rank_sub.c.worst_rank_val.label("worst_rank")
        ).join(
            erben_rank_sub, College.code == erben_rank_sub.c.college_code
        ).filter(
            erben_rank_sub.c.worst_rank_val >= rank,
            erben_rank_sub.c.worst_rank_val <= rank * 2.0
        ).order_by(erben_rank_sub.c.worst_rank_val.asc()).limit(6).all()

        erben_list = _build_erben_list(erben_results, db, province, category, batch2_name)

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
        return {"label": "高分段", "desc": "远超本科线，可冲击中流985/强势211", "emoji": "🏆"}
    if yiben_diff >= 50:
        return {"label": "中高分段", "desc": "超本科线较多，选择空间较大", "emoji": "🌟"}
    if yiben_diff >= 20:
        return {"label": "中等偏上", "desc": "超本科线不多，建议在专业和城市之间取舍", "emoji": "📊"}
    if yiben_diff >= 0:
        return {"label": "压线段", "desc": "刚过本科线，需注意滑档风险，做好保底", "emoji": "⚡"}
    if erben_diff is not None and erben_diff >= 0:
        return {"label": "偏低分段", "desc": "未达本科线，关注专科批优质院校", "emoji": "📈"}
    return {"label": "低分段", "desc": "建议关注专科批优势院校和特色专业", "emoji": "📋"}


def _build_erben_list(erben_results, db, province, category, batch_name):
    """构建二批保底院校列表"""
    erben_list = []
    scoring = ScoringService(db)
    for college, worst_rank in erben_results:
        from sqlalchemy import or_
        history = db.query(Score).filter(
            Score.college_code == college.code,
            Score.province == province,
            Score.category == category,
            or_(Score.batch == "本科二批", Score.batch == "本科批"),
            ~Score.college_name.startswith("__省控线__")
        ).order_by(Score.year.desc()).limit(3).all()

        avg_rank = scoring.calculate_avg_rank(history)
        if avg_rank is None:
            avg_rank = worst_rank
        prob, level, _ = scoring.calculate_admission_probability(rank, avg_rank)
        erben_list.append({
            "code": college.code,
            "name": college.name,
            "province": college.province,
            "city": college.city,
            "type": college.type,
            "is_985": college.is_985,
            "is_211": college.is_211,
            "is_double_first": college.is_double_first,
            "latest_rank": worst_rank,
            "probability": round(prob, 2),
            "level": level,
            "margin": rank - worst_rank,
            "batch": batch_name,
            "history": [
                {"year": h.year, "min_score": h.min_score, "min_rank": h.min_rank, "enrollment": h.enrollment}
                for h in history
            ]
        })
    return erben_list


def _generate_tips(position, yiben_diff, chong_count, wen_count, bao_count):
    """生成填报建议"""
    tips = []
    if yiben_diff is not None and yiben_diff >= 0 and yiben_diff < 30:
        tips.append(f"你超本科线仅 {yiben_diff} 分，211 机会有限，建议关注强势双非和中外合办")
    elif yiben_diff is not None and yiben_diff >= 30:
        tips.append(f"你超本科线 {yiben_diff} 分，有一定选择空间")
    if bao_count == 0:
        tips.append("⚠️ 保底院校不足，建议增加保底志愿")
    if chong_count > wen_count * 2:
        tips.append("冲刺院校远多于稳妥院校，建议适当增加稳妥志愿")
    tips.append("稳妥志愿安全余量建议 ≥1500 名")
    tips.append("合理分配冲稳保比例（建议 2:4:4 或 3:4:3）")
    return tips
