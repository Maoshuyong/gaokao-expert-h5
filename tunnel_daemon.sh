#!/bin/bash
# 高报专家 - 隧道自动重连守护进程
# 使用方法: bash tunnel_daemon.sh

H5_DIR="/Users/fengweitao/.qclaw/workspace/gaokao-expert-h5"
JS_FILE="$H5_DIR/js/app.js"
LOG_FILE="$H5_DIR/tunnel.log"

echo "========================================"
echo "🚀 隧道守护进程启动"
echo "📝 日志: $LOG_FILE"
echo "按 Ctrl+C 停止"
echo "========================================"

while true; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 正在连接 localhost.run ..." | tee -a "$LOG_FILE"
    
    # 启动 SSH 隧道并捕获输出
    ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -R 80:localhost:8080 nokey@localhost.run 2>&1 | while read -r line; do
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $line" | tee -a "$LOG_FILE"
        
        # 检测隧道地址
        if echo "$line" | grep -qE 'https://[a-z0-9]+\.lhr\.life'; then
            URL=$(echo "$line" | grep -oE 'https://[a-z0-9]+\.lhr\.life' | head -1)
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 隧道已建立: $URL" | tee -a "$LOG_FILE"
            
            # 更新 app.js
            if [ -f "$JS_FILE" ]; then
                sed -i '' "s|baseURL: 'https://[a-z0-9]*\.lhr\.life'|baseURL: '$URL'|g" "$JS_FILE"
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 已更新 app.js" | tee -a "$LOG_FILE"
                
                # Git 提交推送
                cd "$H5_DIR"
                git add -A
                git commit -m "自动更新隧道: $(echo $URL | cut -c1-30)" 2>/dev/null
                if git push origin main 2>/dev/null; then
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 已推送到 GitHub" | tee -a "$LOG_FILE"
                else
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ 推送失败，请手动推送" | tee -a "$LOG_FILE"
                fi
            fi
        fi
    done
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ 隧道断开，5秒后重连..." | tee -a "$LOG_FILE"
    sleep 5
done
