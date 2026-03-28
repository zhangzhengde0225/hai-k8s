#!/bin/bash

# 先停止PM2

pm2 delete openclaw-gateway

# 再监听微信启动的OpenClaw后端进程，并杀死它
PORT=18789
echo "正在监控端口 $PORT，等待进程出现..."


while true; do
    # 使用ss命令查找指定端口的进程信息
    process_info=$(ss -tanlp 2>/dev/null | grep ":$PORT ")
    
    if [ -n "$process_info" ]; then
        echo "找到占用端口 $PORT 的进程:"
        echo "$process_info"
        
        # 提取PID（从users部分提取）
        pid=$(echo "$process_info" | grep -o 'pid=[0-9]*' | head -1 | cut -d'=' -f2)
        
        if [ -n "$pid" ]; then
            echo "正在终止进程 PID: $pid"
            kill -9 "$pid"
            
            # 验证进程是否已被杀死
            if ! kill -0 "$pid" 2>/dev/null; then
                echo "进程 $pid 已成功终止"
            else
                echo "警告：进程 $pid 可能仍在运行"
            fi
            break
        else
            echo "无法提取PID，尝试其他方式..."
            # 备用方法：使用lsof（如果可用）
            if command -v lsof >/dev/null 2>&1; then
                pid=$(lsof -ti:$PORT | head -1)
                if [ -n "$pid" ]; then
                    echo "通过lsof找到PID: $pid"
                    kill -9 "$pid"
                    echo "进程 $pid 已终止"
                    break
                fi
            fi
            echo "无法获取PID，退出"
            exit 1
        fi
    else
        echo "端口 $PORT 暂无进程占用，继续监控..."
        sleep 1
    fi
done

echo "脚本执行完成"
