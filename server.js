// 简单的一体化服务器：H5页面 + API代理（解决CORS问题）
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const API_TARGET = 'http://localhost:28789';

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg'
};

// 解析URL，提取路径
function getPath(url) {
    const parsed = new URL(url, 'http://localhost:8080');
    return parsed.pathname;
}

// 处理静态文件请求
function serveStatic(filePath, res) {
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// 代理API请求（关键：解决CORS问题）
function proxyAPI(req, res) {
    const url = API_TARGET + req.url;
    
    console.log(`代理请求: ${req.method} ${req.url} -> ${url}`);
    
    const options = {
        hostname: 'localhost',
        port: 28789,
        path: req.url,
        method: req.method,
        headers: req.headers
    };
    
    const proxyReq = http.request(options, (proxyRes) => {
        // 添加CORS头，允许任何来源访问
        res.writeHead(proxyRes.statusCode, {
            ...proxyRes.headers,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        
        proxyRes.on('data', (chunk) => res.write(chunk));
        proxyRes.on('end', () => res.end());
    });
    
    req.on('data', (chunk) => proxyReq.write(chunk));
    req.on('end', () => proxyReq.end());
    
    proxyReq.on('error', (err) => {
        console.error('代理错误:', err.message);
        res.writeHead(502);
        res.end('API代理失败: ' + err.message);
    });
}

// 主服务器
const server = http.createServer((req, res) => {
    const urlPath = getPath(req.url);
    
    console.log(`请求: ${req.method} ${urlPath}`);
    
    // API请求代理到OpenClaw网关
    if (urlPath.startsWith('/v1/')) {
        // 处理预检请求
        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            });
            res.end();
            return;
        }
        proxyAPI(req, res);
        return;
    }
    
    // 静态文件服务
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
======================================
🚀 高报专家 H5 服务器已启动

📍 访问地址: http://localhost:8080

⚠️ 注意：需要通过localhost.run隧道暴露到公网
    ssh -R 80:localhost:8080 nokey@localhost.run

📝 隧道建立后，把地址发给我更新H5配置
======================================
`);
});