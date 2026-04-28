#!/usr/bin/env python3
"""
批量爬取一分一段表数据（2022-2025）
数据源：eol.cn（中国教育在线）
输出：CSV 文件到 score_rank_data/ 目录

使用方法：
  python3 crawl_score_rank_eol.py 2025   # 只爬2025
  python3 crawl_score_rank_eol.py 2022   # 只爬2022
  python3 crawl_score_rank_eol.py all     # 爬所有年份
"""

import requests
from bs4 import BeautifulSoup
import re
import csv
import os
import sys
import time

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'score_rank_data')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# eol.cn URL 配置
# 格式：{省份: {年份: {科类: URL}}}
# 部分省份合并 URL（河北/广东/江苏等）用 "合并" 标记，解析时会自动拆分
EOL_URLS = {
    '陕西': {
        2025: {
            '物理类': 'https://gaokao.eol.cn/shan_xi_sheng/dongtai/202506/t20250625_2677115.shtml',
            '历史类': 'https://gaokao.eol.cn/shan_xi_sheng/dongtai/202506/t20250625_2677119.shtml',
        },
        2024: {
            '理科': 'https://gaokao.eol.cn/shan_xi_sheng/dongtai/202406/t20240624_2618960.shtml',
            '文科': 'https://gaokao.eol.cn/shan_xi_sheng/dongtai/202406/t20240624_2618959.shtml',
        },
        2023: {
            '理科': 'https://gaokao.eol.cn/shan_xi_sheng/dongtai/202306/t20230624_2446622.shtml',
            '文科': 'https://gaokao.eol.cn/shan_xi_sheng/dongtai/202306/t20230624_2446619.shtml',
        },
        2022: {
            '理科': 'https://gaokao.eol.cn/shan_xi_sheng/dongtai/202206/t20220624_2233920.shtml',
            '文科': 'https://gaokao.eol.cn/shan_xi_sheng/dongtai/202206/t20220624_2233921.shtml',
        },
    },
    '河南': {
        2025: {
            '物理类': 'https://gaokao.eol.cn/he_nan/dongtai/202506/t20250625_2676859.shtml',
            '历史类': 'https://gaokao.eol.cn/he_nan/dongtai/202506/t20250625_2676858.shtml',
        },
        2024: {
            '理科': 'https://gaokao.eol.cn/he_nan/dongtai/202406/t20240625_2619064.shtml',
            '文科': 'https://gaokao.eol.cn/he_nan/dongtai/202406/t20240625_2619065.shtml',
        },
        2023: {
            '理科': 'https://gaokao.eol.cn/he_nan/dongtai/202306/t20230625_2446820.shtml',
            '文科': 'https://gaokao.eol.cn/he_nan/dongtai/202306/t20230625_2446821.shtml',
        },
        2022: {
            '理科': 'https://gaokao.eol.cn/he_nan/dongtai/202206/t20220625_2234107.shtml',
            '文科': 'https://gaokao.eol.cn/he_nan/dongtai/202206/t20220625_2234108.shtml',
        },
    },
    '四川': {
        2025: {
            '物理类': 'https://gaokao.eol.cn/si_chuan/dongtai/202507/t20250702_2678480.shtml',
            '历史类': 'https://gaokao.eol.cn/si_chuan/dongtai/202507/t20250702_2678481.shtml',
        },
        2024: {
            '理科': 'https://gaokao.eol.cn/si_chuan/dongtai/202406/t20240623_2618657.shtml',
            '文科': 'https://gaokao.eol.cn/si_chuan/dongtai/202406/t20240623_2618656.shtml',
        },
        2023: {
            '文科': 'https://gaokao.eol.cn/si_chuan/dongtai/202306/t20230623_2446484.shtml',
        },
        2022: {
            '合并': 'https://gaokao.eol.cn/si_chuan/dongtai/202206/t20220623_2233577.shtml',
        },
    },
    '广东': {
        2025: {
            '合并': 'https://gaokao.eol.cn/guang_dong/dongtai/202506/t20250626_2677410.shtml',
        },
        2024: {
            '物理类': 'https://gaokao.eol.cn/guang_dong/dongtai/202406/t20240626_2619547.shtml',
            '历史类': 'https://gaokao.eol.cn/guang_dong/dongtai/202406/t20240626_2619545.shtml',
        },
        2023: {
            '物理类': 'https://gaokao.eol.cn/guang_dong/dongtai/202306/t20230627_2447641.shtml',
            '历史类': 'https://gaokao.eol.cn/guang_dong/dongtai/202306/t20230627_2447639.shtml',
        },
        2022: {
            '物理类': 'https://gaokao.eol.cn/guang_dong/dongtai/202206/t20220626_2234197.shtml',
            '历史类': 'https://gaokao.eol.cn/guang_dong/dongtai/202206/t20220626_2234201.shtml',
        },
    },
    '湖北': {
        2025: {
            '物理类': 'https://gaokao.eol.cn/hu_bei/dongtai/202506/t20250625_2677129.shtml',
            '历史类': 'https://gaokao.eol.cn/hu_bei/dongtai/202506/t20250625_2677137.shtml',
        },
        2024: {
            '物理类': 'https://gaokao.eol.cn/hu_bei/dongtai/202406/t20240625_2619340.shtml',
            '历史类': 'https://gaokao.eol.cn/hu_bei/dongtai/202406/t20240625_2619345.shtml',
        },
        2023: {
            '物理类': 'https://gaokao.eol.cn/hu_bei/dongtai/202306/t20230625_2447085.shtml',
            '历史类': 'https://gaokao.eol.cn/hu_bei/dongtai/202306/t20230625_2447090.shtml',
        },
        2022: {
            '物理类': 'https://gaokao.eol.cn/hu_bei/dongtai/202206/t20220625_2234089.shtml',
            '历史类': 'https://gaokao.eol.cn/hu_bei/dongtai/202206/t20220625_2234090.shtml',
        },
    },
    '湖南': {
        2025: {
            '物理类': 'https://gaokao.eol.cn/hu_nan/dongtai/202506/t20250625_2676956.shtml',
            '历史类': 'https://gaokao.eol.cn/hu_nan/dongtai/202506/t20250625_2676955.shtml',
        },
        2024: {
            '物理类': 'https://gaokao.eol.cn/hu_nan/dongtai/202406/t20240625_2619159.shtml',
            '历史类': 'https://gaokao.eol.cn/hu_nan/dongtai/202406/t20240625_2619109.shtml',
        },
        2023: {
            '物理类': 'https://gaokao.eol.cn/hu_nan/dongtai/202306/t20230625_2447181.shtml',
            '历史类': 'https://gaokao.eol.cn/hu_nan/dongtai/202306/t20230625_2447179.shtml',
        },
        2022: {
            '物理类': 'https://gaokao.eol.cn/hu_nan/dongtai/202206/t20220626_2234195.shtml',
            '历史类': 'https://gaokao.eol.cn/hu_nan/dongtai/202206/t20220626_2234194.shtml',
        },
    },
    '山东': {
        2025: {
            '综合': 'https://gaokao.eol.cn/shan_dong/dongtai/202506/t20250625_2677092.shtml',
        },
        2023: {
            '综合': 'https://gaokao.eol.cn/shan_dong/dongtai/202306/t20230625_2447198.shtml',
        },
        2022: {
            '综合': 'https://gaokao.eol.cn/shan_dong/dongtai/202206/t20220626_2234173.shtml',
        },
    },
    '江苏': {
        2025: {
            '物理类': 'https://gaokao.eol.cn/jiang_su/dongtai/202506/t20250625_2676969.shtml',
            '历史类': 'https://gaokao.eol.cn/jiang_su/dongtai/202506/t20250625_2676968.shtml',
        },
        2024: {
            '物理类': 'https://gaokao.eol.cn/jiang_su/dongtai/202406/t20240624_2619055.shtml',
            '历史类': 'https://gaokao.eol.cn/jiang_su/dongtai/202406/t20240624_2619054.shtml',
        },
        2023: {
            '合并': 'https://gaokao.eol.cn/jiang_su/dongtai/202306/t20230625_2447018.shtml',
        },
        2022: {
            '合并': 'https://gaokao.eol.cn/jiang_su/dongtai/202206/t20220625_2234102.shtml',
        },
    },
    '河北': {
        2025: {
            '合并': 'https://gaokao.eol.cn/he_bei/dongtai/202506/t20250624_2676842.shtml',
        },
        2024: {
            '物理类': 'https://gaokao.eol.cn/he_bei/dongtai/202406/t20240625_2619074.shtml',
            '历史类': 'https://gaokao.eol.cn/he_bei/dongtai/202406/t20240625_2619073.shtml',
        },
        2023: {
            '物理类': 'https://gaokao.eol.cn/he_bei/dongtai/202306/t20230625_2446858.shtml',
            '历史类': 'https://gaokao.eol.cn/he_bei/dongtai/202306/t20230625_2446944.shtml',
        },
        2022: {
            '合并': 'https://gaokao.eol.cn/he_bei/dongtai/202206/t20220625_2233997.shtml',
        },
    },
    '安徽': {
        2025: {
            '物理类': 'https://gaokao.eol.cn/an_hui/dongtai/202506/t20250625_2676962.shtml',
            '历史类': 'https://gaokao.eol.cn/an_hui/dongtai/202506/t20250625_2676963.shtml',
        },
        2024: {
            '物理类': 'https://gaokao.eol.cn/an_hui/dongtai/202406/t20240625_2619348.shtml',
            '历史类': 'https://gaokao.eol.cn/an_hui/dongtai/202406/t20240625_2619346.shtml',
        },
        2023: {
            '理科': 'https://gaokao.eol.cn/an_hui/dongtai/202306/t20230624_2446601.shtml',
            '文科': 'https://gaokao.eol.cn/an_hui/dongtai/202306/t20230624_2446600.shtml',
        },
        2022: {
            '理科': 'https://gaokao.eol.cn/an_hui/dongtai/202206/t20220624_2233780.shtml',
            '文科': 'https://gaokao.eol.cn/an_hui/dongtai/202206/t20220624_2233778.shtml',
        },
    },
    '浙江': {
        2025: {
            '综合': 'https://gaokao.eol.cn/zhe_jiang/dongtai/202506/t20250625_2677143.shtml',
        },
        2024: {
            '综合': 'https://gaokao.eol.cn/zhe_jiang/dongtai/202406/t20240626_2619511.shtml',
        },
        2022: {
            '综合': 'https://gaokao.eol.cn/zhe_jiang/dongtai/202206/t20220626_2234172.shtml?proId=37',
        },
    },
}


