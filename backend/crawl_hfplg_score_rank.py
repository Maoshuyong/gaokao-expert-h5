#!/usr/bin/env python3
"""
从 hfplg.com（新高考网）爬取各省一分一段表数据。
hfplg.com 的表格数据是真实的，每行包含：分数、该分数人数、累计人数。
"""

import csv
import os
import re
import sys
import subprocess
import json

DATA_DIR = os.path.join(os.path.dirname(__file__), 'score_rank_data')
os.makedirs(DATA_DIR, exist_ok=True)

# hfplg.com 页面 URL 映射：{省份_科类: URL}
URLS = {
    '河南_理科': 'https://www.hfplg.com/yfyd/12848.html',
    '河南_文科': 'https://www.hfplg.com/yfyd/12849.html',
}

def fetch_html(url):
    """用 curl 获取页面 HTML"""
    result = subprocess.run(
        ['curl', '-sL', url, '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'],
        capture_output=True, timeout=30
    )
    for enc in ['utf-8', 'gbk', 'gb2312', 'gb18030', 'latin-1']:
        try:
            return result.stdout.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return result.stdout.decode('utf-8', errors='replace')

def parse_hfplg_table(html):
    """解析 hfplg.com 的表格数据"""
    rows = []
    
    # hfplg.com 的数据通常在 <table> 标签中
    # 尝试解析 table 中的数据
    # 每行格式：分数 | 人数 | 累计人数
    
    # 方法1：从 <td> 标签中提取
    # 匹配表格中连续的 3 个数字列
    import re
    
    # 找到所有表格行
    tr_pattern = re.compile(r'<tr[^>]*>(.*?)</tr>', re.DOTALL)
    td_pattern = re.compile(r'<td[^>]*>(.*?)</td>', re.DOTALL)
    
    for tr_match in tr_pattern.finditer(html):
        tr_content = tr_match.group(1)
        tds = td_pattern.findall(tr_content)
        
        if len(tds) >= 3:
            # 提取每个 td 中的纯文本
            values = []
            for td in tds:
                text = re.sub(r'<[^>]+>', '', td).strip()
                # 提取数字
                num_match = re.search(r'[\d,]+', text)
                if num_match:
                    values.append(num_match.group().replace(',', ''))
            
            if len(values) >= 3:
                try:
                    score = int(values[0])
                    count = int(values[1])
                    cumulative = int(values[2])
                    # 合理性检查
                    if 0 < score <= 800 and 0 < count <= 50000 and 0 < cumulative <= 2000000:
                        rows.append((score, count, cumulative))
                except (ValueError, IndexError):
                    continue
    
    # 如果没有从 table 提取到数据，尝试从纯文本中提取
    if not rows:
        # hfplg.com 可能把数据放在 JavaScript 变量或特定 div 中
        # 尝试找到包含 "分数" 和 "人数" 的区域
        # 匹配连续的 "数字 | 数字 | 数字" 模式
        text_pattern = re.compile(r'(\d{2,3})\s*[|\s]\s*(\d+)\s*[|\s]\s*(\d+)')
        for match in text_pattern.finditer(html):
            score = int(match.group(1))
            count = int(match.group(2))
            cumulative = int(match.group(3))
            if 100 <= score <= 750 and 0 < count <= 50000 and 0 < cumulative <= 2000000:
                rows.append((score, count, cumulative))
    
    return rows

def parse_hfplg_from_text(html):
    """备用方法：从页面中的文本模式提取数据"""
    rows = []
    
    # hfplg.com 的数据有时以纯文本格式呈现
    # 模式：分数 + 空格/制表符 + 人数 + 空格/制表符 + 累计人数
    # 尝试多种分隔符
    
    # 方法1：连续数字模式（类似 "695 12 76" 的格式）
    patterns = [
        re.compile(r'(\d{3})\s+(\d+)\s+(\d+)', re.MULTILINE),  # 3位数分数
        re.compile(r'>(\d{3})</td>\s*<td[^>]*>(\d+)</td>\s*<td[^>]*>(\d+)</td>', re.DOTALL),  # table格式
    ]
    
    seen_scores = set()
    for pattern in patterns:
        for match in pattern.finditer(html):
            score = int(match.group(1))
            count = int(match.group(2))
            cumulative = int(match.group(3))
            
            if score in seen_scores:
                continue
            seen_scores.add(score)
            
            if 100 <= score <= 750 and 0 < count <= 50000 and count <= cumulative:
                rows.append((score, count, cumulative))
    
    return rows

