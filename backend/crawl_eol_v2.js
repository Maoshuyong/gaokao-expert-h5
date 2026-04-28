const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'score_rank_data');

// 需要爬取的页面
const TASKS = [
  { name: '河南_文科', url: 'https://gaokao.eol.cn/he_nan/dongtai/202406/t20240625_2619065.shtml' },
  { name: '河南_理科', url: 'https://gaokao.eol.cn/he_nan/dongtai/202406/t20240625_2619064.shtml' },
  { name: '四川_文科', url: 'https://gaokao.eol.cn/si_chuan/dongtai/202406/t20240623_2618654.shtml' },
  { name: '四川_理科', url: 'https://gaokao.eol.cn/si_chuan/dongtai/202406/t20240623_2618652.shtml' },
  { name: '湖南_物理', url: 'https://gaokao.eol.cn/hu_nan/dongtai/202406/t20240625_2619123.shtml' },
  { name: '河北_物理', url: 'https://gaokao.eol.cn/he_bei/dongtai/202406/t20240625_2619087.shtml' },
  { name: '河北_历史', url: 'https://gaokao.eol.cn/he_bei/dongtai/202406/t20240625_2619086.shtml' },
  { name: '江苏_物理', url: 'https://gaokao.eol.cn/jiang_su/dongtai/202406/t20240624_2619012.shtml' },
  { name: '江苏_历史', url: 'https://gaokao.eol.cn/jiang_su/dongtai/202406/t20240624_2619011.shtml' },
];

