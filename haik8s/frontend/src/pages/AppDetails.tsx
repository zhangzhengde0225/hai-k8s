import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Play, Square, Trash2, Copy, Check,
  Loader2, Terminal, FileText, LayoutGrid, ChevronDown, ChevronUp,
  Cpu, MemoryStick, Zap, Wifi, Clock, Server,
} from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../api/client';
import { useAuthStore } from '../auth/AuthContext';
import TtyTerminal from '../components/Terminal';
import type { ContainerDetail } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AppInstance {
  id: number;
  name: string;
  image_name: string | null;
  image_registry_url: string | null;
  status: string;
  k8s_status: string | null;
  cpu_request: number;
  memory_request: number;
  gpu_request: number;
  ssh_enabled: boolean;
  ssh_node_port: number | null;
  ssh_command: string | null;
  created_at: string;
  updated_at: string;
}

interface AppInfo { id: string; name: string; version: string }

interface PodEvent {
  type: string; reason: string; message: string;
  count: number; last_timestamp: string | null;
}

type DetailTab = 'overview' | 'terminal' | 'logs' | 'events';

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; dot: string; badge: string }> = {
  running:  { label: '运行中',  dot: 'bg-green-400 animate-pulse',  badge: 'bg-green-900/30 text-green-300' },
  creating: { label: '启动中',  dot: 'bg-yellow-400 animate-spin',  badge: 'bg-yellow-900/30 text-yellow-300' },
  stopped:  { label: '已停止',  dot: 'bg-slate-500',                badge: 'bg-slate-800 text-slate-300' },
  failed:   { label: '已失败',  dot: 'bg-red-500',                  badge: 'bg-red-900/30 text-red-300' },
};

const getMeta = (s: string) => STATUS_META[s] ?? STATUS_META['stopped'];

function StatusDot({ status }: { status: string }) {
  const { dot } = getMeta(status);
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />;
}

