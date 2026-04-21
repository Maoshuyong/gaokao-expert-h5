#!/usr/bin/env node
/**
 * 批量抓取一分一段表 - Playwright 版
 * 从 eol.cn 抓取 JS 渲染的表格数据
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'score_rank_data');
fs.mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  // 湖北
  { name: '湖北', cat: '物理类', url: 'https://gaokao.eol.cn/hu_bei/dongtai/202406/t20240625_2619340.shtml' },
  { name: '湖北', cat: '历史类', url: 'https://gaokao.eol.cn/hu_bei/dongtai/202406/t20240625_2619345.shtml' },
  // 河南
  { name: '河南', cat: '文科', url: 'https://gaokao.eol.cn/he_nan/dongtai/202406/t20240625_2619065.shtml' },
  { name: '河南', cat: '理科', url: 'https://gaokao.eol.cn/he_nan/dongtai/202406/t20240625_2619064.shtml' },
  // 湖南
  { name: '湖南', cat: '物理类', url: 'https://gaokao.eol.cn/hu_nan/dongtai/202406/t20240625_2619122.shtml' },
  { name: '湖南', cat: '历史类', url: 'https://gaokao.eol.cn/hu_nan/dongtai/202406/t20240625_2619123.shtml' },
  // 河北
  { name: '河北', cat: '物理类', url: 'https://gaokao.eol.cn/he_bei/dongtai/202406/t20240625_2619180.shtml' },
  { name: '河北', cat: '历史类', url: 'https://gaokao.eol.cn/he_bei/dongtai/202406/t20240625_2619181.shtml' },
  // 四川
  { name: '四川', cat: '理科', url: 'https://gaokao.eol.cn/si_chuan/dongtai/202406/t20240623_2618652.shtml' },
  { name: '四川', cat: '文科', url: 'https://gaokao.eol.cn/si_chuan/dongtai/202406/t20240623_2618653.shtml' },
  // 江苏
  { name: '江苏', cat: '物理类', url: 'https://gaokao.eol.cn/jiang_su/dongtai/202406/t20240624_2618969.shtml' },
  { name: '江苏', cat: '历史类', url: 'https://gaokao.eol.cn/jiang_su/dongtai/202406/t20240624_2618970.shtml' },
];

function parseTableText(text) {
  const lines = text.split('\n');
  const data = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // 匹配: "696 50 50" 或 "696  50  50"
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
  
  // 去重并排序
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
  console.log(`✅ ${province}_${category}: ${data.length} 条, ${data[0]?.score}-${data[data.length-1]?.score}, 累计 ${data[data.length-1]?.cum?.toLocaleString()}`);
  return csvPath;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  for (const target of targets) {
    // 跳过已存在的
    const csvPath = path.join(OUT_DIR, `2024_${target.name}_${target.cat}.csv`);
    if (fs.existsSync(csvPath)) {
      const lines = fs.readFileSync(csvPath, 'utf-8').split('\n').length;
      if (lines > 50) {
        console.log(`⏭️ ${target.name}_${target.cat}: 已存在 (${lines-1} 条)`);
        continue;
      }
    }
    
    console.log(`\n=== ${target.name} (${target.cat}) ===`);
    const page = await browser.newPage();
    
    try {
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(5000);
      
      // 获取所有 table
      const tables = await page.$$eval('table', tables => {
        return tables.map(table => {
          const rows = [];
          const trs = table.querySelectorAll('tr');
          for (const tr of trs) {
            const cells = [];
            const tds = tr.querySelectorAll('td, th');
            for (const td of tds) {
              cells.push(td.innerText.trim());
            }
            rows.push(cells.join('\t'));
          }
          return rows.join('\n');
        });
      });
      
      let found = false;
      for (const tableText of tables) {
        const data = parseTableText(tableText);
        if (data.length > 50) {
          saveCSV(target.name, target.cat, data);
          found = true;
          break;
        }
      }
      
      if (!found) {
        // 尝试页面文本
        const text = await page.evaluate(() => document.body.innerText);
        const data = parseTableText(text);
        if (data.length > 50) {
          saveCSV(target.name, target.cat, data);
        } else {
          console.log(`  ❌ 未找到有效数据 (文本: ${text.length} chars)`);
        }
      }
      
    } catch (e) {
      console.error(`  ❌ 错误: ${e.message}`);
    }
    
    await page.close();
  }
  
  await browser.close();
  console.log('\n=== 完成 ===');
})();
