"""
一分一段表批量下载 + 解析脚本
策略：用 Playwright 从各省考试院官网下载 Excel/PDF 附件，然后解析为 CSV

支持省份（2024）：
- 陕西: gk100 HTML 表格（已爬取）
- 山东: sdzk.cn Excel 附件 ✅
- 浙江: zjzs.net PDF 附件 ✅
- 广东: eea.gd.gov.cn 附件
- 安徽: jyt.ah.gov.cn 附件
- 河南: haeea.cn
- 四川: sceea.cn
- 湖北: hbea.edu.cn PDF
- 湖南: jnee.cn
- 江苏: jseea.cn JPG 图片
- 河北: hebeea.edu.cn
"""

import os
import sys
import subprocess
import json
import csv
import re
import time
from urllib.parse import urljoin

# 确保可用 Node.js 路径
NODE_PATH = "/Users/fengweitao/.workbuddy/binaries/node/workspace/node_modules"
NODE_BIN = "/Users/fengweitao/.workbuddy/binaries/node/versions/22.12.0/bin/node"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOAD_DIR = os.path.join(SCRIPT_DIR, 'score_rank_data', 'downloads')
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'score_rank_data')

# 各省附件下载URL配置
# format: '省份': {'url': '通知页面URL', 'site': '域名'}
PROVINCE_CONFIGS = {
    '山东': {
        'url': 'https://www.sdzk.cn/NewsInfo.aspx?NewsID=6577',
        'download_url': 'https://www.sdzk.cn/Floadup/file/20240625/6385492724297110442689837.xls',
        'format': 'excel',
        'categories': ['综合'],
    },
    '浙江': {
        'url': 'https://www.zjzs.net/art/2024/6/26/art_155_9758.html',
        'download_url': 'https://www.zjzs.net/module/download/downfile.jsp?classid=0&showname=%E6%B5%99%E6%B1%9F%E7%9C%812024%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E6%A0%A1%E6%8B%9B%E7%94%9F%E6%88%90%E7%BB%A9%E5%88%86%E6%95%B0%E6%AE%B5%E8%A1%A8%EF%BC%88%E6%80%BB%E5%88%86%EF%BC%89.pdf&filename=3a2fa631275c4ade92963934126d8062.pdf',
        'format': 'pdf',
        'categories': ['综合'],
    },
    '广东': {
        'url': 'https://eea.gd.gov.cn/ptgk/content/post_4445521.html',
        'download_url': None,  # 需要从页面提取
        'format': 'excel',
        'categories': ['历史类', '物理类'],
    },
    '安徽': {
        'url': 'https://jyt.ah.gov.cn/public/7071/40711918.html',
        'download_url': None,  # 需要从页面提取
        'format': 'excel',
        'categories': ['物理类', '历史类'],
    },
}


def run_node_script(script_content):
    """运行 Node.js 脚本"""
    result = subprocess.run(
        [NODE_BIN, '-e', script_content],
        capture_output=True, text=True, timeout=60,
        env={**os.environ, 'NODE_PATH': NODE_PATH}
    )
    return result.stdout.strip(), result.stderr.strip()


def download_file(url, filepath, referer=None):
    """下载文件"""
    import requests
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Referer': referer or url,
    }
    try:
        resp = requests.get(url, headers=headers, timeout=60, stream=True)
        resp.raise_for_status()
        with open(filepath, 'wb') as f:
            for chunk in resp.iter_content(8192):
                f.write(chunk)
        size = os.path.getsize(filepath)
        print(f"  ✅ 下载成功: {os.path.basename(filepath)} ({size:,} bytes)")
        return True
    except Exception as e:
        print(f"  ❌ 下载失败: {e}")
        return False


def find_download_links(page_url):
    """用 Playwright 找页面中的附件下载链接"""
    script = f"""
const {{ chromium }} = require('playwright');
(async () => {{
  const browser = await chromium.launch({{ headless: true }});
  const page = await browser.newPage();
  try {{
    await page.goto('{page_url}', {{ waitUntil: 'domcontentloaded', timeout: 20000 }});
    await page.waitForTimeout(3000);
    
    const links = await page.$$eval('a', els => els.map(e => ({{
      text: e.innerText.trim().substring(0, 100),
      href: e.href
    }})).filter(e => 
      e.href.includes('.xls') || e.href.includes('.xlsx') || e.href.includes('.pdf') ||
      e.text.includes('附件') || e.text.includes('下载') || e.text.includes('一分一段') ||
      e.text.includes('分段') || e.text.includes('统计表')
    ));
    
    console.log(JSON.stringify(links));
  }} catch(e) {{
    console.error('Error: ' + e.message);
  }}
  await browser.close();
}})();
"""
    stdout, stderr = run_node_script(script)
    if stdout:
        try:
            return json.loads(stdout)
        except json.JSONDecodeError:
            return []
    return []


