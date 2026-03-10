import { useState, useEffect } from 'react';
import { BookOpen, Check } from 'lucide-react';
import type { AppInstance } from '../../types';
import { CommandExecutor } from '../../components/CommandExecutor';
import client from '../../../../api/client';

interface Props {
  instance: AppInstance;
}

export default function UsageGuide({ instance }: Props) {
  const [showCommandExecutor, setShowCommandExecutor] = useState(false);
  const [commandToExecute, setCommandToExecute] = useState('');
  const [port18789Opened, setPort18789Opened] = useState(false);
  const [isPortCommand, setIsPortCommand] = useState(false);

  const handleOpenExecutor = (command: string, isPort: boolean = false) => {
    setCommandToExecute(command);
    setIsPortCommand(isPort);
    setShowCommandExecutor(true);
  };

  const handleCloseExecutor = async () => {
    setShowCommandExecutor(false);

    // 命令执行器关闭后，重新检查端口状态
    await checkPortStatus();
  };

  const handlePortCommandSuccess = async () => {
    // 端口放通成功后：关闭弹窗并重新检查状态
    setShowCommandExecutor(false);
    await checkPortStatus();
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

  const isRunning = instance.status === 'running';

  // 检查18789端口是否已放通
  useEffect(() => {
    checkPortStatus();
  }, [instance.id, isRunning]);

  const steps = [
    {
      number: 1,
      title: '端口放通',
      tip: '放通18789端口',
      command: 'iptables -I INPUT -p tcp --dport 18789 -j ACCEPT && echo "端口18789已放通"',
    },
    {
      number: 2,
      title: '配置OpenClaw',
      tip: '初始化配置',
      command: 'openclaw onboard',
    },
    {
      number: 3,
      title: '启动服务',
      tip: '启动OpenClaw服务',
      command: 'openclaw gateway --port 18789 --bind lan',
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
                  {step.number === 1 && port18789Opened ? (
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
                  {step.tip}，
                  <button
                    onClick={() => handleOpenExecutor(step.command, step.number === 1)}
                    disabled={!isRunning}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                  >
                    执行命令
                  </button>
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
    </>
  );
}
