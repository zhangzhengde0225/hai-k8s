#!/usr/bin/env python3
"""
测试防火墙功能的脚本

用法:
    python test_firewall_feature.py
"""

import requests
import json
import os

# 配置
BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
TOKEN = os.getenv("API_TOKEN", "your_token_here")

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}


def test_save_config_with_firewall():
    """测试保存带防火墙的配置"""
    print("=" * 60)
    print("测试 1: 保存带防火墙的配置")
    print("=" * 60)

    config_data = {
        "image_id": 1,  # 需要根据实际情况修改
        "cpu_request": 2.0,
        "memory_request": 4.0,
        "gpu_request": 0,
        "ssh_enabled": True,
        "bound_ip": None,
        # 防火墙配置
        "enable_firewall": True,
        "firewall_rules": [
            {
                "port": 22,
                "protocol": "tcp",
                "source": "0.0.0.0/0",
                "action": "allow"
            },
            {
                "port": 80,
                "protocol": "tcp",
                "source": "0.0.0.0/0",
                "action": "allow"
            },
            {
                "port": 443,
                "protocol": "tcp",
                "source": "0.0.0.0/0",
                "action": "allow"
            }
        ],
        "firewall_default_policy": "DROP"
    }

    response = requests.post(
        f"{BASE_URL}/api/applications/openclaw/config",
        headers=headers,
        json=config_data
    )

    if response.status_code in [200, 201]:
        print("✅ 配置保存成功")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        return response.json()
    else:
        print(f"❌ 配置保存失败: {response.status_code}")
        print(response.text)
        return None


def test_get_config():
    """测试获取配置"""
    print("\n" + "=" * 60)
    print("测试 2: 获取配置")
    print("=" * 60)

    response = requests.get(
        f"{BASE_URL}/api/applications/openclaw/config",
        headers=headers
    )

    if response.status_code == 200:
        config = response.json()
        print("✅ 配置获取成功")
        print(f"  - 防火墙启用: {config.get('enable_firewall')}")
        print(f"  - 默认策略: {config.get('firewall_default_policy')}")
        print(f"  - 规则数量: {len(config.get('firewall_rules', []))}")

        if config.get('firewall_rules'):
            print("  - 防火墙规则:")
            for idx, rule in enumerate(config['firewall_rules'], 1):
                print(f"    {idx}. 端口 {rule['port']}/{rule['protocol']} - {rule['action']} from {rule['source']}")

        return config
    else:
        print(f"❌ 配置获取失败: {response.status_code}")
        print(response.text)
        return None


def test_update_firewall_rules():
    """测试更新防火墙规则"""
    print("\n" + "=" * 60)
    print("测试 3: 更新防火墙规则")
    print("=" * 60)

    config_data = {
        "image_id": 1,
        "cpu_request": 2.0,
        "memory_request": 4.0,
        "gpu_request": 0,
        "ssh_enabled": True,
        # 更新防火墙规则 - 添加端口范围
        "enable_firewall": True,
        "firewall_rules": [
            {
                "port": 22,
                "protocol": "tcp",
                "source": "10.5.8.0/24",  # 限制源IP
                "action": "allow"
            },
            {
                "port": "8000:8100",  # 端口范围
                "protocol": "tcp",
                "source": "0.0.0.0/0",
                "action": "allow"
            }
        ],
        "firewall_default_policy": "DROP"
    }

    response = requests.put(
        f"{BASE_URL}/api/applications/openclaw/config",
        headers=headers,
        json=config_data
    )

    if response.status_code == 200:
        print("✅ 防火墙规则更新成功")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        return response.json()
    else:
        print(f"❌ 防火墙规则更新失败: {response.status_code}")
        print(response.text)
        return None


def test_disable_firewall():
    """测试禁用防火墙"""
    print("\n" + "=" * 60)
    print("测试 4: 禁用防火墙")
    print("=" * 60)

    config_data = {
        "image_id": 1,
        "cpu_request": 2.0,
        "memory_request": 4.0,
        "gpu_request": 0,
        "ssh_enabled": True,
        # 禁用防火墙
        "enable_firewall": False,
        "firewall_rules": None,
        "firewall_default_policy": "DROP"
    }

    response = requests.put(
        f"{BASE_URL}/api/applications/openclaw/config",
        headers=headers,
        json=config_data
    )

    if response.status_code == 200:
        print("✅ 防火墙禁用成功")
        config = response.json()
        print(f"  - 防火墙启用: {config.get('enable_firewall')}")
        return config
    else:
        print(f"❌ 防火墙禁用失败: {response.status_code}")
        print(response.text)
        return None


def test_default_firewall_rules():
    """测试默认防火墙规则（无规则时自动添加SSH）"""
    print("\n" + "=" * 60)
    print("测试 5: 默认防火墙规则（启用防火墙但不提供规则）")
    print("=" * 60)

    config_data = {
        "image_id": 1,
        "cpu_request": 2.0,
        "memory_request": 4.0,
        "gpu_request": 0,
        "ssh_enabled": True,
        # 启用防火墙但不提供规则 - 应该自动添加 SSH 规则
        "enable_firewall": True,
        "firewall_rules": None,
        "firewall_default_policy": "DROP"
    }

    response = requests.put(
        f"{BASE_URL}/api/applications/openclaw/config",
        headers=headers,
        json=config_data
    )

    if response.status_code == 200:
        print("✅ 配置保存成功")
        print("ℹ️  注意: 启动实例时会自动添加 SSH (22) 规则")
        return response.json()
    else:
        print(f"❌ 配置保存失败: {response.status_code}")
        print(response.text)
        return None


if __name__ == "__main__":
    print("OpenClaw 防火墙功能测试")
    print(f"API URL: {BASE_URL}")
    print()

    # 检查环境变量
    if TOKEN == "your_token_here":
        print("⚠️  警告: 请设置 API_TOKEN 环境变量")
        print("   export API_TOKEN=your_actual_token")
        print()

    try:
        # 运行测试
        test_save_config_with_firewall()
        test_get_config()
        test_update_firewall_rules()
        test_get_config()  # 再次获取查看更新
        test_disable_firewall()
        test_get_config()  # 查看禁用后的状态
        test_default_firewall_rules()

        print("\n" + "=" * 60)
        print("✅ 所有测试完成")
        print("=" * 60)

    except requests.exceptions.ConnectionError:
        print(f"\n❌ 无法连接到 API 服务器: {BASE_URL}")
        print("   请确保服务器正在运行")
    except Exception as e:
        print(f"\n❌ 测试过程中出错: {str(e)}")
        import traceback
        traceback.print_exc()