def parse_excel(filepath, categories):
    """解析 Excel 文件为一分一段数据"""
    import xlrd
    
    wb = xlrd.open_workbook(filepath)
    results = {}
    
    for sheet_name in wb.sheet_names():
        sheet = wb.sheet_by_name(sheet_name)
        
        # 解析表头，确定列位置
        header_row1 = [str(sheet.cell_value(0, c)).strip() for c in range(sheet.ncols)]
        header_row2 = [str(sheet.cell_value(1, c)).strip() for c in range(sheet.ncols)]
        
        # 查找分数列、人数列、累计列
        score_col = None
        count_col = None
        cum_col = None
        
        for c in range(sheet.ncols):
            val = str(sheet.cell_value(0, c)).strip()
            if '分数' in val:
                score_col = c
            elif '本段' in val or '人数' in header_row2[c] if c < len(header_row2) else False:
                count_col = c
            elif '累计' in header_row2[c] if c < len(header_row2) else False:
                cum_col = c
        
        # 如果表头解析失败，用默认列
        if score_col is None:
            score_col = 0
        if count_col is None:
            count_col = 1
        if cum_col is None:
            cum_col = 2
        
        # 跳过标题行
        start_row = 2 if '一分一段' in str(sheet.cell_value(0, 0)) else 1
        
        data = []
        for r in range(start_row, sheet.nrows):
            try:
                score = sheet.cell_value(r, score_col)
                count = sheet.cell_value(r, count_col)
                cum = sheet.cell_value(r, cum_col)
                
                score = int(score)
                count = int(count) if count else 0
                cum = int(cum) if cum else 0
                
                if 100 <= score <= 800:
                    data.append((score, count, cum))
            except (ValueError, TypeError):
                continue
        
        if data:
            # 用第一个科类（或"综合"）
            cat = categories[0] if categories else '综合'
            results[cat] = data
    
    return results


def parse_excel_multi_column(filepath):
    """解析 Excel 多列格式（如山东按选科分列）"""
    import xlrd
    
    wb = xlrd.open_workbook(filepath)
    results = {}
    
    for sheet_name in wb.sheet_names():
        sheet = wb.sheet_by_name(sheet_name)
        
        # 解析表头
        # Row 0: "2024年夏季高考文化成绩一分一段表"
        # Row 1: 分数段 | 全体 | | 选考物理 | | ...
        # Row 2: | 本段人数 | 累计人数 | 本段人数 | 累计人数 | ...
        
        # 找"全体"的列位置
        all_col = None
        for c in range(sheet.ncols):
            val = str(sheet.cell_value(1, c)).strip()
            if val == '全体':
                all_col = c
                break
        
        if all_col is None:
            # fallback: 用第一列（本段人数）和第二列（累计人数）
            all_col = 1
        
        start_row = 3
        data = []
        for r in range(start_row, sheet.nrows):
            try:
                score = int(sheet.cell_value(r, 0))
                count = int(sheet.cell_value(r, all_col))
                cum = int(sheet.cell_value(r, all_col + 1))
                
                if 100 <= score <= 800:
                    data.append((score, count, cum))
            except (ValueError, TypeError):
                continue
        
        if data:
            results['综合'] = data
    
    return results


def parse_pdf(filepath, categories):
    """解析 PDF 文件为一分一段数据"""
    try:
        import pdfplumber
    except ImportError:
        print("  ⚠️ 需要安装 pdfplumber: pip install pdfplumber")
        return {}
    
    results = {}
    
    with pdfplumber.open(filepath) as pdf:
        all_text = ''
        all_tables = []
        
        for page in pdf.pages:
            text = page.extract_text() or ''
            all_text += text + '\n'
            
            tables = page.extract_tables()
            if tables:
                all_tables.extend(tables)
    
    # 尝试从表格提取（合并所有表格）
    if all_tables:
        data = []
        for table in all_tables:
            for row in table:
                if not row or len(row) < 3:
                    continue
                try:
                    score_text = str(row[0]).strip()
                    # 处理 "699↑" 格式
                    score = int(re.match(r'(\d+)', score_text).group(1))
                    count = int(str(row[1]).strip().replace(',', ''))
                    cum = int(str(row[2]).strip().replace(',', ''))
                    if 100 <= score <= 800:
                        data.append((score, count, cum))
                except (ValueError, TypeError, AttributeError):
                    continue
        
        if data:
            # 去重并按分数排序
            seen = set()
            unique_data = []
            for item in sorted(data, key=lambda x: -x[0]):
                if item[0] not in seen:
                    seen.add(item[0])
                    unique_data.append(item)
            
            cat = categories[0] if categories else '综合'
            results[cat] = unique_data
    
    # 如果表格提取失败，尝试从文本提取
    if not results:
        data = []
        for line in all_text.split('\n'):
            line = line.strip()
            if not line or '总分' in line or '分数段' in line:
                continue
            # 每行可能有多个3列组（PDF一页排了3列）
            numbers = re.findall(r'(\d+)\s+(\d+)\s+(\d+)', line.replace(',', ''))
            for match in numbers:
                try:
                    score = int(match[0])
                    count = int(match[1])
                    cum = int(match[2])
                    if 100 <= score <= 800:
                        data.append((score, count, cum))
                except (ValueError, TypeError):
                    continue
        
        if data:
            seen = set()
            unique_data = []
            for item in sorted(data, key=lambda x: -x[0]):
                if item[0] not in seen:
                    seen.add(item[0])
                    unique_data.append(item)
            
            cat = categories[0] if categories else '综合'
            results[cat] = unique_data
    
    return results


