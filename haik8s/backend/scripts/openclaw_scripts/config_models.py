import json
import os


config_path = os.path.expanduser("~/.openclaw/openclaw.json")
hepai_api_key = "{{API_KEY_OF_HEPAI}}"

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
                    "id": "openai/gpt-5.4-mini",
                    "name": "GPT-5.4 Mini (HepAI)",
                    "reasoning": False,
                    "input": ["text","image"],
                    "cost": {
                        "input": 0,
                        "output": 0,
                        "cacheRead": 0,
                        "cacheWrite": 0
                        },
                    "contextWindow": 128000,
                    "maxTokens": 8192
                },
                {
                    "id": "aliyun/qwen3-max",
                    "name": "Qwen 3 Max (HepAI)",
                    "reasoning": False,
                    "input": ["text"],
                    "cost": {"input": 6, "output": 24, "cacheRead": 0, "cacheWrite": 0},
                    "contextWindow": 128000,
                    "maxTokens": 8192
                },
                {
                    "id": "deepseek-ai/deepseek-v3.2",
                    "name": "DeepSeek v3.2 (HepAI)",
                    "reasoning": False,
                    "input": ["text", "image"],
                    "cost": {"input": 2, "output": 3, "cacheRead": 0, "cacheWrite": 0},
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
                    "cost": {"input": 10, "output": 50, "cacheRead": 1, "cacheWrite": 20},
                    "contextWindow": 128000,
                    "maxTokens": 8192
                },
                {
                    "id": "minimax/minimax-m2.7",
                    "name": "MiniMax M2.7 (HepAI)",
                    "reasoning": False,
                    "input": ["text"],
                    "cost": {"input": 2.1, "output": 8.4, "cacheRead": 0.21, "cacheWrite": 2.625},
                    "contextWindow": 128000,
                    "maxTokens": 8192
                },
                {
                    "id": "minimax/minimax-m2.7-highspeed",
                    "name": "MiniMax M2.7 Highspeed (HepAI)",
                    "reasoning": False,
                    "input": ["text"],
                    "cost": {"input": 4.2, "output": 16.8, "cacheRead": 0.21, "cacheWrite": 2.625},
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
            "primary": "hepai_anthropic/minimax/minimax-m2.7",
            "fallbacks": [
                "hepai/hepai/deepseek-v3.2",
                "hepai/deepseek-ai/deepseek-v3.2",
                "hepai/aliyun/qwen3-max",
                "hepai/anthropic/claude-haiku-4-5",
                "hepai/minimax/minimax-m2.5-highspeed",
                "hepai/openai/gpt-5.4-mini"
            ]
        },
        "models": {
            "hepai/hepai/deepseek-v3.2": {"alias": "hepai/deepseek-v3.2"},
            "hepai/deepseek-v3.2": {"alias": "deepseek-v3.2-hepai"},
            "aliyun/qwen3-max": {"alias": "qwen3-max-hepai"},
            "anthropic/claude-haiku-4-5": {"alias": "claude-haiku-4-5-hepai"},
            "minimax/minimax-m2.5-highspeed": {"alias": "minimax-m2.5-highspeed-hepai"}
        }
    },
    "imageModel": {
        "primary": "hepai/openai/gpt-5.4-mini",
        "fallbacks": [
          "hepai_anthropic/anthropic/claude-haiku-4-5"
        ]
      }
}

# 2. 合并配置

# 合并模型配置
if "models" not in config:
    config["models"] = models_config
else:   # 确保provider合并
    if "providers" not in config["models"]:
        config["models"]["providers"] = models_config["providers"]
    else:
        for provider_name, provider_info in models_config["providers"].items():
            if provider_name not in config["models"]["providers"]:
                config["models"]["providers"][provider_name] = provider_info
            else:
                # 如果provider已存在，则合并模型列表
                existing_models = {model["id"]: model for model in config["models"]["providers"][provider_name]["models"]}
                for model in provider_info["models"]:
                    if model["id"] not in existing_models:
                        config["models"]["providers"][provider_name]["models"].append(model)

# 合并Agent的默认模型配置
if "agents" not in config:
    config["agents"] = {}
if "defaults" not in config["agents"]:
    # 如果为空则直接使用新的defaults
    config["agents"]["defaults"] = agents_config["defaults"]
else:  # 如果已有defaults，合并内部的模型配置
    if "model" not in config["agents"]["defaults"]:
        config["agents"]["defaults"]["model"] = agents_config["defaults"]["model"]
    else:
        pass  # 不变
    # 合并models别名配置
    if "models" not in config["agents"]["defaults"]:
        config["agents"]["defaults"]["models"] = agents_config["defaults"]["models"]
    else:
        existing_models_aliases = config["agents"]["defaults"]["models"]
        for model_id, model_info in agents_config["defaults"]["models"].items():
            if model_id not in existing_models_aliases:
                existing_models_aliases[model_id] = model_info
            else:
                # 如果模型已存在，可以选择覆盖或保留原有别名，这里选择保留原有别名
                pass
    # 合并imageModel配置
    if "imageModel" not in config["agents"]["defaults"]:
        config["agents"]["defaults"]["imageModel"] = agents_config["imageModel"]
    else:
        pass  # 不变


# 写入配置
with open(config_path, "w") as f:
    json.dump(config, f, indent=2)

print(f"模型配置完成，默认模型已设置为: {agents_config['defaults']['model']['primary']}")

