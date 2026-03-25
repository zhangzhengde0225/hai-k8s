// 基础配置：WebUI访问地址、Gateway Token、重启网关等基础操作。作者：Zhengde Zhang (zhangzhengde0225@gmail.com)
import { useState, useEffect } from 'react';
import { Settings2, Globe, RefreshCw, Copy, Eye, EyeOff, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AppInstance } from '../../types';
import { CommandExecutor } from '../../components/CommandExecutor';
import client from '../../../../../../api/client';

interface Props {
  instance: AppInstance;
  refreshTrigger?: number;
}

export default function BasicConfiguration({ instance, refreshTrigger }: Props) {
  const [showCommandExecutor, setShowCommandExecutor] = useState(false);
  const [gatewayToken, setGatewayToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const isRunning = instance.status === 'running';

  useEffect(() => {
    if (!isRunning) { setGatewayToken(''); return; }
    const cmd = instance.ssh_user
      ? `su - ${instance.ssh_user} -c "openclaw config get gateway.auth.token"`
      : 'openclaw config get gateway.auth.token';
    client.post(`/containers/${instance.id}/exec`, { command: cmd, timeout: 10 })
      .then((res) => {
        setGatewayToken(res.data.success && res.data.output.trim() ? res.data.output.trim() : '');
      })
      .catch(() => setGatewayToken(''));
  }, [instance.id, isRunning, refreshTrigger]);

  const handleCopyToken = async () => {
    if (!gatewayToken) return;
    try {
      await navigator.clipboard.writeText(gatewayToken);
      toast.success('Token已复制到剪贴板');
    } catch {
      toast.error('复制失败');
    }
  };

  const formatToken = (token: string) => {
    if (token.length <= 8) return token;
    return `${token.slice(0, 4)}****${token.slice(-4)}`;
  };

  return (
    <>
      <div className="space-y-4">
        {/* 基础配置 */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">基础配置</h3>
          </div>

          <div className="space-y-3">
            {/* WebUI 访问地址 */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">WebUI 访问地址:</span>
              </div>
              {instance.bound_ip ? (
                <a
                  href={`http://${instance.bound_ip}:18789`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-mono"
                >
                  http://{instance.bound_ip}:18789
                </a>
              ) : (
                <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                  未配置IP地址
                </span>
              )}
            </div>

            {/* Gateway Token */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">Gateway Token:</span>
                <span
                  title="访问 OpenClaw 网页，在 Overview 中填入 Gateway Token，点击 Connect，即能成功连接"
                  className="text-gray-400 dark:text-slate-500 cursor-help"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </span>
              </div>
              {gatewayToken ? (
                <div className="flex items-center gap-1">
                  <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                    {showToken ? gatewayToken : formatToken(gatewayToken)}
                  </span>
                  <button
                    onClick={() => setShowToken((v) => !v)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    title={showToken ? '隐藏Token' : '查看完整Token'}
                  >
                    {showToken
                      ? <EyeOff className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                      : <Eye className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                    }
                  </button>
                  <button
                    onClick={handleCopyToken}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    title="复制完整Token"
                  >
                    <Copy className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              ) : (
                <span className="text-sm text-gray-400 dark:text-gray-500">
                  {isRunning ? '读取中...' : '容器未运行'}
                </span>
              )}
            </div>

            {/* 重启 OpenClaw 网关 */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <span className="text-sm font-medium text-gray-900 dark:text-white">重启 OpenClaw 网关</span>
              <button
                onClick={() => setShowCommandExecutor(true)}
                disabled={!isRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" />
                执行命令
              </button>
            </div>

          </div>
        </div>
      </div> 

      {/* Command Executor Modal */}
      {showCommandExecutor && (
        <CommandExecutor
          containerId={instance.id}
          containerName={instance.name}
          onClose={() => setShowCommandExecutor(false)}
          initialCommand={
            instance.ssh_user
              ? `su - ${instance.ssh_user} -c "pm2 delete openclaw-gateway; pm2 start sh --name openclaw-gateway -- -c 'openclaw gateway --port 18789 --bind lan'"`
              : `pm2 delete openclaw-gateway && pm2 start sh --name openclaw-gateway -- -c "openclaw gateway --port 18789 --bind lan"`
          }
        />
      )}
    </>
  );
}
