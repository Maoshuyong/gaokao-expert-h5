#!/usr/bin/env node
/**
 * 从掌上高考交互式抓取一分一段表 - 强制点击版
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'score_rank_data');
fs.mkdirSync(OUT_DIR, { recursive: true });

// 目标: 需要爬取的省份和科类
const targets = [
  { prov: '河南', cats: ['文科', '理科'] },
  { prov: '湖南', cats: ['物理类'] },
  { prov: '四川', cats: ['文科', '理科'] },
  { prov: '河北', cats: ['物理类', '历史类'] },
  { prov: '江苏', cats: ['物理类', '历史类'] },
];

function parseSectionData(jsonData) {
  const data = [];
  const search = jsonData?.data?.search;
  if (!search) return data;
  
  for (const [scoreRange, info] of Object.entries(search)) {
    const match = scoreRange.match(/^(\d+)/);
    if (!match) continue;
    const score = parseInt(match[1]);
    const num = parseInt(String(info.num || '0').replace(/,/g, ''));
    const total = parseInt(String(info.total || '0').replace(/,/g, ''));
    if (score >= 100 && score <= 800 && num >= 0 && total >= 0) {
      data.push({ score, count: num, cum: total });
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
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').length;
    if (lines > 50) return false;
  }
  const header = 'score,count_this_score,cumulative_count\n';
  const rows = data.map(d => `${d.score},${d.count},${d.cum}`).join('\n');
  fs.writeFileSync(csvPath, header + rows + '\n', 'utf-8');
  console.log(`  ✅ ${province}_${category}: ${data.length} 条, ${data[0]?.score}-${data[data.length-1]?.score}, 累计 ${data[data.length-1]?.cum?.toLocaleString()}`);
  return true;
}

(async () => {
  const browser = await chromium.launch({ headless: false });  // 非headless模式
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  for (const target of targets) {
    console.log(`\n=== ${target.prov} ===`);
    
    try {
      await page.goto('https://www.gaokao.cn/colleges/bypart', { 
        waitUntil: 'domcontentloaded', timeout: 20000 
      });
      await page.waitForTimeout(4000);
      
      // 关闭可能存在的弹窗
      try { await page.click('.close-btn, [class*=close]', { timeout: 1000 }); } catch(e) {}
      await page.waitForTimeout(500);
      
      // 先点击省份选择器
      const provSwitch = page.locator('.province-switch').first();
      if (await provSwitch.isVisible()) {
        await provSwitch.click({ force: true });
        await page.waitForTimeout(1000);
      }
      
      // 点击目标省份（强制）
      const provLocator = page.locator(`.province-switch_item__2GoSI:has-text("${target.prov}")`).first();
      await provLocator.click({ force: true, timeout: 5000 });
      await page.waitForTimeout(2000);
      
      // 点击一分一段 tab（如果有）
      try {
        await page.locator('text=一分一段').first().click({ force: true, timeout: 2000 });
        await page.waitForTimeout(2000);
      } catch(e) {}
      
      for (const cat of target.cats) {
        console.log(`  科类: ${cat}`);
        
        // 拦截 API
        let capturedJson = null;
        const handler = async (route) => {
          const url = route.request().url();
          if (url.includes('section2021') && url.includes('lists.json') && url.includes('2024')) {
            try {
              const response = await route.fetch();
              const body = await response.text();
              if (body.length > 200) {
                capturedJson = JSON.parse(body);
                console.log(`    捕获 API: ${url.substring(0, 100)} (${body.length} bytes)`);
              }
              await route.fulfill({ response });
            } catch(e) {
              route.continue();
            }
          } else {
            route.continue();
          }
        };
        
        await page.route('**/*', handler);
        
        // 点击科类（强制）
        try {
          await page.locator(`text=${cat}`).first().click({ force: true, timeout: 3000 });
          await page.waitForTimeout(3000);
        } catch(e) {
          console.log(`    无法点击 ${cat}: ${e.message.substring(0, 50)}`);
        }
        
        // 检查是否需要选年份
        try {
          await page.locator('text=2024').first().click({ force: true, timeout: 1000 });
          await page.waitForTimeout(2000);
        } catch(e) {}
        
        await page.unroute('**/*', handler);
        
        if (capturedJson) {
          const data = parseSectionData(capturedJson);
          if (data.length > 10) {
            saveCSV(target.prov, cat, data);
          } else {
            console.log(`    解析到 ${data.length} 条 (section2021格式)`);
            // 可能是不同的数据格式，打印看看
            const keys = Object.keys(capturedJson.data || {});
            console.log(`    data keys: ${keys.join(', ')}`);
            if (capturedJson.data?.search) {
              const firstKey = Object.keys(capturedJson.data.search)[0];
              console.log(`    first entry: ${firstKey} -> ${JSON.stringify(capturedJson.data.search[firstKey]).substring(0, 200)}`);
            }
          }
        } else {
          console.log('    未捕获到API');
          
          // 从页面文本提取
          const text = await page.evaluate(() => document.body.innerText);
          const data = [];
          for (const line of text.split('\n')) {
            const match = line.trim().match(/^(\d{2,3})\s+(\d[\d,]*)\s+(\d[\d,]*)$/);
            if (match) {
              const score = parseInt(match[1]);
              const count = parseInt(match[2].replace(/,/g, ''));
              const cum = parseInt(match[3].replace(/,/g, ''));
              if (score >= 100 && score <= 800 && count >= 0 && cum <= 2000000) {
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
          if (unique.length > 50) saveCSV(target.prov, cat, unique);
          else console.log(`    页面提取 ${unique.length} 条`);
        }
        
        await page.waitForTimeout(500);
      }
    } catch(e) {
      console.error(`  ❌ ${target.prov}: ${e.message.substring(0, 100)}`);
    }
  }
  
  await browser.close();
  console.log('\n=== 完成 ===');
})();
