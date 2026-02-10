import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuthStore } from '../auth/AuthContext';
import type { ContainerDetail } from '../types';
import Terminal from '../components/Terminal';
import toast from 'react-hot-toast';
import { Play, Square, Trash2 } from 'lucide-react';

const statusColors: Record<string, string> = {
  running: 'bg-green-100 text-green-800',
  creating: 'bg-yellow-100 text-yellow-800',
  stopped: 'bg-gray-100 text-gray-800',
  failed: 'bg-red-100 text-red-800',
};

export default function ContainerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [container, setContainer] = useState<ContainerDetail | null>(null);
  const [logs, setLogs] = useState('');
  const [tab, setTab] = useState<'overview' | 'terminal' | 'logs'>('overview');
  const [loading, setLoading] = useState(true);

  const fetchContainer = () => {
    client
      .get(`/containers/${id}`)
      .then((res) => setContainer(res.data))
      .catch(() => toast.error('Failed to load container'))
      .finally(() => setLoading(false));
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
    try {
      await client.post(`/containers/${id}/stop`);
      toast.success('Container stopped');
      fetchContainer();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to stop');
    }
  };

  const handleStart = async () => {
    try {
      await client.post(`/containers/${id}/start`);
      toast.success('Container started');
      fetchContainer();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to start');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this container permanently?')) return;
    try {
      await client.delete(`/containers/${id}`);
      toast.success('Container deleted');
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!container) return <p className="text-red-500">Container not found</p>;

  const isRunning = container.status === 'running';
  const isStopped = container.status === 'stopped' || container.status === 'failed';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{container.name}</h2>
          <span
            className={`inline-block mt-1 text-xs px-2 py-1 rounded-full font-medium ${
              statusColors[container.status] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {container.status}
            {container.k8s_status && container.k8s_status !== container.status
              ? ` (K8s: ${container.k8s_status})`
              : ''}
          </span>
        </div>
        <div className="flex gap-2">
          {isStopped && (
            <button
              onClick={handleStart}
              className="inline-flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm cursor-pointer"
            >
              <Play size={14} /> Start
            </button>
          )}
          {isRunning && (
            <button
              onClick={handleStop}
              className="inline-flex items-center gap-1 px-3 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm cursor-pointer"
            >
              <Square size={14} /> Stop
            </button>
          )}
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm cursor-pointer"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {(['overview', 'terminal', 'logs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 cursor-pointer ${
              tab === t
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-3">
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
      )}

      {tab === 'terminal' && (
        <div>
          {isRunning && token ? (
            <Terminal containerId={container.id} token={token} />
          ) : (
            <div className="bg-gray-100 rounded-lg p-8 text-center text-gray-500">
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
      <span className="text-sm text-gray-500 w-32 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 font-mono break-all">{value}</span>
    </div>
  );
}
