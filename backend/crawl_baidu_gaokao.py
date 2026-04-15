# -*- coding: utf-8 -*-
"""
从百度高考 API 爬取真实录取数据并导入 gaokao.db

数据来源：https://gaokao.baidu.com/gk/gkschool/schoolscore
基于 sjzy23/gaokao 方案，针对我们的数据库结构定制

用法：
    # 爬取陕西省数据（2022-2024，文理）
    python crawl_baidu_gaokao.py

    # 爬取指定省份
    python crawl_baidu_gaokao.py --province 陕西 北京 上海

    # 指定年份范围
    python crawl_baidu_gaokao.py --year-start 2020 --year-end 2025

    # 仅爬取院校列表（不爬分数线）
    python crawl_baidu_gaokao.py --schools-only

    # 仅爬取分数线（使用已有的院校列表）
    python crawl_baidu_gaokao.py --scores-only
"""

import argparse
import csv
import json
import os
import sys
import time
from datetime import datetime
from urllib.parse import quote

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import SessionLocal, init_db
from models import College, Score

# ============================================================
# 配置
# ============================================================

BASE_URL = "https://gaokao.baidu.com/gk/gkschool"

# 默认配置
DEFAULT_PROVINCES = ["陕西"]
DEFAULT_YEAR_START = 2022
DEFAULT_YEAR_END = 2025
REQUEST_DELAY = 0.8  # 请求间隔（秒），防止被封
MAX_RETRIES = 3

# 陕西省是传统高考，文理分科
# 新高考省份使用 "物理类" / "历史类" 或 "综合"
PROVINCE_CURRICULUM = {
    # 传统高考省份（文理分科）
    "陕西": ["文科", "理科"],
    "河南": ["文科", "理科"],
    "山西": ["文科", "理科"],
    "四川": ["文科", "理科"],
    "云南": ["文科", "理科"],
    "贵州": ["文科", "理科"],
    "广西": ["文科", "理科"],
    "甘肃": ["文科", "理科"],
    "青海": ["文科", "理科"],
    "宁夏": ["文科", "理科"],
    "新疆": ["文科", "理科"],
    "西藏": ["文科", "理科"],
    "内蒙古": ["文科", "理科"],
    "黑龙江": ["文科", "理科"],
    "吉林": ["文科", "理科"],
    # 新高考 3+1+2 省份
    "广东": ["物理类", "历史类"],
    "湖南": ["物理类", "历史类"],
    "湖北": ["物理类", "历史类"],
    "河北": ["物理类", "历史类"],
    "辽宁": ["物理类", "历史类"],
    "江苏": ["物理类", "历史类"],
    "福建": ["物理类", "历史类"],
    "重庆": ["物理类", "历史类"],
    # 新高考 3+3 省份
    "北京": ["综合"],
    "天津": ["综合"],
    "上海": ["综合"],
    "浙江": ["综合"],
    "山东": ["综合"],
    "海南": ["综合"],
    # 其他
    "江西": ["文科", "理科"],
    "安徽": ["文科", "理科"],
}

# 百度高考 API 的 curriculum 参数映射
# 百度高考用 "文科"/"理科" 对应传统高考，用省份名+课程类型对应新高考
CURRICULUM_MAP = {
    "文科": "文科",
    "理科": "理科",
    "物理类": "理科",  # 百度高考对新高考省份仍用文理科分类
    "历史类": "文科",
    "综合": "综合",
}

# ============================================================
# HTTP 请求
# ============================================================