def save_csv(province, year, results):
    """保存到CSV"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    for category, data in results.items():
        filepath = os.path.join(OUTPUT_DIR, f'{year}_{province}_{category}.csv')
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['score', 'count_this_score', 'cumulative_count'])
            for score, count, cumulative in data:
                writer.writerow([score, count, cumulative])
        print(f"  💾 已保存: {filepath} ({len(data)} 条)")


def process_province(province, config, year=2024):
    """处理单个省份"""
    print(f"\n{'='*50}")
    print(f"📊 处理 {province}...")
    print(f"{'='*50}")
    
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    
    # 确定下载URL
    download_url = config.get('download_url')
    
    if not download_url:
        # 需要从页面提取
        print(f"  🔍 从页面查找附件链接: {config['url']}")
        links = find_download_links(config['url'])
        
        if links:
            print(f"  📎 找到 {len(links)} 个链接:")
            for link in links:
                print(f"     {link['text']}: {link['href'][:80]}")
            
            # 找 xls/xlsx/pdf
            for link in links:
                href = link['href']
                if any(ext in href.lower() for ext in ['.xls', '.xlsx', '.pdf']):
                    download_url = href
                    break
        
        if not download_url:
            print(f"  ❌ 未找到下载链接")
            return {}
    
    print(f"  📥 下载: {download_url[:80]}...")
    
    # 确定文件扩展名
    fmt = config.get('format', 'unknown')
    if '.pdf' in download_url:
        ext = '.pdf'
        fmt = 'pdf'
    elif '.xlsx' in download_url:
        ext = '.xlsx'
        fmt = 'excel'
    elif '.xls' in download_url:
        ext = '.xls'
        fmt = 'excel'
    else:
        ext = f'.{fmt}'
    
    filepath = os.path.join(DOWNLOAD_DIR, f'{province}_2024_一分一段{ext}')
    
    # 下载文件
    if not os.path.exists(filepath) or os.path.getsize(filepath) < 1000:
        referer = config.get('url', download_url)
        if not download_file(download_url, filepath, referer):
            return {}
    else:
        print(f"  ✅ 已存在: {os.path.basename(filepath)}")
    
    # 解析文件
    print(f"  🔧 解析 {fmt} 文件...")
    
    if fmt == 'excel':
        if '山东' in province:
            results = parse_excel_multi_column(filepath)
        else:
            results = parse_excel(filepath, config.get('categories', []))
    elif fmt == 'pdf':
        results = parse_pdf(filepath, config.get('categories', []))
    else:
        print(f"  ❌ 不支持的格式: {fmt}")
        return {}
    
    # 输出结果
    for cat, data in results.items():
        if data:
            print(f"  ✅ {cat}: {len(data)} 条")
            print(f"     分数范围: {data[0][0]} ~ {data[-1][0]}, 最高累计: {data[0][2]:,}")
    
    # 保存CSV
    if results:
        save_csv(province, year, results)
    
    return results


def process_all():
    """处理所有配置的省份"""
    year = 2024
    all_results = {}
    
    for province, config in sorted(PROVINCE_CONFIGS.items()):
        results = process_province(province, config, year)
        if results:
            all_results[province] = results
        time.sleep(2)
    
    # 汇总
    print(f"\n{'='*60}")
    print(f"📊 批量下载解析完成")
    print(f"{'='*60}")
    
    for province, results in sorted(all_results.items()):
        for cat, data in results.items():
            print(f"  {province} {cat}: {len(data)} 条, 分数 {data[0][0]}-{data[-1][0]}, 累计 {data[-1][2]:,}")
    
    return all_results


if __name__ == '__main__':
    if len(sys.argv) > 1:
        province = sys.argv[1]
        if province in PROVINCE_CONFIGS:
            results = process_province(province, PROVINCE_CONFIGS[province])
        else:
            print(f"未知省份: {province}")
            print(f"可选: {', '.join(PROVINCE_CONFIGS.keys())}")
    else:
        process_all()