def save_csv(province, category, rows, filepath):
    """保存为 CSV 文件"""
    rows.sort(key=lambda x: x[0], reverse=True)  # 按分数降序
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['score', 'count_this_score', 'cumulative_count'])
        for score, count, cumulative in rows:
            writer.writerow([score, count, cumulative])

def crawl_one(name, url):
    """爬取一个省的数据"""
    print(f"\n{'='*50}")
    print(f"正在爬取: {name}")
    print(f"URL: {url}")
    
    html = fetch_html(url)
    print(f"HTML 长度: {len(html)} 字符")
    
    # 尝试多种解析方法
    rows = parse_hfplg_table(html)
    
    if not rows:
        print("方法1（表格解析）无结果，尝试方法2（文本模式）...")
        rows = parse_hfplg_from_text(html)
    
    if not rows:
        # 最后手段：打印 HTML 中的表格区域供调试
        table_area = re.search(r'<table[^>]*>(.*?)</table>', html, re.DOTALL)
        if table_area:
            print("表格区域前500字符:")
            print(table_area.group(1)[:500])
        else:
            # 查找可能的 JSON 数据
            json_match = re.search(r'var\s+\w+\s*=\s*(\[.*?\]);', html, re.DOTALL)
            if json_match:
                print("找到 JSON 数据:")
                print(json_match.group(1)[:500])
            else:
                print("未找到表格数据。HTML 前2000字符:")
                # 找到有内容的区域
                body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL | re.IGNORECASE)
                if body_match:
                    clean = re.sub(r'<script[^>]*>.*?</script>', '', body_match.group(1), flags=re.DOTALL)
                    clean = re.sub(r'<style[^>]*>.*?</style>', '', clean, flags=re.DOTALL)
                    clean = re.sub(r'<[^>]+>', ' ', clean)
                    clean = re.sub(r'\s+', ' ', clean)
                    # 找包含数字的部分
                    segments = re.findall(r'\d{3}\s+\d+\s+\d+', clean)
                    if segments:
                        print(f"找到 {len(segments)} 个匹配段落:")
                        for s in segments[:5]:
                            print(f"  {s}")
                    else:
                        print("未找到数字模式")
        return None
    
    # 检查数据合理性
    if rows:
        rows.sort(key=lambda x: x[0], reverse=True)
        print(f"解析到 {len(rows)} 条数据")
        print(f"分数范围: {rows[0][0]} - {rows[-1][0]}")
        print(f"最高分人数: {rows[0][1]}, 累计: {rows[0][2]}")
        print(f"最低分人数: {rows[-1][1]}, 累计: {rows[-1][2]}")
        print(f"前5行: {rows[:5]}")
        print(f"后5行: {rows[-5:]}")
        
        # 验证累计人数的合理性
        total = rows[0][2]  # 最高分的累计人数应该等于该分人数
        last_cumulative = rows[-1][2]
        print(f"总累计人数（最低分）: {last_cumulative}")
    
    return rows

if __name__ == '__main__':
    if len(sys.argv) > 1:
        # 爬取指定的省份
        for name in sys.argv[1:]:
            if name in URLS:
                rows = crawl_one(name, URLS[name])
                if rows:
                    province, category = name.split('_')
                    filepath = os.path.join(DATA_DIR, f'2024_{province}_{category}.csv')
                    save_csv(province, category, rows, filepath)
                    print(f"已保存: {filepath}")
            else:
                print(f"未知省份: {name}，可用: {list(URLS.keys())}")
    else:
        # 爬取所有
        for name, url in URLS.items():
            rows = crawl_one(name, url)
            if rows:
                province, category = name.split('_')
                filepath = os.path.join(DATA_DIR, f'2024_{province}_{category}.csv')
                save_csv(province, category, rows, filepath)
                print(f"已保存: {filepath}")
