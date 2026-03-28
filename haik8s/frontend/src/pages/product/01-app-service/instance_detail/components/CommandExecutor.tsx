// 命令执行界面：在容器中执行命令，左侧为命令输入与结果，右侧为实时流式控制台输出。作者：Zhengde Zhang (zhangzhengde0225@gmail.com)
import { useState, useEffect, useRef } from 'react';
import { X, Terminal, Play, Loader2, AlertCircle, CheckCircle2, Copy, Check, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE } from '../../../../../config';

// ── ANSI 解析器 ──────────────────────────────────────────────────────────────

const ANSI_FG: Record<number, string> = {
  30: '#4e4e4e', 31: '#cc0000', 32: '#4e9a06', 33: '#c4a000',
  34: '#3465a4', 35: '#75507b', 36: '#06989a', 37: '#d3d7cf',
  90: '#888888', 91: '#ef2929', 92: '#8ae234', 93: '#fce94f',
  94: '#729fcf', 95: '#ad7fa8', 96: '#34e2e2', 97: '#ffffff',
};
const ANSI_BG: Record<number, string> = {
  40: '#000000', 41: '#cc0000', 42: '#4e9a06', 43: '#c4a000',
  44: '#3465a4', 45: '#75507b', 46: '#06989a', 47: '#d3d7cf',
};

interface AnsiStyle {
  color?: string;
  backgroundColor?: string;
  fontWeight?: 'bold' | 'normal';
  fontStyle?: 'italic' | 'normal';
  textDecoration?: 'underline' | 'none';
}

function applyCode(s: AnsiStyle, code: number): AnsiStyle {
  if (code === 0)  return {};
  if (code === 1)  return { ...s, fontWeight: 'bold' };
  if (code === 3)  return { ...s, fontStyle: 'italic' };
  if (code === 4)  return { ...s, textDecoration: 'underline' };
  if (code === 22) return { ...s, fontWeight: 'normal' };
  if (ANSI_FG[code]) return { ...s, color: ANSI_FG[code] };
  if (ANSI_BG[code]) return { ...s, backgroundColor: ANSI_BG[code] };
  return s;
}

interface AnsiSegment { text: string; style: AnsiStyle }

function parseAnsi(raw: string): AnsiSegment[] {
  // strip bash \[ \] prompt markers, then parse ESC[ sequences
  const text = raw.replace(/\\\[|\\\]/g, '');
  const re = /\x1b\[([0-9;]*)m/g;
  const segs: AnsiSegment[] = [];
  let style: AnsiStyle = {};
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index), style: { ...style } });
    const codes = m[1] === '' ? [0] : m[1].split(';').map(Number);
    for (const c of codes) style = applyCode(style, c);
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ text: text.slice(last), style: { ...style } });
  return segs;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  containerId: number;
  containerName: string;
  onClose: () => void;
  initialCommand?: string;
  autoExecute?: boolean;
  onSuccess?: () => void;
}

interface StreamLine {
  channel: 'stdout' | 'stderr' | 'error';
  text: string;
}

