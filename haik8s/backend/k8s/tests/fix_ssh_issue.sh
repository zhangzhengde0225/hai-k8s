#!/bin/bash
# 修复 SSH 问题的脚本

NAMESPACE="haik8s-zdzhang"
POD_NAME=$(kubectl get pods -n $NAMESPACE -o name 2>/dev/null | grep openclaw | head -1 | cut -d'/' -f2)

if [ -z "$POD_NAME" ]; then
    echo "❌ 错误: 没有找到 Pod"
    exit 1
fi

echo "🔧 修复 Pod: $POD_NAME"
echo ""

# 1. 检查 openssh-server 是否安装
echo "1. 检查 openssh-server..."
if kubectl exec -n $NAMESPACE $POD_NAME -- which sshd > /dev/null 2>&1; then
    echo "  ✅ sshd 已安装"
else
    echo "  ❌ sshd 未安装，正在安装..."
    kubectl exec -n $NAMESPACE $POD_NAME -- bash -c "
        apt-get update -qq > /dev/null 2>&1 && \
        apt-get install -y openssh-server > /dev/null 2>&1
    " && echo "  ✅ openssh-server 安装成功" || echo "  ❌ 安装失败"
fi
echo ""

# 2. 生成 SSH host keys
echo "2. 生成 SSH host keys..."
kubectl exec -n $NAMESPACE $POD_NAME -- bash -c "
    if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
        ssh-keygen -A
        echo '  ✅ Host keys 已生成'
    else
        echo '  ✅ Host keys 已存在'
    fi
"
echo ""

# 3. 配置 sshd
echo "3. 配置 sshd..."
kubectl exec -n $NAMESPACE $POD_NAME -- bash -c "
    mkdir -p /var/run/sshd
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
    echo '  ✅ sshd 配置完成'
"
echo ""

# 4. 设置用户密码
echo "4. 设置用户密码..."
echo "请为用户 zdzhang 设置密码："
kubectl exec -it -n $NAMESPACE $POD_NAME -- passwd zdzhang
echo ""

# 5. 启动 sshd
echo "5. 启动 sshd..."
# 杀掉可能存在的 tail 进程
kubectl exec -n $NAMESPACE $POD_NAME -- pkill -f "tail -f /dev/null" 2>/dev/null || true

# 在后台启动 sshd
kubectl exec -n $NAMESPACE $POD_NAME -- bash -c "
    # 启动 sshd
    /usr/sbin/sshd

    # 检查是否启动成功
    if ps aux | grep -v grep | grep sshd > /dev/null; then
        echo '  ✅ sshd 启动成功'
        ps aux | grep sshd
    else
        echo '  ❌ sshd 启动失败，尝试前台模式...'
        nohup /usr/sbin/sshd -D -e > /tmp/sshd.log 2>&1 &
        sleep 2
        if ps aux | grep -v grep | grep sshd > /dev/null; then
            echo '  ✅ sshd 在后台启动成功'
        else
            echo '  ❌ sshd 启动失败，查看日志：'
            cat /tmp/sshd.log
        fi
    fi
"
echo ""

# 6. 验证
echo "6. 验证..."
echo "端口监听状态："
kubectl exec -n $NAMESPACE $POD_NAME -- netstat -tlnp 2>/dev/null | grep 22 || \
kubectl exec -n $NAMESPACE $POD_NAME -- ss -tlnp 2>/dev/null | grep 22
echo ""

echo "sshd 进程："
kubectl exec -n $NAMESPACE $POD_NAME -- ps aux | grep sshd
echo ""

# 7. 获取 LoadBalancer IP
echo "7. 获取连接信息..."
SERVICE_NAME=$(kubectl get svc -n $NAMESPACE -o name 2>/dev/null | grep ssh | head -1 | cut -d'/' -f2)
if [ -n "$SERVICE_NAME" ]; then
    LB_IP=$(kubectl get svc -n $NAMESPACE $SERVICE_NAME -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
    if [ -n "$LB_IP" ]; then
        echo "✅ SSH 连接命令:"
        echo "   ssh zdzhang@$LB_IP"
    else
        echo "⚠️  LoadBalancer IP 未分配，使用 NodePort 访问:"
        NODE_PORT=$(kubectl get svc -n $NAMESPACE $SERVICE_NAME -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null)
        if [ -n "$NODE_PORT" ]; then
            echo "   ssh zdzhang@<节点IP> -p $NODE_PORT"
        else
            echo "   需要手动配置 Service"
        fi
    fi
else
    echo "⚠️  没有找到 Service"
fi

echo ""
echo "🎉 修复完成！"
