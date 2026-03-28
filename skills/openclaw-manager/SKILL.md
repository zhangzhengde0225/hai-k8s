---
name: openclaw-manager
description: OpenClaw 实例初始化与管理。在 hai-k8s 容器内完成 OpenClaw 的完整初始化（onboard 注册、配置模型、启动 Gateway）。当需要对新创建的 OpenClaw 容器进行初始化配置，或管理已有 OpenClaw 实例时使用此 skill。
---

# openclaw-manager

对 hai-k8s 中运行中的 OpenClaw 容器进行初始化配置和管理。

## 前置条件

- 容器必须处于 **Running** 状态
- 容器内有 `openclaw` CLI 可用
- 已通过 `hai-k8s-container` skill 获取容器 ID 和 exec 权限

## 认证方式

与 hai-k8s-container 相同（两层认证）：
- `X-Admin-API-Key`：共享管理员 API Key
- `Authorization: Bearer <user_jwt_token>`

## 完整初始化流程

OpenClaw 初始化分为 4 个步骤，按顺序执行：

### Step 1：非交互式 Onboard 注册
```bash
openclaw onboard \
    --non-interactive \
    --accept-risk \
    --flow quickstart \
    --mode local \
    --gateway-bind lan \
    --gateway-auth token \
    --gateway-password $GATEWAY_PASSWORD \
    --skip-channels \
    --skip-skills \
    --skip-health \
    --install-daemon
```

### Step 2：启用 Insecure HTTP 认证
```bash
# 在 ~/.openclaw/openclaw.json 的 gateway 字段下添加：
"controlUi": { "allowInsecureAuth": true }
```
使用 jq 或 sed 修改配置文件。

### Step 3：配置模型
从 hai-k8s 数据库读取 `models_config_template`，替换 `${HEPAI_API_KEY}` 为用户的实际 API Key，然后写入 `~/.openclaw/openclaw.json`。

### Step 4：启动 Gateway
```bash
export TZ="Asia/Shanghai"
openclaw gateway --port 18789 --bind lan
```

## 执行方式

通过 hai-k8s-container skill 的 exec 接口逐条执行命令：
```
POST /api/containers/{container_id}/exec
Body: {
  "command": "<step_command>",
  "timeout": 60
}
```

## 初始化状态检查

每步执行后检查返回的 `exit_code`：
- `0` = 成功，继续下一步
- 非 `0` = 失败，记录错误信息，停止流程

## 获取配置信息

容器初始化完成后，可通过以下方式获取 OpenClaw 访问信息：
```
GET /api/applications/openclaw/instances
```
返回容器状态、bound_ip、SSH 密码等信息。

## 注意事项

- `$GATEWAY_PASSWORD` 需要从容器信息中获取（root_password 或 user_password）
- 模型配置的 `${HEPAI_API_KEY}` 必须替换为真实 Key，否则模型无法使用
- Gateway 启动后监听 18789 端口
- 初始化顺序不可颠倒

## 参考文档

- OpenClaw 初始化详细步骤：`references/openclaw-init-steps.md`
- 启动脚本参考：`references/startup_scripts.md`