function StatusBadge({ status, k8sStatus }: { status: string; k8sStatus: string | null }) {
  const { label, badge } = getMeta(status);
  const display = (status === 'creating' && k8sStatus === 'Pending') ? '拉取镜像中...' : label;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>{display}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AppDetails() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const token = useAuthStore(s => s.token);

  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [instances, setInstances] = useState<AppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Per-instance action loading flags
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Selected instance + detail state
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [detail, setDetail] = useState<ContainerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [logs, setLogs] = useState('');
  const [events, setEvents] = useState<PodEvent[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);

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

      // 默认展开第一个实例
      if (list.length > 0 && selectedId === null) {
        const first = list[0];
        setSelectedId(first.id);
        setDetailLoading(true);
        client.get(`/containers/${first.id}`)
          .then(r => setDetail(r.data))
          .catch(() => setDetail(null))
          .finally(() => setDetailLoading(false));
      }

      // 如果有选中的实例，同时更新其详细信息
      if (selectedId !== null) {
        const currentInstance = list.find(inst => inst.id === selectedId);
        if (currentInstance) {
          try {
            const detailRes = await client.get(`/containers/${selectedId}`);
            setDetail(detailRes.data);
          } catch {
            // 忽略详情加载失败
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

  useEffect(() => { loadInstances(); }, [appId]);

  // 自动轮询：当有实例处于非运行状态时，每2秒刷新一次
  useEffect(() => {
    const hasNonRunning = instances.some(inst => inst.status !== 'running' && inst.status !== 'stopped' && inst.status !== 'failed');
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
    setDetailTab('overview');
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
    if (detailTab === 'logs') {
      client.get(`/containers/${selectedId}/logs`)
        .then(r => setLogs(r.data.logs || ''))
        .catch(() => setLogs('日志加载失败'));
    } else if (detailTab === 'events') {
      client.get(`/containers/${selectedId}/events`)
        .then(r => setEvents(r.data.events || []))
        .catch(() => setEvents([]));
    }
  }, [detailTab, selectedId]);

  // ── Instance actions ──────────────────────────────────────────────────────

  const setFlag = (key: string, val: boolean) =>
    setActionLoading(prev => ({ ...prev, [key]: val }));

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
    } finally { setFlag(`start-${id}`, false); }
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
    } finally { setFlag(`stop-${id}`, false); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定要删除实例 "${name}"？此操作不可恢复。`)) return;
    setFlag(`delete-${id}`, true);
    try {
      await client.delete(`/containers/${id}`);
      toast.success('实例已删除');
      if (selectedId === id) { setSelectedId(null); setDetail(null); }
      await loadInstances(true);
    } catch (e: any) {
      toast.error(e.response?.data?.detail || '删除失败');
    } finally { setFlag(`delete-${id}`, false); }
  };

  const handleCopySSH = async (instance: AppInstance) => {
    if (!instance.ssh_command) return;
    await navigator.clipboard.writeText(instance.ssh_command);
    setCopiedId(instance.id);
    toast.success('SSH 命令已复制到剪贴板');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Derived values ────────────────────────────────────────────────────────

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
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors flex-shrink-0"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:bg-gradient-to-r dark:from-blue-400 dark:to-cyan-400 dark:bg-clip-text dark:text-transparent truncate">
              {appInfo?.name ?? appId} 实例详情
            </h1>
            {appInfo?.version && (
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded flex-shrink-0">
                {appInfo.version}
              </span>
            )}
          </div>
          <button
            onClick={() => loadInstances(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-300 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>
      </div>

      {/* ── Instance cards ────────────────────────────────────────────────── */}
      {instances.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 rounded-xl border border-gray-200 dark:border-slate-700/50">
          <Server size={40} className="mx-auto text-slate-500 mb-4" />
          <p className="text-gray-500 dark:text-slate-400 mb-4">暂无实例</p>
          <button
            onClick={() => navigate('/apps')}
            className="text-blue-400 hover:text-blue-300 text-sm hover:underline"
          >
            返回应用中心，启动一个实例
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {instances.map(inst => {
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
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {inst.image_name ?? inst.image_registry_url ?? '-'}
                    </p>
                  </div>

                  {/* Resources */}
                  <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400 mr-2">
                    <span className="flex items-center gap-1"><Cpu size={12} /> {inst.cpu_request}</span>
                    <span className="flex items-center gap-1"><MemoryStick size={12} /> {inst.memory_request}G</span>
                    {inst.gpu_request > 0 && (
                      <span className="flex items-center gap-1"><Zap size={12} /> {inst.gpu_request} GPU</span>
                    )}
                    {inst.ssh_node_port && (
                      <span className="flex items-center gap-1"><Wifi size={12} /> :{inst.ssh_node_port}</span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5">
                    {/* Start */}
                    {isStopped && (
                      <button
                        onClick={e => { e.stopPropagation(); handleStart(inst.id); }}
                        disabled={startingFlag}
                        title="启动"
                        className="p-1.5 rounded-md bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors disabled:opacity-50"
                      >
                        {startingFlag ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                      </button>
                    )}
                    {/* Stop */}
                    {(isRunning || isCreating) && (
                      <button
                        onClick={e => { e.stopPropagation(); handleStop(inst.id); }}
                        disabled={stoppingFlag}
                        title="停止"
                        className="p-1.5 rounded-md bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 transition-colors disabled:opacity-50"
                      >
                        {stoppingFlag ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
                      </button>
                    )}
                    {/* Copy SSH */}
                    {inst.ssh_command && (
                      <button
                        onClick={e => { e.stopPropagation(); handleCopySSH(inst); }}
                        title="复制 SSH 命令"
                        className="p-1.5 rounded-md bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors"
                      >
                        {copiedId === inst.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    )}
                    {/* Delete */}
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(inst.id, inst.name); }}
                      disabled={deletingFlag}
                      title="删除"
                      className="p-1.5 rounded-md bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors disabled:opacity-50"
                    >
                      {deletingFlag
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />}
                    </button>
                    {/* Expand toggle */}
                    <button
                      onClick={() => selectInstance(inst)}
                      title={isSelected ? '收起详情' : '查看详情'}
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                    >
                      {isSelected ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isSelected && (
                  <div ref={detailRef} className="border-t border-slate-700/50 px-4 pb-4">
                    {/* Tabs */}
                    <div className="flex gap-1 mt-3 mb-4 border-b border-slate-700/50">
                      {([
                        { key: 'overview',  label: '概览',    icon: <LayoutGrid size={13} /> },
                        { key: 'terminal',  label: '终端',    icon: <Terminal size={13} /> },
                        { key: 'logs',      label: '日志',    icon: <FileText size={13} /> },
                        { key: 'events',    label: '事件',    icon: <Clock size={13} /> },
                      ] as { key: DetailTab; label: string; icon: React.ReactNode }[]).map(tab => (
                        <button
                          key={tab.key}
                          onClick={() => setDetailTab(tab.key)}
                          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                            detailTab === tab.key
                              ? 'border-blue-500 text-blue-400'
                              : 'border-transparent text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {tab.icon}{tab.label}
                        </button>
                      ))}
                    </div>

                    {detailLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 size={24} className="animate-spin text-blue-500" />
                      </div>
                    ) : (
                      <>
                        {/* ── Overview tab ──────────────────────────── */}
                        {detailTab === 'overview' && (
                          <div className="space-y-4">
                            {/* Basic info */}
                            <InfoSection title="基本信息">
                              <InfoRow label="镜像" value={detail?.image_name ?? inst.image_name ?? inst.image_registry_url ?? '-'} />
                              <InfoRow label="CPU" value={`${inst.cpu_request} 核`} />
                              <InfoRow label="内存" value={`${inst.memory_request} GB`} />
                              <InfoRow label="GPU" value={String(inst.gpu_request)} />
                              <InfoRow label="创建时间" value={new Date(inst.created_at).toLocaleString()} />
                              <InfoRow label="更新时间" value={new Date(inst.updated_at).toLocaleString()} />
                            </InfoSection>

                            {/* K8s info */}
                            {detail && (
                              <InfoSection title="集群信息">
                                <InfoRow label="命名空间" value={detail.k8s_namespace ?? '-'} mono />
                                <InfoRow label="Pod 名称" value={detail.k8s_pod_name ?? '-'} mono />
                                <InfoRow label="K8s 状态" value={detail.k8s_status ?? '-'} />
                              </InfoSection>
                            )}

                            {/* SSH connection */}
                            {inst.ssh_enabled && inst.ssh_command && (
                              <InfoSection title="SSH 连接">
                                <InfoRow label="端口" value="22" />
                                <div className="mt-2">
                                  <p className="text-xs text-slate-400 mb-1.5">连接命令</p>
                                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-700/50 rounded-lg px-3 py-2.5">
                                    <code className="flex-1 text-xs font-mono text-cyan-300 break-all">
                                      {inst.ssh_command}
                                    </code>
                                    <button
                                      onClick={() => handleCopySSH(inst)}
                                      className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                                    >
                                      {copiedId === inst.id
                                        ? <Check size={14} className="text-green-400" />
                                        : <Copy size={14} />}
                                    </button>
                                  </div>
                                </div>
                              </InfoSection>
                            )}
                          </div>
                        )}

                        {/* ── Terminal tab ──────────────────────────── */}
                        {detailTab === 'terminal' && (
                          <div>
                            {isRunning && token ? (
                              <TtyTerminal containerId={inst.id} token={token} />
                            ) : (
                              <div className="bg-slate-950 rounded-lg p-8 text-center text-slate-400 text-sm">
                                容器运行中才能打开终端
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Logs tab ─────────────────────────────── */}
                        {detailTab === 'logs' && (
                          <div className="bg-slate-950 text-slate-300 rounded-lg p-4 font-mono text-xs whitespace-pre-wrap overflow-auto max-h-96 border border-slate-700/50">
                            {logs || '暂无日志'}
                          </div>
                        )}

                        {/* ── Events tab ───────────────────────────── */}
                        {detailTab === 'events' && (
                          <EventsPanel
                            containerId={inst.id}
                            events={events}
                            setEvents={setEvents}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-950/60 border border-slate-700/40 rounded-lg p-4">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-slate-500 w-24 flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-xs text-slate-200 break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function EventsPanel({
  containerId,
  events,
  setEvents,
}: {
  containerId: number;
  events: PodEvent[];
  setEvents: (e: PodEvent[]) => void;
}) {
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await client.get(`/containers/${containerId}/events`);
      setEvents(r.data.events ?? []);
    } finally { setLoading(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400">Pod 事件</span>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 刷新
        </button>
      </div>
      {events.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center">暂无事件</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {events.map((ev, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg border text-xs ${
                ev.type === 'Warning'
                  ? 'bg-yellow-900/20 border-yellow-800/50'
                  : 'bg-slate-900/60 border-slate-700/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded font-semibold ${
                      ev.type === 'Warning'
                        ? 'bg-yellow-800/60 text-yellow-200'
                        : 'bg-blue-800/60 text-blue-200'
                    }`}>
                      {ev.reason}
                    </span>
                    {ev.count > 1 && (
                      <span className="text-slate-500">×{ev.count}</span>
                    )}
                  </div>
                  <p className="text-slate-300 break-words">{ev.message}</p>
                </div>
                {ev.last_timestamp && (
                  <span className="text-slate-500 whitespace-nowrap flex-shrink-0">
                    {new Date(ev.last_timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
