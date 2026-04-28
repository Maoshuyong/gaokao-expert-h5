# -*- coding: utf-8 -*-
"""
填充省控线数据（control_score）

数据来源：各省教育考试院官方公布（百度百科汇总）
用法：python fill_control_scores.py
"""
import sys
sys.path.insert(0, '.')

from db import SessionLocal
from models import Score
from sqlalchemy import text


# ============================================================
# 11 省 2022-2025 年高考录取最低控制分数线
# 数据来源：各省教育考试院官方公布，百科汇总整理
#
# 注意 2025 年第五批新高考省份的变化：
# - 陕西/四川/河南/山西/内蒙古/云南/宁夏/青海
# - 文理分科 → 物理类/历史类
# - 本科一批+二批 → 合并为"本科批"
# - 新增"特殊类型招生控制线"（可作为原一本线参考）
#
# 存储规则：
# - 2022-2024 年：category 用文科/理科，batch 用本科一批/二批
# - 2025 年（第五批新高考）：category 用文科/理科（保持与历史数据一致，
#   前端通过 normalize_category 映射），batch 用"本科批"
# ============================================================

CONTROL_SCORES = [
    # ===================== 陕西 =====================
    # 2025 年（3+1+2 新高考第一年，合并本科批）
    # 注：2025 年起不再分一本/二本，改为"本科批"；category 保持文科/理科与历史数据一致
    {"year": 2025, "province": "陕西", "category": "文科", "batch": "本科批", "control_score": 414},
    {"year": 2025, "province": "陕西", "category": "文科", "batch": "专科批", "control_score": 200},
    {"year": 2025, "province": "陕西", "category": "理科", "batch": "本科批", "control_score": 394},
    {"year": 2025, "province": "陕西", "category": "理科", "batch": "专科批", "control_score": 200},
    # 2024 年
    {"year": 2024, "province": "陕西", "category": "文科", "batch": "本科一批", "control_score": 488},
    {"year": 2024, "province": "陕西", "category": "文科", "batch": "本科二批", "control_score": 397},
    {"year": 2024, "province": "陕西", "category": "文科", "batch": "专科批", "control_score": 150},
    {"year": 2024, "province": "陕西", "category": "理科", "batch": "本科一批", "control_score": 475},
    {"year": 2024, "province": "陕西", "category": "理科", "batch": "本科二批", "control_score": 372},
    {"year": 2024, "province": "陕西", "category": "理科", "batch": "专科批", "control_score": 150},
    # 2023 年
    {"year": 2023, "province": "陕西", "category": "文科", "batch": "本科一批", "control_score": 489},
    {"year": 2023, "province": "陕西", "category": "文科", "batch": "本科二批", "control_score": 403},
    {"year": 2023, "province": "陕西", "category": "文科", "batch": "专科批", "control_score": 150},
    {"year": 2023, "province": "陕西", "category": "理科", "batch": "本科一批", "control_score": 443},
    {"year": 2023, "province": "陕西", "category": "理科", "batch": "本科二批", "control_score": 336},
    {"year": 2023, "province": "陕西", "category": "理科", "batch": "专科批", "control_score": 150},
    # 2022 年
    {"year": 2022, "province": "陕西", "category": "文科", "batch": "本科一批", "control_score": 484},
    {"year": 2022, "province": "陕西", "category": "文科", "batch": "本科二批", "control_score": 400},
    {"year": 2022, "province": "陕西", "category": "文科", "batch": "专科批", "control_score": 150},
    {"year": 2022, "province": "陕西", "category": "理科", "batch": "本科一批", "control_score": 449},
    {"year": 2022, "province": "陕西", "category": "理科", "batch": "本科二批", "control_score": 344},
    {"year": 2022, "province": "陕西", "category": "理科", "batch": "专科批", "control_score": 150},

    # ===================== 河南 =====================
    # 2025 年（3+1+2 新高考第一年，合并本科批）
    {"year": 2025, "province": "河南", "category": "文科", "batch": "本科批", "control_score": 471},
    {"year": 2025, "province": "河南", "category": "文科", "batch": "专科批", "control_score": 185},
    {"year": 2025, "province": "河南", "category": "理科", "batch": "本科批", "control_score": 427},
    {"year": 2025, "province": "河南", "category": "理科", "batch": "专科批", "control_score": 185},
    # 2024 年
    {"year": 2024, "province": "河南", "category": "文科", "batch": "本科一批", "control_score": 521},
    {"year": 2024, "province": "河南", "category": "文科", "batch": "本科二批", "control_score": 428},
    {"year": 2024, "province": "河南", "category": "文科", "batch": "专科批", "control_score": 185},
    {"year": 2024, "province": "河南", "category": "理科", "batch": "本科一批", "control_score": 511},
    {"year": 2024, "province": "河南", "category": "理科", "batch": "本科二批", "control_score": 396},
    {"year": 2024, "province": "河南", "category": "理科", "batch": "专科批", "control_score": 185},
    # 2023 年
    {"year": 2023, "province": "河南", "category": "文科", "batch": "本科一批", "control_score": 547},
    {"year": 2023, "province": "河南", "category": "文科", "batch": "本科二批", "control_score": 465},
    {"year": 2023, "province": "河南", "category": "文科", "batch": "专科批", "control_score": 185},
    {"year": 2023, "province": "河南", "category": "理科", "batch": "本科一批", "control_score": 514},
    {"year": 2023, "province": "河南", "category": "理科", "batch": "本科二批", "control_score": 409},
    {"year": 2023, "province": "河南", "category": "理科", "batch": "专科批", "control_score": 185},
    # 2022 年
    {"year": 2022, "province": "河南", "category": "文科", "batch": "本科一批", "control_score": 527},
    {"year": 2022, "province": "河南", "category": "文科", "batch": "本科二批", "control_score": 445},
    {"year": 2022, "province": "河南", "category": "文科", "batch": "专科批", "control_score": 190},
    {"year": 2022, "province": "河南", "category": "理科", "batch": "本科一批", "control_score": 509},
    {"year": 2022, "province": "河南", "category": "理科", "batch": "本科二批", "control_score": 405},
    {"year": 2022, "province": "河南", "category": "理科", "batch": "专科批", "control_score": 190},

    # ===================== 四川 =====================
    # 2025 年（3+1+2 新高考第一年，合并本科批）
    {"year": 2025, "province": "四川", "category": "文科", "batch": "本科批", "control_score": 467},
    {"year": 2025, "province": "四川", "category": "文科", "batch": "专科批", "control_score": 150},
    {"year": 2025, "province": "四川", "category": "理科", "batch": "本科批", "control_score": 438},
    {"year": 2025, "province": "四川", "category": "理科", "batch": "专科批", "control_score": 150},
    # 2024 年
    {"year": 2024, "province": "四川", "category": "文科", "batch": "本科一批", "control_score": 529},
    {"year": 2024, "province": "四川", "category": "文科", "batch": "本科二批", "control_score": 457},
    {"year": 2024, "province": "四川", "category": "文科", "batch": "专科批", "control_score": 150},
    {"year": 2024, "province": "四川", "category": "理科", "batch": "本科一批", "control_score": 539},
    {"year": 2024, "province": "四川", "category": "理科", "batch": "本科二批", "control_score": 459},
    {"year": 2024, "province": "四川", "category": "理科", "batch": "专科批", "control_score": 150},
    # 2023 年
    {"year": 2023, "province": "四川", "category": "文科", "batch": "本科一批", "control_score": 527},
    {"year": 2023, "province": "四川", "category": "文科", "batch": "本科二批", "control_score": 458},
    {"year": 2023, "province": "四川", "category": "文科", "batch": "专科批", "control_score": 150},
    {"year": 2023, "province": "四川", "category": "理科", "batch": "本科一批", "control_score": 520},
    {"year": 2023, "province": "四川", "category": "理科", "batch": "本科二批", "control_score": 433},
    {"year": 2023, "province": "四川", "category": "理科", "batch": "专科批", "control_score": 150},
    # 2022 年
    {"year": 2022, "province": "四川", "category": "文科", "batch": "本科一批", "control_score": 538},
    {"year": 2022, "province": "四川", "category": "文科", "batch": "本科二批", "control_score": 466},
    {"year": 2022, "province": "四川", "category": "文科", "batch": "专科批", "control_score": 150},
    {"year": 2022, "province": "四川", "category": "理科", "batch": "本科一批", "control_score": 515},
    {"year": 2022, "province": "四川", "category": "理科", "batch": "本科二批", "control_score": 426},
    {"year": 2022, "province": "四川", "category": "理科", "batch": "专科批", "control_score": 150},

    # ===================== 安徽 =====================
    # 2025 年（3+1+2 新高考第二年，合并本科批）
    {"year": 2025, "province": "安徽", "category": "文科", "batch": "本科批", "control_score": 477},
    {"year": 2025, "province": "安徽", "category": "文科", "batch": "专科批", "control_score": 200},
    {"year": 2025, "province": "安徽", "category": "理科", "batch": "本科批", "control_score": 461},
    {"year": 2025, "province": "安徽", "category": "理科", "batch": "专科批", "control_score": 200},
    # 2024 年（3+1+2 新高考第一年，分物理类/历史类，但有本科一批/二批）
    {"year": 2024, "province": "安徽", "category": "文科", "batch": "本科一批", "control_score": 512},
    {"year": 2024, "province": "安徽", "category": "文科", "batch": "本科二批", "control_score": 462},
    {"year": 2024, "province": "安徽", "category": "文科", "batch": "专科批", "control_score": 200},
    {"year": 2024, "province": "安徽", "category": "理科", "batch": "本科一批", "control_score": 514},
    {"year": 2024, "province": "安徽", "category": "理科", "batch": "本科二批", "control_score": 465},
    {"year": 2024, "province": "安徽", "category": "理科", "batch": "专科批", "control_score": 200},
    # 2023 年
    {"year": 2023, "province": "安徽", "category": "文科", "batch": "本科一批", "control_score": 495},
    {"year": 2023, "province": "安徽", "category": "文科", "batch": "本科二批", "control_score": 440},
    {"year": 2023, "province": "安徽", "category": "文科", "batch": "专科批", "control_score": 200},
    {"year": 2023, "province": "安徽", "category": "理科", "batch": "本科一批", "control_score": 482},
    {"year": 2023, "province": "安徽", "category": "理科", "batch": "本科二批", "control_score": 427},
    {"year": 2023, "province": "安徽", "category": "理科", "batch": "专科批", "control_score": 200},
    # 2022 年
    {"year": 2022, "province": "安徽", "category": "文科", "batch": "本科一批", "control_score": 523},
    {"year": 2022, "province": "安徽", "category": "文科", "batch": "本科二批", "control_score": 480},
    {"year": 2022, "province": "安徽", "category": "文科", "batch": "专科批", "control_score": 200},
    {"year": 2022, "province": "安徽", "category": "理科", "batch": "本科一批", "control_score": 491},
    {"year": 2022, "province": "安徽", "category": "理科", "batch": "本科二批", "control_score": 435},
    {"year": 2022, "province": "安徽", "category": "理科", "batch": "专科批", "control_score": 200},

    # ===================== 湖北 =====================
    # 2025 年
    {"year": 2025, "province": "湖北", "category": "历史类", "batch": "本科批", "control_score": 442},
    {"year": 2025, "province": "湖北", "category": "历史类", "batch": "专科批", "control_score": 200},
    {"year": 2025, "province": "湖北", "category": "物理类", "batch": "本科批", "control_score": 426},
    {"year": 2025, "province": "湖北", "category": "物理类", "batch": "专科批", "control_score": 200},
    # 2024 年（3+1+2 新高考，合并本科批，特殊类型线作为"一本"参考）
    {"year": 2024, "province": "湖北", "category": "历史类", "batch": "本科批", "control_score": 432},
    {"year": 2024, "province": "湖北", "category": "历史类", "batch": "专科批", "control_score": 200},
    {"year": 2024, "province": "湖北", "category": "物理类", "batch": "本科批", "control_score": 437},
    {"year": 2024, "province": "湖北", "category": "物理类", "batch": "专科批", "control_score": 200},
    # 2023 年
    {"year": 2023, "province": "湖北", "category": "历史类", "batch": "本科批", "control_score": 426},
    {"year": 2023, "province": "湖北", "category": "历史类", "batch": "专科批", "control_score": 200},
    {"year": 2023, "province": "湖北", "category": "物理类", "batch": "本科批", "control_score": 424},
    {"year": 2023, "province": "湖北", "category": "物理类", "batch": "专科批", "control_score": 200},
    # 2022 年
    {"year": 2022, "province": "湖北", "category": "历史类", "batch": "本科批", "control_score": 435},
    {"year": 2022, "province": "湖北", "category": "历史类", "batch": "专科批", "control_score": 200},
    {"year": 2022, "province": "湖北", "category": "物理类", "batch": "本科批", "control_score": 409},
    {"year": 2022, "province": "湖北", "category": "物理类", "batch": "专科批", "control_score": 200},

    # ===================== 湖南 =====================
    # 2025 年
    {"year": 2025, "province": "湖南", "category": "历史类", "batch": "本科批", "control_score": 446},
    {"year": 2025, "province": "湖南", "category": "历史类", "batch": "专科批", "control_score": 200},
    {"year": 2025, "province": "湖南", "category": "物理类", "batch": "本科批", "control_score": 405},
    {"year": 2025, "province": "湖南", "category": "物理类", "batch": "专科批", "control_score": 200},
    # 2024 年
    {"year": 2024, "province": "湖南", "category": "历史类", "batch": "本科批", "control_score": 438},
    {"year": 2024, "province": "湖南", "category": "历史类", "batch": "专科批", "control_score": 200},
    {"year": 2024, "province": "湖南", "category": "物理类", "batch": "本科批", "control_score": 422},
    {"year": 2024, "province": "湖南", "category": "物理类", "batch": "专科批", "control_score": 200},
    # 2023 年
    {"year": 2023, "province": "湖南", "category": "历史类", "batch": "本科批", "control_score": 428},
    {"year": 2023, "province": "湖南", "category": "历史类", "batch": "专科批", "control_score": 200},
    {"year": 2023, "province": "湖南", "category": "物理类", "batch": "本科批", "control_score": 415},
    {"year": 2023, "province": "湖南", "category": "物理类", "batch": "专科批", "control_score": 200},
    # 2022 年
    {"year": 2022, "province": "湖南", "category": "历史类", "batch": "本科批", "control_score": 451},
    {"year": 2022, "province": "湖南", "category": "历史类", "batch": "专科批", "control_score": 200},
    {"year": 2022, "province": "湖南", "category": "物理类", "batch": "本科批", "control_score": 414},
    {"year": 2022, "province": "湖南", "category": "物理类", "batch": "专科批", "control_score": 200},

    # ===================== 广东 =====================
    # 2025 年
    {"year": 2025, "province": "广东", "category": "历史类", "batch": "本科批", "control_score": 464},
    {"year": 2025, "province": "广东", "category": "历史类", "batch": "专科批", "control_score": 215},
    {"year": 2025, "province": "广东", "category": "物理类", "batch": "本科批", "control_score": 436},
    {"year": 2025, "province": "广东", "category": "物理类", "batch": "专科批", "control_score": 200},
    # 2024 年
    {"year": 2024, "province": "广东", "category": "历史类", "batch": "本科批", "control_score": 428},
    {"year": 2024, "province": "广东", "category": "历史类", "batch": "专科批", "control_score": 200},
    {"year": 2024, "province": "广东", "category": "物理类", "batch": "本科批", "control_score": 442},
    {"year": 2024, "province": "广东", "category": "物理类", "batch": "专科批", "control_score": 200},
    # 2023 年
    {"year": 2023, "province": "广东", "category": "历史类", "batch": "本科批", "control_score": 433},
    {"year": 2023, "province": "广东", "category": "历史类", "batch": "专科批", "control_score": 180},
    {"year": 2023, "province": "广东", "category": "物理类", "batch": "本科批", "control_score": 439},
    {"year": 2023, "province": "广东", "category": "物理类", "batch": "专科批", "control_score": 180},
    # 2022 年
    {"year": 2022, "province": "广东", "category": "历史类", "batch": "本科批", "control_score": 437},
    {"year": 2022, "province": "广东", "category": "历史类", "batch": "专科批", "control_score": 180},
    {"year": 2022, "province": "广东", "category": "物理类", "batch": "本科批", "control_score": 445},
    {"year": 2022, "province": "广东", "category": "物理类", "batch": "专科批", "control_score": 180},

    # ===================== 江苏 =====================
    # 2025 年
    {"year": 2025, "province": "江苏", "category": "历史类", "batch": "本科批", "control_score": 482},
    {"year": 2025, "province": "江苏", "category": "历史类", "batch": "专科批", "control_score": 220},
    {"year": 2025, "province": "江苏", "category": "物理类", "batch": "本科批", "control_score": 463},
    {"year": 2025, "province": "江苏", "category": "物理类", "batch": "专科批", "control_score": 220},
    # 2024 年
    {"year": 2024, "province": "江苏", "category": "历史类", "batch": "本科批", "control_score": 478},
    {"year": 2024, "province": "江苏", "category": "历史类", "batch": "专科批", "control_score": 220},
    {"year": 2024, "province": "江苏", "category": "物理类", "batch": "本科批", "control_score": 462},
    {"year": 2024, "province": "江苏", "category": "物理类", "batch": "专科批", "control_score": 220},
    # 2023 年
    {"year": 2023, "province": "江苏", "category": "历史类", "batch": "本科批", "control_score": 474},
    {"year": 2023, "province": "江苏", "category": "历史类", "batch": "专科批", "control_score": 220},
    {"year": 2023, "province": "江苏", "category": "物理类", "batch": "本科批", "control_score": 448},
    {"year": 2023, "province": "江苏", "category": "物理类", "batch": "专科批", "control_score": 220},
    # 2022 年
    {"year": 2022, "province": "江苏", "category": "历史类", "batch": "本科批", "control_score": 471},
    {"year": 2022, "province": "江苏", "category": "历史类", "batch": "专科批", "control_score": 220},
    {"year": 2022, "province": "江苏", "category": "物理类", "batch": "本科批", "control_score": 429},
    {"year": 2022, "province": "江苏", "category": "物理类", "batch": "专科批", "control_score": 220},

    # ===================== 河北 =====================
    # 2025 年
    {"year": 2025, "province": "河北", "category": "历史类", "batch": "本科批", "control_score": 477},
    {"year": 2025, "province": "河北", "category": "历史类", "batch": "专科批", "control_score": 200},
    {"year": 2025, "province": "河北", "category": "物理类", "batch": "本科批", "control_score": 459},
    {"year": 2025, "province": "河北", "category": "物理类", "batch": "专科批", "control_score": 200},
    # 2024 年
    {"year": 2024, "province": "河北", "category": "历史类", "batch": "本科批", "control_score": 449},
    {"year": 2024, "province": "河北", "category": "历史类", "batch": "专科批", "control_score": 200},
    {"year": 2024, "province": "河北", "category": "物理类", "batch": "本科批", "control_score": 448},
    {"year": 2024, "province": "河北", "category": "物理类", "batch": "专科批", "control_score": 200},
    # 2023 年
    {"year": 2023, "province": "河北", "category": "历史类", "batch": "本科批", "control_score": 430},
    {"year": 2023, "province": "河北", "category": "历史类", "batch": "专科批", "control_score": 200},
    {"year": 2023, "province": "河北", "category": "物理类", "batch": "本科批", "control_score": 439},
    {"year": 2023, "province": "河北", "category": "物理类", "batch": "专科批", "control_score": 200},
    # 2022 年
    {"year": 2022, "province": "河北", "category": "历史类", "batch": "本科批", "control_score": 443},
    {"year": 2022, "province": "河北", "category": "历史类", "batch": "专科批", "control_score": 200},
    {"year": 2022, "province": "河北", "category": "物理类", "batch": "本科批", "control_score": 430},
    {"year": 2022, "province": "河北", "category": "物理类", "batch": "专科批", "control_score": 200},

    # ===================== 山东 =====================
    # 2025 年（3+3，综合）
    {"year": 2025, "province": "山东", "category": "综合", "batch": "普通类一段", "control_score": 441},
    {"year": 2025, "province": "山东", "category": "综合", "batch": "普通类二段", "control_score": 150},
    # 2024 年（3+3，综合）
    {"year": 2024, "province": "山东", "category": "综合", "batch": "普通类一段", "control_score": 444},
    {"year": 2024, "province": "山东", "category": "综合", "batch": "普通类二段", "control_score": 150},
    {"year": 2024, "province": "山东", "category": "综合", "batch": "提前批", "control_score": 444},
    # 2023 年
    {"year": 2023, "province": "山东", "category": "综合", "batch": "普通类一段", "control_score": 443},
    {"year": 2023, "province": "山东", "category": "综合", "batch": "普通类二段", "control_score": 150},
    {"year": 2023, "province": "山东", "category": "综合", "batch": "提前批", "control_score": 443},
    # 2022 年
    {"year": 2022, "province": "山东", "category": "综合", "batch": "普通类一段", "control_score": 437},
    {"year": 2022, "province": "山东", "category": "综合", "batch": "普通类二段", "control_score": 150},
    {"year": 2022, "province": "山东", "category": "综合", "batch": "提前批", "control_score": 437},

    # ===================== 浙江 =====================
    # 2025 年（3+3，综合）
    {"year": 2025, "province": "浙江", "category": "综合", "batch": "普通类一段", "control_score": 490},
    {"year": 2025, "province": "浙江", "category": "综合", "batch": "普通类二段", "control_score": 268},
    # 2024 年（3+3，综合）
    {"year": 2024, "province": "浙江", "category": "综合", "batch": "平行录取一段", "control_score": 492},
    {"year": 2024, "province": "浙江", "category": "综合", "batch": "平行录取二段", "control_score": 269},
    {"year": 2024, "province": "浙江", "category": "综合", "batch": "普通类提前批", "control_score": 492},
    {"year": 2024, "province": "浙江", "category": "综合", "batch": "普通类平行录取", "control_score": 492},
    {"year": 2024, "province": "浙江", "category": "综合", "batch": "普通类一段", "control_score": 492},
    # 2023 年
    {"year": 2023, "province": "浙江", "category": "综合", "batch": "平行录取一段", "control_score": 488},
    {"year": 2023, "province": "浙江", "category": "综合", "batch": "平行录取二段", "control_score": 274},
    {"year": 2023, "province": "浙江", "category": "综合", "batch": "普通类提前批", "control_score": 488},
    {"year": 2023, "province": "浙江", "category": "综合", "batch": "普通类平行录取", "control_score": 488},
    {"year": 2023, "province": "浙江", "category": "综合", "batch": "普通类一段", "control_score": 488},
    # 2022 年
    {"year": 2022, "province": "浙江", "category": "综合", "batch": "平行录取一段", "control_score": 497},
    {"year": 2022, "province": "浙江", "category": "综合", "batch": "平行录取二段", "control_score": 280},
    {"year": 2022, "province": "浙江", "category": "综合", "batch": "普通类提前批", "control_score": 497},
    {"year": 2022, "province": "浙江", "category": "综合", "batch": "普通类平行录取", "control_score": 497},
    {"year": 2022, "province": "浙江", "category": "综合", "batch": "普通类一段", "control_score": 497},
]


