// 管理员-用户统计面板：展示用户总数、角色分布、激活状态、认证方式及资源配额汇总。
// Author: Zhengde Zhang (zhangzhengde0225@gmail.com)
import type { User } from '../../../types';

interface Props {
  users: User[];
  onClose: () => void;
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
      <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function UserStats({ users, onClose }: Props) {
  const total = users.length;
  const active = users.filter((u) => u.is_active).length;
  const admins = users.filter((u) => u.role === 'admin').length;
  const localUsers = users.filter((u) => u.auth_provider === 'local').length;
  const ssoUsers = total - localUsers;

  const totalCpuQuota = users.reduce((s, u) => s + (u.cpu_quota ?? 0), 0);
  const totalCpuUsed = users.reduce((s, u) => s + (u.cpu_used ?? 0), 0);
  const totalMemQuota = users.reduce((s, u) => s + (u.memory_quota ?? 0), 0);
  const totalMemUsed = users.reduce((s, u) => s + (u.memory_used ?? 0), 0);
  const totalGpuQuota = users.reduce((s, u) => s + (u.gpu_quota ?? 0), 0);
  const totalGpuUsed = users.reduce((s, u) => s + (u.gpu_used ?? 0), 0);

  const recentUsers = [...users]
    .filter((u) => u.last_login_at)
    .sort((a, b) => new Date(b.last_login_at!).getTime() - new Date(a.last_login_at!).getTime())
    .slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">用户统计</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-xl leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Overview */}
          <div>
            <p className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3">概览</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="总用户" value={total} />
              <StatCard label="已激活" value={active} sub={`未激活 ${total - active}`} />
              <StatCard label="管理员" value={admins} sub={`普通用户 ${total - admins}`} />
              <StatCard label="本地账户" value={localUsers} sub={`SSO ${ssoUsers}`} />
            </div>
          </div>

          {/* Resource quotas */}
          <div>
            <p className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3">资源配额汇总</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard
                label="CPU (核)"
                value={`${totalCpuUsed} / ${totalCpuQuota}`}
                sub={`使用率 ${totalCpuQuota ? ((totalCpuUsed / totalCpuQuota) * 100).toFixed(1) : 0}%`}
              />
              <StatCard
                label="内存 (GB)"
                value={`${totalMemUsed} / ${totalMemQuota}`}
                sub={`使用率 ${totalMemQuota ? ((totalMemUsed / totalMemQuota) * 100).toFixed(1) : 0}%`}
              />
              <StatCard
                label="GPU (卡)"
                value={`${totalGpuUsed} / ${totalGpuQuota}`}
                sub={`使用率 ${totalGpuQuota ? ((totalGpuUsed / totalGpuQuota) * 100).toFixed(1) : 0}%`}
              />
            </div>
          </div>

          {/* Recent logins */}
          {recentUsers.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3">最近登录</p>
              <div className="divide-y divide-gray-100 dark:divide-slate-700 rounded-lg border border-gray-100 dark:border-slate-700 overflow-hidden">
                {recentUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium dark:text-white">{u.username}</span>
                      {u.role === 'admin' && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">admin</span>
                      )}
                    </div>
                    <span className="text-gray-400 dark:text-slate-500 text-xs">
                      {new Date(u.last_login_at!).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
