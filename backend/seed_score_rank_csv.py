"""
种子脚本：从 score_rank_data/ 目录的 CSV 文件导入一分一段表数据
替换原有的 seed_score_rank.py（仅硬编码陕西省）
数据来源：赶考猫、百度高考等公开渠道

CSV 文件命名规则: 2024_{省份}_{科类}.csv
CSV 列: score, count_this_score, cumulative_count
"""
import sys
import os
import csv
import re
import logging
import json

sys.path.insert(0, '.')
logger = logging.getLogger(__name__)

# CSV 数据目录
DATA_DIR = os.path.join(os.path.dirname(__file__), 'score_rank_data')
# 导出 JSON 路径（用于部署时打包）
EXPORT_JSON = os.path.join(os.path.dirname(__file__), 'seed_score_rank_data.json')

# 科类标准化映射
CATEGORY_MAP = {
    '文科': '文科',
    '理科': '理科',
    '物理类': '物理类',
    '历史类': '历史类',
    '物理': '物理类',
    '历史': '历史类',
    '综合': '综合',
    '物理科目组合': '物理类',
    '历史科目组合': '历史类',
}

# 省份标准化
PROVINCE_MAP = {
    '陕西': '陕西',
    '山东': '山东',
    '浙江': '浙江',
    '广东': '广东',
    '安徽': '安徽',
    '湖北': '湖北',
    '湖南': '湖南',
    '四川': '四川',
    '河南': '河南',
    '河北': '河北',
    '江苏': '江苏',
}


def parse_csv_filename(filename):
    """从文件名解析年份、省份、科类
    例: 2024_陕西_文科.csv -> (2024, '陕西', '文科')
    """
    basename = os.path.splitext(filename)[0]
    parts = basename.split('_')
    if len(parts) < 3:
        return None

    year_str = parts[0]
    if not year_str.isdigit():
        return None
    year = int(year_str)

    # 省份是第二部分
    province_raw = parts[1]
    province = PROVINCE_MAP.get(province_raw, province_raw)

    # 科类是剩余部分（可能有下划线，如"物理类"已映射，但原始可能是"历史_科目组合"之类）
    category_raw = '_'.join(parts[2:])
    category = CATEGORY_MAP.get(category_raw, category_raw)

    return year, province, category


def read_csv_data(filepath):
    """读取单个 CSV 文件，返回 [(score, count, cumulative), ...]"""
    rows = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                score = int(row['score'].strip())
                count = int(row['count_this_score'].strip().replace(',', ''))
                cumulative = int(row['cumulative_count'].strip().replace(',', ''))

                # 基本校验
                if score < 0 or score > 800:
                    continue
                if count <= 0 or cumulative <= 0:
                    continue

                rows.append((score, count, cumulative))
    except Exception as e:
        logger.error(f"读取 CSV 失败 {filepath}: {e}")
        return []
    return rows


def seed_from_csv(db=None, close_db=True):
    """从 score_rank_data/ 目录导入所有 CSV 文件"""
    from db import SessionLocal, init_db
    from models.score_rank_table import ScoreRankTable

    # 初始化数据库表
    init_db()

    own_db = False
    if db is None:
        db = SessionLocal()
        own_db = True

    # 收集所有 CSV 文件
    csv_files = sorted([
        f for f in os.listdir(DATA_DIR)
        if f.startswith('20') and f.endswith('.csv')
    ])

    if not csv_files:
        logger.warning(f"未找到 CSV 文件: {DATA_DIR}")
        if own_db:
            db.close()
        return 0, []

    total_imported = 0
    summary = []

    for filename in csv_files:
        filepath = os.path.join(DATA_DIR, filename)
        parsed = parse_csv_filename(filename)
        if not parsed:
            logger.warning(f"无法解析文件名: {filename}")
            continue

        year, province, category = parsed
        rows = read_csv_data(filepath)
        if not rows:
            logger.warning(f"CSV 无有效数据: {filename}")
            continue

        # 先删除该省份+科类+年份的旧数据
        deleted = db.query(ScoreRankTable).filter(
            ScoreRankTable.year == year,
            ScoreRankTable.province == province,
            ScoreRankTable.category == category,
        ).delete()
        db.commit()

        # 批量插入
        batch_size = 500
        imported = 0
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            for score, count, cumulative in batch:
                record = ScoreRankTable(
                    year=year,
                    province=province,
                    category=category,
                    score=score,
                    count_this_score=count,
                    cumulative_count=cumulative,
                )
                db.add(record)
                imported += 1
            db.commit()

        max_cum = rows[-1][2] if rows else 0
        score_range = f"{rows[0][0]}~{rows[-1][0]}"
        logger.info(f"{'已清除 '+str(deleted)+'条 | ' if deleted else ''}"
                     f"{province} {category}: {imported}条 "
                     f"({score_range}) 最大累计 {max_cum:,}")
        summary.append({
            'province': province,
            'category': category,
            'year': year,
            'count': imported,
            'score_range': score_range,
            'max_cumulative': max_cum,
        })
        total_imported += imported

    if own_db:
        db.close()

    logger.info(f"导入完成: {total_imported} 条 ({len(summary)} 个科类)")
    return total_imported, summary


