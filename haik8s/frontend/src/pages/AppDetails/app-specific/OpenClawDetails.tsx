import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../../../api/client';
import type { AppDetailsProps } from '../types';
import UsageGuide from './OpenClawDetails/UsageGuide';
import BasicConfiguration from './OpenClawDetails/BasicConfiguration';
import ModelConfiguration from './OpenClawDetails/ModelConfiguration';
import ChannelConfiguration from './OpenClawDetails/ChannelConfiguration';

interface OpenClawConfig {
  models?: {
    providers?: Record<string, any>;
  };
  channels?: Record<string, any>;
  agents?: {
    defaults?: {
      model?: { primary?: string };
      models?: Record<string, any>;
    };
  };
  gateway?: {
    port?: number;
    mode?: string;
    bind?: string;
    auth?: { mode?: string; token?: string };
  };
  file_exists?: boolean; // Added to check if config file exists
}

export default function OpenClawDetails({ appId, instance }: AppDetailsProps) {
  const [config, setConfig] = useState<OpenClawConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = async () => {
    if (instance.status !== 'running') {
      setError('容器未运行，无法读取配置');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await client.get(`/applications/${appId}/openclaw-config`, {
        params: { instance_id: instance.id },
      });
      setConfig(res.data);
    } catch (err: any) {
      const msg = err.response?.data?.detail || '读取配置失败';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [instance.id, instance.status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">加载配置中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
        <p className="text-red-700 dark:text-red-300">{error}</p>
        {instance.status !== 'running' && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-2">
            请先启动容器后再查看应用详情
          </p>
        )}
      </div>
    );
  }

  // Check if config file doesn't exist
  if (config && config.file_exists === false) {
    return (
      <div className="space-y-4">
        <UsageGuide instance={instance} />
        <BasicConfiguration instance={instance} />

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-yellow-600 dark:text-yellow-400 text-xl">⚠️</div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
                配置文件不存在
              </h3>
              <p className="text-xs text-yellow-800 dark:text-yellow-400 mb-3">
                OpenClaw配置文件 <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">~/.openclaw/openclaw.json</code> 尚未创建。
              </p>
              <div className="text-xs text-yellow-800 dark:text-yellow-400 space-y-2">
                <p className="font-medium">如何创建配置文件：</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>通过SSH连接到容器（参考上方"OpenClaw使用步骤"）</li>
                  <li>运行 OpenClaw 初始化命令创建默认配置</li>
                  <li>或手动创建配置文件：
                    <pre className="mt-1 p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded text-[10px] overflow-x-auto">
mkdir -p ~/.openclaw{'\n'}
cat {'>'} ~/.openclaw/openclaw.json {'<<'}EOF{'\n'}
{JSON.stringify({
  models: { providers: {} },
  channels: {},
  agents: { defaults: { model: { primary: "" } } },
  gateway: { port: 3000 }
}, null, 2)}
{'\n'}EOF
                    </pre>
                  </li>
                  <li>刷新此页面即可看到配置内容</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <UsageGuide instance={instance} />
      <BasicConfiguration instance={instance} />
      <ModelConfiguration
        config={config}
        instanceId={instance.id}
        appId={appId}
        onConfigUpdate={loadConfig}
      />
      <ChannelConfiguration
        config={config}
        instanceId={instance.id}
        appId={appId}
        onConfigUpdate={loadConfig}
      />
    </div>
  );
}
