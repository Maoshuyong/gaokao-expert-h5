#!/usr/bin/env node
/**
 * 用 Playwright 从各省考试院官网批量抓取一分一段表
 * 策略：
 * 1. 河南考试院 haeea.cn 有纯 HTML 表格
 * 2. 四川考试院 sceea.cn 有纯 HTML 表格
 * 3. 湖南考试院 hneeb.cn 有纯 HTML 表格
 * 4. 河北考试院 hebeea.edu.cn 可能有 PDF
 * 5. 江苏 jseea.cn 有图片
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'score_rank_data');
fs.mkdirSync(OUT_DIR, { recursive: true });

function parseTableFromHTML(html) {
  // 从 HTML 中提取表格数据
  const data = [];
  const trRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
  let match;
  
  while ((match = trRegex.exec(html)) !== null) {
    const row = match[1];
    const tdRegex = /<t[dh][^>]*>(.*?)<\/t[dh]>/gis;
    const cells = [];
    let cellMatch;
    while ((cellMatch = tdRegex.exec(row)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]*>/g, '').trim());
    }
    
    for (let i = 0; i < cells.length; i++) {
      try {
        const score = parseInt(cells[i]);
        if (score >= 100 && score <= 800 && i + 2 < cells.length) {
          const count = parseInt(cells[i+1].replace(/,/g, ''));
          const cum = parseInt(cells[i+2].replace(/,/g, ''));
          if (!isNaN(count) && !isNaN(cum) && cum >= 0 && cum <= 2000000) {
            data.push({ score, count, cum });
          }
        }
      } catch(e) {}
    }
  }
  
  // 去重排序
  const seen = new Set();
  const unique = [];
  for (const item of data.sort((a, b) => b.score - a.score)) {
    if (!seen.has(item.score)) {
      seen.add(item.score);
      unique.push(item);
    }
  }
  return unique;
}

function parseTableFromText(text) {
  const data = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(\d{2,3})\s+(\d[\d,]*)\s+(\d[\d,]*)$/);
    if (match) {
      const score = parseInt(match[1]);
      const count = parseInt(match[2].replace(/,/g, ''));
      const cum = parseInt(match[3].replace(/,/g, ''));
      if (score >= 100 && score <= 800 && count >= 0 && cum >= 0 && cum <= 2000000) {
        data.push({ score, count, cum });
      }
    }
  }
  
  const seen = new Set();
  const unique = [];
  for (const item of data.sort((a, b) => b.score - a.score)) {
    if (!seen.has(item.score)) {
      seen.add(item.score);
      unique.push(item);
    }
  }
  return unique;
}

function saveCSV(province, category, data) {
  const csvPath = path.join(OUT_DIR, `2024_${province}_${category}.csv`);
  const header = 'score,count_this_score,cumulative_count\n';
  const rows = data.map(d => `${d.score},${d.count},${d.cum}`).join('\n');
  fs.writeFileSync(csvPath, header + rows + '\n', 'utf-8');
  console.log(`  ✅ ${province}_${category}: ${data.length} 条, ${data[0]?.score}-${data[data.length-1]?.score}, 累计 ${data[data.length-1]?.cum?.toLocaleString()}`);
}

async function crawlPage(browser, url, waitMs = 5000) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(waitMs);
    
    // 尝试从 table 提取
    const html = await page.content();
    let data = parseTableFromHTML(html);
    
    if (data.length > 50) return data;
    
    // 尝试从纯文本提取
    const text = await page.evaluate(() => document.body.innerText);
    data = parseTableFromText(text);
    
    if (data.length > 50) return data;
    
    // 尝试点击展开按钮
    const expandButtons = await page.$$('a:has-text("文科"), a:has-text("理科"), a:has-text("物理"), a:has-text("历史"), a:has-text("展开"), a:has-text("查看")');
    for (const btn of expandButtons) {
      try {
        await btn.click();
        await page.waitForTimeout(2000);
        const newHtml = await page.content();
        data = parseTableFromHTML(newHtml);
        if (data.length > 50) return data;
      } catch(e) {}
    }
    
    return data;
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  // 1. 河南考试院
  console.log('\n=== 河南 ===');
  try {
    // 河南考试院有分页面
    const url = 'https://www.haeea.cn/a/202406/43344_af412c0e.shtml';
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(5000);
    
    // 找所有链接
    const links = await page.$$eval('a', els => els.map(e => ({
      text: e.innerText.trim(),
      href: e.href
    })).filter(e => e.text.includes('文科') || e.text.includes('理科') || e.text.includes('分数段')));
    
    console.log('  找到链接:', links.length);
    for (const link of links) {
      console.log(`  ${link.text}: ${link.href}`);
    }
    
    // 点击文科链接
    for (const link of links) {
      if (link.text.includes('文科') && !link.text.includes('对口')) {
        console.log(`  访问: ${link.text}`);
        const data = await crawlPage(browser, link.href);
        if (data.length > 50) saveCSV('河南', '文科', data);
      }
    }
    
    // 点击理科链接
    for (const link of links) {
      if (link.text.includes('理科') && !link.text.includes('对口')) {
        console.log(`  访问: ${link.text}`);
        const data = await crawlPage(browser, link.href);
        if (data.length > 50) saveCSV('河南', '理科', data);
      }
    }
    
    await page.close();
  } catch(e) {
    console.error(`  ❌ 河南: ${e.message}`);
  }
  
  // 2. 四川考试院
  console.log('\n=== 四川 ===');
  try {
    const url = 'https://www.sceea.cn/Html/202406/Newsdetail_3743.html';
    const data = await crawlPage(browser, url, 8000);
    if (data.length > 50) saveCSV('四川', '文科', data);
    else console.log(`  ❌ 四川文科: 解析到 ${data.length} 条`);
    
    // 理科页面
    const url2 = 'https://www.sceea.cn/Html/202406/Newsdetail_3744.html';
    const data2 = await crawlPage(browser, url2, 8000);
    if (data2.length > 50) saveCSV('四川', '理科', data2);
    else console.log(`  ❌ 四川理科: 解析到 ${data2.length} 条`);
  } catch(e) {
    console.error(`  ❌ 四川: ${e.message}`);
  }
  
  // 3. 河北考试院
  console.log('\n=== 河北 ===');
  try {
    const url = 'http://www.hebeea.edu.cn/html/zkks/cjgk/index.html';
    const data = await crawlPage(browser, url);
    if (data.length > 50) saveCSV('河北', '物理类', data);
    else console.log(`  ❌ 河北: 解析到 ${data.length} 条`);
  } catch(e) {
    console.error(`  ❌ 河北: ${e.message}`);
  }
  
  await browser.close();
  console.log('\n=== 完成 ===');
})();
