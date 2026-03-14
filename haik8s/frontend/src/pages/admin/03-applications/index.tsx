// 管理员-应用管理列表页面：查看所有应用定义，支持添加应用、切换可见性、删除应用，以及跳转到应用配置编辑页。
// Author: Zhengde Zhang (zhangzhengde0225@gmail.com)
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import client from '../../../api/client';
import type { ApplicationDefinition } from '../../../types';
import toast from 'react-hot-toast';
import {
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  RefreshCw,
  Plus,
  X,
} from 'lucide-react';

const DEFAULT_FORM = { app_id: '', name: '', version: 'v1.0.0', image_prefix: '' };

export default function AdminApplications() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<ApplicationDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = () => {
    client
      .get('/admin/applications')
      .then((res) => setApplications(res.data))
      .catch(() => toast.error(t('loadFailed', 'Failed to load applications')))
      .finally(() => setLoading(false));
  };

  const toggleVisibility = async (app: ApplicationDefinition) => {
    try {
      await client.patch(`/admin/applications/${app.app_id}/toggle-visibility`);
      toast.success(t('applicationUpdated'));
      fetchApplications();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('saveFailed', 'Failed to update'));
    }
  };

  const deleteApp = async (appId: string) => {
    if (!confirm(t('confirmDeleteApplication'))) return;
    try {
      await client.delete(`/admin/applications/${appId}`);
      toast.success(t('applicationDeleted'));
      fetchApplications();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('deleteFailed', 'Failed to delete'));
    }
  };

  const createApp = async () => {
    if (!formData.app_id.trim() || !formData.name.trim()) {
      toast.error(t('appIdAndNameRequired', 'App ID and name are required'));
      return;
    }
    setCreating(true);
    try {
      await client.post('/admin/applications', formData);
      toast.success(t('applicationCreated'));
      setShowAddModal(false);
      setFormData(DEFAULT_FORM);
      navigate(`/admin/applications/${formData.app_id}/edit`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('saveFailed', 'Failed to create'));
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <p className="text-gray-500 dark:text-slate-400">Loading...</p>;

  return (
    <>
    <div>
      <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-4 md:mb-6">
        {t('manageApplications')}
      </h2>
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow overflow-hidden">
        <div className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('applications')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              {t('manageApplications')}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors flex items-center gap-2"
            >
              <Plus size={16} />
              {t('addApplication')}
            </button>
            <button
              onClick={fetchApplications}
              className="px-3 py-2 text-sm border dark:border-slate-700 rounded-md hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-white transition-colors flex items-center gap-2"
            >
              <RefreshCw size={16} />
              {t('refresh')}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-950 text-left text-gray-500 dark:text-slate-400 uppercase text-xs">
                <th className="px-3 md:px-4 py-3 whitespace-nowrap">{t('appId')}</th>
                <th className="px-3 md:px-4 py-3 whitespace-nowrap">{t('appName')}</th>
                <th className="px-3 md:px-4 py-3 whitespace-nowrap">{t('version')}</th>
                <th className="px-3 md:px-4 py-3 whitespace-nowrap">{t('visible')}</th>
                <th className="px-3 md:px-4 py-3 whitespace-nowrap">{t('recommendedResources')}</th>
                <th className="px-3 md:px-4 py-3 whitespace-nowrap text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {applications.map((app) => (
                <tr key={app.id}>
                  <td className="px-4 py-3 font-medium dark:text-white">{app.app_id}</td>
                  <td className="px-4 py-3 dark:text-white">{app.name}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{app.version}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleVisibility(app)}
                      title={t('toggleVisibility')}
                      className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 w-fit cursor-pointer transition-opacity hover:opacity-70 ${
                        app.is_visible ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {app.is_visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      {app.is_visible ? t('visible') : 'Hidden'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-gray-500 dark:text-slate-400">
                      <span>{t('cpu')}: {app.recommended_cpu}</span>
                      <span className="ml-2">{t('memory')}: {app.recommended_memory}</span>
                      {app.recommended_gpu > 0 && (
                        <span className="ml-2">{t('gpu')}: {app.recommended_gpu}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate(`/admin/applications/${app.app_id}/edit`)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded dark:text-white"
                        title={t('editApplication')}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => deleteApp(app.app_id)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded"
                        title={t('deleteApplication')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>

      {/* Add Application Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {t('addApplication')}
              </h3>
              <button
                onClick={() => { setShowAddModal(false); setFormData(DEFAULT_FORM); }}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  {t('appId')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.app_id}
                  onChange={(e) => setFormData({ ...formData, app_id: e.target.value })}
                  placeholder="e.g. my-app"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  {t('appName')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. My Application"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  {t('version')}
                </label>
                <input
                  type="text"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  {t('imagePrefix', 'Image Prefix')}
                </label>
                <input
                  type="text"
                  value={formData.image_prefix}
                  onChange={(e) => setFormData({ ...formData, image_prefix: e.target.value })}
                  placeholder="e.g. registry.example.com/myapp"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={createApp}
                disabled={creating}
                className="flex-1 px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {creating ? t('creating', 'Creating...') : t('create', 'Create')}
              </button>
              <button
                onClick={() => { setShowAddModal(false); setFormData(DEFAULT_FORM); }}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                {t('cancel', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
