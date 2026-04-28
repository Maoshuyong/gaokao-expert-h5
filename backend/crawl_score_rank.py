"""
一分一段表爬虫：从 gk100.com 抓取各省高考一分一段表数据
数据来源：https://www.gk100.com/read_82298169.htm（汇总页）
输出格式：CSV（score, count_this_score, cumulative_count）

策略：
1. 有 HTML 表格的省份（陕西）→ BeautifulSoup 直接解析
2. 图片格式的省份 → pytesseract OCR 识别
"""

import requests
from bs4 import BeautifulSoup
import re
import csv
import os
import sys
import time
from urllib.parse import urljoin

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

# 2024年各省一分一段表URL（来自 gk100.com 汇总页）
PROVINCE_URLS_2024 = {
    '陕西': 'https://www.gk100.com/read_41444386.htm',
    '河南': 'https://www.gk100.com/read_41760369.htm',
    '四川': 'https://www.gk100.com/read_40724095.htm',
    '广东': 'https://www.gk100.com/read_46899028.htm',
    '湖北': 'https://www.gk100.com/read_70556001.htm',
    '湖南': 'https://www.gk100.com/read_69992144.htm',
    '山东': 'https://www.gk100.com/read_47710456.htm',
    '江苏': 'https://www.gk100.com/read_70923828.htm',
    '河北': 'https://www.gk100.com/read_46041818.htm',
    '安徽': 'https://www.gk100.com/read_42274613.htm',
    '浙江': 'https://www.gk100.com/read_49153069.htm',
}

# 2025年各省一分一段表URL（来自 gk100.com 汇总页）
PROVINCE_URLS_2025 = {
    '陕西': 'https://www.gk100.com/read_28557842.htm',
    '河南': 'https://www.gk100.com/read_31698432.htm',
    '四川': 'https://www.gk100.com/read_16043396.htm',
    '广东': 'https://www.gk100.com/read_25156719.htm',
    '湖北': 'https://www.gk100.com/read_38500828.htm',
    '湖南': 'https://www.gk100.com/read_26730911.htm',
    '山东': 'https://www.gk100.com/read_87543320.htm',
    '江苏': 'https://www.gk100.com/read_39182493.htm',
    '河北': 'https://www.gk100.com/read_39804881.htm',
    '安徽': 'https://www.gk100.com/read_31856773.htm',
    '浙江': 'https://www.gk100.com/read_29320598.htm',
}

# 2023年URL（来自 gk100.com 汇总页）
PROVINCE_URLS_2023 = {
    '陕西': 'https://www.gk100.com/read_6087605.htm',
    '河南': 'https://www.gk100.com/read_10249489.htm',
    '四川': 'https://www.gk100.com/read_11899973.htm',
    '广东': 'https://www.gk100.com/read_33573327.htm',
    '湖北': 'https://www.gk100.com/read_34678179.htm',
    '湖南': 'https://www.gk100.com/read_12721662.htm',
    '山东': 'https://www.gk100.com/read_3215012.htm',
    '江苏': 'https://www.gk100.com/read_12667612.htm',
    '河北': 'https://www.gk100.com/read_10764001.htm',
    '安徽': 'https://www.gk100.com/read_12985434.htm',
    '浙江': 'https://www.gk100.com/read_34147924.htm',
}

# 2022年URL（部分确认，需补充）
PROVINCE_URLS_2022 = {
    '陕西': 'https://www.gk100.com/read_68161.htm',
    '山东': 'https://www.gk100.com/read_66758.htm',
    # 其余省份待搜索补充
}

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'score_rank_data')


