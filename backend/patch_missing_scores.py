# -*- coding: utf-8 -*-
"""
定向补爬遗漏院校的分数线数据

针对已知在陕西（或其他省份）缺少 Score 记录的院校进行补爬。
用法：python patch_missing_scores.py
"""
import sys
import os
import time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import requests
from db import SessionLocal, init_db
from models import College, Score
from urllib.parse import quote

BASE_URL = "https://gaokao.baidu.com/gk/gkschool"

PROVINCE_CURRICULUM = {
    "陕西": ["文科", "理科"],
    "河南": ["文科", "理科"],
    "四川": ["文科", "理科"],
    "安徽": ["文科", "理科"],
    "广东": ["物理类", "历史类"],
    "湖北": ["物理类", "历史类"],
    "河北": ["物理类", "历史类"],
    "江苏": ["物理类", "历史类"],
    "湖南": ["物理类", "历史类"],
    "浙江": ["综合"],
    "山东": ["综合"],
}

CURRICULUM_API_MAP = {
    # 百度 API 的 curriculum 参数：传统高考用文科/理科，新高考用物理类/历史类
    "文科": "文科", "理科": "理科",
    "物理类": "物理类", "历史类": "历史类",
    "综合": "综合",
}

# 要补爬的省份（主目标陕西，也顺带检查其他省份）
TARGET_PROVINCES = ["陕西", "河南", "四川", "安徽", "湖北", "湖南", "广东", "江苏", "河北"]
YEAR_RANGE = range(2022, 2025)  # 2022-2024

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
    "Referer": "https://gaokao.baidu.com/",
})


def fetch_school_score(school_name, province, year, curriculum):
    url = (
        f"{BASE_URL}/schoolscore"
        f"?curriculum={quote(curriculum)}"
        f"&school={quote(school_name)}"
        f"&province={quote(province)}"
        f"&year={year}"
    )
    for attempt in range(3):
        try:
            resp = session.get(url, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            if data.get("errno") != 0:
                return None
            return data.get("data", {}).get("school_score", {}).get("dataList", [])
        except Exception as e:
            if attempt < 2:
                time.sleep((attempt + 1) * 2)
    return None


def safe_int(v):
    try:
        return int(str(v).replace(',', '').strip())
    except:
        return None


def patch_missing():
    init_db()
    db = SessionLocal()

    # 1. 找出所有 985/211 院校在目标省份缺少 Score 数据的情况
    colleges = db.query(College).filter(
        (College.is_985 == True) | (College.is_211 == True)
    ).all()

    missing_tasks = []  # (college, province) 需要补爬的组合

    for college in colleges:
        for province in TARGET_PROVINCES:
            count = db.query(Score).filter(
                Score.college_name == college.name,
                Score.province == province,
            ).count()
            if count == 0:
                missing_tasks.append((college, province))

    print(f"=== 发现 {len(missing_tasks)} 个院校×省份组合需要补爬 ===")
    if not missing_tasks:
        db.close()
        return

    # 提取名称列表（避免 SQLAlchemy session detached 问题）
    task_names = [(college.name, province) for college, province in missing_tasks]

    # 显示前 30 个
    for name, province in task_names[:30]:
        print(f"  {name} × {province}")
    if len(task_names) > 30:
        print(f"  ... 还有 {len(task_names) - 30} 个")

    # 2. 逐个补爬
    total_added = 0
    total_errors = 0

    for idx, (college, province) in enumerate(missing_tasks, 1):
        # 保存名称避免 detached
        college_name = college.name
        college_id = college.id
        college_code = college.code
        curricula = PROVINCE_CURRICULUM.get(province, ["文科", "理科"])

        for curriculum in curricula:
            api_curriculum = CURRICULUM_API_MAP.get(curriculum, curriculum)

            for year in YEAR_RANGE:
                scores = fetch_school_score(college.name, province, year, api_curriculum)
                time.sleep(0.5)

                if not scores:
                    continue

                for score in scores:
                    score_year = score.get("year", "")
                    if str(score_year) != str(year):
                        continue

                    # 检查是否已存在
                    existing = db.query(Score).filter(
                        Score.college_name == college_name,
                        Score.province == province,
                        Score.year == int(score_year),
                        Score.category == curriculum,
                        Score.batch == score.get("batchName", ""),
                    ).first()

                    if existing:
                        continue

                    new_score = Score(
                        college_id=college_id,
                        college_code=college_code,
                        college_name=college_name,
                        year=int(score_year),
                        province=province,
                        batch=score.get("batchName", ""),
                        category=curriculum,
                        min_score=safe_int(score.get("minScore")),
                        min_rank=safe_int(score.get("minScoreOrder")),
                        enrollment=safe_int(score.get("enrollNum")),
                        control_score=safe_int(score.get("controlScore")),
                    )

                    db.add(new_score)
                    total_added += 1

                if (idx - 1) % 10 == 0:
                    db.commit()

        if idx % 20 == 0:
            db.commit()
            print(f"  [{idx}/{len(missing_tasks)}] 已处理 {idx} 个组合，累计 +{total_added} 条")

    db.commit()
    db.close()

    print(f"\n=== 补爬完成！共新增 {total_added} 条分数线数据 ===")

    # 3. 验证
    db2 = SessionLocal()
    for college_name, province in task_names[:10]:
        count = db2.query(Score).filter(
            Score.college_name == college_name,
            Score.province == province,
        ).count()
        status = "✅" if count > 0 else "❌"
        print(f"  {status} {college_name} × {province}: {count} 条")
    db2.close()


if __name__ == "__main__":
    patch_missing()
