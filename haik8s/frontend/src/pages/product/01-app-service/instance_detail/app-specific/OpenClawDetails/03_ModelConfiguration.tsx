// 模型配置：主区域显示首选文本/图像模型，模型列表可折叠展开，Provider 管理通过弹窗操作。作者：Zhengde Zhang (zhangzhengde0225@gmail.com)
import { useState, useEffect } from 'react';
import { Cpu, RefreshCw, Eye, EyeOff, Plus, Trash2, Save, X, Shield, Edit2, Settings, ChevronDown, ChevronRight, FileText, Image } from 'lucide-react';
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
  onDirtyChange?: (dirty: boolean) => void;
}

// ── Provider 管理弹窗 ────────────────────────────────────────────────────────
interface ProviderModalProps {
  providers: Record<string, any>;
  saving: boolean;
  onClose: () => void;
  onSaveProviders: (updated: Record<string, any>) => Promise<void>;
}

function ProviderModal({ providers, saving, onClose, onSaveProviders }: ProviderModalProps) {
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [editBaseUrl, setEditBaseUrl] = useState('');
  const [editApiKey, setEditApiKey] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newApi, setNewApi] = useState('openai');

  const startEdit = (name: string) => {
    setEditingProvider(name);
    setEditBaseUrl(providers[name]?.baseUrl ?? '');
    setEditApiKey(providers[name]?.apiKey ?? '');
  };

  const cancelEdit = () => setEditingProvider(null);

  const handleSaveEdit = async () => {
    if (!editBaseUrl.trim()) return;
    await onSaveProviders({
      ...providers,
      [editingProvider!]: { ...providers[editingProvider!], baseUrl: editBaseUrl.trim(), apiKey: editApiKey.trim() },
    });
    setEditingProvider(null);
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`确定要删除 Provider "${name}" 吗？此操作不可恢复。`)) return;
    const { [name]: _, ...rest } = providers;
    await onSaveProviders(rest);
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newBaseUrl.trim()) {
      toast.error('Provider 名称和 Base URL 不能为空');
      return;
    }
    if (providers[newName.trim()]) {
      toast.error('Provider 名称已存在');
      return;
    }
    await onSaveProviders({
      ...providers,
      [newName.trim()]: { baseUrl: newBaseUrl.trim(), apiKey: newApiKey.trim(), api: newApi, models: [] },
    });
    setNewName(''); setNewBaseUrl(''); setNewApiKey(''); setNewApi('openai');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">管理 Provider</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition-colors">
            <X size={16} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {Object.keys(providers).length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">暂无 Provider</p>
          )}
          {Object.entries(providers).map(([name, p]: [string, any]) => (
            <div key={name} className="border border-gray-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{name}</span>
                <div className="flex items-center gap-2">
                  {editingProvider !== name && (
                    <button
                      onClick={() => startEdit(name)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <Edit2 size={12} />编辑
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(name)}
                    disabled={saving}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} />删除
                  </button>
                </div>
              </div>

              {editingProvider === name ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">Base URL<span className="text-red-500">*</span></span>
                    <input
                      type="text"
                      value={editBaseUrl}
                      onChange={(e) => setEditBaseUrl(e.target.value)}
                      placeholder="Base URL（必填）"
                      className={`flex-1 px-2 py-1 text-xs border rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        !editBaseUrl.trim() ? 'border-red-400' : 'border-gray-300 dark:border-slate-600'
                      }`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">API Key</span>
                    <input
                      type="text"
                      value={editApiKey}
                      onChange={(e) => setEditApiKey(e.target.value)}
                      placeholder="API Key（可选）"
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelEdit} className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded transition-colors">取消</button>
                    <button onClick={handleSaveEdit} disabled={!editBaseUrl.trim() || saving} className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 transition-colors">
                      <Save size={11} />保存
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-16 flex-shrink-0">Base URL</span>
                    <code className="font-mono text-gray-800 dark:text-gray-200 break-all">{p.baseUrl}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-16 flex-shrink-0">API Key</span>
                    <div className="flex items-center gap-1">
                      <code className="font-mono text-gray-800 dark:text-gray-200">
                        {showApiKey[name] ? p.apiKey : '••••••••••••'}
                      </code>
                      <button
                        onClick={() => setShowApiKey((prev) => ({ ...prev, [name]: !prev[name] }))}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded"
                      >
                        {showApiKey[name] ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-16 flex-shrink-0">模型数</span>
                    <span className="text-gray-700 dark:text-gray-300">{p.models?.length ?? 0}</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add provider form */}
          {showAddForm ? (
            <div className="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-green-700 dark:text-green-300">添加 Provider</p>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="名称 * (如 hepai)" className="px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500" />
                <input type="text" value={newApi} onChange={(e) => setNewApi(e.target.value)} placeholder="API 类型 (如 openai)" className="px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500" />
                <input type="text" value={newBaseUrl} onChange={(e) => setNewBaseUrl(e.target.value)} placeholder="Base URL *" className="col-span-2 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500" />
                <input type="text" value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} placeholder="API Key" className="col-span-2 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowAddForm(false); setNewName(''); setNewBaseUrl(''); setNewApiKey(''); setNewApi('openai'); }} className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded transition-colors">取消</button>
                <button onClick={handleAdd} disabled={!newName.trim() || !newBaseUrl.trim() || saving} className="px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50 transition-colors">添加</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddForm(true)} className="w-full flex items-center justify-center gap-1 py-2 text-xs text-gray-400 hover:text-green-600 dark:hover:text-green-400 border border-dashed border-gray-300 dark:border-slate-600 hover:border-green-400 dark:hover:border-green-600 rounded-lg transition-colors">
              <Plus size={13} />添加 Provider
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-slate-700 flex-shrink-0 flex justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded transition-colors">关闭</button>
        </div>
      </div>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
export default function ModelConfiguration({ config, instanceId, appId, instance, onConfigUpdate, onDirtyChange }: Props) {
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [modelListExpanded, setModelListExpanded] = useState(false);

  // Add model form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newModelProvider, setNewModelProvider] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');

  const providers: Record<string, any> = config?.models?.providers || {};
  const providerNames = Object.keys(providers);
  const primaryTextModel = config?.agents?.defaults?.model?.primary || '';
  const primaryImageModel = config?.agents?.defaults?.imageModel?.primary || '';

  useEffect(() => {
    onDirtyChange?.(false);
  }, [config]);

  // 初始化新模型表单的 provider 选项
  useEffect(() => {
    if (providerNames.length > 0 && !newModelProvider) {
      setNewModelProvider(providerNames[0]);
    }
  }, [providerNames.join(',')]);

  // 所有模型的扁平列表
  const allModels = providerNames.flatMap((pName) =>
    (providers[pName]?.models || []).map((m: Model) => ({ ...m, provider: pName }))
  );

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

  const savePrimaryText = async (modelKey: string) => {
    setSaving(true);
    try {
      await client.put(`/applications/${appId}/openclaw-config`, {
        instance_id: instanceId,
        agents: { defaults: { model: { primary: modelKey } } },
      });
      toast.success('已设为首选文本模型');
      onConfigUpdate();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const savePrimaryImage = async (modelKey: string) => {
    setSaving(true);
    try {
      await client.put(`/applications/${appId}/openclaw-config`, {
        instance_id: instanceId,
        agents: { defaults: { imageModel: { primary: modelKey } } },
      });
      toast.success('已设为首选图像模型');
      onConfigUpdate();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleAddModel = async () => {
    if (!newModelId.trim() || !newModelProvider) return;
    const provider = providers[newModelProvider];
    const models: Model[] = provider?.models || [];
    if (models.some((m) => m.id === newModelId.trim())) {
      toast.error('模型 ID 已存在');
      return;
    }
    const updatedModels = [...models, { id: newModelId.trim(), name: newModelName.trim() || newModelId.trim() }];
    await saveProviders({ ...providers, [newModelProvider]: { ...provider, models: updatedModels } });
    setNewModelId('');
    setNewModelName('');
    setShowAddForm(false);
  };

  const handleDeleteModel = async (providerName: string, modelId: string) => {
    const provider = providers[providerName];
    const updatedModels = (provider?.models || []).filter((m: Model) => m.id !== modelId);
    await saveProviders({ ...providers, [providerName]: { ...provider, models: updatedModels } });
  };

  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">模型配置</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReadFromContainer}
              disabled={reading}
              className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 flex items-center gap-1 disabled:opacity-50"
              title="从容器内 ~/.openclaw/openclaw.json 读取"
            >
              <RefreshCw size={14} className={reading ? 'animate-spin' : ''} />
              {reading ? '读取中...' : '从容器读取'}
            </button>
            <button
              onClick={() => setShowProviderModal(true)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 border border-gray-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 px-2 py-1 rounded transition-colors"
            >
              <Settings size={13} />
              管理 Provider
              {providerNames.length > 0 && (
                <span className="text-gray-400 dark:text-gray-500">({providerNames.length})</span>
              )}
            </button>
          </div>
        </div>

        {/* 首选模型信息行 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
            <div className="flex items-center gap-2 flex-shrink-0">
              <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">首选文本模型</span>
            </div>
            <select
              value={primaryTextModel}
              onChange={(e) => savePrimaryText(e.target.value)}
              disabled={saving || allModels.length === 0}
              className="ml-3 flex-1 max-w-[65%] px-2 py-1 text-xs font-mono border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-green-700 dark:text-green-300 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50 truncate"
            >
              <option value="">未设置</option>
              {allModels.map(({ provider, id }) => {
                const key = `${provider}/${id}`;
                return <option key={key} value={key}>{key}</option>;
              })}
            </select>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Image className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">首选图像模型</span>
            </div>
            <select
              value={primaryImageModel}
              onChange={(e) => savePrimaryImage(e.target.value)}
              disabled={saving || allModels.length === 0}
              className="ml-3 flex-1 max-w-[65%] px-2 py-1 text-xs font-mono border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 truncate"
            >
              <option value="">未设置</option>
              {allModels.map(({ provider, id }) => {
                const key = `${provider}/${id}`;
                return <option key={key} value={key}>{key}</option>;
              })}
            </select>
          </div>
        </div>

        {/* 模型列表（可折叠） */}
        <div className="mt-3 border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden">
          <div
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 cursor-pointer"
            onClick={() => { setModelListExpanded((v) => !v); setShowAddForm(false); }}
          >
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">模型列表</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">({allModels.length} 个)</span>
            </div>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {modelListExpanded && (
                <button
                  onClick={() => setShowAddForm((v) => !v)}
                  disabled={providerNames.length === 0}
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={providerNames.length === 0 ? '请先添加 Provider' : '添加模型'}
                >
                  <Plus size={13} />
                  添加模型
                </button>
              )}
              {modelListExpanded
                ? <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                : <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              }
            </div>
          </div>

          {modelListExpanded && (
            <div className="p-3 border-t border-gray-200 dark:border-slate-600 space-y-2">
              {/* Add model form */}
              {showAddForm && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={newModelProvider}
                      onChange={(e) => setNewModelProvider(e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 flex-shrink-0"
                    >
                      {providerNames.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
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
                      disabled={!newModelId.trim() || !newModelProvider || saving}
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
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
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

              {/* Model rows */}
              {allModels.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">暂无模型，请先添加 Provider 并配置模型</p>
              ) : (
                <div className="space-y-1">
                  {allModels.map(({ provider, id, name }) => {
                    const modelKey = `${provider}/${id}`;
                    const isTextPrimary = modelKey === primaryTextModel;
                    const isImagePrimary = modelKey === primaryImageModel;
                    return (
                      <div
                        key={modelKey}
                        className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-slate-800/50 rounded text-xs group"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex-shrink-0">
                            {provider}
                          </span>
                          <code className="font-mono text-blue-600 dark:text-blue-400 font-medium truncate">{id}</code>
                          {id.startsWith('hepai/') && (
                            <span
                              title="使用本地模型，您的消息不会发送给外部，保障数据安全。"
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 cursor-default flex-shrink-0"
                            >
                              <Shield className="w-2.5 h-2.5" />本地
                            </span>
                          )}
                          {name && name !== id && (
                            <>
                              <span className="text-gray-300 dark:text-gray-600">·</span>
                              <span className="text-gray-500 dark:text-gray-400 truncate">{name}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isTextPrimary ? (
                            <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded text-[10px] font-medium">
                              文本首选
                            </span>
                          ) : (
                            <button
                              onClick={() => savePrimaryText(modelKey)}
                              disabled={saving}
                              className="text-[10px] px-2 py-0.5 rounded text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                              title="设为首选文本模型"
                            >
                              文本首选
                            </button>
                          )}
                          {isImagePrimary ? (
                            <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded text-[10px] font-medium">
                              图像首选
                            </span>
                          ) : (
                            <button
                              onClick={() => savePrimaryImage(modelKey)}
                              disabled={saving}
                              className="text-[10px] px-2 py-0.5 rounded text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                              title="设为首选图像模型"
                            >
                              图像首选
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteModel(provider, id)}
                            disabled={saving}
                            className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                            title="删除"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Provider Modal */}
      {showProviderModal && (
        <ProviderModal
          providers={providers}
          saving={saving}
          onClose={() => setShowProviderModal(false)}
          onSaveProviders={saveProviders}
        />
      )}
    </>
  );
}
