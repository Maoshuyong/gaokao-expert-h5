#!/usr/bin/env python3
"""
高报专家 H5 服务器（Python版）
解决 CORS 跨域问题
"""
import http.server
import socketserver
import urllib.request
import urllib.error
import os
from urllib.parse import urlparse

PORT = 8080
API_TARGET = 'http://localhost:28789'

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)
    
    def end_headers(self):
        # 添加 CORS 头，允许跨域访问
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()
    
    def do_POST(self):
        # API 请求代理到 OpenClaw 网关
        if self.path.startswith('/v1/'):
            self.proxy_to_api()
        else:
            self.send_error(404)
    
    def proxy_to_api(self):
        # 获取请求体
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else b''
        
        # 转发到 API
        req = urllib.request.Request(
            API_TARGET + self.path,
            data=body,
            headers={k: v for k, v in self.headers.items() if k.lower() not in ['host', 'content-length']},
            method=self.command
        )
        
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                self.send_response(response.status)
                for key, value in response.getheaders():
                    if key.lower() not in ['transfer-encoding', 'connection']:
                        self.send_header(key, value)
                self.end_headers()
                self.wfile.write(response.read())
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(e.read() or b'{}')
        except Exception as e:
            self.send_error(502, str(e))
    
    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {args[0]}")

os.chdir(os.path.dirname(os.path.abspath(__file__)))
print(f"""
======================================
🚀 高报专家 H5 服务器已启动

📍 访问地址: http://localhost:8080

⚠️ 需要通过 localhost.run 隧道暴露到公网
    ssh -R 80:localhost:8080 nokey@localhost.run

📝 隧道建立后，把地址发给我更新配置
======================================
""")

with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
    httpd.serve_forever()