// OpenClaw 使用步骤指引组件：读取 admin 配置的启动脚本分组，渲染有序步骤卡片，支持单步/多步命令执行。
// Author: Zhengde Zhang (zhangzhengde0225@gmail.com)
import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Check, Zap, Minimize2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AppInstance, AppInfo } from '../../types';
import { CommandExecutor } from '../../components/CommandExecutor';
import { MultiStepCommandExecutor, type CommandStep } from '../../components/MultiStepCommandExecutor';
import client from '../../../../../../api/client';

type RunAs = 'root' | 'ssh_user' | 'frontend';

interface Script {
  id: string;
  group: number;
  name: string;
  command: string;
  language?: 'bash' | 'python';
  run_as?: RunAs;
  enabled?: boolean;
}

interface Props {
  instance: AppInstance;
  appInfo: AppInfo;
  configDirty?: boolean;
  onAllStepsComplete?: () => void;
}

// Resolve template variables in frontend script commands, e.g. {{bound_ip}}, {{instance_id}}
function resolveFrontendCommand(command: string, instance: AppInstance): string {
  return command
    .replace(/\{\{bound_ip\}\}/g, instance.bound_ip ?? '')
    .replace(/\{\{instance_id\}\}/g, String(instance.id));
}

function buildExecutionCommand(script: Script, sshUser: string | null): string {
  let baseCmd: string;
  if (script.language === 'python') {
    const escaped = script.command.replace(/'/g, "'\\''");
    baseCmd = `python3 -c '${escaped}'`;
  } else {
    baseCmd = script.command;
  }

  if (script.run_as === 'ssh_user' && sshUser) {
    const escapedForDQ = baseCmd
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`');
    return `su - ${sshUser} -c "${escapedForDQ}"`;
  }
  return baseCmd;
}

// 已知的可复制变量：{ 占位符 -> { 显示值, 复制值 } }
type VarDef = { display: string; copyValue?: string };
function renderHint(hint: string, vars: Record<string, VarDef>): React.ReactNode {
  // First parse markdown links: [text](url)
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(hint)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      const textBefore = hint.slice(lastIndex, match.index);
      parts.push(...renderTextWithVars(textBefore, vars, parts.length));
    }
    // Add the link
    parts.push(
      <a
        key={parts.length}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 hover:underline"
      >
        {match[1]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last link
  if (lastIndex < hint.length) {
    const textAfter = hint.slice(lastIndex);
    parts.push(...renderTextWithVars(textAfter, vars, parts.length));
  }

  return parts;
}

function renderTextWithVars(text: string, vars: Record<string, VarDef>, startKey: number): React.ReactNode[] {
  const pattern = new RegExp(`(${Object.keys(vars).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    const v = vars[part];
    if (!v) return <span key={startKey + i}>{part}</span>;
    return (
      <span key={startKey + i} className="inline-flex items-center gap-1">
        <span className="font-mono">{v.display}</span>
        {v.copyValue && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(v.copyValue!);
              toast.success('已复制');
            }}
            className="p-0.5 rounded text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
            title="复制"
          >
            <Copy className="w-3 h-3" />
          </button>
        )}
      </span>
    );
  });
}

