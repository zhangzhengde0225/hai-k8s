import { useState, useEffect } from 'react';
import { BookOpen, Check, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AppInstance } from '../../types';
import { CommandExecutor } from '../../components/CommandExecutor';
import { MultiStepCommandExecutor, type CommandStep } from '../../components/MultiStepCommandExecutor';
import client from '../../../../api/client';

interface Props {
  instance: AppInstance;
}

export default function UsageGuide({ instance }: Props) {
  const [showCommandExecutor, setShowCommandExecutor] = useState(false);
  const [showMultiStepExecutor, setShowMultiStepExecutor] = useState(false);
  const [commandToExecute, setCommandToExecute] = useState('');
  const [port18789Opened, setPort18789Opened] = useState(false);
  const [openClawConfigured, setOpenClawConfigured] = useState(false);
  const [gatewayToken, setGatewayToken] = useState<string>('');
  const [isPortCommand, setIsPortCommand] = useState(false);

  const handleOpenExecutor = (command: string, isPort: boolean = false, isMultiStep: boolean = false) => {
    if (isMultiStep) {
      setShowMultiStepExecutor(true);
    } else {
      setCommandToExecute(command);
      setIsPortCommand(isPort);
      setShowCommandExecutor(true);
    }
  };

  const handleCloseExecutor = async () => {
    setShowCommandExecutor(false);

    // 命令执行器关闭后，重新检查端口状态
    await checkPortStatus();
    await checkGatewayStatus();
  };

  const handlePortCommandSuccess = async () => {
    // 端口放通成功后：关闭弹窗并重新检查状态
    setShowCommandExecutor(false);
    await checkPortStatus();
    await checkGatewayStatus();
  };

  const checkPortStatus = async () => {
    if (!isRunning) return;

    try {
      const response = await client.post(`/containers/${instance.id}/exec`, {
        command: 'iptables -L INPUT -n | grep 18789',
        timeout: 10,
      });

      if (response.data.success && response.data.output.trim()) {
        setPort18789Opened(true);
      } else {
        setPort18789Opened(false);
      }
    } catch (error) {
      setPort18789Opened(false);
    }
  };

  const checkGatewayStatus = async () => {
    if (!isRunning) return;

    try {
      // 使用 ss -tanlp 检查18789端口是否在监听
      const response = await client.post(`/containers/${instance.id}/exec`, {
        command: 'ss -tanlp | grep :18789 | grep LISTEN',
        timeout: 10,
      });

      if (response.data.success && response.data.output.trim()) {
        setOpenClawConfigured(true);
        // 端口启动后，获取 gateway token
        await getGatewayToken();
      } else {
        setOpenClawConfigured(false);
        setGatewayToken('');
      }
    } catch (error) {
      setOpenClawConfigured(false);
      setGatewayToken('');
    }
  };

  const getGatewayToken = async () => {
    if (!isRunning) return;

    try {
      const cmd = instance.ssh_user
        ? `su - ${instance.ssh_user} -c "openclaw config get gateway.auth.token"`
        : 'openclaw config get gateway.auth.token';

      const response = await client.post(`/containers/${instance.id}/exec`, {
        command: cmd,
        timeout: 10,
      });

      if (response.data.success && response.data.output.trim()) {
        setGatewayToken(response.data.output.trim());
      } else {
        setGatewayToken('');
      }
    } catch (error) {
      setGatewayToken('');
    }
  };

  const isRunning = instance.status === 'running';

  // 检查18789端口是否已放通和网关是否已启动
  useEffect(() => {
    checkPortStatus();
    checkGatewayStatus();
  }, [instance.id, isRunning]);

  // 构建 OpenClaw onboard 命令
  const buildOnboardCommand = () => {
    const onboardCmd = `openclaw onboard \\
    --non-interactive \\
    --accept-risk \\
    --flow quickstart \\
    --mode local \\
    --gateway-bind lan \\
    --gateway-auth token \\
    --skip-channels \\
    --skip-skills \\
    --skip-health \\
    --install-daemon`;

    return instance.ssh_user
      ? `su - ${instance.ssh_user} -c "${onboardCmd}"`
      : onboardCmd;
  };

  // 构建允许不安全HTTP的命令
  const buildEnableInsecureHttpCommand = () => {
    const configPath = instance.ssh_user
      ? `/home/${instance.ssh_user}/.openclaw/openclaw.json`
      : '~/.openclaw/openclaw.json';

    // 使用 python 来修改 JSON 配置文件
    const pythonCmd = `python3 -c 'import json; config=json.load(open("${configPath}")); config.setdefault("gateway",{}).setdefault("controlUi",{})["allowInsecureAuth"]=True; json.dump(config,open("${configPath}","w"),indent=2); print("已允许不安全的HTTP认证")'`;

    return instance.ssh_user
      ? `su - ${instance.ssh_user} -c '${pythonCmd}'`
      : pythonCmd;
  };

  // 构建配置模型的命令
  const buildConfigModelsCommand = () => {
    const configPath = instance.ssh_user
      ? `/home/${instance.ssh_user}/.openclaw/openclaw.json`
      : '~/.openclaw/openclaw.json';

    // 使用 python 脚本来配置模型，将完整的模型配置和 agents 配置合并到 openclaw.json
    const pythonCmd = `python3 -c '
import json
import os

config_path = "${configPath}"
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
                },
                {
                    "id": "hepai/deepseek-v3.2",
                    "name": "DeepSeek v3.2 (HepAI-Local)",
                    "reasoning": False,
                    "input": ["text", "image"],
                    "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0},
                    "contextWindow": 32000,
                    "maxTokens": 8192
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
                },
                {
                    "id": "minimax/minimax-m2.5-highspeed",
                    "name": "MiniMax M2.5 Highspeed (HepAI)",
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
'`;

    return instance.ssh_user
      ? `su - ${instance.ssh_user} -c '${pythonCmd}'`
      : pythonCmd;
  };

  // 构建 OpenClaw 配置的多步骤命令（不包括端口放通）
  const buildConfigSteps = (): CommandStep[] => {
    return [
      {
        title: '初始化配置',
        description: '使用非交互式方式初始化 OpenClaw',
        command: buildOnboardCommand(),
      },
      {
        title: '允许HTTP认证',
        description: '修改配置文件以允许HTTP访问',
        command: buildEnableInsecureHttpCommand(),
      },
      {
        title: '配置模型',
        description: '配置 HepAI 模型和 Agents',
        command: buildConfigModelsCommand(),
      },
      {
        title: '启动网关服务',
        description: '使用 pm2 启动 OpenClaw Gateway 服务',
        command: instance.ssh_user
          ? `su - ${instance.ssh_user} -c 'pm2 start sh --name openclaw-gateway -- -c "openclaw gateway --port 18789 --bind lan"'`
          : 'pm2 start sh --name openclaw-gateway -- -c "openclaw gateway --port 18789 --bind lan"',
      },
    ];
  };

  const handleCopyToken = async () => {
    if (!gatewayToken) return;

    try {
      await navigator.clipboard.writeText(gatewayToken);
      toast.success('Token已复制到剪贴板');
    } catch (error) {
      toast.error('复制失败');
    }
  };

  const formatToken = (token: string) => {
    if (token.length <= 8) return token;
    return `${token.slice(0, 4)}****${token.slice(-4)}`;
  };

  const handleCloseMultiStepExecutor = async () => {
    setShowMultiStepExecutor(false);
    // 关闭时重新检查网关状态
    await checkGatewayStatus();
  };

  const handleMultiStepSuccess = async () => {
    // 成功后检查网关状态
    await checkGatewayStatus();
  };

  const steps = [
    {
      number: 1,
      title: '端口放通',
      tip: '放通18789端口',
      command: 'iptables -I INPUT -p tcp --dport 18789 -j ACCEPT && echo "端口18789已放通"',
      isMultiStep: false,
    },
    {
      number: 2,
      title: '配置OpenClaw',
      tip: '初始化、配置并启动服务',
      command: '',
      isMultiStep: true,
    },
    {
      number: 3,
      title: '访问WebUI',
      tip: '',
      command: '',
      isMultiStep: false,
    },
  ];

  return (
    <>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300">OpenClaw使用步骤</h3>
        </div>

        {!isRunning && (
          <div className="mb-4 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:text-yellow-300">
            提示: 请先启动容器后再执行以下步骤
          </div>
        )}

        {/* 步骤流程 */}
        <div className="flex items-start justify-between gap-2">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center flex-1">
              {/* 步骤内容 */}
              <div className="flex flex-col items-center flex-1 text-center">
                {/* 圆圈和标题 */}
                <div className="flex items-center gap-2 mb-2">
                  {/* 大圆圈 */}
                  {(step.number === 1 && port18789Opened) ||
                   (step.number === 2 && openClawConfigured) ||
                   (step.number === 3 && gatewayToken) ? (
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md">
                      <Check size={24} strokeWidth={3} />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-lg shadow-md">
                      {step.number}
                    </div>
                  )}
                  {/* 标题 */}
                  <span className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                    {step.title}
                  </span>
                </div>

                {/* 简要提示 + 执行命令链接（同一行） */}
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {step.number === 3 ? (
                    // 步骤3：访问WebUI特殊显示
                    openClawConfigured && gatewayToken ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <a
                          href={`http://${instance.bound_ip}:18789`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
                        >
                          打开此处访问
                        </a>
                        <div className="flex items-center gap-1 text-[10px] text-gray-700 dark:text-gray-300">
                          <span>Gateway Token:</span>
                          <span className="font-mono font-semibold">{formatToken(gatewayToken)}</span>
                          <button
                            onClick={handleCopyToken}
                            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                            title="复制完整Token"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-500">等待配置完成...</span>
                    )
                  ) : (
                    // 步骤1和2：显示提示和执行按钮
                    <>
                      {step.tip}，
                      <button
                        onClick={() => handleOpenExecutor(step.command, step.number === 1, step.isMultiStep)}
                        disabled={!isRunning}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                      >
                        执行命令
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 连接线 (最后一个步骤不显示) */}
              {index < steps.length - 1 && (
                <div className="flex-shrink-0 h-0.5 w-8 bg-blue-300 dark:bg-blue-600 mt-[-30px]" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Command Executor Modal */}
      {showCommandExecutor && (
        <CommandExecutor
          containerId={instance.id}
          containerName={instance.name}
          onClose={handleCloseExecutor}
          initialCommand={commandToExecute}
          autoExecute={isPortCommand}
          onSuccess={isPortCommand ? handlePortCommandSuccess : undefined}
        />
      )}

      {/* Multi-Step Command Executor Modal */}
      {showMultiStepExecutor && (
        <MultiStepCommandExecutor
          containerId={instance.id}
          containerName={instance.name}
          steps={buildConfigSteps()}
          onClose={handleCloseMultiStepExecutor}
          autoExecute={false}
          onSuccess={handleMultiStepSuccess}
        />
      )}
    </>
  );
}
