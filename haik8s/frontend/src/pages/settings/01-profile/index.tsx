// 个人配置页面：显示用户基本信息、账号信息、集群信息及资源配额
// Author: Zhengde Zhang (zhangzhengde0225@gmail.com)

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../auth/AuthContext';
import client from '../../../api/client';
import type { User, IPAllocation } from '../../../types';

export default function Profile() {
  const { t } = useTranslation();
  const { user: storeUser } = useAuthStore();
  const [user, setUser] = useState<User | null>(storeUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [ipAllocation, setIpAllocation] = useState<IPAllocation | null>(null);
  const [ipLoading, setIpLoading] = useState(false);
  const [syncClusterLoading, setSyncClusterLoading] = useState(false);
  const [hepaiApiKey, setHepaiApiKey] = useState<string | null>(null);
  const [hepaiKeyLoading, setHepaiKeyLoading] = useState(false);

  const fetchUser = async () => {
    setLoading(true);
    setError(false);
    try {
      const [userRes, ipRes, keyRes] = await Promise.allSettled([
        client.get<User>('/users/me'),
        client.get<IPAllocation>('/ip-allocations/my-ip'),
        client.get<{ masked_key: string | null }>('/users/key'),
      ]);
      if (userRes.status === 'fulfilled') setUser(userRes.value.data);
      else setError(true);
      if (ipRes.status === 'fulfilled') setIpAllocation(ipRes.value.data);
      if (keyRes.status === 'fulfilled') setHepaiApiKey(keyRes.value.data.masked_key);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const handleAllocateIp = async () => {
    setIpLoading(true);
    try {
      const res = await client.post('/ip-allocations/allocate');
      setIpAllocation({ has_ip: true, ip_address: res.data.ip_address, allocated_at: res.data.allocated_at });
      toast.success(t('ipAllocated'));
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t('ipAllocationFailed'));
    } finally {
      setIpLoading(false);
    }
  };

  const handleReleaseIp = async () => {
    setIpLoading(true);
    try {
      await client.delete('/ip-allocations/release');
      setIpAllocation({ has_ip: false, ip_address: null, allocated_at: null });
      toast.success(t('ipReleased'));
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t('ipReleaseFailed'));
    } finally {
      setIpLoading(false);
    }
  };

  const handleSyncClusterInfo = async () => {
    setSyncClusterLoading(true);
    try {
      const res = await client.post<User>('/users/me/sync-cluster-info');
      setUser(res.data);
      toast.success(t('syncClusterInfoSuccess'));
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t('syncClusterInfoFailed'));
    } finally {
      setSyncClusterLoading(false);
    }
  };

  const handleSyncHepaiKey = async () => {
    setHepaiKeyLoading(true);
    try {
      const res = await client.post<{ masked_key: string | null }>('/users/me/sync-hepai-key');
      setHepaiApiKey(res.data.masked_key);
      toast.success(t('hepaiKeySyncSuccess') || 'API Key synced');
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t('hepaiKeySyncFailed') || 'Sync failed');
    } finally {
      setHepaiKeyLoading(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return t('neverLoggedIn');
    return new Date(dateStr).toLocaleString();
  };

  const roleLabel = (role: string) =>
    role === 'admin' ? t('roleAdmin') : t('roleUser');

  const authProviderLabel = (provider: string | null) => {
    if (!provider) return '—';
    if (provider === 'ihep_sso') return t('authProviderSSO');
    if (provider === 'local') return t('authProviderLocal');
    return provider;
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 md:mb-6 flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
          {t('personalSettings')}
        </h1>
        <button
          onClick={fetchUser}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {t('refresh')}
        </button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-500 dark:text-red-400">{t('loadFailed')}</p>
      )}

      <div className="space-y-4 md:space-y-6">

        {/* 基本信息 */}
        <Card title={t('basicInfo')}>
          <Row label={t('userId')} value={String(user.id)} />
          <Row label={t('username')} value={user.username} />
          <Row label={t('fullName')} value={user.full_name || '—'} />
          <Row label="Email" value={user.email} />
          <Row
            label={t('hepaiApiKey')}
            value={
              <span className="flex items-center gap-3">
                <span className={hepaiApiKey ? 'font-mono' : ''}>
                  {hepaiApiKey || t('hepaiApiKeyNotSet')}
                </span>
                <button
                  onClick={handleSyncHepaiKey}
                  disabled={hepaiKeyLoading}
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={12} className={hepaiKeyLoading ? 'animate-spin' : ''} />
                  {hepaiKeyLoading ? t('syncing') : t('sync')}
                </button>
              </span>
            }
          />
        </Card>

        {/* 账号信息 */}
        <Card title={t('accountInfo')}>
          <Row label={t('role')} value={roleLabel(user.role)} />
          <Row label={t('authProvider')} value={authProviderLabel(user.auth_provider)} />
          <Row
            label={t('accountStatus')}
            value={
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  user.is_active
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                    : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                }`}
              >
                {user.is_active ? t('active') : t('inactive')}
              </span>
            }
          />
          <Row label={t('createdAt')} value={formatDate(user.created_at)} />
          <Row
            label={t('lastLoginAt')}
            value={user.last_login_at ? formatDate(user.last_login_at) : t('neverLoggedIn')}
          />
        </Card>

        {/* 集群信息 */}
        <Card
          title={t('clusterInfo')}
          action={
            <button
              onClick={handleSyncClusterInfo}
              disabled={syncClusterLoading}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={syncClusterLoading ? 'animate-spin' : ''} />
              {syncClusterLoading ? t('syncingClusterInfo') : t('syncClusterInfo')}
            </button>
          }
        >
          <Row label={t('clusterUsername')} value={user.cluster_username || <NotSet />} />
          <Row label={t('clusterUid')} value={user.cluster_uid != null ? String(user.cluster_uid) : <NotSet />} />
          <Row label={t('clusterGid')} value={user.cluster_gid != null ? String(user.cluster_gid) : <NotSet />} />
          <Row label={t('clusterHomeDir')} value={user.cluster_home_dir || <NotSet />} mono />
          <Row
            label={t('allocatedIp')}
            value={
              ipAllocation?.has_ip && ipAllocation.ip_address ? (
                <span className="flex items-center gap-3">
                  <span className="font-mono">{ipAllocation.ip_address}</span>
                  <button
                    onClick={handleReleaseIp}
                    disabled={ipLoading}
                    className="text-xs px-2 py-0.5 rounded border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                  >
                    {ipLoading ? t('releasing') : t('releaseIp')}
                  </button>
                </span>
              ) : (
                <button
                  onClick={handleAllocateIp}
                  disabled={ipLoading}
                  className="text-xs px-2 py-0.5 rounded border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50"
                >
                  {ipLoading ? t('allocating') : t('allocateIp')}
                </button>
              )
            }
          />
        </Card>

        {/* 资源配额与使用 */}
        <Card title={`${t('resourceQuota')} & ${t('resourceUsage')}`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <ResourceBar
              label={t('cpu')}
              unit={t('cores')}
              used={user.cpu_used}
              quota={user.cpu_quota}
              color="bg-blue-500"
            />
            <ResourceBar
              label={t('memory')}
              unit="GB"
              used={parseFloat((user.memory_used / 1024).toFixed(1))}
              quota={parseFloat((user.memory_quota / 1024).toFixed(1))}
              color="bg-purple-500"
            />
            <ResourceBar
              label={t('gpu')}
              unit=""
              used={user.gpu_used}
              quota={user.gpu_quota}
              color="bg-green-500"
            />
          </div>
        </Card>

      </div>
    </div>
  );
}

/* ---- sub-components ---- */

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
        {action}
      </div>
      <dl className="divide-y divide-gray-100 dark:divide-slate-700">{children}</dl>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start py-2.5 gap-4">
      <dt className="w-36 flex-shrink-0 text-xs text-gray-500 dark:text-slate-400 pt-0.5">{label}</dt>
      <dd className={`flex-1 text-sm text-gray-900 dark:text-white ${mono ? 'font-mono' : 'font-medium'}`}>
        {value}
      </dd>
    </div>
  );
}

function NotSet() {
  const { t } = useTranslation();
  return <span className="text-gray-400 dark:text-slate-500 text-xs italic">{t('notSet')}</span>;
}

function ResourceBar({
  label,
  unit,
  used,
  quota,
  color,
}: {
  label: string;
  unit: string;
  used: number;
  quota: number;
  color: string;
}) {
  const pct = quota > 0 ? Math.min((used / quota) * 100, 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs font-medium text-gray-700 dark:text-slate-300">{label}</span>
        <span className="text-xs text-gray-500 dark:text-slate-400">
          {used} / {quota}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
