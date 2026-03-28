# OpenClaw 初始化详细步骤

Author: Zhengde ZHANG

## 概述

OpenClaw 实例初始化需要按顺序执行 4 个步骤，每步都通过 `kubectl exec` 在容器内执行。

## 前置条件

- 容器状态为 `Running`
- openclaw CLI 已安装在容器内（hai-openclaw 镜像已包含）
- 已获取容器访问密码

## 步骤详解

### Step 1: Onboard 注册

```bash
openclaw onboard \
    --non-interactive \
    --accept-risk \
    --flow quickstart \
    --mode local \
    --gateway-bind lan \
    --gateway-auth token \
    --gateway-password "$PASSWORD" \
    --skip-channels \
    --skip-skills \
    --skip-health \
    --install-daemon
```

参数说明：
- `--non-interactive`: 非交互模式
- `--accept-risk`: 接受风险提示
- `--flow quickstart`: 快速启动流程
- `--mode local`: 本地模式
- `--gateway-bind lan`: 绑定 LAN 接口
- `--gateway-auth token`: 使用 token 认证
- `--gateway-password`: 设置 gateway 密码
- `--skip-*`: 跳过可选配置步骤

### Step 2: 启用 Insecure HTTP 认证

修改 `~/.openclaw/openclaw.json`，在 gateway 字段下添加：
```json
"controlUi": { "allowInsecureAuth": true }
```

使用 jq 命令：
```bash
jq '.gateway.controlUi = {"allowInsecureAuth": true}' ~/.openclaw/openclaw.json > /tmp/openclaw.json && mv /tmp/openclaw.json ~/.openclaw/openclaw.json
```

或使用 sed：
```bash
sed -i 's/"gateway": {/"gateway": {\n    "controlUi": {\n        "allowInsecureAuth": true\n    },/' ~/.openclaw/openclaw.json
```

### Step 3: 配置模型

从 hai-k8s 数据库读取 `models_config_template`，替换占位符后写入配置。

模型配置模板结构：
```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "hepai": {
        "baseUrl": "https://aiapi.ihep.ac.cn/apv2",
        "apiKey": "${HEPAI_API_KEY}",
        "api": "openai-completions",
        "models": [...]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {...}
    }
  }
}
```

步骤：
1. 读取 `models_config_template`
2. 替换 `${HEPAI_API_KEY}` 为实际值
3. 合并到 `~/.openclaw/openclaw.json`

### Step 4: 启动 Gateway

```bash
#!/bin/bash
export TZ="Asia/Shanghai"
openclaw gateway --port 18789 --bind lan
```

Gateway 启动后会：
- 监听 `0.0.0.0:18789`
- 提供 Web UI 和 API
- 可通过 `bound_ip:18789` 访问（如已配置 macvlan）

## 状态验证

每步执行后检查：
```bash
# 检查 openclaw 是否已 onboard
openclaw status

# 检查 gateway 是否运行
openclaw gateway status

# 查看监听端口
ss -tlnp | grep 18789
```

## 错误处理

| 错误 | 可能原因 | 解决方案 |
|------|---------|---------|
| onboard 失败 | 网络问题或已 onboard | 检查网络，确认未重复 onboard |
| config 写入失败 | 权限问题 | 检查 ~/.openclaw 目录权限 |
| gateway 启动失败 | 端口被占用 | 检查 18789 端口是否空闲 |
