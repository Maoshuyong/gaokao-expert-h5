# gaokao-agent 后端数据服务
FROM python:3.12-slim

WORKDIR /app

# 安装依赖
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端应用代码
COPY backend/ .

# 数据目录
RUN mkdir -p /app/data

EXPOSE 10000

# Render 注入 PORT 环境变量
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}
