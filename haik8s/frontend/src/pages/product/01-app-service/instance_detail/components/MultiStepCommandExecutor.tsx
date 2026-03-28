// 多步骤命令执行界面：按顺序执行多条命令，左侧显示步骤进度，右侧显示实时控制台输出。作者：Zhengde Zhang (zhangzhengde0225@gmail.com)
import { useState, useEffect, useRef } from 'react';
import { X, Terminal, Play, Loader2, AlertCircle, CheckCircle2, XCircle, Copy, Check, Trash2, ChevronDown, ChevronRight, StopCircle } from 'lucide-react';
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
  color?: string; backgroundColor?: string;
  fontWeight?: 'bold' | 'normal'; fontStyle?: 'italic' | 'normal';
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
  const text = raw.replace(/\\\[|\\\]/g, '');
  const re = /\x1b\[([0-9;]*)m/g;
  const segs: AnsiSegment[] = [];
  let style: AnsiStyle = {};
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index), style: { ...style } });
    const codes = m[1] === '' ? [0] : m[1].split(';').map(Number);
    for (const c of codes) style = applyCode(style, c);
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ text: text.slice(last), style: { ...style } });
  return segs;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CommandStep {
  title: string;
  description: string;
  command: string;
  ignoreFailure?: boolean;
}

type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

interface ConsoleLine { channel: 'stdout' | 'stderr' | 'error' | 'info'; text: string }

