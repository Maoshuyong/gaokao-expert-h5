#!/usr/bin/env python3
"""
用 Playwright + web_fetch 混合方式批量爬取一分一段表。
策略：
1. 纯文本源（hneeb.cn）直接用 curl 提取
2. PDF/Excel 附件源用 Playwright 下载并解析
3. JS 渲染源用 Playwright 渲染后提取

先处理可直接用 curl 获取纯文本的省份。
"""

import subprocess
import re
import csv
import os
import sys

OUT_DIR = os.path.join(os.path.dirname(__file__), 'score_rank_data')
os.makedirs(OUT_DIR, exist_ok=True)


def curl_extract_text(url):
    """用 curl 获取页面纯文本"""
    result = subprocess.run(
        ['curl', '-sL', url, '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'],
        capture_output=True, timeout=30
    )
    # 尝试多种编码
    for enc in ['utf-8', 'gbk', 'gb2312', 'gb18030', 'latin-1']:
        try:
            return result.stdout.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return result.stdout.decode('utf-8', errors='replace')


def parse_html_table(html_text, category=''):
    """从 HTML 文本中解析一分一段表"""
    data = []
    
    # 找到所有 <tr> 行
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html_text, re.DOTALL)
    for row in rows:
        cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.DOTALL)
        # 清除 HTML 标签
        clean_cells = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
        
        # 尝试匹配 "分数 | 人数 | 累计人数" 模式
        for i in range(len(clean_cells)):
            try:
                score = int(clean_cells[i].strip())
                if not (100 <= score <= 800):
                    continue
                if i + 2 < len(clean_cells):
                    count = int(clean_cells[i+1].strip().replace(',', ''))
                    cum = int(clean_cells[i+2].strip().replace(',', ''))
                else:
                    continue
                if count >= 0 and cum >= 0:
                    data.append((score, count, cum))
            except (ValueError, IndexError):
                continue
    
    # 去重
    seen = set()
    unique = []
    for item in sorted(data, key=lambda x: -x[0]):
        if item[0] not in seen:
            seen.add(item[0])
            unique.append(item)
    
    return unique


def parse_text_table(text, category=''):
    """从纯文本中解析一分一段表"""
    data = []
    lines = text.split('\n')
    
    for line in lines:
        line = line.strip()
        # 匹配模式：数字 数字 数字（可能有空格/制表符分隔）
        matches = re.findall(r'(\d+)\s+(\d+)\s+(\d+)', line)
        for m in matches:
            try:
                score = int(m[0])
                count = int(m[1].replace(',', ''))
                cum = int(m[2].replace(',', ''))
                if 100 <= score <= 800 and count >= 0 and cum >= 0 and cum <= 1000000:
                    data.append((score, count, cum))
            except (ValueError, IndexError):
                continue
    
    # 去重
    seen = set()
    unique = []
    for item in sorted(data, key=lambda x: -x[0]):
        if item[0] not in seen:
            seen.add(item[0])
            unique.append(item)
    
    return unique


def save_csv(province, category, data):
    """保存数据到 CSV"""
    csv_path = os.path.join(OUT_DIR, f'2024_{province}_{category}.csv')
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['score', 'count_this_score', 'cumulative_count'])
        for score, count, cum in data:
            writer.writerow([score, count, cum])
    print(f'✅ {province}_{category}: {len(data)} 条, {data[0][0]}-{data[-1][0]}, 累计 {data[-1][2]:,}')
    return csv_path


if __name__ == '__main__':
    province = sys.argv[1] if len(sys.argv) > 1 else 'all'
    
    if province == '湖南历史':
        # 湖南历史类 - hneeb.cn 纯文本
        url = 'https://www.hneeb.cn/hnxxg/741/742/content_4206.html'
        html = curl_extract_text(url)
        data = parse_html_table(html)
        if data:
            save_csv('湖南', '历史类', data)
        else:
            print('❌ 湖南历史类解析失败')
    
    elif province == '湖南物理':
        # 湖南物理类 - 搜索另一个 URL
        url = 'https://www.hneeb.cn/hnxxg/741/743/content_4207.html'
        html = curl_extract_text(url)
        if '404' not in html and len(html) > 1000:
            data = parse_html_table(html)
            if data:
                save_csv('湖南', '物理类', data)
            else:
                print('❌ 湖南物理类解析失败')
        else:
            print('❌ 湖南物理类页面不存在')
    
    elif province == 'all':
        # 先测试湖南历史
        url = 'https://www.hneeb.cn/hnxxg/741/742/content_4206.html'
        html = curl_extract_text(url)
        data = parse_html_table(html)
        if data:
            save_csv('湖南', '历史类', data)
        
        # 测试湖南物理 - 尝试不同的 content ID
        for cid in range(4200, 4220):
            url = f'https://www.hneeb.cn/hnxxg/741/743/content_{cid}.html'
            html = curl_extract_text(url)
            if '物理' in html and len(html) > 2000:
                data = parse_html_table(html)
                if data and len(data) > 100:
                    save_csv('湖南', '物理类', data)
                    break