export default function UsageGuide({ instance, appInfo, configDirty, onAllStepsComplete }: Props) {
  const [showCommandExecutor, setShowCommandExecutor] = useState(false);
  const [showMultiStepExecutor, setShowMultiStepExecutor] = useState(false);
  const [commandToExecute, setCommandToExecute] = useState('');
  const [multiStepSteps, setMultiStepSteps] = useState<CommandStep[]>([]);
  const [openClawConfigured, setOpenClawConfigured] = useState(false);
  const [autoExecuteFlag, setAutoExecuteFlag] = useState(false);
  const [autoCloseFlag, setAutoCloseFlag] = useState(false);
  const [groupOverrides, setGroupOverrides] = useState<Record<number, { autoStart?: boolean; autoClose?: boolean }>>({});
  const [maskedKey, setMaskedKey] = useState<string | null | undefined>(undefined);
  const [fullKey, setFullKey] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const isRunning = instance.status === 'running';

  const toggleOverride = (g: number, key: 'autoStart' | 'autoClose', current: boolean) => {
    setGroupOverrides((prev) => ({
      ...prev,
      [g]: { ...prev[g], [key]: !current },
    }));
  };

  // Read scripts from admin config, grouped (exclude disabled scripts)
  const rawScripts: Script[] = (appInfo.startup_scripts_config?.scripts ?? []).filter(
    (s: Script) => s.enabled !== false
  );
  const groupConfigs: Record<string, { name?: string; auto_start?: boolean; auto_close?: boolean; hint?: string }> =
    appInfo.startup_scripts_config?.group_configs ?? {};
  const groupNums = [...new Set(rawScripts.map((s) => s.group))].sort((a, b) => a - b);
  const scriptsByGroup = (g: number) => rawScripts.filter((s) => s.group === g);

  const checkGatewayStatus = useCallback(async () => {
    if (!isRunning) return;
    try {
      const response = await client.post(`/containers/${instance.id}/exec`, {
        command: 'ss -tanlp | grep :18789 | grep LISTEN',
        timeout: 10,
      });
      setOpenClawConfigured(response.data.success && !!response.data.output.trim());
    } catch {
      setOpenClawConfigured(false);
    }
  }, [isRunning, instance.id]);

  useEffect(() => {
    checkGatewayStatus();
  }, [instance.id, isRunning]);

  // Auto refresh every 2s when enabled
  useEffect(() => {
    if (!autoRefresh || !isRunning) return;
    const timer = setInterval(() => {
      checkGatewayStatus();
    }, 2000);
    return () => clearInterval(timer);
  }, [autoRefresh, isRunning, checkGatewayStatus]);

  // Auto disable refresh when all steps done
  useEffect(() => {
    const allDone = groupNums.every((_, idx) => isStepDone(idx));
    if (allDone && autoRefresh) {
      setAutoRefresh(false);
      onAllStepsComplete?.();
    }
  }, [openClawConfigured, groupNums.length]);

  useEffect(() => {
    client.get('/users/key').then((res) => {
      setMaskedKey(res.data.masked_key ?? null);
      setFullKey(res.data.full_key ?? null);
    }).catch(() => {});
  }, []);

  const handleOpenSingle = (command: string, autoStart: boolean, autoClose: boolean) => {
    setCommandToExecute(command);
    setAutoExecuteFlag(autoStart);
    setAutoCloseFlag(autoClose);
    setShowCommandExecutor(true);
  };

  const handleOpenMulti = (steps: CommandStep[], autoStart: boolean, autoClose: boolean) => {
    setMultiStepSteps(steps);
    setAutoExecuteFlag(autoStart);
    setAutoCloseFlag(autoClose);
    setShowMultiStepExecutor(true);
  };

  const handleCloseExecutor = async () => {
    setShowCommandExecutor(false);
    await checkGatewayStatus();
  };

  const handlePortCommandSuccess = async () => {
    setShowCommandExecutor(false);
    await checkGatewayStatus();
  };

  const handleCloseMultiStep = async () => {
    setShowMultiStepExecutor(false);
    await checkGatewayStatus();
  };

  const isStepDone = (_groupIndex: number): boolean => {
    return openClawConfigured;
  };

  if (rawScripts.length === 0) {
    return null;
  }

  return (
    <>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300">OpenClaw使用步骤</h3>
          <label className="ml-auto flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-3.5 h-3.5 accent-blue-500"
            />
            自动刷新
          </label>
        </div>

        {!isRunning && (
          <div className="mb-4 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:text-yellow-300">
            提示: 请先启动容器后再执行以下步骤
          </div>
        )}

        {configDirty && (
          <div className="mb-4 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded text-xs text-orange-800 dark:text-orange-300">
            提示: 有未保存的配置，请先保存后再启动
          </div>
        )}

        <div className="flex items-start justify-between gap-2">
          {groupNums.map((g, groupIndex) => {
            const scripts = scriptsByGroup(g);
            const stepNumber = groupIndex + 1;
            const done = isStepDone(groupIndex);

            const groupName = groupConfigs[String(g)]?.name;
            const groupTitle = groupName
              ? groupName
              : scripts.length === 1
              ? scripts[0].name
              : `步骤 ${stepNumber}`;

            const groupTip = scripts.length === 1
              ? `执行: ${scripts[0].name}`
              : `共 ${scripts.length} 步`;

            const cfg = groupConfigs[String(g)] ?? {};
            const autoStart = groupOverrides[g]?.autoStart ?? cfg.auto_start ?? false;
            const autoClose = groupOverrides[g]?.autoClose ?? cfg.auto_close ?? false;

            const handleExecute = () => {
              if (scripts.every((s) => s.run_as === 'frontend')) {
                scripts.forEach((s) => {
                  const cmd = resolveFrontendCommand(s.command, instance);
                  if (cmd.startsWith('http://') || cmd.startsWith('https://')) {
                    window.open(cmd, '_blank', 'noopener,noreferrer');
                  } else {
                    toast.error(`未知的前端操作: ${cmd}`);
                  }
                });
                return;
              }

              // Substitute known template variables in command
              const needsHepaiKey = scripts.some((s) => s.command.includes('{{API_KEY_OF_HEPAI}}'));
              if (needsHepaiKey && !fullKey) {
                toast.error('正在从HAI平台获取专属API Key，请稍等后重试');
                return;
              }
              const resolveScript = (s: Script): Script =>
                fullKey ? { ...s, command: s.command.replace(/\{\{API_KEY_OF_HEPAI\}\}/g, fullKey) } : s;

              if (scripts.length === 1) {
                handleOpenSingle(buildExecutionCommand(resolveScript(scripts[0]), instance.ssh_user), autoStart, autoClose);
              } else {
                const steps: CommandStep[] = scripts.map((s) => ({
                  title: s.name,
                  description: `运行身份: ${s.run_as ?? 'root'}${s.language === 'python' ? ' · python' : ''}`,
                  command: buildExecutionCommand(resolveScript(s), instance.ssh_user),
                }));
                handleOpenMulti(steps, autoStart, autoClose);
              }
            };

            return (
              <div key={g} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1 text-center">
                  <div className="flex items-center gap-2 mb-2">
                    {/* Step indicator — large, on the left */}
                    {done ? (
                      <div className="flex-shrink-0 w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md">
                        <Check size={28} strokeWidth={3} />
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-14 h-14 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-2xl shadow-md">
                        {stepNumber}
                      </div>
                    )}

                    {/* Right: prominent button + toggles */}
                    <div className="flex flex-col items-start gap-1">
                      <button
                        type="button"
                        onClick={handleExecute}
                        disabled={!isRunning || !!configDirty}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold shadow transition-all ${
                          done
                            ? 'bg-green-500 hover:bg-green-600 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        } disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none`}
                        title={configDirty ? '有未保存的配置，请先保存' : undefined}
                      >
                        {groupTitle}
                      </button>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleOverride(g, 'autoStart', autoStart)}
                          title={autoStart ? '自动执行（点击关闭）' : '手动执行（点击开启自动执行）'}
                          className={`flex items-center p-0.5 rounded transition-colors hover:bg-gray-200 dark:hover:bg-slate-700 ${
                            autoStart ? 'text-green-600 dark:text-green-400' : 'text-gray-300 dark:text-slate-600'
                          }`}
                        >
                          <Zap className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleOverride(g, 'autoClose', autoClose)}
                          title={autoClose ? '执行后自动关闭弹窗（点击关闭）' : '执行后保持弹窗（点击开启自动关闭）'}
                          className={`flex items-center p-0.5 rounded transition-colors hover:bg-gray-200 dark:hover:bg-slate-700 ${
                            autoClose ? 'text-orange-500 dark:text-orange-400' : 'text-gray-300 dark:text-slate-600'
                          }`}
                        >
                          <Minimize2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Sub-info: step count or single script name */}
                  <span className="text-xs text-gray-500 dark:text-slate-400">{groupTip}</span>

                  {/* Hint from config (e.g. 访问WebUI) */}
                  {cfg.hint && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300 whitespace-pre-wrap">
                      Tips: {renderHint(cfg.hint, {
                        '{{API_KEY_OF_HEPAI}}': {
                          display: maskedKey === undefined ? '读取中...' : maskedKey ?? '（未设置）',
                        },
                      })}
                    </p>
                  )}
                </div>

                {groupIndex < groupNums.length - 1 && (
                  <div className="flex-shrink-0 h-0.5 w-8 bg-blue-300 dark:bg-blue-600 mt-[-30px]" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showCommandExecutor && (
        <CommandExecutor
          containerId={instance.id}
          containerName={instance.name}
          onClose={handleCloseExecutor}
          initialCommand={commandToExecute}
          autoExecute={autoExecuteFlag}
          onSuccess={autoCloseFlag ? handlePortCommandSuccess : undefined}
        />
      )}

      {showMultiStepExecutor && (
        <MultiStepCommandExecutor
          containerId={instance.id}
          containerName={instance.name}
          steps={multiStepSteps}
          onClose={handleCloseMultiStep}
          autoExecute={autoExecuteFlag}
          onSuccess={autoCloseFlag ? handleCloseMultiStep : undefined}
        />
      )}
    </>
  );
}
