// 管理员-用户详情弹窗：展示 User 表所有字段（含 SSO ID、API Key 脱敏）
// Author: Zhengde Zhang (zhangzhengde0225@gmail.com)

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import client from '../../../api/client';
import toast from 'react-hot-toast';

interface UserDetail {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: string;
  auth_provider: string | null;
  is_active: boolean;
  sso_id: string | null;
  has_password: boolean;
  cluster_username: string | null;
  cluster_uid: number | null;
  cluster_gid: number | null;
  cluster_home_dir: string | null;
  api_key_masked: string | null;
  cpu_quota: number;
  memory_quota: number;
  gpu_quota: number;
  cpu_used: number;
  memory_used: number;
  gpu_used: number;
  created_at: string;
  last_login_at: string | null;
}

interface Props {
  userId: number;
  onClose: () => void;
}

export default function UserDetails({ userId, onClose }: Props) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get<UserDetail>(`/admin/users/${userId}`)
      .then((res) => setUser(res.data))
      .catch(() => toast.error('Failed to load user details'))
      .finally(() => setLoading(false));
  }, [userId]);

  const fmt = (v: string | null | undefined) =>
    v ? new Date(v).toLocaleString() : '—';

  const val = (v: string | number | boolean | null | undefined, mono = false) => {
    if (v === null || v === undefined) return <span className="text-gray-400 dark:text-slate-500 italic text-xs">未设置</span>;
    if (typeof v === 'boolean') return <span className={v ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{v ? 'Yes' : 'No'}</span>;
    return <span className={mono ? 'font-mono' : ''}>{String(v)}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            User Details {user ? `— ${user.username}` : ''}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-5">
          {loading && (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          )}

          {!loading && user && (
            <>
              <Section title="基本信息">
                <Row label="ID" value={val(user.id)} />
                <Row label="Username" value={val(user.username)} />
                <Row label="Email" value={val(user.email)} />
                <Row label="Full Name" value={val(user.full_name)} />
              </Section>

              <Section title="账号信息">
                <Row label="Role" value={
                  <span className={`text-xs px-2 py-0.5 rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' : 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300'}`}>
                    {user.role}
                  </span>
                } />
                <Row label="Auth Provider" value={val(user.auth_provider)} />
                <Row label="Active" value={val(user.is_active)} />
                <Row label="SSO ID" value={val(user.sso_id, true)} />
                <Row label="Local Password" value={val(user.has_password)} />
                <Row label="Created At" value={fmt(user.created_at)} />
                <Row label="Last Login" value={fmt(user.last_login_at)} />
              </Section>

              <Section title="集群信息">
                <Row label="Cluster Account" value={val(user.cluster_username)} />
                <Row label="UID" value={val(user.cluster_uid)} />
                <Row label="GID" value={val(user.cluster_gid)} />
                <Row label="Home Dir" value={val(user.cluster_home_dir, true)} />
              </Section>

              <Section title="资源配额 & 使用">
                <Row label="CPU" value={<QuotaBar used={user.cpu_used} quota={user.cpu_quota} unit="cores" color="bg-blue-500" />} />
                <Row label="Memory" value={<QuotaBar used={parseFloat((user.memory_used / 1024).toFixed(1))} quota={parseFloat((user.memory_quota / 1024).toFixed(1))} unit="GB" color="bg-purple-500" />} />
                <Row label="GPU" value={<QuotaBar used={user.gpu_used} quota={user.gpu_quota} unit="" color="bg-green-500" />} />
              </Section>

              <Section title="HepAI">
                <Row label="API Key" value={val(user.api_key_masked, true)} />
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-slate-400 tracking-wider mb-2">{title}</h3>
      <dl className="bg-gray-50 dark:bg-slate-800/50 rounded-lg divide-y divide-gray-100 dark:divide-slate-700/50 px-4">
        {children}
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <dt className="w-36 flex-shrink-0 text-xs text-gray-500 dark:text-slate-400">{label}</dt>
      <dd className="flex-1 text-sm text-gray-900 dark:text-white font-medium">{value}</dd>
    </div>
  );
}

function QuotaBar({ used, quota, unit, color }: { used: number; quota: number; unit: string; color: string }) {
  const pct = quota > 0 ? Math.min((used / quota) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 bg-gray-200 dark:bg-slate-700 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
        {used} / {quota}{unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}
