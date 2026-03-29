#!/usr/bin/env python3
"""
Pod 命令执行功能测试脚本

使用方法:
    python test_pod_exec.py

确保已初始化 K8s 客户端配置
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'haik8s', 'backend'))

from k8s_service.client import init_k8s_client
from k8s_service.pods.interface import execute_command_in_pod, execute_command_with_separate_streams


def test_basic_commands():
    """测试基础命令执行"""
    print("=" * 60)
    print("测试 1: 基础命令执行")
    print("=" * 60)

    # 需要替换为实际的 namespace 和 pod_name
    namespace = "default"
    pod_name = "test-pod"  # 替换为实际的 Pod 名称

    print(f"\n执行命令: echo 'Hello from K8s Pod'")
    result = execute_command_in_pod(
        namespace=namespace,
        pod_name=pod_name,
        command="echo 'Hello from K8s Pod'"
    )

    print(f"成功: {result.success}")
    print(f"输出: {result.stdout}")
    print(f"错误: {result.stderr}")
    print(f"退出码: {result.exit_code}")


def test_list_directory():
    """测试目录列表"""
    print("\n" + "=" * 60)
    print("测试 2: 列出目录")
    print("=" * 60)

    namespace = "default"
    pod_name = "test-pod"

    print(f"\n执行命令: ls -la /")
    result = execute_command_in_pod(
        namespace=namespace,
        pod_name=pod_name,
        command="ls -la /"
    )

    print(f"成功: {result.success}")
    print(f"输出:\n{result.stdout[:500]}...")  # 只显示前 500 字符


def test_environment():
    """测试环境变量查看"""
    print("\n" + "=" * 60)
    print("测试 3: 查看环境变量")
    print("=" * 60)

    namespace = "default"
    pod_name = "test-pod"

    print(f"\n执行命令: env | head -10")
    result = execute_command_in_pod(
        namespace=namespace,
        pod_name=pod_name,
        command="env | head -10"
    )

    print(f"成功: {result.success}")
    print(f"输出:\n{result.stdout}")


def test_failed_command():
    """测试失败的命令"""
    print("\n" + "=" * 60)
    print("测试 4: 失败命令处理")
    print("=" * 60)

    namespace = "default"
    pod_name = "test-pod"

    print(f"\n执行命令: ls /nonexistent-directory")
    result = execute_command_in_pod(
        namespace=namespace,
        pod_name=pod_name,
        command="ls /nonexistent-directory"
    )

    print(f"成功: {result.success}")
    print(f"输出: {result.stdout}")
    print(f"错误: {result.stderr or result.error_message}")
    print(f"退出码: {result.exit_code}")


def test_separate_streams():
    """测试分离的 stdout/stderr"""
    print("\n" + "=" * 60)
    print("测试 5: 分离 stdout/stderr")
    print("=" * 60)

    namespace = "default"
    pod_name = "test-pod"

    print(f"\n执行命令: echo 'stdout' && echo 'stderr' >&2")
    result = execute_command_with_separate_streams(
        namespace=namespace,
        pod_name=pod_name,
        command="echo 'This is stdout' && echo 'This is stderr' >&2"
    )

    print(f"成功: {result.success}")
    print(f"STDOUT: {result.stdout}")
    print(f"STDERR: {result.stderr}")
    print(f"退出码: {result.exit_code}")


def test_timeout():
    """测试超时处理"""
    print("\n" + "=" * 60)
    print("测试 6: 超时处理")
    print("=" * 60)

    namespace = "default"
    pod_name = "test-pod"

    print(f"\n执行命令: sleep 5 (timeout=2)")
    try:
        result = execute_command_in_pod(
            namespace=namespace,
            pod_name=pod_name,
            command="sleep 5",
            timeout=2  # 2秒超时，但命令需要5秒
        )

        print(f"成功: {result.success}")
        print(f"错误: {result.error_message}")
    except Exception as e:
        print(f"预期的超时错误: {e}")


def test_complex_command():
    """测试复杂命令"""
    print("\n" + "=" * 60)
    print("测试 7: 复杂命令（多行、管道）")
    print("=" * 60)

    namespace = "demo"
    pod_name = "ssh-ubuntu-demo"

    complex_cmd = """
    echo "=== System Info ===" && \
    uname -a && \
    echo "=== Memory ===" && \
    free -h | head -2 && \
    echo "=== Disk ===" && \
    df -h | head -5
    """

    print(f"\n执行复杂命令...")
    result = execute_command_in_pod(
        namespace=namespace,
        pod_name=pod_name,
        command=complex_cmd
    )

    print(f"成功: {result.success}")
    print(f"输出:\n{result.stdout}")


def main():
    """主测试函数"""
    print("\n" + "=" * 60)
    print("HAI-K8S Pod 命令执行功能测试")
    print("=" * 60)

    # 初始化 K8s 客户端
    print("\n初始化 Kubernetes 客户端...")
    try:
        kubeconfig_path = os.path.expanduser("~/.kube/config")
        init_k8s_client(kubeconfig_path)
        print("✓ K8s 客户端初始化成功")
    except Exception as e:
        print(f"✗ K8s 客户端初始化失败: {e}")
        print("\n请确保:")
        print("  1. 已安装 kubectl")
        print("  2. kubeconfig 文件存在于 ~/.kube/config")
        print("  3. 有访问集群的权限")
        return 1

    # 提示用户修改配置
    print("\n" + "⚠" * 30)
    print("重要提示:")
    print("  请先编辑此脚本，将 'test-pod' 替换为实际的 Pod 名称")
    print("  可以使用 kubectl get pods 查看可用的 Pod")
    print("⚠" * 30)

    response = input("\n是否继续测试? (y/N): ").strip().lower()
    if response != 'y':
        print("测试已取消")
        return 0

    # 运行测试
    tests = [
        test_basic_commands,
        test_list_directory,
        test_environment,
        test_failed_command,
        test_separate_streams,
        test_timeout,
        test_complex_command,
    ]

    for test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"\n✗ 测试失败: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 60)
    print("测试完成!")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    sys.exit(main())
