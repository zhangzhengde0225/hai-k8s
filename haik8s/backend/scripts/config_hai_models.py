import json
import os


config_path = os.path.expanduser("~/.openclaw/openclaw.json")
hepai_api_key = os.environ.get("HEPAI_API_KEY", "")

# 读取现有配置
with open(config_path, "r") as f:
    config = json.load(f)

# 模型配置
models_config = {
    "mode": "merge",
    "providers": {
        "hepai": {
            "baseUrl": "https://aiapi.ihep.ac.cn/apiv2",
            "apiKey": hepai_api_key,
            "api": "openai-completions",
            "models": [
                {
                    "id": "hepai/deepseek-v3.2",
                    "name": "DeepSeek v3.2 (HepAI-Local)",
                    "reasoning": False,
                    "input": ["text", "image"],
                    "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0},
                    "contextWindow": 32000,
                    "maxTokens": 8192
                },
                {
                    "id": "minimax/minimax-m2.5-highspeed",
                    "name": "MiniMax M2.5 Highspeed (HepAI)",
                    "reasoning": False,
                    "input": ["text"],
                    "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0},
                    "contextWindow": 128000,
                    "maxTokens": 8192
                },
                {
                    "id": "aliyun/qwen3-max",
                    "name": "Qwen 3 Max (HepAI)",
                    "reasoning": False,
                    "input": ["text"],
                    "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0},
                    "contextWindow": 128000,
                    "maxTokens": 8192
                },
                {
                    "id": "deepseek-ai/deepseek-v3.2",
                    "name": "DeepSeek v3.2 (HepAI)",
                    "reasoning": False,
                    "input": ["text", "image"],
                    "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0},
                    "contextWindow": 200000,
                    "maxTokens": 16384
                }
            ]
        },
        "hepai_anthropic": {
            "baseUrl": "https://aiapi.ihep.ac.cn/apiv2/anthropic",
            "apiKey": hepai_api_key,
            "api": "anthropic-messages",
            "models": [
                {
                    "id": "anthropic/claude-haiku-4-5",
                    "name": "Claude Haiku 4.5 (HepAI)",
                    "reasoning": False,
                    "input": ["text"],
                    "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0},
                    "contextWindow": 128000,
                    "maxTokens": 8192
                }
            ]
        }
    }
}

# Agents 配置
agents_config = {
    "defaults": {
        "model": {
            "primary": "hepai/deepseek-ai/deepseek-v3.2",
            "fallbacks": [
                "hepai/hepai/deepseek-v3.2",
                "hepai/deepseek-ai/deepseek-v3.2",
                "hepai/aliyun/qwen3-max",
                "hepai/anthropic/claude-haiku-4-5",
                "hepai/minimax/minimax-m2.5-highspeed"
            ]
        },
        "models": {
            "hepai/hepai/deepseek-v3.2": {"alias": "hepai/deepseek-v3.2"},
            "hepai/deepseek-v3.2": {"alias": "deepseek-v3.2-hepai"},
            "aliyun/qwen3-max": {"alias": "qwen3-max-hepai"},
            "anthropic/claude-haiku-4-5": {"alias": "claude-haiku-4-5-hepai"},
            "minimax/minimax-m2.5-highspeed": {"alias": "minimax-m2.5-highspeed-hepai"}
        }
    }
}

# 合并配置
config["models"] = models_config
if "agents" not in config:
    config["agents"] = {}
if "defaults" not in config["agents"]:
    config["agents"]["defaults"] = {}
config["agents"]["defaults"].update(agents_config["defaults"])

# 写入配置
with open(config_path, "w") as f:
    json.dump(config, f, indent=2)

print("模型配置完成")
