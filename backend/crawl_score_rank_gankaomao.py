#!/usr/bin/env python3
"""
批量从 gankaomao.com 抓取一分一段表数据
gankaomao.com 的 URL 格式: https://www.gankaomao.com/{province_pinyin}/{year}yifenyiduan.html
"""

import requests
from bs4 import BeautifulSoup
import csv
import os
import time

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "score_rank_data")

# 省份拼音映射
PROVINCE_PINYIN = {
    "陕西": "shaanxi",
    "河南": "henan", 
    "四川": "sichuan",
    "广东": "guangdong",
    "湖北": "hubei",
    "湖南": "hunan",
    "山东": "shandong",
    "江苏": "jiangsu",
    "河北": "hebei",
    "安徽": "anhui",
    "浙江": "zhejiang",
}

# 需要爬取的任务: (year, province, category, expected_filename)
# 注意: 2022年安徽用文科/理科, 2025年安徽用历史类/物理类
TASKS = [
    # 2022 年缺失
    (2022, "安徽", "文科", "2022_安徽_文科.csv"),
    (2022, "安徽", "理科", "2022_安徽_理科.csv"),
    (2022, "广东", "物理类", "2022_广东_物理类.csv"),
    (2022, "江苏", "文科", "2022_江苏_文科.csv"),  # 江苏2022实际是物理类/历史类
    (2022, "江苏", "理科", "2022_江苏_理科.csv"),
    (2022, "河北", "文科", "2022_河北_文科.csv"),
    (2022, "河北", "理科", "2022_河北_理科.csv"),
    (2022, "河南", "文科", "2022_河南_文科.csv"),
    (2022, "河南", "理科", "2022_河南_理科.csv"),
    (2022, "湖北", "文科", "2022_湖北_文科.csv"),
    (2022, "湖北", "理科", "2022_湖北_理科.csv"),
    (2022, "湖南", "文科", "2022_湖南_文科.csv"),
    (2022, "湖南", "理科", "2022_湖南_理科.csv"),
    # 2023 年缺失
    (2023, "四川", "文科", "2023_四川_文科.csv"),
    (2023, "安徽", "文科", "2023_安徽_文科.csv"),
    (2023, "江苏", "文科", "2023_江苏_文科.csv"),
    (2023, "江苏", "理科", "2023_江苏_理科.csv"),
    (2023, "河南", "文科", "2023_河南_文科.csv"),
    (2023, "河南", "理科", "2023_河南_理科.csv"),
    (2023, "浙江", "综合", "2023_浙江_综合.csv"),
    # 2025 年缺失
    (2025, "广东", "历史类", "2025_广东_历史类.csv"),
    (2025, "广东", "物理类", "2025_广东_物理类.csv"),
    (2025, "河北", "历史类", "2025_河北_历史类.csv"),
    (2025, "河北", "物理类", "2025_河北_物理类.csv"),
    (2025, "浙江", "综合", "2025_浙江_综合.csv"),
    (2025, "湖北", "历史类", "2025_湖北_历史类.csv"),
    (2025, "湖北", "物理类", "2025_湖北_物理类.csv"),
    # 重采
    (2023, "四川", "理科", "2023_四川_理科.csv"),
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}


def try_gankaomao(year, province):
    """尝试从 gankaomao.com 获取数据"""
    py = PROVINCE_PINYIN.get(province, "")
    url = f"https://www.gankaomao.com/{py}/{year}yifenyiduan.html"
    print(f"  尝试 gankaomao: {url}")
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            print(f"    HTTP {resp.status_code}")
            return None
        soup = BeautifulSoup(resp.text, "html.parser")
        tables = soup.find_all("table")
        if not tables:
            print(f"    无表格")
            return None
        return soup
    except Exception as e:
        print(f"    错误: {e}")
        return None