async function crawlOne(page, task) {
  console.log(`\n===== ${task.name} =====`);
  console.log(`URL: ${task.url}`);
  
  try {
    await page.goto(task.url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // 尝试获取页面文本内容
    const text = await page.evaluate(() => document.body.innerText);
    
    // 查找包含分数段数据的表格
    const tables = await page.$$eval('table', tables => {
      return tables.map(table => {
        const rows = [];
        const trs = table.querySelectorAll('tr');
        trs.forEach(tr => {
          const cells = [];
          const tds = tr.querySelectorAll('td, th');
          tds.forEach(td => {
            cells.push(td.innerText.trim());
          });
          if (cells.length >= 2) rows.push(cells);
        });
        return rows;
      });
    });
    
    console.log(`找到 ${tables.length} 个表格`);
    
    if (tables.length > 0) {
      // 查找包含数字数据的表格
      let bestTable = null;
      let bestScore = 0;
      
      for (const table of tables) {
        if (table.length < 10) continue;
        
        // 检查第一列是否是分数
        let scoreCount = 0;
        for (const row of table) {
          const firstCell = parseInt(row[0]);
          if (firstCell >= 100 && firstCell <= 800) {
            scoreCount++;
          }
        }
        
        if (scoreCount > bestScore) {
          bestScore = scoreCount;
          bestTable = table;
        }
      }
      
      if (bestTable && bestScore > 10) {
        console.log(`最佳表格有 ${bestScore} 行分数数据`);
        
        // 解析数据
        const rows = [];
        for (const row of bestTable) {
          const values = row.map(c => parseInt(c.replace(/[,，\s]/g, ''))).filter(n => !isNaN(n));
          
          if (values.length >= 3) {
            const score = values[0];
            const count = values[1];
            const cumulative = values[2];
            
            if (score >= 100 && score <= 800 && count > 0 && cumulative > 0 && count <= cumulative) {
              rows.push([score, count, cumulative]);
            }
          } else if (values.length === 2) {
            // 有些表格只有分数和人数，没有累计
            const score = values[0];
            const count = values[1];
            if (score >= 100 && score <= 800 && count > 0) {
              rows.push([score, count, 0]); // 累计需要后续计算
            }
          }
        }
        
        if (rows.length > 0) {
          // 如果没有累计人数，手动计算
          if (rows[0][2] === 0) {
            let cum = 0;
            for (let i = rows.length - 1; i >= 0; i--) {
              cum += rows[i][1];
              rows[i][2] = cum;
            }
          }
          
          // 按分数降序排列
          rows.sort((a, b) => b[0] - a[0]);
          
          console.log(`解析到 ${rows.length} 条数据`);
          console.log(`范围: ${rows[0][0]} - ${rows[rows.length-1][0]}`);
          console.log(`最高分: 人数=${rows[0][1]}, 累计=${rows[0][2]}`);
          console.log(`最低分: 人数=${rows[rows.length-1][1]}, 累计=${rows[rows.length-1][2]}`);
          console.log(`前3行:`, rows.slice(0, 3));
          
          // 保存
          const [province, category] = task.name.split('_');
          const filename = `2024_${province}_${category}.csv`;
          const filepath = path.join(DATA_DIR, filename);
          
          let csv = 'score,count_this_score,cumulative_count\n';
          for (const [score, count, cumulative] of rows) {
            csv += `${score},${count},${cumulative}\n`;
          }
          
          fs.writeFileSync(filepath, csv);
          console.log(`✅ 已保存: ${filepath}`);
          return true;
        }
      }
    }
    
    // 如果表格解析失败，尝试从页面文本中提取
    console.log('表格解析失败，尝试从文本中提取...');
    
    // 在文本中查找数字模式
    const textRows = await page.evaluate(() => {
      const text = document.body.innerText;
      const lines = text.split('\n');
      const results = [];
      
      for (const line of lines) {
        // 匹配 "分数 人数 累计" 或 "分数|人数|累计" 或 "分数 人数 累计"
        const match = line.match(/^(\d{2,3})[\s|,，]+(\d+)[\s|,，]+(\d+)$/);
        if (match) {
          results.push([parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]);
        }
      }
      return results;
    });
    
    if (textRows.length > 10) {
      // 过滤合理数据
      const filtered = textRows.filter(([s, c, cum]) => s >= 100 && s <= 800 && c > 0 && cum > 0);
      if (filtered.length > 10) {
        filtered.sort((a, b) => b[0] - a[0]);
        console.log(`文本提取到 ${filtered.length} 条数据`);
        
        const [province, category] = task.name.split('_');
        const filename = `2024_${province}_${category}.csv`;
        const filepath = path.join(DATA_DIR, filename);
        
        let csv = 'score,count_this_score,cumulative_count\n';
        for (const [score, count, cumulative] of filtered) {
          csv += `${score},${count},${cumulative}\n`;
        }
        
        fs.writeFileSync(filepath, csv);
        console.log(`✅ 已保存: ${filepath}`);
        return true;
      }
    }
    
    console.log('❌ 未找到有效数据');
    console.log('页面文本前1000字符:', text.substring(0, 1000));
    
  } catch (e) {
    console.error(`错误: ${e.message}`);
  }
  
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  // 只爬取需要的数据
  const tasksToCrawl = TASKS.filter(t => {
    const [province, category] = t.name.split('_');
    const filepath = path.join(DATA_DIR, `2024_${province}_${category}.csv`);
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      if (lines.length > 50) {
        console.log(`⏭️ 跳过 ${t.name}（已有 ${lines.length - 1} 条数据）`);
        return false;
      }
    }
    return true;
  });
  
  console.log(`需要爬取 ${tasksToCrawl.length} 个省份科类`);
  
  for (const task of tasksToCrawl) {
    await crawlOne(page, task);
  }
  
  await browser.close();
  
  // 汇总
  console.log('\n\n========== 汇总 ==========');
  const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('2024_') && f.endsWith('.csv'));
  for (const file of files.sort()) {
    const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const first = lines[1]?.split(',')[0];
    const last = lines[lines.length - 1]?.split(',')[0];
    const cumLast = lines[lines.length - 1]?.split(',')[2];
    console.log(`${file}: ${lines.length - 1} 条 (${first}-${last}), 累计 ${cumLast}`);
  }
})();
