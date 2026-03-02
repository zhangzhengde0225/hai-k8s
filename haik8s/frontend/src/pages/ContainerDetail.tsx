import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuthStore } from '../auth/AuthContext';
import type { ContainerDetail } from '../types';
import Terminal from '../components/Terminal';
import toast from 'react-hot-toast';
import { Play, Square, Trash2, RefreshCw, Loader2 } from 'lucide-react';

const statusColors: Record<string, string> = {
  running: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  creating: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  stopped: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

// Helper to get display status text
const getStatusDisplay = (dbStatus: string, k8sStatus: string | null) => {
  if (!k8sStatus) {
    return dbStatus;
  }

  // Map K8s status to user-friendly text
  const k8sStatusMap: Record<string, string> = {
    'Pending': 'Starting (pulling image...)',
    'Running': 'Running',
    'Succeeded': 'Completed',
    'Failed': 'Failed',
    'Unknown': 'Unknown',
  };

  const k8sDisplay = k8sStatusMap[k8sStatus] || k8sStatus;

  // If DB and K8s status match, just show once
  if (dbStatus === 'running' && k8sStatus === 'Running') {
    return 'Running';
  }
  if (dbStatus === 'creating' && k8sStatus === 'Pending') {
    return 'Starting (pulling image...)';
  }

  // Otherwise show both
  return `${dbStatus} (${k8sDisplay})`;
};

interface PodEvent {
  type: string;
  reason: string;
  message: string;
  count: number;
  last_timestamp: string | null;
}

export default function ContainerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [container, setContainer] = useState<ContainerDetail | null>(null);
  const [logs, setLogs] = useState('');
  const [events, setEvents] = useState<PodEvent[]>([]);
  const [tab, setTab] = useState<'overview' | 'terminal' | 'logs'>('overview');
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchContainer = () => {
    client
      .get(`/containers/${id}`)
      .then((res) => {
        setContainer(res.data);
        // Auto-fetch events if container is creating or starting
        if (res.data.status === 'creating' || res.data.k8s_status === 'Pending') {
          fetchEvents();
        }
      })
      .catch(() => toast.error('Failed to load container'))
      .finally(() => setLoading(false));
  };

  const fetchEvents = () => {
    setEventsLoading(true);
    client
      .get(`/containers/${id}/events`)
      .then((res) => setEvents(res.data.events || []))
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false));
  };

  const fetchLogs = () => {
    client
      .get(`/containers/${id}/logs`)
      .then((res) => setLogs(res.data.logs || ''))
      .catch(() => setLogs('Failed to fetch logs'));
  };

  useEffect(() => {
    fetchContainer();
  }, [id]);

  useEffect(() => {
    if (tab === 'logs') fetchLogs();
  }, [tab]);

  const handleStop = async () => {
    setStopping(true);
    try {
      await client.post(`/containers/${id}/stop`);
      toast.success('Container stopped');
      fetchContainer();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to stop');
    } finally {
      setStopping(false);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      await client.post(`/containers/${id}/start`);
      toast.success('Container started');
      fetchContainer();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to start');
    } finally {
      setStarting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this container permanently?')) return;
    setDeleting(true);
    try {
      await client.delete(`/containers/${id}`);
      toast.success('Container deleted');
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <p className="text-gray-500 dark:text-slate-400">Loading...</p>;
  if (!container) return <p className="text-red-500 dark:text-red-400">Container not found</p>;

  const isRunning = container.status === 'running';
  const isStopped = container.status === 'stopped' || container.status === 'failed';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{container.name}</h2>
          <span
            className={`inline-block mt-1 text-xs px-2 py-1 rounded-full font-medium ${
              statusColors[container.status] || 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {getStatusDisplay(container.status, container.k8s_status)}
          </span>
        </div>
        <div className="flex gap-2">
          {isStopped && (
            <button
              onClick={handleStart}
              disabled={starting}
              className="inline-flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {starting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Starting...
                </>
              ) : (
                <>
                  <Play size={14} /> Start
                </>
              )}
            </button>
          )}
          {isRunning && (
            <button
              onClick={handleStop}
              disabled={stopping}
              className="inline-flex items-center gap-1 px-3 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {stopping ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Stopping...
                </>
              ) : (
                <>
                  <Square size={14} /> Stop
                </>
              )}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Deleting...
              </>
            ) : (
              <>
                <Trash2 size={14} /> Delete
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-700 mb-4">
        {(['overview', 'terminal', 'logs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 cursor-pointer ${
              tab === t
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Container Info */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow p-6 space-y-3">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Container Info</h3>
            <InfoRow label="Image" value={container.image_name || container.image_registry_url || '-'} />
            <InfoRow label="CPU" value={`${container.cpu_request} cores`} />
            <InfoRow label="Memory" value={`${container.memory_request} GB`} />
            <InfoRow label="GPU" value={String(container.gpu_request)} />
            <InfoRow label="Namespace" value={container.k8s_namespace || '-'} />
            <InfoRow label="Pod" value={container.k8s_pod_name || '-'} />
            {container.ssh_enabled && (
              <>
                <InfoRow label="SSH Port" value={String(container.ssh_node_port || '-')} />
                {container.ssh_command && (
                  <InfoRow label="SSH Command" value={container.ssh_command} />
                )}
              </>
            )}
            <InfoRow label="Created" value={new Date(container.created_at).toLocaleString()} />
          </div>

          {/* Pod Events - Show when starting or if there are events */}
          {((container.status === 'creating' || container.k8s_status === 'Pending') || events.length > 0) && (
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Pod Events {eventsLoading && <span className="text-sm font-normal text-gray-500">(loading...)</span>}
                </h3>
                <button
                  onClick={fetchEvents}
                  className="p-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  title="Refresh events"
                >
                  <RefreshCw size={16} />
                </button>
              </div>

              {events.length === 0 && !eventsLoading ? (
                <p className="text-gray-500 dark:text-slate-400 text-sm">No events yet</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {events.map((event, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-md border ${
                        event.type === 'Warning'
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                          : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                event.type === 'Warning'
                                  ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100'
                                  : 'bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100'
                              }`}
                            >
                              {event.reason}
                            </span>
                            {event.count > 1 && (
                              <span className="text-xs text-gray-500 dark:text-slate-400">
                                (×{event.count})
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 dark:text-slate-300">{event.message}</p>
                        </div>
                        {event.last_timestamp && (
                          <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap ml-4">
                            {new Date(event.last_timestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Helpful hints based on events */}
              {events.some(e => e.reason === 'Pulling') && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    🔄 <strong>Pulling image...</strong> This may take 10-60 seconds depending on image size.
                    Refresh events to see progress.
                  </p>
                </div>
              )}
              {events.some(e => e.reason === 'ErrImagePull' || e.reason === 'ImagePullBackOff') && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    ❌ <strong>Image pull failed!</strong> Please check if the image address is correct and accessible.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'terminal' && (
        <div>
          {isRunning && token ? (
            <Terminal containerId={container.id} token={token} />
          ) : (
            <div className="bg-gray-100 dark:bg-slate-900 rounded-lg p-8 text-center text-gray-500 dark:text-slate-400">
              Container must be running to open a terminal
            </div>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div className="bg-gray-900 text-gray-200 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap overflow-auto max-h-[600px]">
          {logs || 'No logs available'}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="text-sm text-gray-500 dark:text-slate-400 w-32 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white font-mono break-all">{value}</span>
    </div>
  );
}
