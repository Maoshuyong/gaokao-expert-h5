# gaokao-agent 后端部署指南

## 🆓 免费部署方案对比

| 平台 | 免费额度 | 冷启动 | 自动 HTTPS | 国内访问 | 推荐度 |
|------|---------|--------|-----------|---------|-------|
| **Render** | 750h/月 | ~30s | ✅ | ⚠️ 需梯子 | ⭐⭐⭐ 最成熟 |
| **SnapDeploy** | 永久免费 | ~20s | ✅ | ⚠️ 需梯子 | ⭐⭐⭐ 最新最快 |
| **Railway** | $5 试用额度 | ~15s | ✅ | ⚠️ 需梯子 | ⭐⭐ 额度有限 |
| **Hugging Face Spaces** | 免费 CPU | ~10s | ✅ | ⚠️ 需梯子 | ⭐⭐ 适合 AI 项目 |

> ⚠️ **国内访问问题**：所有免费海外平台都需要梯子才能访问。如果需要国内直连，建议用腾讯云函数 SCF（有免费额度，但配置更复杂）。

---

## 方案一：Render（推荐，最稳定）

### 步骤

1. **创建 GitHub 仓库并推送代码**
   ```bash
   cd gaokao-agent
   # 在 GitHub 上创建仓库后：
   git remote add origin https://github.com/你的用户名/gaokao-agent.git
   git push -u origin main
   ```

2. **注册 Render** → https://render.com
   - 用 GitHub 账号登录
   - 点击 "New" → "Web Service"

3. **连接仓库**
   - 选择你的 `gaokao-agent` 仓库
   - Render 会自动检测到 `render.yaml` 配置

4. **配置构建**
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`

5. **环境变量**（可选）
   | Key | Value |
   |-----|-------|
   | `DEBUG` | `false` |
   | `PYTHON_VERSION` | `3.12.0` |

6. **部署** → 点击 "Create Web Service"
   - 约 2-3 分钟构建完成
   - 获得 URL：`https://gaokao-agent-backend.onrender.com`

### 注意事项
- ⏰ **冷启动**：免费版闲置 15 分钟后会休眠，首次访问需等待 ~30s
- 📊 **流量限制**：100GB/月（对这个应用绰绰有余）
- 🔄 **自动部署**：push 到 main 分支自动触发重新部署

---

## 方案二：SnapDeploy（最简单，60秒部署）

### 步骤

1. **注册 SnapDeploy** → https://snapdeploy.dev
   - 用 GitHub 账号登录（无需信用卡）

2. **创建容器**
   - 点击 "New Container"
   - 选择你的 `gaokao-agent` 仓库

3. **配置**
   - **Container Name**: `gaokao-agent`
   - **Root Directory**: `backend`（如果仓库根目录就是 backend 则留空）
   - SnapDeploy 会自动检测 FastAPI 并设置 8000 端口

4. **环境变量**（可选）
   | Key | Value |
   |-----|-------|
   | `DEBUG` | `false` |

5. **点击 "Deploy"** → 等待构建
   - 获得 URL：`https://gaokao-agent.snapdeploy.app`

### 注意事项
- ⏰ **冷启动**：有流量时自动唤醒，约 ~20s
- 💰 **Always-On**：如需 24/7 运行，$12/月

---

## 方案三：Hugging Face Spaces（Docker）

适合需要免费 GPU 或与 AI 生态集成的场景。

### 步骤

1. **注册 Hugging Face** → https://huggingface.co
2. **创建 Space**
   - 点击头像 → "New Space"
   - **Name**: `gaokao-agent`
   - **SDK**: Docker
   - **Visibility**: Public
3. **推送代码**
   ```bash
   git remote add space https://huggingface.co/spaces/你的用户名/gaokao-agent
   git push space main
   ```
4. **Dockerfile 会自动构建**，获得 URL：`https://huggingface.co/spaces/你的用户名/gaokao-agent`

### 注意事项
- 免费 2vCPU + 16GB RAM（非常充裕）
- 适合 AI 项目，与 Hugging Face 生态集成

---

## 方案四：腾讯云函数 SCF（国内直连）

### 适合场景
- 需要国内用户直连（不翻墙）
- 已有腾讯云账号

### 步骤（简化版）
1. 登录腾讯云控制台 → 云函数 SCF
2. 创建函数 → 选择 "自定义镜像"
3. 使用项目中的 Dockerfile 构建镜像并推送至 TCR
4. 配置 API 网关触发器
5. 获得国内可访问的 URL

### 免费额度
- 每月 100 万次调用（完全够用）
- 每月 40 万 GB·s 资源使用量

---

## 📡 部署后验证

无论选择哪个平台，部署完成后访问以下端点验证：

```bash
# 健康检查
curl https://你的域名/health

# 根路径信息
curl https://你的域名/

# API 文档（浏览器打开）
# https://你的域名/docs

# 测试院校搜索
curl "https://你的域名/api/v1/colleges/?q=北京大学"

# 测试概率计算
curl -X POST "https://你的域名/api/v1/probability" \
  -H "Content-Type: application/json" \
  -d '{"score":519,"rank":7173,"province":"陕西","category":"文科","college_codes":["61001","61004"]}'
```

---

## 🔄 更新 SKILL.md 中的 API 地址

部署成功后，记得更新 `.workbuddy/skills/gaokao-agent/SKILL.md` 中的 API 地址：

```
# 将
后端数据服务运行在 `http://localhost:8000`

# 改为
后端数据服务运行在 `https://你的部署域名`
```
