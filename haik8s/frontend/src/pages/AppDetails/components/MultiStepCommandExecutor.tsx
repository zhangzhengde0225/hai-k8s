import { useState, useEffect } from 'react';
import { X, Terminal, Play, Loader2, AlertCircle, CheckCircle2, XCircle, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../../../api/client';

export interface CommandStep {
  title: string;
  description: string;
  command: string;
}

interface Props {
  containerId: number;
  containerName: string;
  onClose: () => void;
  steps: CommandStep[];
  autoExecute?: boolean;
  onSuccess?: () => void;
}

type StepStatus = 'pending' | 'running' | 'success' | 'failed';

interface StepResult {
  status: StepStatus;
  output?: string;
  error?: string;
  exit_code?: number;
}

export function MultiStepCommandExecutor({
  containerId,
  containerName,
  onClose,
  steps,
  autoExecute = false,
  onSuccess,
}: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepResults, setStepResults] = useState<StepResult[]>(
    steps.map(() => ({ status: 'pending' }))
  );
  const [executing, setExecuting] = useState(false);
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  const executeStep = async (stepIndex: number) => {
    const step = steps[stepIndex];

    // 更新状态为运行中
    setStepResults(prev => {
      const newResults = [...prev];
      newResults[stepIndex] = { status: 'running' };
      return newResults;
    });

    try {
      const response = await client.post(`/containers/${containerId}/exec`, {
        command: step.command.trim(),
        timeout: 60,
      });

      if (response.data.success) {
        // 成功
        setStepResults(prev => {
          const newResults = [...prev];
          newResults[stepIndex] = {
            status: 'success',
            output: response.data.output,
            exit_code: response.data.exit_code,
          };
          return newResults;
        });
        return true;
      } else {
        // 失败
        setStepResults(prev => {
          const newResults = [...prev];
          newResults[stepIndex] = {
            status: 'failed',
            output: response.data.output,
            error: response.data.error,
            exit_code: response.data.exit_code,
          };
          return newResults;
        });
        return false;
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || '命令执行失败';
      setStepResults(prev => {
        const newResults = [...prev];
        newResults[stepIndex] = {
          status: 'failed',
          error: errorMsg,
          exit_code: -1,
        };
        return newResults;
      });
      return false;
    }
  };

  const executeAllSteps = async () => {
    setExecuting(true);

    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      const success = await executeStep(i);

      if (!success) {
        // 失败则终止
        toast.error(`步骤 ${i + 1} 执行失败，已终止`);
        setExecuting(false);
        return;
      }

      // 小延迟，让用户看到进度
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 全部成功
    toast.success('所有步骤执行成功！');
    setExecuting(false);

    if (onSuccess) {
      setTimeout(() => {
        onSuccess();
      }, 1500);
    }
  };

  // 自动执行
  useEffect(() => {
    if (autoExecute) {
      executeAllSteps();
    }
  }, []);

  const handleCopyOutput = async (stepIndex: number) => {
    const output = stepResults[stepIndex]?.output;
    if (!output) return;

    await navigator.clipboard.writeText(output);
    setCopiedStep(stepIndex);
    toast.success('已复制到剪贴板');
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const getStepIcon = (status: StepStatus, stepNumber: number) => {
    switch (status) {
      case 'running':
        return (
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        );
      case 'success':
        return (
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        );
      case 'failed':
        return (
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md">
            <XCircle className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-300 dark:bg-slate-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
            {stepNumber}
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Terminal className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">多步骤命令执行</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">{containerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={executing}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Steps Flow */}
          <div className="flex items-start justify-between gap-2">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center flex-1">
                {/* Step Content */}
                <div className="flex flex-col items-center flex-1 text-center">
                  {/* Circle and Title */}
                  <div className="flex items-center gap-2 mb-2">
                    {getStepIcon(stepResults[index].status, index + 1)}
                    <span className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                      {step.title}
                    </span>
                  </div>
                  {/* Description */}
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {step.description}
                  </div>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="flex-shrink-0 h-0.5 w-8 bg-gray-300 dark:bg-slate-600 mt-[-30px]" />
                )}
              </div>
            ))}
          </div>

          {/* Execute Button */}
          {!executing && stepResults.every(r => r.status === 'pending') && (
            <button
              onClick={executeAllSteps}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              <Play className="w-5 h-5" />
              开始执行全部步骤
            </button>
          )}

          {/* Step Details */}
          <div className="space-y-4">
            {steps.map((step, index) => {
              const result = stepResults[index];
              if (result.status === 'pending') return null;

              return (
                <div
                  key={index}
                  className={`border rounded-lg p-4 ${
                    result.status === 'success'
                      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                      : result.status === 'failed'
                      ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                      : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                  }`}
                >
                  {/* Step Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {result.status === 'success' && (
                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                      )}
                      {result.status === 'failed' && (
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      )}
                      {result.status === 'running' && (
                        <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                      )}
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        步骤 {index + 1}: {step.title}
                      </span>
                      {result.exit_code !== undefined && (
                        <span className="text-xs text-gray-500 dark:text-slate-500">
                          退出码: {result.exit_code}
                        </span>
                      )}
                    </div>
                    {result.output && (
                      <button
                        onClick={() => handleCopyOutput(index)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 transition-colors"
                      >
                        {copiedStep === index ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        {copiedStep === index ? '已复制' : '复制'}
                      </button>
                    )}
                  </div>

                  {/* Command */}
                  <div className="mb-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-slate-400 mb-1">
                      命令
                    </label>
                    <div className="bg-gray-900 dark:bg-black rounded p-2">
                      <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all">
                        {step.command}
                      </pre>
                    </div>
                  </div>

                  {/* Output */}
                  {result.output && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-slate-400 mb-1">
                        输出
                      </label>
                      <div className="bg-gray-900 dark:bg-black rounded p-3 max-h-40 overflow-y-auto">
                        <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all">
                          {result.output}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {result.error && (
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-red-600 dark:text-red-400 mb-1">
                        错误信息
                      </label>
                      <div className="bg-red-100 dark:bg-red-900/40 rounded p-3">
                        <pre className="text-xs text-red-800 dark:text-red-300 font-mono whitespace-pre-wrap break-all">
                          {result.error}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-500">
            <div className="flex items-center gap-4">
              {executing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  正在执行步骤 {currentStep + 1}/{steps.length}...
                </span>
              ) : stepResults.every(r => r.status === 'success') ? (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  ✓ 所有步骤已成功完成
                </span>
              ) : stepResults.some(r => r.status === 'failed') ? (
                <span className="text-red-600 dark:text-red-400 font-medium">
                  ✗ 执行失败，已终止
                </span>
              ) : (
                <span>💡 步骤将按顺序执行，失败则终止</span>
              )}
            </div>
            <button
              onClick={onClose}
              disabled={executing}
              className="px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {executing ? '执行中...' : '关闭'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
