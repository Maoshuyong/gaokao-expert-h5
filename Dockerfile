# gaokao-agent 全栈部署 — 前端 + 后端一体化
# Stage 1: 构建前端
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: 后端 + 前端静态文件
FROM python:3.12-slim

WORKDIR /app

# 安装后端依赖
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端应用代码
COPY backend/ .

# 从 Stage 1 复制前端构建产物
COPY --from=frontend-builder /frontend/dist /app/static

# 数据目录
RUN mkdir -p /app/data

EXPOSE 10000

# Render 注入 PORT 环境变量
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}
