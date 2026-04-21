#!/usr/bin/env node
/**
 * 用 Playwright 从掌上高考 (gaokao.cn) 交互式提取一分一段表
 * 策略：模拟用户操作，选择省份/年份/科类，等待表格渲染后提取
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'score_rank_data');
fs.mkdirSync(OUT_DIR, { recursive: true });

// province_id 映射
const PROVINCE_MAP = {
  '河南': '41', '四川': '51', '湖北': '42', '湖南': '43',
  '江苏': '32', '河北': '13', '陕西': '61'
};

// 科类映射
const CAT_MAP = {
  '文科': '1', '理科': '2',
  '历史类': '3', '物理类': '4'
};

const targets = [
  { prov: '河南', cat: '文科', catName: '文科' },
  { prov: '河南', cat: '理科', catName: '理科' },
  { prov: '湖南', cat: '物理类', catName: '物理类' },
  { prov: '四川', cat: '文科', catName: '文科' },
  { prov: '四川', cat: '理科', catName: '理科' },
  { prov: '河北', cat: '物理类', catName: '物理类' },
  { prov: '河北', cat: '历史类', catName: '历史类' },
  { prov: '江苏', cat: '物理类', catName: '物理类' },
  { prov: '江苏', cat: '历史类', catName: '历史类' },
];

function parseTableRows(text) {
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
  if (fs.existsSync(csvPath)) {
    const lines = fs.readFileSync(csvPath, 'utf-8').split('\n').length;
    if (lines > 50) {
      console.log(`  ⏭️ 已存在 (${lines-1} 条)`);
      return false;
    }
  }
  const header = 'score,count_this_score,cumulative_count\n';
  const rows = data.map(d => `${d.score},${d.count},${d.cum}`).join('\n');
  fs.writeFileSync(csvPath, header + rows + '\n', 'utf-8');
  console.log(`  ✅ ${province}_${category}: ${data.length} 条, ${data[0]?.score}-${data[data.length-1]?.score}, 累计 ${data[data.length-1]?.cum?.toLocaleString()}`);
  return true;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // 拦截 API 请求
  const apiData = {};
  page.on('response', async res => {
    const url = res.url();
    try {
      const ct = res.headers()['content-type'] || '';
      if (ct.includes('json') && (url.includes('section') || url.includes('score') || url.includes('rank') || url.includes('fraction'))) {
        const body = await res.text();
        if (body.length > 100 && body.length < 500000) {
          apiData[url] = { body: body.substring(0, 500), size: body.length };
        }
      }
    } catch(e) {}
  });
  
  try {
    console.log('加载掌上高考一分一段页面...');
    await page.goto('https://www.gaokao.cn/colleges/bypart', { 
      waitUntil: 'domcontentloaded', timeout: 30000 
    });
    await page.waitForTimeout(5000);
    
    // 打印页面结构
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('页面:', bodyText.substring(0, 200));
    
    // 找到 tab 切换
    const tabs = await page.$$eval('[class*=tab] span, [class*=tab] a, li[class*=active]', 
      els => els.slice(0, 10).map(e => e.innerText.trim()));
    console.log('Tabs:', tabs);
    
    // 找所有省份选项
    const options = await page.$$eval('li, option, [class*=item], [class*=option]',
      els => els.filter(e => /河南|四川|湖北|湖南|江苏|河北|陕西/.test(e.innerText)).slice(0, 20).map(e => e.innerText.trim().substring(0, 30)));
    console.log('省份选项:', options);
    
    // 尝试 URL 参数方式
    // https://www.gaokao.cn/colleges/bypart?province=河南&year=2024&type=文科
    const testUrl = 'https://www.gaokao.cn/colleges/bypart?province=河南&year=2024';
    console.log(`\n测试 URL 参数: ${testUrl}`);
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(5000);
    
    const text2 = await page.evaluate(() => document.body.innerText);
    console.log('URL参数结果:', text2.substring(0, 300));
    
    // 检查表格
    const tables = await page.$$('table');
    console.log(`表格数: ${tables.length}`);
    
    // 打印捕获到的 API
    console.log('\n捕获到的 API:', Object.keys(apiData).length);
    for (const [url, info] of Object.entries(apiData)) {
      console.log(`  ${url.substring(0, 100)} (${info.size} bytes)`);
      console.log(`  ${info.body.substring(0, 100)}`);
    }
    
  } catch(e) {
    console.error('Error:', e.message);
  }
  
  await browser.close();
  console.log('\n=== 完成 ===');
})();
