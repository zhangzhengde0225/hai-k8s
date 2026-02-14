#!/bin/bash
# 诊断 SSH 和 LoadBalancer IP 分配问题

echo "=========================================="
echo "诊断脚本：SSH 和 LoadBalancer IP 问题"
echo "=========================================="
echo ""

# 设置变量
NAMESPACE="haik8s-zdzhang"
POD_NAME=$(kubectl get pods -n $NAMESPACE -o name 2>/dev/null | grep openclaw | head -1 | cut -d'/' -f2)
SERVICE_NAME=$(kubectl get svc -n $NAMESPACE -o name 2>/dev/null | grep ssh | head -1 | cut -d'/' -f2)

if [ -z "$POD_NAME" ]; then
    echo "❌ 错误: 在命名空间 $NAMESPACE 中没有找到 Pod"
    echo "请运行以下命令手动检查："
    echo "  kubectl get pods -n $NAMESPACE"
    exit 1
fi

echo "✅ 找到 Pod: $POD_NAME"
if [ -n "$SERVICE_NAME" ]; then
    echo "✅ 找到 Service: $SERVICE_NAME"
else
    echo "⚠️  警告: 没有找到 Service"
fi
echo ""

# 1. 检查 Pod 状态
echo "=========================================="
echo "1. Pod 状态"
echo "=========================================="
kubectl get pod -n $NAMESPACE $POD_NAME -o wide
echo ""

# 2. 检查 Service 状态
echo "=========================================="
echo "2. Service 状态"
echo "=========================================="
if [ -n "$SERVICE_NAME" ]; then
    kubectl get svc -n $NAMESPACE $SERVICE_NAME -o wide
    echo ""
    echo "Service 详细信息："
    kubectl describe svc -n $NAMESPACE $SERVICE_NAME
else
    echo "没有找到 Service，列出所有 Service："
    kubectl get svc -n $NAMESPACE
fi
echo ""

# 3. 检查 Pod 日志
echo "=========================================="
echo "3. Pod 日志（最后 50 行）"
echo "=========================================="
kubectl logs -n $NAMESPACE $POD_NAME --tail=50
echo ""

# 4. 检查 sshd 进程
echo "=========================================="
echo "4. 检查 sshd 进程"
echo "=========================================="
kubectl exec -n $NAMESPACE $POD_NAME -- ps aux | grep -E "sshd|PID" || echo "无法执行命令"
echo ""

# 5. 检查端口监听
echo "=========================================="
echo "5. 检查端口 22 监听状态"
echo "=========================================="
kubectl exec -n $NAMESPACE $POD_NAME -- netstat -tlnp 2>/dev/null | grep -E "22|Proto" || \
kubectl exec -n $NAMESPACE $POD_NAME -- ss -tlnp 2>/dev/null | grep -E "22|State" || \
echo "无法执行 netstat/ss 命令"
echo ""

# 6. 检查 MetalLB 状态
echo "=========================================="
echo "6. MetalLB 状态"
echo "=========================================="
echo "MetalLB Pods:"
kubectl get pods -n metallb-system 2>/dev/null || echo "MetalLB 命名空间不存在或无法访问"
echo ""
echo "MetalLB IP 地址池:"
kubectl get ipaddresspool -n metallb-system -o wide 2>/dev/null || echo "没有找到 IPAddressPool"
echo ""
echo "MetalLB L2 广播:"
kubectl get l2advertisement -n metallb-system -o wide 2>/dev/null || echo "没有找到 L2Advertisement"
echo ""

# 7. 检查 sshd 配置
echo "=========================================="
echo "7. SSH 配置"
echo "=========================================="
echo "检查 PasswordAuthentication 设置:"
kubectl exec -n $NAMESPACE $POD_NAME -- cat /etc/ssh/sshd_config 2>/dev/null | grep -E "PasswordAuthentication|PermitRootLogin" || echo "无法读取 sshd_config"
echo ""

# 8. 检查用户
echo "=========================================="
echo "8. 用户信息"
echo "=========================================="
kubectl exec -n $NAMESPACE $POD_NAME -- id zdzhang 2>/dev/null || echo "用户 zdzhang 不存在"
echo ""

# 9. 检查 SSH host keys
echo "=========================================="
echo "9. SSH Host Keys"
echo "=========================================="
kubectl exec -n $NAMESPACE $POD_NAME -- ls -la /etc/ssh/ssh_host_*_key 2>/dev/null || echo "没有找到 SSH host keys"
echo ""

# 10. 建议
echo "=========================================="
echo "10. 诊断建议"
echo "=========================================="

# 检查 LoadBalancer IP
LB_IP=$(kubectl get svc -n $NAMESPACE $SERVICE_NAME -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
if [ -z "$LB_IP" ]; then
    echo "❌ LoadBalancer IP 未分配"
    echo ""
    echo "可能的原因："
    echo "  1. MetalLB 未正确安装或配置"
    echo "  2. IP 地址池已用完"
    echo "  3. Service 创建时间太短，还在分配中"
    echo ""
    echo "建议："
    echo "  - 检查 MetalLB 日志: kubectl logs -n metallb-system -l app=metallb"
    echo "  - 等待几分钟后再次检查 Service 状态"
else
    echo "✅ LoadBalancer IP 已分配: $LB_IP"
    echo ""
    echo "测试 SSH 连接:"
    echo "  ssh zdzhang@$LB_IP"
fi

# 检查 sshd 进程
SSHD_COUNT=$(kubectl exec -n $NAMESPACE $POD_NAME -- ps aux 2>/dev/null | grep -c "[s]shd" || echo "0")
if [ "$SSHD_COUNT" = "0" ]; then
    echo ""
    echo "❌ sshd 进程未运行"
    echo ""
    echo "可能的原因："
    echo "  1. 容器镜像中没有安装 openssh-server"
    echo "  2. sshd 启动失败（检查 Pod 日志）"
    echo "  3. 启动脚本有错误"
    echo ""
    echo "建议："
    echo "  - 检查容器中是否有 sshd: kubectl exec -n $NAMESPACE $POD_NAME -- which sshd"
    echo "  - 手动启动 sshd: kubectl exec -it -n $NAMESPACE $POD_NAME -- /usr/sbin/sshd -D -e"
else
    echo ""
    echo "✅ sshd 进程正在运行（找到 $SSHD_COUNT 个进程）"
fi

echo ""
echo "=========================================="
echo "诊断完成"
echo "=========================================="
