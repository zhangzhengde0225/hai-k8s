// 管理员-用户管理页面：查看所有用户列表，支持编辑用户角色、CPU/内存/GPU配额及激活状态。
import { useEffect, useState } from 'react';
import client from '../../../api/client';
import type { User } from '../../../types';
import toast from 'react-hot-toast';

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});

  const fetchUsers = () => {
    client
      .get('/admin/users')
      .then((res) => setUsers(res.data))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const startEdit = (user: User) => {
    setEditing(user.id);
    setEditData({
      role: user.role,
      cpu_quota: user.cpu_quota,
      memory_quota: user.memory_quota,
      gpu_quota: user.gpu_quota,
      is_active: user.is_active,
    });
  };

  const saveEdit = async (userId: number) => {
    try {
      await client.patch(`/admin/users/${userId}`, editData);
      toast.success('User updated');
      setEditing(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update');
    }
  };

  if (loading) return <p className="text-gray-500 dark:text-slate-400">Loading...</p>;

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-4 md:mb-6">Users</h2>
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-950 text-left text-gray-500 dark:text-slate-400 uppercase text-xs">
                <th className="px-3 md:px-4 py-3 whitespace-nowrap">Username</th>
                <th className="px-3 md:px-4 py-3 whitespace-nowrap">Email</th>
                <th className="px-3 md:px-4 py-3 whitespace-nowrap">Role</th>
                <th className="px-3 md:px-4 py-3 whitespace-nowrap">Active</th>
                <th className="px-3 md:px-4 py-3 whitespace-nowrap">CPU Quota</th>
                <th className="px-3 md:px-4 py-3 whitespace-nowrap">Mem Quota</th>
                <th className="px-3 md:px-4 py-3 whitespace-nowrap">GPU Quota</th>
                <th className="px-3 md:px-4 py-3 whitespace-nowrap">Usage (C/M/G)</th>
                <th className="px-3 md:px-4 py-3 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium dark:text-white">{u.username}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{u.email}</td>
                <td className="px-4 py-3">
                  {editing === u.id ? (
                    <select
                      value={editData.role}
                      onChange={(e) =>
                        setEditData({ ...editData, role: e.target.value })
                      }
                      className="border dark:border-slate-700 rounded px-1 py-0.5 text-xs dark:bg-slate-950 dark:text-white"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  ) : (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        u.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {u.role}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editing === u.id ? (
                    <input
                      type="checkbox"
                      checked={editData.is_active}
                      onChange={(e) =>
                        setEditData({ ...editData, is_active: e.target.checked })
                      }
                    />
                  ) : u.is_active ? (
                    <span className="text-green-600 dark:text-green-400">Yes</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">No</span>
                  )}
                </td>
                <td className="px-4 py-3 dark:text-white">
                  {editing === u.id ? (
                    <input
                      type="number"
                      value={editData.cpu_quota}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          cpu_quota: Number(e.target.value),
                        })
                      }
                      className="border dark:border-slate-700 rounded w-16 px-1 py-0.5 text-xs dark:bg-slate-950 dark:text-white"
                    />
                  ) : (
                    u.cpu_quota
                  )}
                </td>
                <td className="px-4 py-3 dark:text-white">
                  {editing === u.id ? (
                    <input
                      type="number"
                      value={editData.memory_quota}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          memory_quota: Number(e.target.value),
                        })
                      }
                      className="border dark:border-slate-700 rounded w-16 px-1 py-0.5 text-xs dark:bg-slate-950 dark:text-white"
                    />
                  ) : (
                    u.memory_quota
                  )}
                </td>
                <td className="px-4 py-3 dark:text-white">
                  {editing === u.id ? (
                    <input
                      type="number"
                      value={editData.gpu_quota}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          gpu_quota: Number(e.target.value),
                        })
                      }
                      className="border dark:border-slate-700 rounded w-16 px-1 py-0.5 text-xs dark:bg-slate-950 dark:text-white"
                    />
                  ) : (
                    u.gpu_quota
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">
                  {u.cpu_used}/{u.memory_used}/{u.gpu_used}
                </td>
                <td className="px-4 py-3">
                  {editing === u.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => saveEdit(u.id)}
                        className="text-xs px-2 py-1 bg-blue-600 text-white rounded cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="text-xs px-2 py-1 bg-gray-200 dark:bg-slate-800 dark:text-white rounded cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(u)}
                      className="text-xs px-2 py-1 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}