def parse_eol_table(html, url=""):
    """从 eol.cn 的 HTML 中解析一分一段表数据"""
    soup = BeautifulSoup(html, 'html.parser')
    
    # 查找所有表格，取最大的那个
    tables = soup.find_all('table')
    if not tables:
        return []
    
    table = max(tables, key=lambda t: len(t.find_all('tr')))
    rows = table.find_all('tr')
    data = []

    for row in rows:
        cells = row.find_all(['td', 'th'])
        if len(cells) < 3:
            continue

        texts = [c.get_text(strip=True).replace(',', '') for c in cells]

        # 解析分数
        score_text = texts[0]
        # 跳过分数段行（如 "710-750"）和非数字行
        if not score_text.isdigit():
            continue
        score = int(score_text)
        if not (100 <= score <= 800):
            continue

        # 解析人数和累计
        try:
            count = int(texts[1])
            cumulative = int(texts[2])
        except (ValueError, IndexError):
            continue

        if count >= 0 and cumulative >= 0:
            data.append((score, count, cumulative))

    # 按分数降序排列
    data.sort(key=lambda x: -x[0])
    return data


def parse_merged_table(html, url=""):
    """解析合并表格（物理+历史/文+理在同一个页面），
    返回 {category: [(score, count, cumulative), ...]}"""
    soup = BeautifulSoup(html, 'html.parser')
    
    # 获取页面标题来判断科类
    title = soup.find('title')
    title_text = title.get_text(strip=True) if title else ""
    
    tables = soup.find_all('table')
    if not tables:
        return {}
    
    results = {}
    
    for table in tables:
        rows = table.find_all('tr')
        if len(rows) < 10:  # 跳过小表格
            continue
        
        # 检查表头确定科类
        header_cells = rows[0].find_all(['td', 'th'])
        header_text = ' '.join([c.get_text(strip=True) for c in header_cells]).lower()
        
        category = None
        if '物理' in header_text:
            category = '物理类'
        elif '历史' in header_text:
            category = '历史类'
        elif '理科' in header_text or '理工' in header_text:
            category = '理科'
        elif '文科' in header_text or '文史' in header_text:
            category = '文科'
        else:
            # 无法从表头判断，跳过
            continue
        
        data = []
        for row in rows:
            cells = row.find_all(['td', 'th'])
            if len(cells) < 3:
                continue
            texts = [c.get_text(strip=True).replace(',', '') for c in cells]
            
            score_text = texts[0]
            if not score_text.isdigit():
                continue
            score = int(score_text)
            if not (100 <= score <= 800):
                continue
            
            try:
                count = int(texts[1])
                cumulative = int(texts[2])
            except (ValueError, IndexError):
                continue
            
            if count >= 0 and cumulative >= 0:
                data.append((score, count, cumulative))
        
        if data:
            data.sort(key=lambda x: -x[0])
            results[category] = data
    
    return results


