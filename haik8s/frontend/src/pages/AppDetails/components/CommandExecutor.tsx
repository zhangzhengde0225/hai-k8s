import { useState, useEffect } from 'react';
import { X, Terminal, Play, Loader2, AlertCircle, CheckCircle2, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../../../api/client';

interface Props {
  containerId: number;
  containerName: string;
  onClose: () => void;
  initialCommand?: string;  // 预填充的命令
  autoExecute?: boolean;  // 是否自动执行
  onSuccess?: () => void;  // 执行成功的回调
}

export function CommandExecutor({ containerId, containerName, onClose, initialCommand = '', autoExecute = false, onSuccess }: Props) {
  const [command, setCommand] = useState(initialCommand);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    output: string;
    error?: string;
    exit_code: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleExecute = async () => {
    if (!command.trim()) {
      toast.error('请输入命令');
      return;
    }

    setExecuting(true);
    setResult(null);

    try {
      const response = await client.post(`/containers/${containerId}/exec`, {
        command: command.trim(),
        timeout: 30,
      });

      setResult(response.data);

      if (response.data.success) {
        toast.success('命令执行成功');
        // 如果有成功回调，延迟调用以便用户看到成功消息
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 1500);
        }
      } else {
        toast.error('命令执行失败');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || '命令执行失败';
      toast.error(errorMsg);
      setResult({
        success: false,
        output: '',
        error: errorMsg,
        exit_code: -1,
      });
    } finally {
      setExecuting(false);
    }
  };

  // 自动执行
  useEffect(() => {
    if (autoExecute && command.trim()) {
      handleExecute();
    }
  }, []);

  const handleCopyOutput = async () => {
    if (!result?.output) return;
    await navigator.clipboard.writeText(result.output);
    setCopied(true);
    toast.success('已复制到剪贴板');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter 执行命令
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Terminal className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">命令执行</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">{containerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Command Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              命令
              <span className="ml-2 text-xs text-gray-500 dark:text-slate-500">(Ctrl+Enter 执行)</span>
            </label>
            <div className="relative">
              <textarea
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入要执行的命令，例如：ls -la"
                disabled={executing}
                rows={3}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg font-mono text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              />
            </div>
          </div>

          {/* Quick Commands */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              快捷命令
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'pwd', cmd: 'pwd' },
                { label: 'ls', cmd: 'ls -la' },
                { label: '环境变量', cmd: 'env' },
                { label: '进程', cmd: 'ps aux' },
                { label: '磁盘', cmd: 'df -h' },
                { label: '内存', cmd: 'free -h' },
              ].map((item) => (
                <button
                  key={item.cmd}
                  onClick={() => setCommand(item.cmd)}
                  disabled={executing}
                  className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Execute Button */}
          <button
            onClick={handleExecute}
            disabled={executing || !command.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {executing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                执行中...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                执行命令
              </>
            )}
          </button>

          {/* Result */}
          {result && (
            <div className="space-y-3">
              {/* Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        执行成功
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">
                        执行失败
                      </span>
                    </>
                  )}
                  <span className="text-xs text-gray-500 dark:text-slate-500">
                    退出码: {result.exit_code}
                  </span>
                </div>
                {result.output && (
                  <button
                    onClick={handleCopyOutput}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? '已复制' : '复制'}
                  </button>
                )}
              </div>

              {/* Output */}
              {result.output && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-slate-400 mb-1">
                    输出
                  </label>
                  <div className="bg-gray-900 dark:bg-black rounded-lg p-4 overflow-x-auto">
                    <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all">
                      {result.output}
                    </pre>
                  </div>
                </div>
              )}

              {/* Error */}
              {result.error && (
                <div>
                  <label className="block text-xs font-medium text-red-600 dark:text-red-400 mb-1">
                    错误信息
                  </label>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <pre className="text-xs text-red-800 dark:text-red-300 font-mono whitespace-pre-wrap break-all">
                      {result.error}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-500">
            <div className="flex items-center gap-4">
              <span>💡 提示: 支持管道、重定向等 Bash 语法</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