session = requests.Session()
session.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Referer": "https://gaokao.baidu.com/",
})


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def safe_request(url, max_retries=MAX_RETRIES):
    """带重试的 HTTP 请求"""
    for attempt in range(max_retries):
        try:
            resp = session.get(url, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            if data.get("errno") != 0:
                log(f"  ⚠ API errno={data.get('errno')}: {url}")
                return None
            return data
        except requests.exceptions.RequestException as e:
            wait = (attempt + 1) * 2
            log(f"  ⚠ 请求失败 (尝试 {attempt+1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                time.sleep(wait)
    return None


# ============================================================
# 院校列表爬取
# ============================================================

def fetch_school_page(page_no, page_size=30):
    """获取一页学校列表"""
    url = f"{BASE_URL}/list?rn={page_size}&pn={page_no}"
    data = safe_request(url)
    if data and data.get("data", {}).get("ranking", {}).get("tRow"):
        return data["data"]["ranking"]["tRow"]
    return []


def parse_college(raw):
    """将百度高考原始院校数据转换为 College 对象"""
    name = raw.get("college_name", "")
    if not name:
        return None

    # 解析标签判断 985/211/双一流
    tags = raw.get("tag", "")
    if isinstance(tags, list):
        tags = " ".join(tags)

    is_985 = "985" in tags
    is_211 = "211" in tags
    is_double_first = "双一流" in tags

    # 排名
    ranking = None
    rank_str = raw.get("rank", "")
    if rank_str and rank_str.isdigit():
        ranking = int(rank_str)

    return College(
        code=name[:10] if name else "",  # 用名称前缀作为临时 code（避免空值唯一约束冲突）
        name=name,
        short_name="",
        province=raw.get("province", ""),
        city=raw.get("city", ""),
        level="本科" if "本科" in raw.get("batch", "") else raw.get("education", ""),
        type=raw.get("school_type", ""),
        is_985=is_985,
        is_211=is_211,
        is_double_first=is_double_first,
        ranking=ranking,
        ranking_type=raw.get("rankTypeShow", ""),
        has_master=True,  # 默认本科院校都有
        has_doctor=is_985 or is_211,  # 985/211 一般都有博士点
    )


def crawl_all_colleges(max_schools=0):
    """爬取所有院校列表"""
    log("===== 开始爬取院校列表 =====")
    db = SessionLocal()
    page_no = 1
    total = 0
    added = 0

    while True:
        schools = fetch_school_page(page_no)
        if not schools:
            break

        for raw in schools:
            college = parse_college(raw)
            if not college:
                continue

            # 跳过已存在的（按名称判断）
            existing = db.query(College).filter(College.name == college.name).first()
            if existing:
                # 更新 code 为非空值（如果之前是空的）
                if not existing.code and college.code:
                    existing.code = college.code
                total += 1
            else:
                try:
                    db.add(college)
                    db.flush()  # 立即刷新以检测冲突
                    added += 1
                except Exception:
                    db.rollback()
                    # 如果仍然冲突，尝试更新已存在的
                    existing = db.query(College).filter(College.name == college.name).first()
                    if existing and not existing.code and college.code:
                        existing.code = college.code

            total += 1
            if max_schools > 0 and total >= max_schools:
                break

        db.commit()
        log(f"  第 {page_no} 页完成，累计 {total} 所，新增 {added} 所")

        if max_schools > 0 and total >= max_schools:
            break

        time.sleep(REQUEST_DELAY)
        page_no += 1

    db.close()
    log(f"===== 院校列表完成：共 {total} 所，新增 {added} 所 =====")
    return total


# ============================================================
# 录取分数线爬取
# ============================================================

def fetch_school_score(school_name, province, year, curriculum):
    """获取某校某省某年的录取分数线"""
    url = (
        f"{BASE_URL}/schoolscore"
        f"?curriculum={quote(curriculum)}"
        f"&school={quote(school_name)}"
        f"&province={quote(province)}"
        f"&year={year}"
    )
    data = safe_request(url)
    if data:
        try:
            return data["data"]["school_score"]["dataList"]
        except (KeyError, TypeError):
            return None
    return None


def crawl_scores(provinces=None, year_start=None, year_end=None):
    """爬取录取分数线数据"""
    provinces = provinces or DEFAULT_PROVINCES
    year_start = year_start or DEFAULT_YEAR_START
    year_end = year_end or DEFAULT_YEAR_END

    log(f"===== 开始爬取录取分数线 =====")
    log(f"  省份: {provinces}")
    log(f"  年份: {year_start}-{year_end}")

    db = SessionLocal()

    # 获取所有院校
    colleges = db.query(College).all()
    if not colleges:
        log("  ✗ 没有院校数据，请先运行 --schools-only")
        db.close()
        return

    total_scores = 0
    total_colleges_with_data = 0

    for idx, college in enumerate(colleges, 1):
        college_has_data = False

        for province in provinces:
            # 获取该省份的课程类型
            curricula = PROVINCE_CURRICULUM.get(province, ["文科", "理科"])

            for curriculum in curricula:
                # 映射到百度高考的课程类型参数
                api_curriculum = CURRICULUM_MAP.get(curriculum, curriculum)

                for year in range(year_end, year_start - 1, -1):
                    scores = fetch_school_score(
                        college.name, province, year, api_curriculum
                    )
                    if not scores:
                        continue

                    for score in scores:
                        score_year = score.get("year", "")
                        if str(score_year) != str(year):
                            continue

                        # 检查是否已存在（避免重复）
                        existing = db.query(Score).filter(
                            Score.college_name == college.name,
                            Score.province == province,
                            Score.year == int(score_year),
                            Score.category == curriculum,
                            Score.batch == score.get("batchName", ""),
                        ).first()

                        if existing:
                            continue

                        # 解析数值字段
                        min_score = score.get("minScore", "")
                        min_rank = score.get("minScoreOrder", "")
                        enrollment = score.get("enrollNum", "")

                        new_score = Score(
                            college_id=college.id,
                            college_code=college.code,
                            college_name=college.name,
                            year=int(score_year),
                            province=province,
                            batch=score.get("batchName", ""),
                            category=curriculum,
                            min_score=int(min_score) if str(min_score).isdigit() else None,
                            min_rank=int(min_rank) if str(min_rank).isdigit() else None,
                            enrollment=int(enrollment) if str(enrollment).isdigit() else None,
                        )

                        db.add(new_score)
                        total_scores += 1
                        college_has_data = True

                    time.sleep(REQUEST_DELAY)

        if college_has_data:
            total_colleges_with_data += 1

        if idx % 100 == 0:
            db.commit()
            log(f"  已处理 {idx}/{len(colleges)} 所院校，累计 {total_scores} 条分数线")

    db.commit()
    db.close()
    log(f"===== 录取分数线爬取完成 =====")
    log(f"  总计 {total_scores} 条分数线，覆盖 {total_colleges_with_data} 所院校")
    return total_scores


# ============================================================
# 数据导出（调试用）
# ============================================================

def export_scores_csv(province="陕西", output_dir="data"):
    """导出某省分数线为 CSV（用于数据校验）"""
    db = SessionLocal()
    scores = db.query(Score).filter(Score.province == province).order_by(
        Score.year.desc(), Score.min_rank.asc()
    ).all()

    os.makedirs(output_dir, exist_ok=True)
    filepath = os.path.join(output_dir, f"scores_{province}_{datetime.now().strftime('%Y%m%d')}.csv")

    with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([
            "院校名称", "省份", "年份", "科类", "批次",
            "最低分", "最低位次", "招生人数",
        ])
        for s in scores:
            writer.writerow([
                s.college_name, s.province, s.year, s.category,
                s.batch, s.min_score, s.min_rank, s.enrollment,
            ])

    db.close()
    log(f"已导出 {len(scores)} 条数据到 {filepath}")
    return filepath


# ============================================================
# 主入口
# ============================================================

def main():
    global REQUEST_DELAY

    parser = argparse.ArgumentParser(description="从百度高考爬取真实录取数据")
    parser.add_argument("--province", nargs="+", default=None,
                        help="目标省份（默认：陕西）")
    parser.add_argument("--year-start", type=int, default=None,
                        help=f"起始年份（默认：{DEFAULT_YEAR_START}）")
    parser.add_argument("--year-end", type=int, default=None,
                        help=f"结束年份（默认：{DEFAULT_YEAR_END}）")
    parser.add_argument("--schools-only", action="store_true",
                        help="仅爬取院校列表")
    parser.add_argument("--scores-only", action="store_true",
                        help="仅爬取分数线（使用已有院校列表）")
    parser.add_argument("--max-schools", type=int, default=0,
                        help="最多爬取院校数（0=全部，默认2900+所）")
    parser.add_argument("--export", type=str, default=None,
                        help="导出某省数据为 CSV")
    parser.add_argument("--delay", type=float, default=REQUEST_DELAY,
                        help=f"请求间隔秒数（默认：{REQUEST_DELAY}）")

    args = parser.parse_args()

    # 更新全局配置
    REQUEST_DELAY = args.delay

    # 初始化数据库
    init_db()

    if args.export:
        export_scores_csv(args.export)
        return

    if args.schools_only:
        crawl_all_colleges(max_schools=args.max_schools)
    elif args.scores_only:
        crawl_scores(
            provinces=args.province,
            year_start=args.year_start,
            year_end=args.year_end,
        )
    else:
        # 全量：先爬院校，再爬分数线
        crawl_all_colleges(max_schools=args.max_schools)
        crawl_scores(
            provinces=args.province,
            year_start=args.year_start,
            year_end=args.year_end,
        )


if __name__ == "__main__":
    main()
