"""
录取概率计算服务
"""
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from models import Score, College
import logging

logger = logging.getLogger(__name__)


class ScoringService:
    """录取概率计算服务"""

    # 档位阈值
    LEVEL_THRESHOLDS = {
        "冲刺": (0, 0.90),      # 排名/历史均值 < 0.90
        "稳妥": (0.90, 1.05),   # 0.90 <= 排名/历史均值 < 1.05
        "保底": (1.05, 1.20),    # 1.05 <= 排名/历史均值 < 1.20
        "不建议": (1.20, 999.0)  # >= 1.20
    }

    # 概率区间
    LEVEL_PROBABILITIES = {
        "冲刺": (0.15, 0.55),
        "稳妥": (0.55, 0.85),
        "保底": (0.85, 0.98),
        "不建议": (0, 0.15)
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
        """计算历史排名均值"""
        if not scores:
            return None

        valid_ranks = [s.min_rank for s in scores if s.min_rank]
        if not valid_ranks:
            return None

        # 加权平均（近年权重更高）
        weights = [1 + 0.2 * (len(scores) - i) for i in range(len(valid_ranks))]
        total_weight = sum(weights)
        weighted_avg = sum(r * w for r, w in zip(valid_ranks, weights)) / total_weight

        return weighted_avg

    def calculate_admission_probability(
        self,
        user_rank: int,
        historical_avg_rank: float,
        volatility: float = 0.05
    ) -> Tuple[float, str, str]:
        """
        计算录取概率

        Args:
            user_rank: 用户排名
            historical_avg_rank: 历史排名均值
            volatility: 波动修正

        Returns:
            (概率, 档位, 说明)
        """
        # 计算排名比值
        rank_ratio = user_rank / historical_avg_rank if historical_avg_rank else 0

        # 判断档位
        for level, (low, high) in self.LEVEL_THRESHOLDS.items():
            if low <= rank_ratio < high:
                prob_low, prob_high = self.LEVEL_PROBABILITIES[level]
                base_prob = (prob_low + prob_high) / 2

                # 根据波动修正概率（仅在小范围内修正）
                mid = (low + high) / 2
                deviation = rank_ratio - mid
                range_width = high - low
                # 归一化偏差，限制在 [-1, 1] 范围内
                normalized_dev = max(-1.0, min(1.0, deviation / (range_width / 2)))
                probability = base_prob - volatility * normalized_dev * base_prob

                # 确保 probability 在 [0, 1] 范围内
                probability = max(0.0, min(1.0, probability))

                explanation = self._get_explanation(level, rank_ratio)
                return round(probability, 2), level, explanation

        # 超出范围
        if rank_ratio <= 0:
            return 0.99, "保底", "排名远高于院校录取线，录取概率极高"
        return 0.01, "不建议", "排名低于院校录取线，录取风险极大"

    def _get_explanation(self, level: str, rank_ratio: float) -> str:
        """生成说明"""
        ratio = round(rank_ratio, 2)
        explanations = {
            "冲刺": f"排名略高于院校历史录取线(比率{ratio:.2f})，有一定冲刺空间",
            "稳妥": f"排名处于院校录取区间内(比率{ratio:.2f})，录取概率较高",
            "保底": f"排名明显高于院校录取线(比率{ratio:.2f})，作为保底院校",
            "不建议": f"排名低于院校录取线(比率{ratio:.2f})，录取风险较大"
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