def fill_control_scores():
    """批量更新省控线到 scores 表中对应批次的记录"""
    db = SessionLocal()
    updated = 0
    inserted = 0
    not_found = []

    for cs in CONTROL_SCORES:
        rows = db.query(Score).filter(
            Score.province == cs["province"],
            Score.year == cs["year"],
            Score.category == cs["category"],
            Score.batch == cs["batch"],
        ).all()

        if rows:
            # 找到匹配记录，更新 control_score
            for row in rows:
                row.control_score = cs["control_score"]
            updated += len(rows)
            print(f"  ✅ {cs['year']} {cs['province']} {cs['category']} {cs['batch']}: {cs['control_score']}分 (更新{len(rows)}条)")
        else:
            # 无匹配记录（如 2025 年还没有投档线数据），创建省控线专用记录
            # 用特殊 college_name 标记为省控线数据
            placeholder = Score(
                college_name=f"__省控线__{cs['province']}_{cs['category']}_{cs['batch']}",
                college_code="000000",
                year=cs["year"],
                province=cs["province"],
                batch=cs["batch"],
                category=cs["category"],
                min_score=None,
                min_rank=None,
                control_score=cs["control_score"],
                note="省控线专用记录（由 fill_control_scores.py 自动创建）",
            )
            db.add(placeholder)
            inserted += 1
            print(f"  ➕ {cs['year']} {cs['province']} {cs['category']} {cs['batch']}: {cs['control_score']}分 (新建)")

    db.commit()
    print(f"\n✅ 共更新 {updated} 条，新建 {inserted} 条省控线记录")

    if not_found:
        print(f"\n⚠️ {len(not_found)} 个组合未找到匹配记录:")
        for nf in not_found:
            print(nf)

    # 验证：按省统计 control_score 覆盖情况
    print("\n📊 省控线覆盖验证:")
    provinces = ["陕西", "河南", "四川", "湖北", "湖南", "广东", "江苏", "河北", "安徽", "山东", "浙江"]
    for prov in provinces:
        for year in [2025, 2024, 2023, 2022]:
            total = db.query(Score).filter(Score.province == prov, Score.year == year).count()
            filled = db.query(Score).filter(
                Score.province == prov, Score.year == year, Score.control_score.isnot(None)
            ).count()
            pct = filled / total * 100 if total > 0 else 0
            status = "✅" if pct >= 80 else "⚠️" if pct > 0 else "❌"
            if year == 2025 or total > 0:
                print(f"  {status} {prov} {year}: {filled}/{total} ({pct:.1f}%)")

    db.close()


if __name__ == "__main__":
    fill_control_scores()