export function CommandExecutor({ containerId, containerName, onClose, initialCommand = '', autoExecute = false, onSuccess }: Props) {
  const [command, setCommand] = useState(initialCommand);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; exit_code: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [autoClose, setAutoClose] = useState(false);
  const [streamLines, setStreamLines] = useState<StreamLine[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamLines]);

  const handleExecute = async () => {
    if (!command.trim()) {
      toast.error('请输入命令');
      return;
    }

    // 取消上一次流
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setExecuting(true);
    setResult(null);
    setStreamLines([]);

    const token = localStorage.getItem('token');
    const url = `${API_BASE}/containers/${containerId}/exec-stream?command=${encodeURIComponent(command.trim())}&timeout=300`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token || ''}` },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        let detail = `HTTP ${response.status}`;
        try { detail = JSON.parse(errText).detail || detail; } catch {}
        throw new Error(detail);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.channel === 'done') {
              const exitCode = parseInt(data.text, 10);
              const success = exitCode === 0;
              setResult({ success, exit_code: exitCode });
              if (success) {
                toast.success('命令执行成功');
                if (onSuccess) setTimeout(() => onSuccess(), 1500);
                if (autoClose) setTimeout(() => onClose(), 1500);
              } else {
                toast.error('命令执行失败');
              }
            } else {
              setStreamLines((prev) => [...prev, data as StreamLine]);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      const msg = err.message || '连接失败';
      toast.error(msg);
      setStreamLines((prev) => [...prev, { channel: 'error', text: msg }]);
      setResult({ success: false, exit_code: -1 });
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

  const handleCopyConsole = async () => {
    const text = streamLines.map((l) => l.text).join('');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('已复制到剪贴板');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Terminal className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">命令执行</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">{containerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <div
                onClick={() => setAutoClose((v) => !v)}
                className={`relative w-8 h-4 rounded-full transition-colors ${autoClose ? 'bg-blue-500' : 'bg-gray-300 dark:bg-slate-600'}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${autoClose ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">成功后自动关闭</span>
            </label>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
            </button>
          </div>
        </div>

        {/* Body: two columns */}
        <div className="flex flex-1 min-h-0 divide-x divide-gray-200 dark:divide-slate-700">

          {/* Left: command input + status */}
          <div className="w-2/5 flex flex-col overflow-y-auto p-5 space-y-4">
            {/* Command Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                命令
                <span className="ml-2 text-xs text-gray-500 dark:text-slate-500">(Ctrl+Enter 执行)</span>
              </label>
              <textarea
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入要执行的命令"
                disabled={executing}
                rows={4}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg font-mono text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              />
            </div>

            {/* Quick Commands */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">快捷命令</label>
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
                <><Loader2 className="w-5 h-5 animate-spin" />执行中...</>
              ) : (
                <><Play className="w-5 h-5" />执行命令</>
              )}
            </button>

            {/* Result status */}
            {result && (
              <div className={`flex items-center gap-2 p-3 rounded-lg ${result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                {result.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                )}
                <div>
                  <p className={`text-sm font-medium ${result.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {result.success ? '执行成功' : '执行失败'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-500">退出码: {result.exit_code}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right: streaming console */}
          <div className="w-3/5 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-4 py-2 bg-black border-b border-gray-700 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-300">控制台输出</span>
                {executing && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    实时输出中
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopyConsole}
                  disabled={streamLines.length === 0}
                  className="p-1.5 hover:bg-gray-700 rounded transition-colors disabled:opacity-30"
                  title="复制全部输出"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                </button>
                <button
                  onClick={() => setStreamLines([])}
                  disabled={streamLines.length === 0}
                  className="p-1.5 hover:bg-gray-700 rounded transition-colors disabled:opacity-30"
                  title="清除输出"
                >
                  <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto bg-black p-4 rounded-br-xl">
              {streamLines.length === 0 && !executing ? (
                <p className="text-xs text-gray-500 italic font-mono">执行命令后将在此处显示实时输出...</p>
              ) : (
                <pre className="text-xs font-mono whitespace-pre leading-tight">
                  {streamLines.map((line, i) => {
                    const defaultColor =
                      line.channel === 'stderr' ? '#fbbf24' :
                      line.channel === 'error'  ? '#f87171' :
                      '#e5e5e5';
                    const segs = parseAnsi(line.text);
                    return (
                      <span key={i}>
                        {segs.map((seg, j) => (
                          <span
                            key={j}
                            style={{ color: seg.style.color ?? defaultColor, ...seg.style }}
                          >
                            {seg.text}
                          </span>
                        ))}
                      </span>
                    );
                  })}
                </pre>
              )}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-500">
            <span>💡 提示: 支持管道、重定向等 Bash 语法，长命令超时 300s</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