def save_csv(year, province, category, data):
    """保存数据到 CSV"""
    filepath = os.path.join(OUTPUT_DIR, f'{year}_{province}_{category}.csv')
    
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['score', 'count_this_score', 'cumulative_count'])
        for score, count, cumulative in data:
            writer.writerow([score, count, cumulative])
    
    if data:
        print(f"  ✅ {year}_{province}_{category}: {len(data)} 条 "
              f"({data[0][0]}-{data[-1][0]}) 累计 {data[-1][2]:,}")
    return True


def crawl_eol(url, year, province, category):
    """从 eol.cn 爬取单个页面"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.encoding = 'utf-8'
        data = parse_eol_table(resp.text, url)
        if data:
            save_csv(year, province, category, data)
            return True
        else:
            print(f"  ❌ {province} {category}: 未解析到数据")
            return False
    except Exception as e:
        print(f"  ❌ {province} {category}: 请求失败 - {e}")
        return False


def crawl_merged(url, year, province):
    """爬取合并表格页面（物理+历史在同一页）"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.encoding = 'utf-8'
        results = parse_merged_table(resp.text, url)
        if results:
            for category, data in results.items():
                save_csv(year, province, category, data)
            return len(results)
        else:
            print(f"  ❌ {province}: 未解析到合并数据，尝试普通解析...")
            # 回退到普通表格解析
            data = parse_eol_table(resp.text, url)
            if data:
                # 根据页面标题判断科类
                soup = BeautifulSoup(resp.text, 'html.parser')
                title = soup.find('title')
                title_text = title.get_text(strip=True) if title else ""
                category = '综合'
                if '物理' in title_text:
                    category = '物理类'
                elif '历史' in title_text:
                    category = '历史类'
                elif '理科' in title_text or '理工' in title_text:
                    category = '理科'
                elif '文科' in title_text or '文史' in title_text:
                    category = '文科'
                save_csv(year, province, category, data)
                return 1
            else:
                print(f"  ❌ {province}: 完全无法解析")
                return 0
    except Exception as e:
        print(f"  ❌ {province}: 请求失败 - {e}")
        return 0


