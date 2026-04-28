const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'score_rank_data');

// 赶考猫页面 URL - 6 个剩余科类
const TASKS = [
  { name: '河南_文科',  url: 'https://www.gankaomao.com/yfyd/6910a115.html' },
  { name: '四川_文科',  url: 'https://www.gankaomao.com/yfyd/sb6909945.html' },
  { name: '湖南_物理类', url: 'https://www.gankaomao.com/yfyd/v6905060.html' },
  { name: '河北_物理类', url: 'https://www.gankaomao.com/yfyd/b6911513.html' },
  { name: '河北_历史类', url: 'https://www.gankaomao.com/yfyd/6nh911637.html' },
  { name: '江苏_物理类', url: 'https://www.gankaomao.com/yfyd/69x09351.html' },
  { name: '江苏_历史类', url: 'https://www.gankaomao.com/yfyd/x6909444.html' },
];

function parseRows(text) {
  const rows = [];
  // 匹配三列数字（分数 人数 累计人数）
  // 允许数字间有空格/换行/逗号
  const lines = text.split('\n');
  for (const line of lines) {
    // 提取行内所有数字
    const nums = line.match(/\d[\d,，]*/g);
    if (!nums || nums.length < 3) continue;
    const vals = nums.map(n => parseInt(n.replace(/[,，]/g, ''))).filter(n => !isNaN(n));
    if (vals.length < 3) continue;
    // 找合理的分数（100-800）
    for (let i = 0; i <= vals.length - 3; i++) {
      const score = vals[i];
      const count = vals[i + 1];
      const cum = vals[i + 2];
      if (score >= 100 && score <= 800 && count > 0 && count < 100000 && cum > 0 && count <= cum) {
        rows.push([score, count, cum]);
        break;
      }
    }
  }
  return rows;
}

async function crawlOne(page, task) {
  console.log(`\n===== ${task.name} =====`);
  console.log(`URL: ${task.url}`);

  try {
    await page.goto(task.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // 等待页面渲染
    await page.waitForTimeout(4000);

    // 尝试等待表格出现
    try {
      await page.waitForSelector('table', { timeout: 8000 });
    } catch (e) {
      console.log('无表格，尝试纯文本提取');
    }

    // 1. 优先从表格提取
    let rows = [];
    try {
      const tableData = await page.$$eval('table tr', trs => {
        return trs.map(tr => {
          return Array.from(tr.querySelectorAll('td, th')).map(td => td.innerText.trim());
        }).filter(cells => cells.length >= 3);
      });

      console.log(`表格行数: ${tableData.length}`);

      for (const cells of tableData) {
        const vals = cells.map(c => parseInt(c.replace(/[,，\s]/g, ''))).filter(n => !isNaN(n));
        if (vals.length >= 3) {
          for (let i = 0; i <= vals.length - 3; i++) {
            const [score, count, cum] = [vals[i], vals[i+1], vals[i+2]];
            if (score >= 100 && score <= 800 && count > 0 && count < 100000 && cum > 0 && count <= cum) {
              rows.push([score, count, cum]);
              break;
            }
          }
        }
      }
    } catch (e) {
      console.log('表格提取失败:', e.message);
    }

    // 2. 如果表格数据不足，从页面文本提取
    if (rows.length < 50) {
      const text = await page.evaluate(() => document.body.innerText);
      console.log(`文本长度: ${text.length}`);
      const textRows = parseRows(text);
      console.log(`文本提取: ${textRows.length} 条`);
      if (textRows.length > rows.length) rows = textRows;
    }

    // 去重 + 排序
    const seen = new Set();
    const unique = rows.filter(r => {
      const k = r[0];
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    unique.sort((a, b) => b[0] - a[0]);

    console.log(`有效数据: ${unique.length} 条`);
    if (unique.length > 0) {
      console.log(`分数范围: ${unique[0][0]}-${unique[unique.length-1][0]}, 累计人数: ${unique[unique.length-1][2]}`);
    }

    if (unique.length >= 50) {
      const [province, category] = task.name.split('_');
      const filepath = path.join(DATA_DIR, `2024_${province}_${category}.csv`);
      let csv = 'score,count_this_score,cumulative_count\n';
      for (const [s, c, cum] of unique) csv += `${s},${c},${cum}\n`;
      fs.writeFileSync(filepath, csv);
      console.log(`✅ 已保存: ${filepath}`);
      return true;
    }

    // 3. 数据不足 - 输出页面文本前3000字符用于诊断
    console.log('❌ 数据不足（<50条）');
    const text = await page.evaluate(() => document.body.innerText);
    console.log('文本片段:\n' + text.substring(0, 3000));

  } catch (e) {
    console.error(`错误: ${e.message}`);
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'zh-CN',
  });
  const page = await context.newPage();

  const results = { success: [], failed: [] };

  for (const task of TASKS) {
    const ok = await crawlOne(page, task);
    if (ok) results.success.push(task.name);
    else results.failed.push(task.name);
    // 避免频率太快
    await page.waitForTimeout(2000);
  }

  await browser.close();

  console.log('\n========== 汇总 ==========');
  console.log(`✅ 成功 (${results.success.length}):`, results.success.join(', '));
  console.log(`❌ 失败 (${results.failed.length}):`, results.failed.join(', '));
})();