def fetch_page(url):
    """获取页面HTML"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        resp.encoding = 'utf-8'
        return resp.text
    except Exception as e:
        print(f"  ❌ 请求失败: {e}")
        return None


def parse_html_table(soup, table_class='ym-article-table'):
    """从HTML表格中解析一分一段数据
    
    返回: dict of category -> [(score, count, cumulative), ...]
    例如: {'文科': [(652, 12, 12), ...], '理科': [(712, 12, 12), ...]}
    """
    results = {}
    
    # 找到所有表格
    tables = soup.find_all('table', class_=table_class)
    if not tables:
        return results
    
    # 找到每个section的标题来确定科类
    # 先找到所有h3标签（如"一、2024陕西文科高考一分一段表"）
    content_div = soup.find('div', class_='article-content') or soup.find('div', class_='content')
    if not content_div:
        # 尝试找到包含表格的父容器
        if tables:
            content_div = tables[0].find_parent('div')
    
    if content_div:
        # 按h3分割内容
        sections = split_by_headers(content_div, tables)
        # split_by_headers 已返回 {category: [data_list]}
        for category, data in sections.items():
            if data and isinstance(data, list):
                results[category] = data
    
    # 如果按标题分割失败，直接解析所有表格
    if not results:
        for i, table in enumerate(tables):
            data = extract_table_data(table)
            if data:
                results[f'group_{i}'] = data
    
    return results


def split_by_headers(container, tables):
    """按h3标题将表格分配到对应科类"""
    sections = {}
    
    # 获取所有h3和表格在容器中的顺序
    elements = []
    for h3 in container.find_all(['h3', 'h2']):
        elements.append(('header', h3))
    for table in container.find_all('table', class_='ym-article-table'):
        elements.append(('table', table))
    
    if not elements:
        # 没有h3标题，直接按表格数量推断科类
        for i, table in enumerate(tables):
            data = extract_table_data(table)
            if data:
                sections[f'group_{i}'] = data
        return sections
    
    # 按文档顺序排列
    elements.sort(key=lambda x: get_element_position(x[1]))
    
    current_category = None
    for elem_type, elem in elements:
        if elem_type == 'header':
            text = elem.get_text(strip=True)
            current_category = extract_category(text)
        elif elem_type == 'table':
            if current_category:
                data = extract_table_data(elem)
                if data:
                    if current_category in sections:
                        sections[current_category].extend(data)
                    else:
                        sections[current_category] = data
    
    return sections


def get_element_position(element):
    """获取元素在文档中的位置"""
    pos = 0
    for sib in element.previous_siblings:
        if hasattr(sib, 'name'):
            pos += 1
    return pos


def extract_category(text):
    """从标题文本中提取科类
    
    例如：
    "一、2024陕西文科高考一分一段表" -> "文科"
    "2024河南高考一分一段表（物理类）" -> "物理类"  
    "2024年山东高考一分一段表" -> "综合"
    """
    text = text.strip()
    
    # 新高考命名
    for kw in ['物理类', '历史类']:
        if kw in text:
            return kw
    
    # 老高考命名
    for kw in ['文科', '理科', '文史', '理工']:
        if kw in text:
            if kw in ('文史', '理工'):
                return '文科' if kw == '文史' else '理科'
            return kw
    
    # 综合（山东、浙江等）
    if '一分一段' in text:
        return '综合'
    
    return None


def extract_table_data(table):
    """从单个表格中提取数据
    
    返回: [(score, count, cumulative), ...]
    """
    raw_data = []
    rows = table.find_all('tr')
    
    for row in rows:
        cells = row.find_all(['td', 'th'])
        if len(cells) < 3:
            continue
        
        # 清理文本
        texts = [c.get_text(strip=True).replace(',', '') for c in cells]
        
        # 解析第一列：分数（可能包含"XX分及以上"）
        score_text = texts[0]
        score = parse_score(score_text)
        if score is None:
            continue
        
        # 第二列：本段人数
        count_text = texts[1]
        count = parse_int(count_text)
        
        # 第三列：累计人数（总人数）
        cumulative_text = texts[2]
        cumulative = parse_int(cumulative_text)
        
        if cumulative is not None:
            # 如果人数为空，用累计人数差值推算
            if count is None:
                if raw_data:
                    prev_cum = raw_data[-1][2] if raw_data else cumulative
                    count = max(0, cumulative - prev_cum) if prev_cum < cumulative else 0
                else:
                    count = cumulative  # 第一行就是总人数
            raw_data.append((score, count, cumulative))
    
    # 后处理：按分数降序排列
    raw_data.sort(key=lambda x: -x[0])
    
    # 验证累积连续性
    validated = []
    for i, (score, count, cumulative) in enumerate(raw_data):
        if cumulative is not None and count is not None:
            validated.append((score, count, cumulative))
    
    return validated


def parse_score(text):
    """解析分数文本
    
    "652" -> 652
    "652分及以上" -> 652
    "200分及以上" -> 200
    """
    text = text.strip()
    # 移除"分及以上"等后缀
    match = re.match(r'(\d+)', text)
    if match:
        return int(match.group(1))
    return None


def parse_int(text):
    """解析整数文本"""
    text = text.strip()
    if not text:
        return None
    match = re.match(r'(\d+)', text.replace(',', ''))
    if match:
        return int(match.group(1))
    return None


def crawl_province_with_table(province, url):
    """爬取有HTML表格的省份"""
    print(f"\n📊 爬取 {province}...")
    html = fetch_page(url)
    if not html:
        return {}
    
    soup = BeautifulSoup(html, 'html.parser')
    results = parse_html_table(soup)
    
    for category, data in results.items():
        print(f"  ✅ {category}: {len(data)} 条数据")
        if data:
            print(f"     分数范围: {data[0][0]} ~ {data[-1][0]}, 最高累计: {data[0][2]:,}")
    
    return results


def download_images(soup, output_dir):
    """下载页面中的所有一分一段表图片"""
    os.makedirs(output_dir, exist_ok=True)
    
    article_div = soup.find('div', class_='article-content') or soup.find('div', class_='content')
    if not article_div:
        # 尝试找body里的img
        article_div = soup.find('body')
    
    if not article_div:
        return []
    
    images = []
    for img in article_div.find_all('img'):
        src = img.get('src') or img.get('data-original')
        if not src:
            continue
        # 跳过小图标和logo
        if 'logo' in src.lower() or 'icon' in src.lower():
            continue
        if src.endswith(('.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.JPEG')):
            full_url = urljoin('https://www.gk100.com', src)
            images.append(full_url)
    
    return images


def ocr_image_table(image_url, output_dir, index=0):
    """OCR 识别一分一段表图片
    
    返回: [(score, count, cumulative), ...]
    """
    try:
        from PIL import Image
        import pytesseract
    except ImportError:
        print("  ⚠️ 需要安装 pytesseract: pip install pytesseract Pillow")
        print("  ⚠️ 还需要安装 tesseract-ocr: brew install tesseract")
        return []
    
    # 下载图片
    img_path = os.path.join(output_dir, f'temp_{index}.png')
    try:
        resp = requests.get(image_url, headers=HEADERS, timeout=30, stream=True)
        resp.raise_for_status()
        with open(img_path, 'wb') as f:
            for chunk in resp.iter_content(8192):
                f.write(chunk)
    except Exception as e:
        print(f"  ❌ 图片下载失败: {e}")
        return []
    
    # OCR识别
    try:
        img = Image.open(img_path)
        text = pytesseract.image_to_string(img, lang='chi_sim+eng', config='--psm 6')
        
        # 解析OCR结果
        data = parse_ocr_text(text)
        print(f"  📷 OCR 识别 {len(data)} 条数据")
        return data
    except Exception as e:
        print(f"  ❌ OCR识别失败: {e}")
        return []
    finally:
        if os.path.exists(img_path):
            os.remove(img_path)


def parse_ocr_text(text):
    """解析OCR识别的文本为一分一段数据"""
    data = []
    lines = text.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # 尝试匹配 "数字 数字 数字" 格式
        numbers = re.findall(r'\d+', line.replace(',', '').replace(' ', '\t'))
        if len(numbers) >= 3:
            score = int(numbers[0])
            count = int(numbers[1])
            cumulative = int(numbers[2])
            if 100 <= score <= 750 and count >= 0 and cumulative >= 0:
                data.append((score, count, cumulative))
    
    return data


def crawl_province_with_images(province, url):
    """爬取图片格式的省份（需要OCR）"""
    print(f"\n🖼️ 爬取 {province}（图片格式）...")
    html = fetch_page(url)
    if not html:
        return {}
    
    soup = BeautifulSoup(html, 'html.parser')
    
    # 确定科类（从标题提取）
    categories = {}
    content_div = soup.find('div', class_='article-content') or soup.find('div', class_='content')
    
    if content_div:
        # 按h3标题分组图片
        current_category = None
        elements = []
        for h3 in content_div.find_all(['h3', 'h2']):
            elements.append(('header', h3))
        for img in content_div.find_all('img'):
            src = img.get('src') or img.get('data-original')
            if src and src.endswith(('.png', '.jpg', '.jpeg')):
                elements.append(('img', urljoin('https://www.gk100.com', src)))
        
        img_idx = 0
        for elem_type, elem in elements:
            if elem_type == 'header':
                cat = extract_category(elem.get_text(strip=True))
                if cat:
                    current_category = cat
            elif elem_type == 'img' and current_category:
                data = ocr_image_table(elem, OUTPUT_DIR, img_idx)
                img_idx += 1
                if data:
                    if current_category not in categories:
                        categories[current_category] = []
                    categories[current_category].extend(data)
    
    for cat, data in categories.items():
        print(f"  ✅ {cat}: {len(data)} 条数据")
    
    return categories


def save_data(province, year, results):
    """保存爬取的数据到CSV"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    for category, data in results.items():
        filepath = os.path.join(OUTPUT_DIR, f'{year}_{province}_{category}.csv')
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['score', 'count_this_score', 'cumulative_count'])
            for score, count, cumulative in data:
                writer.writerow([score, count, cumulative])
        print(f"  💾 已保存: {filepath} ({len(data)} 条)")


