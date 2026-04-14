# 高考志愿填报专家 - 数据服务 v2.0

> 为 AI Agent 提供高考志愿填报数据工具接口

## 🏗 架构说明（v2.0 重构）

v2.0 采用 **Agent + Tool** 架构，将原来的全栈智能体拆分为：

```
┌─────────────────────┐      HTTP API      ┌──────────────────────┐
│   WorkBuddy Agent    │ ◄──────────────► │   gaokao-backend      │
│  (LLM 对话 + 调度)   │                   │  (数据服务)           │
│                      │                   │                      │
│  - 自然语言对话       │   curl/fetch      │  - 院校查询           │
│  - 信息采集          │ ◄──────────────►  │  - 概率计算           │
│  - 方案生成          │                   │  - 分数线查询         │
│  - 风险分析          │                   │  - 控制分数线         │
└─────────────────────┘                   └──────────────────────┘
```

**核心变化**：移除了内置的 LLM 调用（OpenAI/SiliconFlow/混元），LLM 对话能力由 WorkBuddy Agent 直接提供，后端只负责数据查询和概率计算。

## 🚀 快速开始

### 1. 启动数据服务

```bash
cd backend
pip install -r requirements.txt
python main.py
```

服务启动后访问 http://localhost:8000/docs 查看 API 文档。

### 2. 配置 WorkBuddy Skill

将 `.workbuddy/skills/gaokao-agent/SKILL.md` 文件放入 WorkBuddy 的 skills 目录。Agent 在对话时将自动加载该 Skill，按流程调用数据服务接口。

### 3. 使用

在 WorkBuddy 中直接对话即可，例如：
- "我是四川考生，理科，考了587分"
- "帮我分析一下能上哪些学校"
- "我想学计算机，有没有推荐的"

## 📡 API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/colleges/recommend` | GET | 根据考生条件筛选院校 |
| `/api/v1/probability` | POST | 批量计算录取概率 |
| `/api/v1/scores/lookup` | POST | 查询历年分数线 |
| `/api/v1/colleges/` | GET | 模糊搜索院校 |
| `/api/v1/colleges/{code}` | GET | 院校详情 |
| `/api/v1/colleges/{code}/scores` | GET | 院校分数线 |
| `/api/v1/control-scores` | GET | 控制分数线查询 |
| `/api/v1/profile` | POST | 创建考生画像 |
| `/api/v1/profile/{id}` | PUT | 更新考生画像 |

## 📁 项目结构（v2.0）

```
gaokao-agent/
├── backend/                    # 数据服务
│   ├── api/                    # API 路由
│   │   ├── chat.py             # 工具接口（概率计算、画像管理、院校推荐）
│   │   └── colleges.py         # 院校查询接口
│   ├── models/                 # 数据模型
│   │   ├── college.py          # 院校信息
│   │   ├── score.py            # 录取分数线
│   │   ├── profile.py          # 考生画像
│   │   └── conversation.py     # 对话记录
│   ├── services/               # 业务服务
│   │   └── scoring_service.py  # 录取概率计算
│   ├── db/                     # 数据库层
│   ├── config.py               # 配置
│   ├── main.py                 # FastAPI 入口
│   ├── init_data.py            # 示例数据
│   └── data/gaokao.db          # SQLite 数据库
├── frontend/                   # 前端（待改造为直接对接 Agent）
└── README.md
```

## 📊 技术栈

| 层 | 技术 |
|----|------|
| 数据服务 | FastAPI + SQLAlchemy + SQLite |
| LLM 对话 | WorkBuddy Agent（内置） |
| 通信协议 | HTTP REST API |

## 🔧 配置

v2.0 **不需要任何 API Key 配置**。只需启动后端数据服务即可。

## 📝 更新日志

### v2.0 - Agent + Tool 架构重构
- ❌ 移除内置 LLM 调用（OpenAI/SiliconFlow/混元）
- ❌ 移除提示词模板系统（prompts/）
- ❌ 移除智能体核心模块（agent/）
- ❌ 移除会话管理器（状态机由 Agent 处理）
- ✅ 新增录取概率计算 API
- ✅ 新增院校推荐筛选 API
- ✅ 新增分数线查询 API
- ✅ 新增控制分数线 API
- ✅ 新增考生画像管理 API
- ✅ 创建 WorkBuddy Skill 文件
- ✅ 修复概率计算中 float('inf') 导致 JSON 序列化失败的问题
- ✅ 精简依赖（从 15+ 减少到 5 个）

### v1.0 - 初始版本
- 全栈智能体架构
- 内置 LLM 调用
- 状态机驱动的对话流程
