// 模型配置：以 Tab 形式展示不同 Provider，支持从容器读取配置、Provider 增删、模型添加/删除。作者：Zhengde Zhang (zhangzhengde0225@gmail.com)
import { useState, useEffect } from 'react';
import { Cpu, RefreshCw, Eye, EyeOff, Plus, Trash2, Save, X, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AppInstance } from '../../types';
import client from '../../../../../../api/client';

interface Model {
  id: string;
  name: string;
}

interface Props {
  config: any;
  instanceId: number;
  appId: string;
  instance: AppInstance;
  onConfigUpdate: () => void;
}

export default function ModelConfiguration({ config, instanceId, appId, instance, onConfigUpdate }: Props) {
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);

  // New model form state
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // New provider form state
  const [showAddProviderForm, setShowAddProviderForm] = useState(false);
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderBaseUrl, setNewProviderBaseUrl] = useState('');
  const [newProviderApiKey, setNewProviderApiKey] = useState('');
  const [newProviderApi, setNewProviderApi] = useState('openai');

  const providers = config?.models?.providers || {};
  const primaryModel = config?.agents?.defaults?.model?.primary || '';
  const providerNames = Object.keys(providers);
  const [activeTab, setActiveTab] = useState(providerNames[0] || '');

  useEffect(() => {
    setActiveTab(providerNames[0] || '');
  }, [config]);

  const handleReadFromContainer = async () => {
    setReading(true);
    try {
      const cmd = instance.ssh_user
        ? `su - ${instance.ssh_user} -c "cat ~/.openclaw/openclaw.json"`
        : 'cat ~/.openclaw/openclaw.json';
      const res = await client.post(`/containers/${instanceId}/exec`, { command: cmd, timeout: 10 });
      if (!res.data.success || !res.data.output?.trim()) {
        toast.error('读取失败：容器内未找到配置文件');
        return;
      }
      const parsed = JSON.parse(res.data.output.trim());
      const newProviders = parsed?.models?.providers;
      if (!newProviders || Object.keys(newProviders).length === 0) {
        toast.error('配置文件中未找到 providers');
        return;
      }
      await client.put(`/applications/${appId}/openclaw-config`, {
        instance_id: instanceId,
        models: { providers: newProviders },
      });
      toast.success('已从容器读取并同步');
      onConfigUpdate();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '读取失败');
    } finally {
      setReading(false);
    }
  };

  const saveProviders = async (updatedProviders: Record<string, any>) => {
    setSaving(true);
    try {
      await client.put(`/applications/${appId}/openclaw-config`, {
        instance_id: instanceId,
        models: { providers: updatedProviders },
      });
      toast.success('已保存');
      onConfigUpdate();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const savePrimary = async (modelKey: string) => {
    setSaving(true);
    try {
      await client.put(`/applications/${appId}/openclaw-config`, {
        instance_id: instanceId,
        agents: { defaults: { model: { primary: modelKey } } },
      });
      toast.success('已设为默认模型');
      onConfigUpdate();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleAddModel = async () => {
    if (!newModelId.trim()) return;
    const provider = providers[activeTab];
    const models: Model[] = provider?.models || [];
    if (models.some((m) => m.id === newModelId.trim())) {
      toast.error('模型 ID 已存在');
      return;
    }
    const updatedModels = [...models, { id: newModelId.trim(), name: newModelName.trim() || newModelId.trim() }];
    const updatedProviders = {
      ...providers,
      [activeTab]: { ...provider, models: updatedModels },
    };
    await saveProviders(updatedProviders);
    setNewModelId('');
    setNewModelName('');
    setShowAddForm(false);
  };

  const handleDeleteModel = async (modelId: string) => {
    const provider = providers[activeTab];
    const updatedModels = (provider?.models || []).filter((m: Model) => m.id !== modelId);
    const updatedProviders = {
      ...providers,
      [activeTab]: { ...provider, models: updatedModels },
    };
    await saveProviders(updatedProviders);
  };

  const handleAddProvider = async () => {
    if (!newProviderName.trim() || !newProviderBaseUrl.trim()) {
      toast.error('Provider 名称和 Base URL 不能为空');
      return;
    }
    if (providers[newProviderName.trim()]) {
      toast.error('Provider 名称已存在');
      return;
    }
    const updatedProviders = {
      ...providers,
      [newProviderName.trim()]: {
        baseUrl: newProviderBaseUrl.trim(),
        apiKey: newProviderApiKey.trim(),
        api: newProviderApi,
        models: [],
      },
    };
    await saveProviders(updatedProviders);
    setActiveTab(newProviderName.trim());
    setNewProviderName('');
    setNewProviderBaseUrl('');
    setNewProviderApiKey('');
    setNewProviderApi('openai');
    setShowAddProviderForm(false);
  };

  const handleDeleteProvider = async (providerName: string) => {
    if (!confirm(`确定要删除 Provider "${providerName}" 吗？此操作不可恢复。`)) return;
    const { [providerName]: _, ...updatedProviders } = providers;
    await saveProviders(updatedProviders);
    if (activeTab === providerName) {
      setActiveTab(Object.keys(updatedProviders)[0] || '');
    }
  };

  if (providerNames.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">模型配置</h3>
          </div>
          <button
            onClick={handleReadFromContainer}
            disabled={reading}
            className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw size={14} className={reading ? 'animate-spin' : ''} />
            {reading ? '读取中...' : '从容器读取'}
          </button>
        </div>
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <p className="text-sm">暂未配置模型提供商</p>
          <p className="text-xs mt-1">点击「从容器读取」同步配置</p>
        </div>
      </div>
    );
  }

  const activeProvider = providers[activeTab];

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">模型配置</h3>
        </div>
        <button
          onClick={handleReadFromContainer}
          disabled={reading}
          className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 flex items-center gap-1 disabled:opacity-50"
          title="从容器内 ~/.openclaw/openclaw.json 读取"
        >
          <RefreshCw size={14} className={reading ? 'animate-spin' : ''} />
          {reading ? '读取中...' : '从容器读取'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 border-b border-gray-200 dark:border-slate-700 items-end">
        {providerNames.map((name) => (
          <div key={name} className="relative group/tab flex items-end">
            <button
              onClick={() => { setActiveTab(name); setShowAddForm(false); setShowAddProviderForm(false); }}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === name
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {name}
            </button>
            <button
              onClick={() => handleDeleteProvider(name)}
              disabled={saving}
              className="mb-1.5 ml-0.5 p-0.5 text-gray-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 opacity-0 group-hover/tab:opacity-100 transition-all disabled:opacity-50"
              title={`删除 ${name}`}
            >
              <X size={11} />
            </button>
          </div>
        ))}
        <button
          onClick={() => { setShowAddProviderForm((v) => !v); setShowAddForm(false); }}
          className="mb-1.5 ml-1 flex items-center gap-0.5 text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title="添加 Provider"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Add provider form */}
      {showAddProviderForm && (
        <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
          <p className="text-xs font-semibold text-green-700 dark:text-green-300">添加 Provider</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newProviderName}
              onChange={(e) => setNewProviderName(e.target.value)}
              placeholder="Provider 名称 * (如 hepai)"
              className="px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <input
              type="text"
              value={newProviderApi}
              onChange={(e) => setNewProviderApi(e.target.value)}
              placeholder="API 类型 (如 openai)"
              className="px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <input
              type="text"
              value={newProviderBaseUrl}
              onChange={(e) => setNewProviderBaseUrl(e.target.value)}
              placeholder="Base URL *"
              className="col-span-2 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <input
              type="text"
              value={newProviderApiKey}
              onChange={(e) => setNewProviderApiKey(e.target.value)}
              placeholder="API Key"
              className="col-span-2 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowAddProviderForm(false); setNewProviderName(''); setNewProviderBaseUrl(''); setNewProviderApiKey(''); setNewProviderApi('openai'); }}
              className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAddProvider}
              disabled={!newProviderName.trim() || !newProviderBaseUrl.trim() || saving}
              className="px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50 transition-colors"
            >
              添加
            </button>
          </div>
        </div>
      )}

      {activeProvider && (
        <div className="space-y-3">
          {/* Provider info */}
          <div className="space-y-2 text-sm">
            <div className="flex items-start justify-between">
              <span className="text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Base URL:</span>
              <code className="font-mono text-gray-900 dark:text-white text-xs break-all flex-1 text-right">
                {activeProvider.baseUrl}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">API Key:</span>
              <div className="flex items-center gap-2">
                <code className="font-mono text-gray-900 dark:text-white text-xs">
                  {showApiKey[activeTab] ? activeProvider.apiKey : '••••••••••••'}
                </code>
                <button
                  onClick={() => setShowApiKey((prev) => ({ ...prev, [activeTab]: !prev[activeTab] }))}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition-colors"
                >
                  {showApiKey[activeTab] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Model List */}
          <div className="pt-3 border-t border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                模型列表 ({activeProvider.models?.length || 0})
              </p>
              <button
                onClick={() => setShowAddForm((v) => !v)}
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                <Plus size={12} />
                添加模型
              </button>
            </div>

            {/* Add model form */}
            {showAddForm && (
              <div className="mb-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newModelId}
                    onChange={(e) => setNewModelId(e.target.value)}
                    placeholder="Model ID *"
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    placeholder="显示名称"
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleAddModel}
                    disabled={!newModelId.trim() || saving}
                    className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 transition-colors"
                    title="保存"
                  >
                    <Save size={12} />
                  </button>
                  <button
                    onClick={() => { setShowAddForm(false); setNewModelId(''); setNewModelName(''); }}
                    className="p-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
                    title="取消"
                  >
                    <X size={12} />
                  </button>
                </div>
                <p className="text-[10px] text-gray-600 dark:text-gray-400">
                  Tips: 您可在{' '}
                  <a
                    href="https://ai.ihep.ac.cn/#/cloud-models"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    HAI平台-模型广场
                  </a>
                  {' '}查看可用的模型
                </p>
              </div>
            )}

            <div className="space-y-1">
              {(activeProvider.models || []).map((model: Model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-800/50 rounded text-xs group"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <code className="font-mono text-blue-600 dark:text-blue-400 font-medium">{model.id}</code>
                    {model.id.startsWith('hepai/') && (
                      <span
                        title="使用本地模型，您的消息不会发送给外部，保障数据安全。"
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 cursor-default"
                      >
                        <Shield className="w-2.5 h-2.5" />
                        本地模型
                      </span>
                    )}
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-700 dark:text-gray-300 truncate">{model.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {`${activeTab}/${model.id}` === primaryModel ? (
                      <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded text-[10px] font-medium">
                        默认
                      </span>
                    ) : (
                      <button
                        onClick={() => savePrimary(`${activeTab}/${model.id}`)}
                        disabled={saving}
                        className="text-[10px] px-2 py-0.5 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                        title="设为默认"
                      >
                        设为默认
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteModel(model.id)}
                      disabled={saving}
                      className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {(!activeProvider.models || activeProvider.models.length === 0) && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">暂无模型</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
