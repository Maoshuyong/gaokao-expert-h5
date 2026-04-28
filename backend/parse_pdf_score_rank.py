#!/usr/bin/env python3
"""
从 PDF 文件解析一分一段表数据并保存为 CSV
"""

import pdfplumber
import csv
import os
import re

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "score_rank_data")
DOWNLOADS_DIR = os.path.join(OUTPUT_DIR, "downloads")


def parse_zj_2025(pdf_path, output_path):
    """解析浙江省2025年一分一段表PDF"""
    all_data = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if len(row) >= 3 and row[0] != '总分':
                        score_str = str(row[0]).replace('↑', '').replace('↓', '').strip()
                        count_str = str(row[1]).replace(',', '').strip()
                        cum_str = str(row[2]).replace(',', '').strip()
                        try:
                            score = int(score_str)
                            count = int(count_str) if count_str else 0
                            cumulative = int(cum_str)
                            all_data.append((score, count, cumulative))
                        except (ValueError, IndexError):
                            continue
    
    # 去重排序
    seen = set()
    unique = []
    for row in all_data:
        if row[0] not in seen:
            seen.add(row[0])
            unique.append(row)
    unique.sort(key=lambda x: -x[0])
    
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["score", "count_this_score", "cumulative_count"])
        for row in unique:
            writer.writerow(row)
    
    print(f"  浙江2025: {len(unique)} rows -> {output_path}")
    return len(unique)


def parse_gd_2025(pdf_dir, output_history, output_physics):
    """解析广东省2025年一分一段表PDF（历史和物理）"""
    for pdf_name, output_path in [
        ("1.广东省2025年高考普通类（历史）分数段统计表（含本、专科层次加分）.pdf", output_history),
        ("2.广东省2025年高考普通类（物理）分数段统计表（含本、专科层次加分）.pdf", output_physics),
    ]:
        pdf_path = os.path.join(pdf_dir, pdf_name)
        if not os.path.exists(pdf_path):
            print(f"  PDF not found: {pdf_path}")
            continue
        
        all_data = []
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        if len(row) >= 3:
                            # Skip header rows
                            first_cell = str(row[0]).strip()
                            if first_cell in ['分数', '分数段', '总分'] or not first_cell:
                                continue
                            score_str = first_cell.replace('↑', '').replace('↓', '').replace('≥', '').strip()
                            count_str = str(row[1]).replace(',', '').strip()
                            cum_str = str(row[2]).replace(',', '').strip() if len(row) > 2 else ''
                            try:
                                score = int(score_str)
                                count = int(count_str) if count_str else 0
                                cumulative = int(cum_str) if cum_str else 0
                                all_data.append((score, count, cumulative))
                            except (ValueError, IndexError):
                                continue
        
        seen = set()
        unique = []
        for row in all_data:
            if row[0] not in seen:
                seen.add(row[0])
                unique.append(row)
        unique.sort(key=lambda x: -x[0])
        
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["score", "count_this_score", "cumulative_count"])
            for row in unique:
                writer.writerow(row)
        
        category = "历史" if "历史" in pdf_name else "物理"
        print(f"  广东2025{category}: {len(unique)} rows -> {output_path}")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 1. 浙江2025
    zj_pdf = os.path.join(DOWNLOADS_DIR, "浙江_2025_一分一段.pdf")
    zj_out = os.path.join(OUTPUT_DIR, "2025_浙江_综合.csv")
    if os.path.exists(zj_pdf):
        parse_zj_2025(zj_pdf, zj_out)
    else:
        print(f"浙江2025 PDF not found: {zj_pdf}")
    
    # 2. 广东2025
    gd_dir = os.path.join(DOWNLOADS_DIR, "广东_2025_unzip")
    gd_hist = os.path.join(OUTPUT_DIR, "2025_广东_历史类.csv")
    gd_phys = os.path.join(OUTPUT_DIR, "2025_广东_物理类.csv")
    if os.path.isdir(gd_dir):
        parse_gd_2025(gd_dir, gd_hist, gd_phys)
    else:
        print(f"广东2025 dir not found: {gd_dir}")


if __name__ == "__main__":
    main()
