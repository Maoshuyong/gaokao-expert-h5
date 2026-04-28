# -*- coding: utf-8 -*-
"""
多省份分数线高效爬取脚本
- 只爬「已有陕西数据」的院校（1597所，跳过明确无数据的小院校）
- 并发 5 线程加速
- 断点续爬（跳过已有数据的院校-省份-年份组合）
- 预计耗时：约 2-3 小时
"""

import sys, os, time, json, sqlite3
from datetime import datetime
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import requests

# ─── 配置 ─────────────────────────────────────────────
PROVINCES = ['广东', '湖北', '江苏', '湖南', '河北']
YEARS = [2022, 2023, 2024]
WORKERS = 5        # 并发线程数
DELAY = 0.5        # 每线程请求间隔（秒）
DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'gaokao.db')

# 省份课程类型
PROVINCE_CURRICULUM = {
    '河南': ['文科', '理科'],
    '四川': ['文科', '理科'],
    '安徽': ['文科', '理科'],
    '广东': ['物理类', '历史类'],
    '湖北': ['物理类', '历史类'],
    '河北': ['物理类', '历史类'],
    '江苏': ['物理类', '历史类'],
    '湖南': ['物理类', '历史类'],
    '浙江': ['综合'],
    '山东': ['综合'],
}
# 百度API课程参数（新高考省份直接传「物理类」「历史类」，传「理科」会返回空）
CURRICULUM_API = {
    '文科': '文科', '理科': '理科',
    '物理类': '物理类', '历史类': '历史类',
    '综合': '综合',
}

# ─── 全局锁 ───────────────────────────────────────────
db_lock = threading.Lock()
counter = {'done': 0, 'added': 0, 'errors': 0}
counter_lock = threading.Lock()

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def make_session():
    s = requests.Session()
    s.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': 'https://gaokao.baidu.com/',
    })
    return s


def fetch_scores(session, school_name, province, year, curriculum_api):
    url = (
        f'https://gaokao.baidu.com/gk/gkschool/schoolscore'
        f'?curriculum={quote(curriculum_api)}'
        f'&school={quote(school_name)}'
        f'&province={quote(province)}'
        f'&year={year}'
    )
    for attempt in range(3):
        try:
            r = session.get(url, timeout=15)
            r.raise_for_status()
            data = r.json()
            if data.get('errno') != 0:
                return []
            return data.get('data', {}).get('school_score', {}).get('dataList', [])
        except Exception as e:
            if attempt < 2:
                time.sleep((attempt + 1) * 2)
    return []


def get_existing_keys(conn):
    """获取已有数据的 (college_name, province, year, category) 集合"""
    cur = conn.cursor()
    cur.execute('SELECT DISTINCT college_name, province, year, category FROM scores WHERE province != "陕西"')
    return set(cur.fetchall())


def parse_score(raw, college_name, college_id, province, curriculum):
    """解析单条分数线数据"""
    def safe_int(v):
        try:
            return int(str(v).replace(',', '').strip())
        except:
            return None

    year_val = raw.get('year', '')
    batch = raw.get('batchName', '')
    min_score = safe_int(raw.get('minScore'))
    min_rank = safe_int(raw.get('minScoreOrder'))
    enrollment = safe_int(raw.get('enrollNum'))
    control = safe_int(raw.get('controlScore'))

    if not min_score or not year_val or not batch:
        return None

    return {
        'college_id': college_id,
        'college_name': college_name,
        'year': int(year_val),
        'province': province,
        'batch': batch,
        'category': curriculum,
        'min_score': min_score,
        'min_rank': min_rank,
        'control_score': control,
        'enrollment': enrollment,
    }


def process_college(task):
    """处理单个 (院校, 省份) 的所有年份+课程爬取"""
    college_id, college_name, province, existing_keys, session = task
    results = []
    curricula = PROVINCE_CURRICULUM.get(province, ['文科', '理科'])

    for curriculum in curricula:
        api_cur = CURRICULUM_API.get(curriculum, curriculum)
        key = (college_name, province)

        for year in YEARS:
            # 断点续爬：已有数据则跳过
            if (college_name, province, year, curriculum) in existing_keys:
                continue

            scores_raw = fetch_scores(session, college_name, province, year, api_cur)
            time.sleep(DELAY)

            for raw in scores_raw:
                if str(raw.get('year', '')) != str(year):
                    continue
                rec = parse_score(raw, college_name, college_id, province, curriculum)
                if rec:
                    results.append(rec)

    return college_name, province, results


def save_batch(conn, rows):
    """批量写入数据库"""
    if not rows:
        return 0
    cur = conn.cursor()
    added = 0
    for r in rows:
        try:
            cur.execute('''
                INSERT OR IGNORE INTO scores
                (college_id, college_name, year, province, batch, category,
                 min_score, min_rank, control_score, enrollment, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))
            ''', (r['college_id'], r['college_name'], r['year'], r['province'],
                  r['batch'], r['category'], r['min_score'], r['min_rank'],
                  r['control_score'], r['enrollment']))
            added += cur.rowcount
        except Exception as e:
            pass
    conn.commit()
    return added


def main():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)

    # 获取有陕西数据的院校
    cur = conn.cursor()
    cur.execute('''
        SELECT DISTINCT s.college_id, s.college_name
        FROM scores s
        WHERE s.province = '陕西'
        ORDER BY s.college_name
    ''')
    colleges = cur.fetchall()
    log(f'目标院校数: {len(colleges)}')

    # 获取已有数据（断点续爬）
    existing_keys = get_existing_keys(conn)
    log(f'已有非陕西数据: {len(existing_keys)} 条记录')

    # 构建任务列表
    tasks = []
    sessions = [make_session() for _ in range(WORKERS)]

    for i, (cid, cname) in enumerate(colleges):
        for province in PROVINCES:
            tasks.append((cid, cname, province, existing_keys, sessions[i % WORKERS]))

    log(f'总任务数: {len(tasks)} (院校×省份组合)')
    log(f'并发线程: {WORKERS}，预计耗时: ~{len(tasks)*len(YEARS)*1.5/WORKERS/3600:.1f} 小时')

    total_added = 0
    completed = 0

    with ThreadPoolExecutor(max_workers=WORKERS) as executor:
        futures = {executor.submit(process_college, t): t for t in tasks}
        for future in as_completed(futures):
            completed += 1
            try:
                college_name, province, rows = future.result()
                if rows:
                    with db_lock:
                        added = save_batch(conn, rows)
                        total_added += added
                    log(f'[{completed}/{len(tasks)}] {college_name} × {province}: +{len(rows)} 条 | 累计 +{total_added}')
                elif completed % 100 == 0:
                    log(f'[{completed}/{len(tasks)}] 进度 {completed/len(tasks)*100:.1f}% | 累计 +{total_added}')
            except Exception as e:
                log(f'任务失败: {e}')

    conn.close()
    log(f'===== 完成！新增 {total_added} 条分数线数据 =====')

    # 统计结果
    conn2 = sqlite3.connect(DB_PATH)
    cur2 = conn2.cursor()
    cur2.execute('SELECT province, COUNT(*) FROM scores WHERE province != "陕西" GROUP BY province ORDER BY COUNT(*) DESC')
    log('各省数据量:')
    for row in cur2.fetchall():
        log(f'  {row[0]}: {row[1]} 条')
    conn2.close()


if __name__ == '__main__':
    main()
