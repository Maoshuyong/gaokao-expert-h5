# 🚀 高报专家 H5 V1.0.0 部署指南

> **版本：** V1.0.0 蓝金色版  
> **日期：** 2026-04-28  
> **部署目标：** Cloudflare Pages

---

## 一、部署前准备

### ✅ 已完成

- [x] 代码已复制到当前工作区
- [x] Git 仓库已初始化
- [x] 初始提交已完成 (`5b033cf`)
- [x] 版本号已标定 (`v1.0.0`)

### 📋 待完成

- [ ] 在 GitHub 创建远程仓库
- [ ] 推送代码到 GitHub
- [ ] 在 Cloudflare Pages 连接仓库
- [ ] 配置环境变量
- [ ] 部署并测试

---

## 二、GitHub 仓库创建

### 方法A：在 GitHub 网站手动创建（推荐）

1. 访问 https://github.com/new
2. **Repository name:** `gaokao-expert-h5`
3. **Description:** "高报专家 H5 - 高考志愿填报 AI 助手"
4. **Public/Private:** 建议选 **Private**（避免代码被抄袭）
5. **不要** 勾选 "Initialize this repository with a README"（已经本地提交了）
6. 点击 **"Create repository"**

### 方法B：如果安装了 GitHub CLI

```bash
# 安装 GitHub CLI（如果还没装）
brew install gh

# 登录 GitHub
gh auth login

# 创建私有仓库并推送
cd /Users/fengweitao/WorkBuddy/20260423111717/qclaw-archive/gaokao-expert-h5-v2
gh repo create gaokao-expert-h5 --private --source=. --push
```

---

## 三、推送代码到 GitHub

**在 GitHub 创建仓库后**，执行以下命令：

```bash
cd /Users/fengweitao/WorkBuddy/20260423111717/qclaw-archive/gaokao-expert-h5-v2

# 添加远程仓库（替换 {your-username} 为你的 GitHub 用户名）
git remote add origin https://github.com/{your-username}/gaokao-expert-h5.git

# 推送代码到 GitHub
git push -u origin main

# 打标签（可选，用于版本管理）
git tag v1.0.0
git push origin v1.0.0
```

---

## 四、Cloudflare Pages 部署配置

### 4.1 连接 GitHub 仓库

1. 登录 https://dash.cloudflare.com/
2. 进入 **Pages** → **Create a project**
3. 选择 **Connect to Git**
4. 授权 Cloudflare 访问你的 GitHub 账号
5. 选择 `gaokao-expert-h5` 仓库

### 4.2 构建设置

| 配置项 | 值 |
|--------|-----|
| **Build command** | *（留空，纯静态站点）* |
| **Build output directory** | `/`（根目录） |
| **Root directory** | *（留空，使用仓库根目录）* |
| **Environment variables** | 见下表 |

### 4.3 环境变量配置

在 **Settings** → **Environment variables** 中添加：

| Variable name | Value | 说明 |
|---------------|-------|------|
| `SILICONFLOW_API_KEY` | `sk-xxx...` | 你的 SiliconFlow API Key |
| `MODEL` | `deepseek-ai/DeepSeek-V3` | 模型名称 |

---

## 五、CF Worker 部署（API 代理）

H5 的 API 代理由 `cf-worker/worker.js` 提供。需要单独部署：

### 5.1 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 5.2 登录 Cloudflare

```bash
cd /Users/fengweitao/WorkBuddy/20260423111717/qclaw-archive/gaokao-expert-h5-v2/cf-worker
wrangler login
```

### 5.3 配置 wrangler.toml

编辑 `cf-worker/wrangler.toml`：

```toml
name = "gaokao-expert-api"
main = "worker.js"
compatibility_date = "2024-01-01"

[vars]
UPSTREAM_BASE = "https://api.siliconflow.cn"
MODEL = "deepseek-ai/DeepSeek-V3"

[secrets]
SILICONFLOW_API_KEY = "sk-xxx..."  # 用 wrangler secret put 添加
```

### 5.4 添加 API Key（Secret）

```bash
wrangler secret put SILICONFLOW_API_KEY
# 输入你的 API Key（不会明文存储在代码中）
```

### 5.5 部署 Worker

```bash
wrangler deploy
```

部署成功后会输出 Worker 地址，例如：
```
https://gaokao-expert-api.{your-subdomain}.workers.dev
```

