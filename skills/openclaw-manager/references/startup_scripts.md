# OpenClaw 启动脚本参考

Author: Zhengde ZHANG

这些是 hai-k8s 中实际使用的启动脚本，供参考。

## 脚本位置

`haik8s/backend/apps/openclaw/startup/`

## 脚本清单

### 1-allow_port_18789.sh
预留端口脚本（当前为空，用于未来端口配置）。

### 2-1_onboard_non_interactive.sh
非交互式 onboard：
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

### 2-2_enable_insecure_http.sh
启用 insecure http 认证：
```bash
# 在 openclaw.json gateway 字段添加：
# "controlUi": { "allowInsecureAuth": true}
```
参考实现：从 `models_config_hepai.json` 读取配置。

### 2-3_config_models.sh
配置模型：
```bash
# 从 models_config_hepai.json 读取模型配置
# 替换 ${HEPAI_API_KEY} 为实际 API Key
# 写入 ~/.openclaw/openclaw.json
```

### 2-4_start_gateway.sh
启动 Gateway：
```bash
#!/bin/bash
export TZ="Asia/Shanghai"
openclaw gateway --port 18789 --bind lan
```

## models_config_hepai.json 结构

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "hepai": {
        "baseUrl": "https://aiapi.ihep.ac.cn/apiv2",
        "apiKey": "${HEPAI_API_KEY}",
        "api": "openai-completions",
        "models": [
          {"id": "aliyun/qwen3-max", "name": "Qwen 3 Max (HepAI)", ...},
          {"id": "deepseek-ai/deepseek-v3.2", "name": "DeepSeek v3.2 (HepAI)", ...}
        ]
      },
      "hepai_anthropic": {
        "baseUrl": "https://aiapi.ihep.ac.cn/apiv2/anthropic",
        "apiKey": "${HEPAI_API_KEY}",
        "api": "anthropic-messages",
        "models": [
          {"id": "anthropic/claude-haiku-4-5", "name": "Claude Haiku 4.5 (HepAI)", ...},
          {"id": "minimax/minimax-m2.5-highspeed", "name": "MiniMax M2.5 Highspeed (HepAI)", ...}
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "hepai/deepseek-ai/deepseek-v3.2",
        "fallbacks": [...]
      }
    }
  }
}
```

## 注意事项

- 这些脚本由管理员在前端配置后保存到数据库的 `startup_scripts_config` 字段
- Skill 执行时需要从数据库读取这些配置
- 实际执行顺序：Step 1 → Step 2 → Step 3 → Step 4
