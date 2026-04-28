// 高报专家 H5 - WorkBuddy Agent 代理服务器
// 职责：① 静态文件服务  ② 注入 SOUL.md 系统提示词  ③ 代理到 WorkBuddy Agent

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT = 8080;

// ─── WorkBuddy Agent 配置 ─────────────────────────────────
// WorkBuddy 本地 OpenAI 兼容端点（由 WorkBuddy IDE 提供）
// 若使用云端 Agent API，改为对应 URL 和 token
const WB_BASE_URL  = process.env.WB_BASE_URL  || 'https://api.siliconflow.cn';
const WB_API_KEY   = process.env.WB_API_KEY   || 'sk-cjmosfitgvdiqkpubfwanmjdyeyhjyuiesnquzoysjkhkxzy';
const WB_MODEL     = process.env.WB_MODEL     || 'deepseek-ai/DeepSeek-V3';

// ─── 加载高报专家系统提示词 ──────────────────────────────
const SOUL_PATHS = [
    path.join(__dirname, '..', '..', '.qclaw', 'workspace-gaokao-expert', 'SOUL.md'),
    path.join(__dirname, 'SOUL.md'),
    path.join(__dirname, '..', 'SOUL.md'),
];

let SYSTEM_PROMPT = '';
for (const p of SOUL_PATHS) {
    try {
        SYSTEM_PROMPT = fs.readFileSync(p, 'utf8');
        console.log(`✅ 高报专家系统提示词已加载 (${SYSTEM_PROMPT.length} 字) from ${p}`);
        break;
    } catch (_) {}
}
if (!SYSTEM_PROMPT) {
    SYSTEM_PROMPT = '你是高考志愿填报专家，擅长根据学生分数、排名、兴趣和职业规划，提供个性化的志愿填报建议。请运用苏格拉底式追问帮助学生找到真正适合的方向。';
    console.warn('⚠️  未找到 SOUL.md，使用内置默认提示词');
}

// ─── MIME 类型 ────────────────────────────────────────────
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.ico':  'image/x-icon',
};

// ─── 静态文件服务 ─────────────────────────────────────────
function serveStatic(filePath, res) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'text/plain; charset=utf-8';
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not Found: ' + path.basename(filePath)); return; }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// ─── 代理 /v1/* 到 WorkBuddy Agent ──────────────────────
function proxyToWorkBuddy(req, res, body) {
    // 注入系统提示词
    let modifiedBody = body;
    try {
        const parsed = JSON.parse(body);
        const msgs = parsed.messages || [];
        // 只注入一次（避免重复）
        if (!msgs.length || msgs[0].role !== 'system') {
            parsed.messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...msgs];
        }
        // 覆盖 model 字段
        parsed.model = WB_MODEL;
        modifiedBody = JSON.stringify(parsed);
    } catch (e) {
        console.warn('⚠️  无法解析请求 body，透传原始内容:', e.message);
    }

    const parsed = url.parse(WB_BASE_URL);
    const isHttps = parsed.protocol === 'https:';
    const port = parsed.port || (isHttps ? 443 : 80);
    const transport = isHttps ? https : http;

    const options = {
        hostname: parsed.hostname,
        port:     port,
        path:     req.url,
        method:   'POST',
        headers: {
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(modifiedBody),
            ...(WB_API_KEY ? { 'Authorization': `Bearer ${WB_API_KEY}` } : {})
        }
    };

    console.log(`📡 代理 ${req.url} → ${WB_BASE_URL}${req.url}`);

    const proxyReq = transport.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, {
            ...proxyRes.headers,
            'Access-Control-Allow-Origin':  '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        });
        proxyRes.on('data',  chunk => res.write(chunk));
        proxyRes.on('end',   ()    => res.end());
    });

    proxyReq.on('error', (err) => {
        console.error('❌ 代理错误:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: `代理错误: ${err.message}`, code: 'PROXY_ERROR' } }));
    });

    proxyReq.write(modifiedBody);
    proxyReq.end();
}

// ─── 主服务器 ─────────────────────────────────────────────
const server = http.createServer((req, res) => {
    const pathname = url.parse(req.url).pathname;

    // CORS 预检
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin':  '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        });
        res.end();
        return;
    }

    // API 代理
    if (pathname.startsWith('/v1/')) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end',  ()    => proxyToWorkBuddy(req, res, body));
        return;
    }

    // 健康检查
    if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', backend: WB_BASE_URL }));
        return;
    }

    // 静态文件路由
    const h5Dir = __dirname;
    let filePath;
    if (pathname === '/' || pathname === '/index.html') {
        filePath = path.join(h5Dir, 'index.html');
    } else if (pathname.startsWith('/css/') || pathname.startsWith('/js/')) {
        filePath = path.join(h5Dir, pathname);
    } else {
        res.writeHead(404); res.end('Not Found'); return;
    }

    serveStatic(filePath, res);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
========================================
🎓 高报专家 H5（WorkBuddy Agent 版）

📍 本地访问:  http://localhost:${PORT}
📱 局域网访问: http://<本机IP>:${PORT}
📡 后端 Agent: ${WB_BASE_URL}
🔑 系统提示词: ${SYSTEM_PROMPT.length} 字

启动公网隧道（可选）:
  ssh -R 80:localhost:${PORT} nokey@localhost.run
  或
  npx localtunnel --port ${PORT}
========================================
`);
});
