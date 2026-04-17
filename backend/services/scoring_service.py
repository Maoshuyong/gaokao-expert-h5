"""
录取概率计算服务

核心逻辑：
  rank_ratio = user_rank / historical_avg_rank
  位次越小越好，所以：
  - ratio < 1: 考生位次优于院校录取位次 → 高概率（保底/稳妥）
  - ratio ≈ 1: 位次接近 → 冲刺/稳妥
  - ratio > 1: 考生位次劣于院校录取位次 → 低概率（不建议）
"""
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from models import Score, College
import logging
import math

logger = logging.getLogger(__name__)


class ScoringService:
    """录取概率计算服务"""

    # 档位阈值（rank_ratio 区间）
    # 位次越小越好：ratio < 1 表示考生位次更高（更好）
    LEVEL_THRESHOLDS = {
        "冲刺":   (0.80, 1.05),   # 考生位次是院校录取位次的 80%~105%，可以冲一冲
        "稳妥":   (0.55, 0.80),   # 考生位次是院校录取位次的 55%~80%，比较稳
        "保底":   (0.01, 0.55),   # 考生位次远低于院校录取位次，稳上（含极端高分）
        "不建议": (1.05, 999.0),  # 考生位次高于院校录取位次 5% 以上，录取困难
    }

    # 概率区间（用于在阈值区间内线性插值）
    LEVEL_PROBABILITIES = {
        "冲刺":   (0.20, 0.55),   # 冲刺院校录取概率 20%~55%
        "稳妥":   (0.60, 0.85),   # 稳妥院校录取概率 60%~85%
        "保底":   (0.85, 0.98),   # 保底院校录取概率 85%~98%
        "不建议": (0.02, 0.18),   # 不建议院校录取概率 2%~18%
    }

    def __init__(self, db: Session):
        self.db = db

    def get_historical_scores(
        self,
        college_code: str,
        province: str,
        year: int,
        category: str
    ) -> List[Score]:
        """获取历史录取数据"""
        return self.db.query(Score).filter(
            Score.college_code == college_code,
            Score.province == province,
            Score.year <= year,
            Score.category == category
        ).order_by(Score.year.desc()).limit(5).all()

    def calculate_avg_rank(self, scores: List[Score]) -> Optional[float]:
        """计算历史排名均值（取最差年份的位次，作为保守估计）"""
        if not scores:
            return None

        valid_ranks = [s.min_rank for s in scores if s.min_rank]
        if not valid_ranks:
            return None

        # 使用最差年份（位次最大值）作为基准，避免趋势外推陷阱
        # 这符合"历史趋势外推不可靠，稳妥线要按最坏年份位次定"的经验
        worst_rank = max(valid_ranks)

        # 如果有多年数据，取加权平均但偏向最差年份
        if len(valid_ranks) > 1:
            # 给最差年份额外权重
            avg = sum(valid_ranks) / len(valid_ranks)
            return avg * 0.4 + worst_rank * 0.6  # 偏保守
        return worst_rank

    def calculate_admission_probability(
        self,
        user_rank: int,
        historical_avg_rank: float,
    ) -> Tuple[float, str, str]:
        """
        计算录取概率

        Args:
            user_rank: 用户排名（越小越好）
            historical_avg_rank: 历史排名均值/最差值（越小越好）

        Returns:
            (概率, 档位, 说明)
        """
        if not historical_avg_rank or historical_avg_rank <= 0:
            return 0.0, "数据不足", "缺少历史录取位次数据"

        # 计算排名比值
        # ratio < 1: 考生位次更优（位次数字更小）→ 概率高
        # ratio > 1: 考生位次更差（位次数字更大）→ 概率低
        rank_ratio = user_rank / historical_avg_rank

        # 极端高分段（ratio 极小，远超院校门槛）
        if rank_ratio < 0.01:
            return 0.99, "保底", "位次远优于该院校历史录取线，录取概率极高"

        # 判断档位
        for level, (low, high) in self.LEVEL_THRESHOLDS.items():
            if low <= rank_ratio < high:
                prob_low, prob_high = self.LEVEL_PROBABILITIES[level]

                # 在区间内线性插值
                if high > low:
                    t = (rank_ratio - low) / (high - low)
                else:
                    t = 0.5

                # 对于"冲刺"和"稳妥"，ratio 越小（位次越优），概率越高
                # 对于"不建议"，ratio 越大（位次越差），概率越低
                if level == "冲刺":
                    probability = prob_high - t * (prob_high - prob_low)
                elif level == "稳妥":
                    probability = prob_high - t * (prob_high - prob_low)
                elif level == "保底":
                    probability = prob_high - t * (prob_high - prob_low)
                else:  # 不建议
                    probability = prob_low + t * (prob_high - prob_low)

                probability = max(0.0, min(1.0, probability))

                explanation = self._get_explanation(level, rank_ratio, historical_avg_rank)
                return round(probability, 2), level, explanation

        # 超出所有区间（理论上不应发生，所有正 ratio 均已被覆盖）
        return 0.01, "不建议", "位次远低于该院校历史录取线，录取风险极大"

    def _get_explanation(self, level: str, rank_ratio: float, hist_rank: float) -> str:
        """生成说明"""
        ratio = round(rank_ratio, 2)
        user_desc = f"您的位次约为历史录取位次的{ratio:.0%}"
        explanations = {
            "冲刺": f"{user_desc}，有一定冲刺空间，建议作为冲刺志愿",
            "稳妥": f"{user_desc}，录取概率较高，建议作为核心志愿",
            "保底": f"{user_desc}，作为保底院校较为稳妥",
            "不建议": f"{user_desc}，录取概率较低，建议谨慎考虑"
        }
        return explanations.get(level, "")

    def batch_calculate_probability(
        self,
        user_rank: int,
        college_codes: List[str],
        province: str,
        year: int,
        category: str
    ) -> List[Dict]:
        """批量计算多所院校的概率"""
        results = []
        for code in college_codes:
            scores = self.get_historical_scores(code, province, year, category)
            if not scores:
                results.append({
                    "college_code": code,
                    "probability": None,
                    "level": "数据不足",
                    "explanation": "历史数据不足"
                })
                continue

            avg_rank = self.calculate_avg_rank(scores)
            prob, level, explanation = self.calculate_admission_probability(
                user_rank, avg_rank
            )
            results.append({
                "college_code": code,
                "probability": prob,
                "level": level,
                "explanation": explanation,
                "historical_data": {
                    "years": [s.year for s in scores],
                    "avg_rank": round(avg_rank, 0) if avg_rank else None
                }
            })

        return results