interface Props {
  containerId: number;
  containerName: string;
  onClose: () => void;
  steps: CommandStep[];
  autoExecute?: boolean;
  onSuccess?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MultiStepCommandExecutor({
  containerId, containerName, onClose, steps, autoExecute = false, onSuccess,
}: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(steps.map(() => 'pending'));
  const [executing, setExecuting] = useState(false);
  const [done, setDone] = useState(false);
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [copied, setCopied] = useState(false);
  const [autoClose, setAutoClose] = useState(false);
  const [stepEnabled, setStepEnabled] = useState<boolean[]>(steps.map(() => true));
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const setStepStatus = (idx: number, status: StepStatus) =>
    setStepStatuses(prev => { const next = [...prev]; next[idx] = status; return next; });

  const appendLine = (channel: ConsoleLine['channel'], text: string) =>
    setLines(prev => [...prev, { channel, text }]);

  const runStep = async (idx: number, controller: AbortController): Promise<boolean> => {
    const step = steps[idx];
    setStepStatus(idx, 'running');
    appendLine('info', `\n▶ 步骤 ${idx + 1}/${steps.length}：${step.title}\n`);

    const token = localStorage.getItem('token');
    const url = `${API_BASE}/containers/${containerId}/exec-stream?command=${encodeURIComponent(step.command)}&timeout=300`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token || ''}` },
        signal: controller.signal,
      });
      if (!response.ok) {
        const errText = await response.text();
        let detail = `HTTP ${response.status}`;
        try { detail = JSON.parse(errText).detail || detail; } catch {}
        appendLine('error', detail + '\n');
        setStepStatus(idx, 'failed');
        return false;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let exitCode = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(part.slice(6));
            if (data.channel === 'done') {
              exitCode = parseInt(data.text, 10);
            } else {
              appendLine(data.channel, data.text);
            }
          } catch {}
        }
      }

      const success = exitCode === 0 || !!step.ignoreFailure;
      setStepStatus(idx, exitCode === 0 ? 'success' : (step.ignoreFailure ? 'success' : 'failed'));
      if (exitCode !== 0 && step.ignoreFailure) {
        appendLine('info', `（退出码 ${exitCode}，已忽略）\n`);
      }
      return success;
    } catch (err: any) {
      if (err.name === 'AbortError') return false;
      appendLine('error', (err.message || '连接失败') + '\n');
      setStepStatus(idx, 'failed');
      return false;
    }
  };

  const executeAllSteps = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setExecuting(true);
    setDone(false);
    setLines([]);
    setStepStatuses(steps.map(() => 'pending'));

    let allSuccess = true;
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      if (!stepEnabled[i]) {
        setStepStatus(i, 'skipped');
        appendLine('info', `\n⏭ 步骤 ${i + 1}/${steps.length}：${steps[i].title}（已跳过）\n`);
        continue;
      }
      const ok = await runStep(i, controller);
      if (!ok) {
        allSuccess = false;
        toast.error(`步骤 ${i + 1} 执行失败，已终止`);
        break;
      }
    }

    setExecuting(false);
    setDone(true);
    if (allSuccess) {
      toast.success('所有步骤执行成功！');
      onSuccess?.();
      if (autoClose) setTimeout(() => onClose(), 1500);
    }
  };

  useEffect(() => {
    if (autoExecute) executeAllSteps();
  }, []);

  const handleForceStop = () => {
    abortRef.current?.abort();
    setStepStatuses(prev => prev.map(s => s === 'running' ? 'failed' : s));
    setExecuting(false);
    setDone(true);
    appendLine('error', '\n⛔ 已强制停止\n');
    toast.error('已强制停止');
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(lines.map(l => l.text).join(''));
    setCopied(true);
    toast.success('已复制到剪贴板');
    setTimeout(() => setCopied(false), 2000);
  };

  const getStepIcon = (status: StepStatus, stepNumber: number) => {
    switch (status) {
      case 'skipped':
        return (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 flex items-center justify-center">
            <span className="text-xs font-bold">{stepNumber}</span>
          </div>
        );
      case 'running':
        return (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        );
      case 'success':
        return (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
      case 'failed':
        return (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md">
            <XCircle className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 dark:bg-slate-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
            {stepNumber}
          </div>
        );
    }
  };

  const allSuccess = done && stepStatuses.every(s => s === 'success');
  const hasFailed  = stepStatuses.some(s => s === 'failed');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Terminal className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">多步骤命令执行</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">{containerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <div
                onClick={() => setAutoClose(v => !v)}
                className={`relative w-8 h-4 rounded-full transition-colors ${autoClose ? 'bg-blue-500' : 'bg-gray-300 dark:bg-slate-600'}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${autoClose ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">成功后自动关闭</span>
            </label>
            <button
              onClick={onClose}
              disabled={executing}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
            </button>
          </div>
        </div>

        {/* Body: two columns */}
        <div className="flex flex-1 min-h-0 divide-x divide-gray-200 dark:divide-slate-700">

          {/* Left: step flow + execute */}
          <div className="w-2/5 flex flex-col p-5 gap-5 overflow-y-auto">
            {/* Step flow */}
            <div className="flex flex-col gap-2">
              {steps.map((step, index) => {
                const status = stepStatuses[index];
                const expanded = expandedStep === index;
                return (
                  <div key={index} className={`border rounded-lg overflow-hidden transition-opacity ${stepEnabled[index] ? 'border-gray-200 dark:border-slate-700' : 'border-gray-200 dark:border-slate-700 opacity-50'}`}>
                    <button
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                      onClick={() => setExpandedStep(expanded ? null : index)}
                    >
                      {getStepIcon(status, index + 1)}
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-semibold leading-tight ${stepEnabled[index] ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-slate-500 line-through'}`}>{step.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-0.5">{step.description}</div>
                      </div>
                      {/* Toggle */}
                      <div
                        onClick={e => { e.stopPropagation(); if (!executing) setStepEnabled(prev => { const next = [...prev]; next[index] = !next[index]; return next; }); }}
                        className={`relative flex-shrink-0 w-8 h-4 rounded-full transition-colors ${stepEnabled[index] ? 'bg-blue-500' : 'bg-gray-300 dark:bg-slate-600'} ${executing ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        title={stepEnabled[index] ? '点击禁用此步骤' : '点击启用此步骤'}
                      >
                        <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${stepEnabled[index] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                      {expanded
                        ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                    </button>
                    {expanded && (
                      <div className="border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950/50 px-3 py-2">
                        <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all leading-snug">{step.command}</pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Execute / Stop buttons */}
            <div className="flex gap-2">
              <button
                onClick={executeAllSteps}
                disabled={executing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {executing
                  ? <><Loader2 className="w-5 h-5 animate-spin" />执行中 ({currentStep + 1}/{steps.length})...</>
                  : <><Play className="w-5 h-5" />{done ? '重新执行' : '开始执行全部步骤'}</>
                }
              </button>
              {executing && (
                <button
                  onClick={handleForceStop}
                  className="flex items-center gap-1.5 px-3 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                  title="强制停止"
                >
                  <StopCircle className="w-5 h-5" />
                  停止
                </button>
              )}
            </div>

            {/* Overall result */}
            {done && (
              <div className={`flex items-center gap-2 p-3 rounded-lg ${allSuccess ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                {allSuccess
                  ? <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  : <AlertCircle  className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />}
                <p className={`text-sm font-medium ${allSuccess ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  {allSuccess ? '所有步骤执行成功' : '执行中断'}
                </p>
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
                <button onClick={handleCopy} disabled={lines.length === 0}
                  className="p-1.5 hover:bg-gray-700 rounded transition-colors disabled:opacity-30" title="复制输出">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                </button>
                <button onClick={() => setLines([])} disabled={lines.length === 0}
                  className="p-1.5 hover:bg-gray-700 rounded transition-colors disabled:opacity-30" title="清除">
                  <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto bg-black p-4 rounded-br-xl">
              {lines.length === 0 && !executing ? (
                <p className="text-xs text-gray-500 italic font-mono">点击"开始执行"后将在此处显示实时输出...</p>
              ) : (
                <pre className="text-xs font-mono whitespace-pre leading-tight">
                  {lines.map((line, i) => {
                    if (line.channel === 'info') {
                      return <span key={i} style={{ color: '#60a5fa', fontWeight: 'bold' }}>{line.text}</span>;
                    }
                    const defaultColor =
                      line.channel === 'stderr' ? '#fbbf24' :
                      line.channel === 'error'  ? '#f87171' : '#e5e5e5';
                    const segs = parseAnsi(line.text);
                    return (
                      <span key={i}>
                        {segs.map((seg, j) => (
                          <span key={j} style={{ color: seg.style.color ?? defaultColor, ...seg.style }}>{seg.text}</span>
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
            <span>
              {executing ? `正在执行步骤 ${currentStep + 1}/${steps.length}...` :
               allSuccess ? '✓ 所有步骤已成功完成' :
               hasFailed  ? '✗ 执行失败，已终止' :
               '💡 步骤将按顺序执行，失败则终止'}
            </span>
            <button
              onClick={onClose}
              disabled={executing}
              className="px-4 py-1.5 text-sm text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {executing ? '执行中...' : '关闭'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
