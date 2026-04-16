"""
数据模型模块
"""
from .college import College
from .score import Score
from .profile import UserProfile
from .conversation import Conversation, Message
from .score_rank_table import ScoreRankTable

__all__ = ["College", "Score", "UserProfile", "Conversation", "Message", "ScoreRankTable"]