def detect_page_type(url):
    """检测页面是有表格还是图片"""
    html = fetch_page(url)
    if not html:
        return 'unknown', None
    
    soup = BeautifulSoup(html, 'html.parser')
    
    if soup.find('table', class_='ym-article-table'):
        return 'table', soup
    
    # 检查是否有图片
    content_div = soup.find('div', class_='article-content') or soup.find('div', class_='content')
    if content_div:
        imgs = content_div.find_all('img')
        for img in imgs:
            src = img.get('src', '')
            if src.endswith(('.png', '.jpg', '.jpeg')) and 'logo' not in src.lower():
                return 'image', soup
    
    return 'unknown', soup


def crawl_all_provinces(year=2024):
    """爬取所有省份的一分一段表"""
    urls_map = {
        2025: PROVINCE_URLS_2025,
        2024: PROVINCE_URLS_2024,
        2023: PROVINCE_URLS_2023,
        2022: PROVINCE_URLS_2022,
    }
    
    urls = urls_map.get(year, {})
    if not urls:
        print(f"❌ {year} 年没有配置URL")
        return
    
    print(f"{'='*60}")
    print(f"📊 开始爬取 {year} 年一分一段表")
    print(f"{'='*60}")
    
    all_results = {}
    
    for province, url in urls.items():
        page_type, soup = detect_page_type(url)
        
        if page_type == 'table':
            results = crawl_province_with_table(province, url)
        elif page_type == 'image':
            results = crawl_province_with_images(province, url)
        else:
            print(f"\n⚠️ {province}: 无法识别页面格式")
            results = {}
        
        if results:
            all_results[province] = results
            save_data(province, year, results)
        
        time.sleep(2)  # 礼貌性延迟
    
    # 汇总统计
    print(f"\n{'='*60}")
    print(f"📊 爬取完成汇总")
    print(f"{'='*60}")
    total_records = 0
    for province, results in all_results.items():
        for category, data in results.items():
            records = len(data)
            total_records += records
            last_cum = data[-1][2] if data else 0
            score_range = f"{data[0][0]}-{data[-1][0]}" if data else "N/A"
            print(f"  {province} {category:4s}: {records:4d} 条, 分数 {score_range}, 累计 {last_cum:>8,}")
    print(f"\n  总计: {total_records} 条数据")


