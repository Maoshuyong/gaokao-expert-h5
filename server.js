// 高报专家 H5 应用 - API代理服务器
// 代理请求到高报专家专属网关（端口28790），解决CORS问题

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

// 高报专家专属网关配置
const GK_GATEWAY = 'http://localhost:28790';
const GK_TOKEN = 'gkzhuanye2026';

// 加载高报专家系统提示词
let GAOKAO_SYSTEM_PROMPT = '';
try {
    const soulPath = path.join(__dirname, '..', '..', 'workspace-gaokao-expert', 'SOUL.md');
    GAOKAO_SYSTEM_PROMPT = fs.readFileSync(soulPath, 'utf8');
    console.log(`✅ 高报专家系统提示词已加载 (${GAOKAO_SYSTEM_PROMPT.length} 字)`);
} catch (e) {
    console.warn('⚠️  未找到 SOUL.md，将使用默认提示词:', e.message);
    GAOKAO_SYSTEM_PROMPT = '你是高考志愿填报专家，擅长根据学生分数、排名、兴趣和职业规划，提供个性化的志愿填报建议。';
}

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg'
};

function getPath(url) {
    const parsed = new URL(url, `http://localhost:${PORT}`);
    return parsed.pathname;
}

// 处理静态文件请求
function serveStatic(filePath, res) {
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found: ' + filePath);
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// 代理API请求到高报专家专属网关
function proxyAPI(req, res, postData) {
    const options = {
        hostname: 'localhost',
        port: 28790,
        path: req.url,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GK_TOKEN}`
        }
    };

    console.log(`📡 代理请求 -> ${GK_GATEWAY}${req.url}`);

    const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, {
            ...proxyRes.headers,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        proxyRes.on('data', (chunk) => res.write(chunk));
        proxyRes.on('end', () => res.end());
    });

    proxyReq.on('error', (err) => {
        console.error('❌ 代理错误:', err.message);
        res.writeHead(502);
        res.end('网关错误: ' + err.message);
    });

    if (postData) {
        proxyReq.write(postData);
    }
    proxyReq.end();
}

// 主服务器
const server = http.createServer((req, res) => {
    const urlPath = getPath(req.url);

    // API请求
    if (urlPath.startsWith('/v1/')) {
        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            });
            res.end();
            return;
        }

        // 读取body
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            if (body) {
                try {
                    const parsed = JSON.parse(body);
                    // 注入高报专家系统提示词
                    parsed.messages = [
                        { role: 'system', content: GAOKAO_SYSTEM_PROMPT },
                        ...(parsed.messages || [])
                    ];
                    body = JSON.stringify(parsed);
                    req.headers['content-length'] = Buffer.byteLength(body);
                } catch (e) {
                    console.warn('无法解析请求body:', e.message);
                }
            }
            proxyAPI(req, res, body);
        });
        return;
    }

    // 静态文件
    let filePath;
    if (urlPath === '/' || urlPath === '/index.html') {
        filePath = path.join(__dirname, 'index.html');
    } else if (urlPath.startsWith('/css/')) {
        filePath = path.join(__dirname, urlPath);
    } else if (urlPath.startsWith('/js/')) {
        filePath = path.join(__dirname, urlPath);
    } else {
        res.writeHead(404);
        res.end('Not Found');
        return;
    }

    serveStatic(filePath, res);
});

server.listen(PORT, () => {
    console.log(`
========================================
🎓 高报专家 H5 服务器已启动

📍 本地访问: http://localhost:${PORT}
📡 API代理: -> localhost:28790 (高报专家专属网关)
🔑 Token: ${GK_TOKEN}

⚠️  公网需通过隧道暴露:
    ssh -R 80:localhost:${PORT} nokey@localhost.run
========================================
`);
});