def main():
    year_filter = sys.argv[1] if len(sys.argv) > 1 else 'all'
    years = [2022, 2023, 2024, 2025] if year_filter == 'all' else [int(year_filter)]

    total_success = 0
    total_fail = 0

    for year in years:
        print(f"\n{'='*60}")
        print(f"📊 爬取 {year} 年一分一段表")
        print(f"{'='*60}")

        # 收集本年所有省份
        province_year_urls = {}  # {省份: {科类: URL}}
        for province, year_map in sorted(EOL_URLS.items()):
            if year not in year_map:
                continue
            if province not in province_year_urls:
                province_year_urls[province] = {}
            province_year_urls[province].update(year_map[year])

        for province, cat_map in sorted(province_year_urls.items()):
            for category, url in sorted(cat_map.items()):
                print(f"\n  {province} {category}:")
                if category == '合并':
                    count = crawl_merged(url, year, province)
                    if count > 0:
                        total_success += count
                    else:
                        total_fail += 1
                else:
                    ok = crawl_eol(url, year, province, category)
                    if ok:
                        total_success += 1
                    else:
                        total_fail += 1
                time.sleep(1)  # 礼貌性延迟

    print(f"\n{'='*60}")
    print(f"📊 爬取完成: ✅ {total_success} 成功, ❌ {total_fail} 失败")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()
