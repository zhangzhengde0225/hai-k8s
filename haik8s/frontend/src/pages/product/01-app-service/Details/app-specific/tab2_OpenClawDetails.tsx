import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../../../../../api/client';
import type { AppDetailsProps } from '../types';
import UsageGuide from './OpenClawDetails/01_UsageGuide';
import BasicConfiguration from './OpenClawDetails/02_BasicConfiguration';
import ModelConfiguration from './OpenClawDetails/03_ModelConfiguration';
import ChannelConfiguration from './OpenClawDetails/04_ChannelConfiguration';

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
}

export default function OpenClawDetails({ appId, appInfo, instance }: AppDetailsProps) {
  const [config, setConfig] = useState<OpenClawConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

  // 静默刷新：不显示 loading，不卸载子组件，避免触发循环
  const reloadConfigSilent = async () => {
    if (instance.status !== 'running') return;
    try {
      const res = await client.get(`/applications/${appId}/openclaw-config`, {
        params: { instance_id: instance.id },
      });
      setConfig(res.data);
    } catch {
      // 静默失败
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

  return (
    <div className="space-y-4">
      <UsageGuide instance={instance} appInfo={appInfo} onAllStepsComplete={() => {
        setRefreshTrigger((v) => v + 1);
        reloadConfigSilent();
      }} />
      <BasicConfiguration instance={instance} refreshTrigger={refreshTrigger} />
      <ModelConfiguration
        config={config}
        instanceId={instance.id}
        appId={appId}
        instance={instance}
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
