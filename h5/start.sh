#!/bin/bash
# 高报专家 H5 一键启动脚本
# 用法: bash start.sh [WB_BASE_URL] [WB_API_KEY]
#
# 示例（WorkBuddy 本地网关）:
#   bash start.sh http://localhost:28789
#
# 示例（WorkBuddy 云端 Agent API）:
#   WB_BASE_URL=https://your-workbuddy-agent-url WB_API_KEY=your-token bash start.sh

H5_DIR="$(cd "$(dirname "$0")" && pwd)"

export WB_BASE_URL="${1:-${WB_BASE_URL:-http://localhost:28789}}"
export WB_API_KEY="${2:-${WB_API_KEY:-}}"

echo "========================================"
echo "🎓 高报专家 H5 启动中..."
echo "📡 WorkBuddy Agent: $WB_BASE_URL"
echo "========================================"

node "$H5_DIR/server.js"