def export_to_json(summary=None):
    """将 CSV 数据导出为 JSON 文件（用于 Render 部署打包）"""
    from db import SessionLocal, init_db
    from models.score_rank_table import ScoreRankTable

    init_db()
    db = SessionLocal()

    records = db.query(ScoreRankTable).order_by(
        ScoreRankTable.year,
        ScoreRankTable.province,
        ScoreRankTable.category,
        ScoreRankTable.score.desc(),
    ).all()

    data = {
        'score_rank_tables': [
            {
                'year': r.year,
                'province': r.province,
                'category': r.category,
                'score': r.score,
                'count_this_score': r.count_this_score,
                'cumulative_count': r.cumulative_count,
            }
            for r in records
        ],
        'summary': summary or [],
    }

    with open(EXPORT_JSON, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    db.close()
    logger.info(f"已导出 JSON: {EXPORT_JSON} ({len(data['score_rank_tables'])} 条)")
    return len(data['score_rank_tables'])


def seed_from_json():
    """从 JSON 文件导入数据（部署时无 CSV 目录时使用）"""
    if not os.path.exists(EXPORT_JSON):
        logger.warning(f"JSON 数据文件不存在: {EXPORT_JSON}")
        return 0, []

    from db import SessionLocal, init_db
    from models.score_rank_table import ScoreRankTable

    init_db()
    db = SessionLocal()

    with open(EXPORT_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)

    rows = data.get('score_rank_tables', [])
    if not rows:
        db.close()
        return 0, []

    # 清空旧数据
    db.query(ScoreRankTable).delete()
    db.commit()

    # 批量插入
    batch_size = 500
    imported = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        for r in batch:
            record = ScoreRankTable(**r)
            db.add(record)
            imported += 1
        db.commit()

    db.close()
    logger.info(f"从 JSON 导入: {imported} 条")
    return imported, data.get('summary', [])


if __name__ == '__main__':
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    import argparse
    parser = argparse.ArgumentParser(description='一分一段表数据导入')
    parser.add_argument('--from-json', action='store_true',
                        help='从 JSON 文件导入（部署用）')
    parser.add_argument('--export-json', action='store_true',
                        help='导出为 JSON 文件（部署打包用）')
    parser.add_argument('--from-csv', action='store_true',
                        help='从 CSV 文件导入（默认）')
    args = parser.parse_args()

    if args.from_json:
        count, summary = seed_from_json()
        print(f"\n✅ 从 JSON 导入完成: {count} 条")
    elif args.export_json:
        count = export_to_json()
        print(f"\n✅ JSON 导出完成: {count} 条")
    else:
        # 默认从 CSV 导入
        count, summary = seed_from_csv()
        print(f"\n✅ CSV 导入完成: {count} 条")
        if summary:
            print("\n详细汇总:")
            for s in summary:
                print(f"  {s['province']} {s['category']}: "
                      f"{s['count']}条 ({s['score_range']}) "
                      f"最大累计 {s['max_cumulative']:,}")
