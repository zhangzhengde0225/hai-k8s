import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import client from '../api/client';
import type { Pod } from '../types';
import toast from 'react-hot-toast';
import {
  Eye, FileText, RotateCw, Trash2, RefreshCw, Search
} from 'lucide-react';

export default function AdminPods() {
  const { t } = useTranslation('admin');
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'system' | 'other'>('all');

  const fetchPods = () => {
    setLoading(true);
    client
      .get('/admin/pods')
      .then((res) => setPods(res.data))
      .catch(() => toast.error(t('failedToLoadPods')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPods();
  }, []);

  // Filter PODs
  const filteredPods = pods.filter((pod) => {
    // Search filter
    const matchesSearch =
      pod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pod.namespace.toLowerCase().includes(searchTerm.toLowerCase());

    // Type filter
    const matchesFilter =
      filterType === 'all' ||
      (filterType === 'system' && pod.is_system_managed) ||
      (filterType === 'other' && !pod.is_system_managed);

    return matchesSearch && matchesFilter;
  });

  const handleDelete = async (pod: Pod) => {
    const confirmMessage = pod.is_system_managed
      ? t('confirmDeleteSystemPod')
      : t('confirmDeleteExternalPod');

    if (!confirm(confirmMessage)) return;

    try {
      await client.delete(`/admin/pods/${pod.namespace}/${pod.name}`);
      toast.success(t('podDeleted'));
      fetchPods();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('failedToDeletePod'));
    }
  };

  const handleRestart = async (pod: Pod) => {
    if (!confirm(t('confirmRestartPod'))) return;

    try {
      await client.post(`/admin/pods/${pod.namespace}/${pod.name}/restart`);
      toast.success(t('podRestartInitiated'));
      fetchPods();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('failedToRestartPod'));
    }
  };

  const handleViewLogs = async (pod: Pod) => {
    try {
      const res = await client.get(`/admin/pods/${pod.namespace}/${pod.name}/logs`);
      const logs = res.data.logs;

      // Open logs in a new window
      const logWindow = window.open('', '_blank', 'width=800,height=600');
      if (logWindow) {
        logWindow.document.write(`
          <html>
            <head>
              <title>Logs - ${pod.namespace}/${pod.name}</title>
              <style>
                body {
                  margin: 0;
                  padding: 20px;
                  font-family: monospace;
                  background: #1e1e1e;
                  color: #d4d4d4;
                }
                pre {
                  white-space: pre-wrap;
                  word-wrap: break-word;
                }
              </style>
            </head>
            <body>
              <h2>Logs: ${pod.namespace}/${pod.name}</h2>
              <pre>${logs}</pre>
            </body>
          </html>
        `);
        logWindow.document.close();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('failedToLoadLogs'));
    }
  };

  const handleViewDetails = async (pod: Pod) => {
    try {
      const res = await client.get(`/admin/pods/${pod.namespace}/${pod.name}`);
      const detail = res.data;

      // Open details in a new window
      const detailWindow = window.open('', '_blank', 'width=800,height=600');
      if (detailWindow) {
        detailWindow.document.write(`
          <html>
            <head>
              <title>Details - ${pod.namespace}/${pod.name}</title>
              <style>
                body {
                  margin: 0;
                  padding: 20px;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  background: #f5f5f5;
                }
                pre {
                  background: #fff;
                  padding: 15px;
                  border-radius: 4px;
                  overflow-x: auto;
                }
              </style>
            </head>
            <body>
              <h2>POD Details: ${pod.namespace}/${pod.name}</h2>
              <pre>${JSON.stringify(detail, null, 2)}</pre>
            </body>
          </html>
        `);
        detailWindow.document.close();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('failedToLoadDetails'));
    }
  };

  const getStatusColor = (phase: string) => {
    const colors: Record<string, string> = {
      Running: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      Pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      Failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      Succeeded: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      Unknown: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300',
    };
    return colors[phase] || colors.Unknown;
  };

  const getAgeString = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  };

  if (loading) {
    return <p className="text-gray-500 dark:text-slate-400">Loading...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
          {t('podManagement')}
        </h2>
        <button
          onClick={fetchPods}
          className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm cursor-pointer flex items-center gap-2"
        >
          <RefreshCw size={14} /> {t('refresh')}
        </button>
      </div>

      {/* Search and filter */}
      <div className="mb-4 flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder={t('searchPods')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-md dark:bg-slate-900 dark:text-white"
        >
          <option value="all">{t('allPods')}</option>
          <option value="system">{t('systemManaged')}</option>
          <option value="other">{t('externalPods')}</option>
        </select>
      </div>

      {/* POD list table */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-950 text-left text-gray-500 dark:text-slate-400 uppercase text-xs">
                <th className="px-4 py-3">{t('namespace')}</th>
                <th className="px-4 py-3">{t('podName')}</th>
                <th className="px-4 py-3">{t('status')}</th>
                <th className="px-4 py-3">{t('containers')}</th>
                <th className="px-4 py-3">{t('node')}</th>
                <th className="px-4 py-3">{t('resources')}</th>
                <th className="px-4 py-3">{t('managed')}</th>
                <th className="px-4 py-3">{t('age')}</th>
                <th className="px-4 py-3">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filteredPods.map((pod) => {
                const readyContainers = pod.containers.filter(c => c.ready).length;
                const totalContainers = pod.containers.length;

                return (
                  <tr key={`${pod.namespace}-${pod.name}`}>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 font-mono text-xs">
                      {pod.namespace}
                    </td>
                    <td className="px-4 py-3 font-medium dark:text-white">
                      {pod.name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(pod.phase)}`}>
                        {pod.phase}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400">
                      <span className={readyContainers === totalContainers ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
                        {readyContainers}/{totalContainers}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">
                      {pod.node_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs font-mono">
                      {pod.resource_requests.cpu || '-'} / {pod.resource_requests.memory || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {pod.is_system_managed ? (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
                          System
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300 rounded-full">
                          External
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">
                      {getAgeString(pod.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetails(pod)}
                          className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                          title={t('describe')}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleViewLogs(pod)}
                          className="text-green-600 dark:text-green-400 hover:underline text-xs"
                          title={t('viewLogs')}
                        >
                          <FileText size={14} />
                        </button>
                        <button
                          onClick={() => handleRestart(pod)}
                          className="text-yellow-600 dark:text-yellow-400 hover:underline text-xs"
                          title={t('restart')}
                        >
                          <RotateCw size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(pod)}
                          className="text-red-600 dark:text-red-400 hover:underline text-xs"
                          title={t('deletePod')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statistics */}
      <div className="mt-4 text-sm text-gray-500 dark:text-slate-400">
        {t('showingPods')}: {filteredPods.length} / {pods.length}
      </div>
    </div>
  );
}
