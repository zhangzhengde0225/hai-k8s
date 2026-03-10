import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Play,
  Square,
  Trash2,
  Copy,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  Cpu,
  MemoryStick,
  Zap,
  Wifi,
  Server,
  Terminal,
} from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { useAuthStore } from '../../auth/AuthContext';
import type { ContainerDetail } from '../../types';
import type { AppInstance, AppInfo, PodEvent, AppDetailTab } from './types';
import { TAB_CONFIGS } from './constants';
import { StatusDot } from './components/StatusDot';
import { StatusBadge } from './components/StatusBadge';
import { ServerOverview } from './components/ServerOverview';
import { WebTerminal } from './components/WebTerminal';
import { ContainerLogs } from './components/ContainerLogs';
import { ContainerEvents } from './components/ContainerEvents';
import { CommandExecutor } from './components/CommandExecutor';
import { getAppDetailsComponent } from './app-specific';

export default function AppDetails() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);

  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [instances, setInstances] = useState<AppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Per-instance action loading flags
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Selected instance + detail state
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<AppDetailTab>('server-overview');
  const [detail, setDetail] = useState<ContainerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [logs, setLogs] = useState('');
  const [events, setEvents] = useState<PodEvent[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Command executor state
  const [showCommandExecutor, setShowCommandExecutor] = useState(false);
  const [executorContainerId, setExecutorContainerId] = useState<number | null>(null);
  const [executorContainerName, setExecutorContainerName] = useState<string>('');

  const detailRef = useRef<HTMLDivElement>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadInstances = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await client.get(`/applications/${appId}/instances`);
      setAppInfo(res.data.application);
      const list: AppInstance[] = res.data.instances;
      setInstances(list);

      // Auto-expand first instance
      if (list.length > 0 && selectedId === null) {
        const first = list[0];
        setSelectedId(first.id);
        setDetailLoading(true);
        client
          .get(`/containers/${first.id}`)
          .then((r) => setDetail(r.data))
          .catch(() => setDetail(null))
          .finally(() => setDetailLoading(false));
      }

      // Update detail for currently selected instance
      if (selectedId !== null) {
        const currentInstance = list.find((inst) => inst.id === selectedId);
        if (currentInstance) {
          try {
            const detailRes = await client.get(`/containers/${selectedId}`);
            setDetail(detailRes.data);
          } catch {
            // Ignore detail loading failure
          }
        }
      }
    } catch {
      toast.error('加载实例列表失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInstances();
  }, [appId]);

  // Auto-refresh when there are non-running instances
  useEffect(() => {
    const hasNonRunning = instances.some(
      (inst) => inst.status !== 'running' && inst.status !== 'stopped' && inst.status !== 'failed'
    );
    if (!hasNonRunning) return;

    const timer = setInterval(() => {
      loadInstances(true);
    }, 2000);

    return () => clearInterval(timer);
  }, [instances, appId]);

  // Load container detail when selecting an instance
  const selectInstance = async (instance: AppInstance) => {
    if (selectedId === instance.id) {
      setSelectedId(null);
      return;
    }
    setSelectedId(instance.id);
    setActiveTab('server-overview');
    setLogs('');
    setEvents([]);
    setDetailLoading(true);
    try {
      const res = await client.get(`/containers/${instance.id}`);
      setDetail(res.data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
    // Scroll to detail panel
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  // Load logs / events lazily on tab switch
  useEffect(() => {
    if (!selectedId) return;
    if (activeTab === 'container-logs') {
      client
        .get(`/containers/${selectedId}/logs`)
        .then((r) => setLogs(r.data.logs || ''))
        .catch(() => setLogs('日志加载失败'));
    } else if (activeTab === 'container-events') {
      client
        .get(`/containers/${selectedId}/events`)
        .then((r) => setEvents(r.data.events || []))
        .catch(() => setEvents([]));
    }
  }, [activeTab, selectedId]);

  // ── Instance actions ──────────────────────────────────────────────────────

  const setFlag = (key: string, val: boolean) => setActionLoading((prev) => ({ ...prev, [key]: val }));

  const handleStart = async (id: number) => {
    setFlag(`start-${id}`, true);
    try {
      await client.post(`/containers/${id}/start`);
      toast.success('实例已启动');
      await loadInstances(true);
      if (selectedId === id) {
        const r = await client.get(`/containers/${id}`);
        setDetail(r.data);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.detail || '启动失败');
    } finally {
      setFlag(`start-${id}`, false);
    }
  };

  const handleStop = async (id: number) => {
    setFlag(`stop-${id}`, true);
    try {
      await client.post(`/containers/${id}/stop`);
      toast.success('实例已停止');
      await loadInstances(true);
      if (selectedId === id) {
        const r = await client.get(`/containers/${id}`);
        setDetail(r.data);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.detail || '停止失败');
    } finally {
      setFlag(`stop-${id}`, false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定要删除实例 "${name}"？此操作不可恢复。`)) return;
    setFlag(`delete-${id}`, true);
    try {
      await client.delete(`/containers/${id}`);
      toast.success('实例已删除');
      if (selectedId === id) {
        setSelectedId(null);
        setDetail(null);
      }
      await loadInstances(true);
    } catch (e: any) {
      toast.error(e.response?.data?.detail || '删除失败');
    } finally {
      setFlag(`delete-${id}`, false);
    }
  };

  const handleCopySSH = async (instance: AppInstance) => {
    if (!instance.ssh_command) return;
    await navigator.clipboard.writeText(instance.ssh_command);
    setCopiedId(instance.id);
    toast.success('SSH 命令已复制到剪贴板');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenCommandExecutor = (instance: AppInstance) => {
    setExecutorContainerId(instance.id);
    setExecutorContainerName(instance.name);
    setShowCommandExecutor(true);
  };

  // ── Tab content rendering ─────────────────────────────────────────────────

  const renderTabContent = () => {
    const instance = instances.find((inst) => inst.id === selectedId);
    if (!instance) return null;

    switch (activeTab) {
      case 'server-overview':
        return <ServerOverview instance={instance} detail={detail} />;

      case 'app-details':
        const AppDetailsComponent = getAppDetailsComponent(appId!);
        return AppDetailsComponent && appInfo ? (
          <AppDetailsComponent appId={appId!} appInfo={appInfo} instance={instance} />
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">该应用暂无详情配置</div>
        );

      case 'web-terminal':
        return <WebTerminal containerId={instance.id} token={token || ''} status={instance.status} />;

      case 'container-logs':
        return <ContainerLogs logs={logs} />;

      case 'container-events':
        return <ContainerEvents containerId={selectedId!} initialEvents={events} />;

      default:
        return null;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/apps')}
              className="p-1.5 rounded-lg text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:bg-gradient-to-r dark:from-blue-400 dark:to-cyan-400 dark:bg-clip-text dark:text-transparent truncate">
              {appInfo?.name ?? appId} 实例详情
            </h1>
            {appInfo?.version && (
              <span className="text-xs text-gray-700 dark:text-slate-500 bg-gray-200 dark:bg-slate-800 px-2 py-0.5 rounded flex-shrink-0">
                {appInfo.version}
              </span>
            )}
          </div>
          <button
            onClick={() => loadInstances(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-slate-300 bg-gray-200 dark:bg-slate-800 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>
      </div>

      {/* ── Instance cards ────────────────────────────────────────────────── */}
      {instances.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 rounded-xl border border-gray-200 dark:border-slate-700/50">
          <Server size={40} className="mx-auto text-gray-400 dark:text-slate-500 mb-4" />
          <p className="text-gray-500 dark:text-slate-400 mb-4">暂无实例</p>
          <button
            onClick={() => navigate('/apps')}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm hover:underline"
          >
            返回应用中心，启动一个实例
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {instances.map((inst) => {
            const isSelected = selectedId === inst.id;
            const isRunning = inst.status === 'running';
            const isStopped = inst.status === 'stopped' || inst.status === 'failed';
            const isCreating = inst.status === 'creating';
            const startingFlag = actionLoading[`start-${inst.id}`];
            const stoppingFlag = actionLoading[`stop-${inst.id}`];
            const deletingFlag = actionLoading[`delete-${inst.id}`];

            return (
              <div
                key={inst.id}
                className={`rounded-xl border transition-all ${
                  isSelected
                    ? 'border-blue-500/60 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 shadow-lg shadow-blue-500/10'
                    : 'border-gray-200 dark:border-slate-700/50 bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 hover:border-blue-400/40'
                }`}
              >
                {/* Card header row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <StatusDot status={inst.status} />

                  {/* Name + status */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                        {inst.name}
                      </span>
                      <StatusBadge status={inst.status} k8sStatus={inst.k8s_status} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5 truncate">
                      {inst.image_name ?? inst.image_registry_url ?? '-'}
                    </p>
                  </div>

                  {/* Resources */}
                  <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400 mr-2">
                    <span className="flex items-center gap-1">
                      <Cpu size={12} /> {inst.cpu_request}
                    </span>
                    <span className="flex items-center gap-1">
                      <MemoryStick size={12} /> {inst.memory_request}G
                    </span>
                    {inst.gpu_request > 0 && (
                      <span className="flex items-center gap-1">
                        <Zap size={12} /> {inst.gpu_request} GPU
                      </span>
                    )}
                    {inst.ssh_node_port && (
                      <span className="flex items-center gap-1">
                        <Wifi size={12} /> :{inst.ssh_node_port}
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5">
                    {/* Start */}
                    {isStopped && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStart(inst.id);
                        }}
                        disabled={startingFlag}
                        title="启动"
                        className="p-1.5 rounded-md bg-green-100 dark:bg-green-600/20 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-600/30 transition-colors disabled:opacity-50"
                      >
                        {startingFlag ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                      </button>
                    )}
                    {/* Stop */}
                    {(isRunning || isCreating) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStop(inst.id);
                        }}
                        disabled={stoppingFlag}
                        title="停止"
                        className="p-1.5 rounded-md bg-yellow-100 dark:bg-yellow-600/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-600/30 transition-colors disabled:opacity-50"
                      >
                        {stoppingFlag ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
                      </button>
                    )}
                    {/* Copy SSH */}
                    {inst.ssh_command && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopySSH(inst);
                        }}
                        title="复制 SSH 命令"
                        className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-600/30 transition-colors"
                      >
                        {copiedId === inst.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    )}
                    {/* Execute Command */}
                    {isRunning && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCommandExecutor(inst);
                        }}
                        title="执行命令"
                        className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-600/20 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-600/30 transition-colors"
                      >
                        <Terminal size={14} />
                      </button>
                    )}
                    {/* Delete */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(inst.id, inst.name);
                      }}
                      disabled={deletingFlag}
                      title="删除"
                      className="p-1.5 rounded-md bg-red-100 dark:bg-red-600/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-600/30 transition-colors disabled:opacity-50"
                    >
                      {deletingFlag ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                    {/* Expand toggle */}
                    <button
                      onClick={() => selectInstance(inst)}
                      title={isSelected ? '收起详情' : '查看详情'}
                      className="p-1.5 rounded-md text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      {isSelected ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isSelected && (
                  <div ref={detailRef} className="border-t border-gray-200 dark:border-slate-700/50 px-4 pb-4">
                    {/* Tabs */}
                    <div className="flex gap-1 mt-3 mb-4 border-b border-gray-200 dark:border-slate-700/50 overflow-x-auto">
                      {TAB_CONFIGS.map((tab) => {
                        const isEnabled = tab.enabled(appId || '', inst.status);
                        const isActive = activeTab === tab.key;

                        return (
                          <button
                            key={tab.key}
                            onClick={() => isEnabled && setActiveTab(tab.key)}
                            disabled={!isEnabled}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                              isActive
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : isEnabled
                                ? 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                                : 'border-transparent text-gray-400 dark:text-slate-600 cursor-not-allowed'
                            }`}
                          >
                            {tab.icon}
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    {detailLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 size={24} className="animate-spin text-blue-500" />
                      </div>
                    ) : (
                      <div>{renderTabContent()}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Command Executor Modal */}
      {showCommandExecutor && executorContainerId !== null && (
        <CommandExecutor
          containerId={executorContainerId}
          containerName={executorContainerName}
          onClose={() => setShowCommandExecutor(false)}
        />
      )}
    </div>
  );
}
