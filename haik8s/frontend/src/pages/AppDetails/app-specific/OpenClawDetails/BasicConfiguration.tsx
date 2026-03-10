import { useState } from 'react';
import { Settings2, Globe, RefreshCw, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AppInstance } from '../../types';
import { CommandExecutor } from '../../components/CommandExecutor';

interface Props {
  instance: AppInstance;
}

export default function BasicConfiguration({ instance }: Props) {
  const [showCommandExecutor, setShowCommandExecutor] = useState(false);
  const [publicAccess, setPublicAccess] = useState(false);

  // 模型配置
  const [modelProvider, setModelProvider] = useState('高能AI');
  const [modelName, setModelName] = useState('qwen3-max');
  const fullModelPath = `${modelProvider === '高能AI' ? 'hepai' : modelProvider.toLowerCase()}/${modelName}`;

  // 飞书配置
  const [feishuAppId, setFeishuAppId] = useState('');
  const [feishuAppSecret, setFeishuAppSecret] = useState('');

  // 企业微信配置
  const [wecomToken, setWecomToken] = useState('');
  const [wecomAesKey, setWecomAesKey] = useState('');

  const isRunning = instance.status === 'running';

  const handleRestartGateway = () => {
    setShowCommandExecutor(true);
  };

  const handleApplyModel = () => {
    toast.success('模型配置已应用');
    // TODO: 调用API保存模型配置
  };

  const handleTogglePublicAccess = () => {
    setPublicAccess(!publicAccess);
    toast.success(publicAccess ? '公网访问已关闭' : '公网访问已开启');
    // TODO: 调用API切换公网访问
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

            {/* 重启 OpenClaw 网关 */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <span className="text-sm font-medium text-gray-900 dark:text-white">重启 OpenClaw 网关</span>
              <button
                onClick={handleRestartGateway}
                disabled={!isRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" />
                执行命令
              </button>
            </div>

            {/* 公网访问 */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <span className="text-sm font-medium text-gray-900 dark:text-white">公网访问</span>
              <button
                onClick={handleTogglePublicAccess}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  publicAccess ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    publicAccess ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* 模型配置 */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">模型配置</h3>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={modelProvider}
              onChange={(e) => setModelProvider(e.target.value)}
              placeholder="提供商"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="模型名称"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-slate-700 rounded-lg font-mono text-gray-700 dark:text-gray-300">
              {fullModelPath}
            </div>
            <button
              onClick={handleApplyModel}
              className="flex items-center gap-1 px-4 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
            >
              <Check className="w-4 h-4" />
              应用
            </button>
          </div>
        </div>

        {/* 通道配置 */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">通道配置</h3>
          </div>

          <div className="space-y-4">
            {/* 飞书 */}
            <div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">飞书</div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={feishuAppId}
                  onChange={(e) => setFeishuAppId(e.target.value)}
                  placeholder="飞书应用 App ID"
                  autoComplete="off"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="password"
                  value={feishuAppSecret}
                  onChange={(e) => setFeishuAppSecret(e.target.value)}
                  placeholder="飞书应用 App Secret"
                  autoComplete="new-password"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 企业微信 */}
            <div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">企业微信</div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={wecomToken}
                  onChange={(e) => setWecomToken(e.target.value)}
                  placeholder="企业微信机器人 Token"
                  autoComplete="off"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={wecomAesKey}
                  onChange={(e) => setWecomAesKey(e.target.value)}
                  placeholder="企业微信机器人 EncodingAESKey"
                  autoComplete="off"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
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
              ? `pkill -f 'openclaw gateway' && su - ${instance.ssh_user} -c "openclaw gateway --port 18789 --bind lan &"`
              : `pkill -f 'openclaw gateway' && openclaw gateway --port 18789 --bind lan &`
          }
        />
      )}
    </>
  );
}