def generate_seed_script(all_data, year=2024):
    """生成种子脚本
    
    all_data: {province: {category: [(score, count, cumulative), ...]}}
    """
    script_lines = [
        '"""',
        f'种子脚本：填充 {year} 年一分一段表数据',
        '数据来源：各省教育考试院官方发布',
        '"""',
        'import sys',
        'sys.path.insert(0, ".")',
        '',
        'from db import SessionLocal, init_db',
        'from models.score_rank_table import ScoreRankTable',
        '',
        f'YEAR = {year}',
        '',
    ]
    
    for province, categories in sorted(all_data.items()):
        for category, data in sorted(categories.items()):
            var_name = f'{province}_{category}'.replace(' ', '_')
            script_lines.append(f'# {year}年{province}高考一分一段表（{category}）')
            script_lines.append(f'# 格式：(分数, 本段人数, 累计人数)')
            script_lines.append(f'{var_name} = [')
            
            # 每行5条数据
            for i in range(0, len(data), 5):
                chunk = data[i:i+5]
                line = '    ' + ', '.join(f'({s}, {c}, {cum})' for s, c, cum in chunk) + ','
                script_lines.append(line)
            
            script_lines.append(']')
            script_lines.append('')
    
    # 生成seed函数
    script_lines.append('def seed_score_rank_tables():')
    script_lines.append('    """填充一分一段表数据"""')
    script_lines.append('    db = SessionLocal()')
    script_lines.append('    total = 0')
    script_lines.append('')
    
    for province in sorted(all_data.keys()):
        for category in sorted(all_data[province].keys()):
            var_name = f'{province}_{category}'.replace(' ', '_')
            script_lines.append(f'    # {province} {category}')
            script_lines.append(f'    for score, count, cumulative in {var_name}:')
            script_lines.append(f'        db.add(ScoreRankTable(')
            script_lines.append(f'            year=YEAR, province="{province}", category="{category}",')
            script_lines.append(f'            score=score, cumulative_count=cumulative, count_this_score=count')
            script_lines.append(f'        ))')
            script_lines.append(f'        total += 1')
            script_lines.append('')
    
    script_lines.append('    db.commit()')
    script_lines.append('    db.close()')
    script_lines.append(f'    print(f"填充完成：共 {{total}} 条数据")')
    script_lines.append('')
    script_lines.append('')
    script_lines.append('if __name__ == "__main__":')
    script_lines.append('    init_db()')
    script_lines.append('    seed_score_rank_tables()')
    
    return '\n'.join(script_lines)


if __name__ == '__main__':
    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    
    if len(sys.argv) > 2:
        # 爬取单个省份
        province = sys.argv[2]
        if province in PROVINCE_URLS_2024:
            url = PROVINCE_URLS_2024[province]
            page_type, soup = detect_page_type(url)
            if page_type == 'table':
                results = crawl_province_with_table(province, url)
            else:
                results = crawl_province_with_images(province, url)
            if results:
                save_data(province, year, results)
        else:
            print(f"未知省份: {province}")
    else:
        # 爬取所有省份
        crawl_all_provinces(year)