def try_gankaomao_search(year, province, category):
    """尝试从 gankaomao.com 搜索页面获取数据"""
    py = PROVINCE_PINYIN.get(province, "")
    # 不同的 URL 模式
    urls = [
        f"https://www.gankaomao.com/{py}/{year}yifenyiduan_{category}.html",
        f"https://www.gankaomao.com/{py}/yifenyiduan_{year}.html",
        f"https://www.gankaomao.com/{py}/{year}_{category}yifenyiduan.html",
    ]
    for url in urls:
        print(f"  尝试: {url}")
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                tables = soup.find_all("table")
                if tables:
                    print(f"    找到 {len(tables)} 个表格!")
                    return soup
        except:
            pass
    return None


def parse_table(soup, category_keyword):
    """从页面中解析指定科类的表格数据"""
    tables = soup.find_all("table")
    results = []
    
    for table in tables:
        rows = table.find_all("tr")
        if len(rows) < 3:
            continue
        
        # 检查表头
        header_text = ""
        for tr in rows[:3]:
            for td in tr.find_all(["th", "td"]):
                header_text += td.get_text(strip=True) + " "
        
        # 判断这个表格是否包含我们要的科类
        category_keywords = {
            "文科": ["文科", "文史", "历史"],
            "理科": ["理科", "理工", "物理"],
            "物理类": ["物理"],
            "历史类": ["历史"],
            "综合": ["综合"],
        }
        
        target_keywords = category_keywords.get(category_keyword, [category_keyword])
        matched = any(kw in header_text for kw in target_keywords)
        
        if not matched and category_keyword in header_text:
            matched = True
        
        if matched:
            print(f"    匹配到表格 (表头: {header_text[:50]}...)")
            data = []
            for tr in rows[1:]:  # 跳过表头
                cells = tr.find_all(["th", "td"])
                cells_text = [c.get_text(strip=True).replace(",", "") for c in cells]
                if len(cells_text) >= 3:
                    try:
                        score = int(cells_text[0])
                        count = int(cells_text[1])
                        # 累计人数可能是第三列或第四列
                        if len(cells_text) >= 4:
                            cumulative = int(cells_text[3])
                        else:
                            cumulative = int(cells_text[2])
                        data.append((score, count, cumulative))
                    except (ValueError, IndexError):
                        continue
            
            if data:
                results.extend(data)
    
    return results


def save_csv(data, filepath):
    """保存数据到 CSV 文件"""
    if not data:
        return False
    
    # 去重并排序
    seen = set()
    unique_data = []
    for row in data:
        if row[0] not in seen:
            seen.add(row[0])
            unique_data.append(row)
    
    unique_data.sort(key=lambda x: -x[0])  # 按分数降序
    
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["score", "count_this_score", "cumulative_count"])
        for row in unique_data:
            writer.writerow(row)
    
    return True


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    success_count = 0
    fail_tasks = []
    
    for year, province, category, filename in TASKS:
        filepath = os.path.join(OUTPUT_DIR, filename)
        
        # 检查是否已存在且非重采任务
        if os.path.exists(filepath) and filename != "2023_四川_理科.csv":
            print(f"[跳过] {filename} 已存在")
            continue
        
        print(f"\n[任务] {year} {province} {category} -> {filename}")
        
        # 尝试多种 URL
        soup = try_gankaomao(year, province)
        if not soup:
            soup = try_gankaomao_search(year, province, category)
        
        if soup:
            data = parse_table(soup, category)
            if data:
                if save_csv(data, filepath):
                    print(f"  ✅ 成功! {len(data)} 条数据 -> {filepath}")
                    success_count += 1
                    continue
        
        print(f"  ❌ 失败")
        fail_tasks.append((year, province, category, filename))
        time.sleep(1)
    
    print(f"\n{'='*60}")
    print(f"完成: {success_count} 成功, {len(fail_tasks)} 失败")
    if fail_tasks:
        print("失败任务:")
        for task in fail_tasks:
            print(f"  {task}")


if __name__ == "__main__":
    main()
