#!/usr/bin/env python3
"""
保存从赶考猫(gankaomao.com)通过web_fetch获取的一分一段表数据。
web_fetch能正确提取gankaomao.com的数据，但curl/Playwright不能。
"""

import csv
import os
import sys

DATA_DIR = os.path.join(os.path.dirname(__file__), 'score_rank_data')
os.makedirs(DATA_DIR, exist_ok=True)

def save_data(province, category, data_text):
    """
    保存赶考猫格式的数据。
    data_text格式：每行 "分数|人数|累计人数"
    """
    rows = []
    for line in data_text.strip().split('\n'):
        line = line.strip()
        if not line or '|' not in line:
            continue
        parts = line.split('|')
        if len(parts) >= 3:
            try:
                score = int(parts[0].strip())
                count = int(parts[1].strip())
                cumulative = int(parts[2].strip())
                rows.append((score, count, cumulative))
            except ValueError:
                continue
    
    if not rows:
        print(f"❌ 无有效数据")
        return False
    
    # 按分数降序排列
    rows.sort(key=lambda x: x[0], reverse=True)
    
    filepath = os.path.join(DATA_DIR, f'2024_{province}_{category}.csv')
    
    # 检查是否已有数据
    if os.path.exists(filepath):
        existing_lines = sum(1 for _ in open(filepath)) - 1
        if existing_lines > rows.count:
            print(f"⏭️ 已有 {existing_lines} 条，新数据 {len(rows)} 条，跳过")
            return True
    
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['score', 'count_this_score', 'cumulative_count'])
        for score, count, cumulative in rows:
            writer.writerow([score, count, cumulative])
    
    print(f"✅ {province}_{category}: {len(rows)} 条 ({rows[0][0]}-{rows[-1][0]}), 累计 {rows[-1][2]}")
    return True

if __name__ == '__main__':
    print("此脚本用于手动保存web_fetch提取的数据。")
    print("使用方式：在代码中填入data_text后运行")