### 5.6 更新 `_routes.json`

确保 `_routes.json` 包含：

```json
{
  "version": 1,
  "include": ["/v1/*"],
  "exclude": []
}
```

这会让 Cloudflare Pages 把 `/v1/*` 请求转发到 Worker。

---

## 六、测试部署

### 6.1 访问 H5 页面

部署完成后，Cloudflare Pages 会生成一个 `.pages.dev` 地址：

```
https://gaokao-expert-h5.pages.dev
```

在浏览器打开，应该能看到蓝金色的 H5 首页。

### 6.2 测试对话功能

1. 点击 "开始咨询" 或 "我是家长"
2. 发送一条测试消息（如 "陕西理科 580 分能上什么大学？"）
3. 应该能看到 AI 助手的回复

### 6.3 检查浏览器控制台

如果对话失败，打开浏览器开发者工具（F12）→ Console 标签页，查看错误信息。

常见错误：
- **404 Not Found** → Worker 未部署或 `_routes.json` 配置错误
- **500 Internal Server Error** → API Key 配置错误
- **CORS Error** → Worker 的 CORS 头配置错误

---

## 七、自定义域名（可选）

如果想用自定义域名（如 `h5.gaokao-expert.com`）：

1. 在 Cloudflare Pages 项目 → **Custom domains**
2. 输入你的域名
3. 按照提示在域名 DNS 设置中添加 CNAME 记录

---

## 八、持续部署

配置完成后，**每次 push 代码到 GitHub 的 `main` 分支，Cloudflare Pages 会自动重新部署**。

```bash
# 修改代码后
git add -A
git commit -m "feat: 添加新功能"
git push origin main
# Cloudflare Pages 会自动构建和部署
```

---

## 九、版本管理建议

### 9.1 Git 分支策略

```
main        → 生产环境（Cloudflare Pages 默认分支）
staging     → 预发布环境（可选）
dev         → 开发分支
```

### 9.2 版本标签

每次发布新版本时打标签：

```bash
git tag v1.0.1
git push origin v1.0.1
```

### 9.3 CHANGELOG

在项目根目录创建 `CHANGELOG.md`，记录每个版本的变更。

---

## 十、故障排查

### 问题1：Worker 部署失败

**可能原因：** `wrangler.toml` 配置错误

**解决方法：**
```bash
wrangler publish --dry-run  # 检查配置
wrangler tail               # 查看实时日志
```

### 问题2：H5 页面能打开，但对话失败

**可能原因：** API Key 未配置或 Worker 地址错误

**解决方法：**
1. 检查 Cloudflare Dashboard → Workers & Pages → 你的 Worker → Settings → Variables
2. 确认 `SILICONFLOW_API_KEY` 已设置
3. 在浏览器开发者工具 → Network 标签页查看 API 请求是否成功

### 问题3：CORS 错误

**可能原因：** Worker 的响应头缺少 CORS 配置

**解决方法：** 在 `cf-worker/worker.js` 中添加：

```javascript
responseHeaders.set('Access-Control-Allow-Origin', '*');
responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
```

---

## 十一、下一步

部署成功后：

1. **测试各个功能** - 首页、对话、报告生成（如果有）
2. **优化移动端体验** - 在手机浏览器测试
3. **添加分析工具** - 如 Google Analytics 或 Cloudflare Web Analytics
4. **准备小程序对接** - 如果小程序需要调用 H5 的 API

---

## 附录：完整命令清单

```bash
# 1. 进入项目目录
cd /Users/fengweitao/WorkBuddy/20260423111717/qclaw-archive/gaokao-expert-h5-v2

# 2. 添加 GitHub 远程仓库（替换 {username}）
git remote add origin https://github.com/{username}/gaokao-expert-h5.git

# 3. 推送代码
git push -u origin main

# 4. 打版本标签
git tag v1.0.0
git push origin v1.0.0

# 5. 部署 CF Worker（需要进入 cf-worker 目录）
cd cf-worker
wrangler login
wrangler secret put SILICONFLOW_API_KEY
wrangler deploy

# 6. 在 Cloudflare Dashboard 完成 Pages 部署配置
# （见上文第四步）
```

---

**祝部署顺利！** 🎉

如有问题，查看：
- Cloudflare Pages 文档：https://developers.cloudflare.com/pages/
- Wrangler 文档：https://developers.cloudflare.com/workers/wrangler/
