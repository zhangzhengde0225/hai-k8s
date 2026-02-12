import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { AppWindow, Play, Settings, ExternalLink, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import Drawer from '../components/Drawer';
import AppConfigForm from '../components/AppConfigForm';
import client from '../api/client';
import type { Application, SaveConfigData } from '../types';

export default function AppService() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  // Configuration management states
  const [showConfigFormDrawer, setShowConfigFormDrawer] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      // Call real API
      const response = await client.get('/applications');

      // Merge with localized descriptions
      const apps = response.data.map((app: any) => ({
        ...app,
        description: t(`${app.id}Description`),
      }));

      setApplications(apps);
    } catch (error) {
      console.error('Failed to load applications:', error);
      toast.error(t('loadApplicationsFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureApp = async (app: Application) => {
    setSelectedApp(app);
    setShowConfigFormDrawer(true);
  };

  const handleSaveConfig = async (configData: SaveConfigData) => {
    if (!selectedApp) return;

    try {
      await client.post(`/applications/${selectedApp.id}/config`, {
        image_id: configData.imageId,
        cpu_request: configData.cpu,
        memory_request: configData.memory,
        gpu_request: configData.gpu,
        ssh_enabled: configData.sshEnabled,
        storage_path: configData.storagePath,
      });

      toast.success(t('configSaved') || '配置已保存');
      setShowConfigFormDrawer(false);

      // Reload applications
      await loadApplications();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || t('saveFailed'));
    }
  };

  const handleLaunchInstance = async (app: Application) => {
    setActionLoading(`launch-${app.id}`);
    try {
      await client.post(
        `/applications/${app.id}/launch`,
        { count: 1 }
      );
      toast.success(t('instanceLaunched') || '实例已启动');
      await loadApplications();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || t('launchFailed') || '启动失败';
      toast.error(errorMsg);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: Application['status']) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'stopped':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'configured':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'unconfigured':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusText = (status: Application['status']) => {
    switch (status) {
      case 'running':
        return t('running');
      case 'stopped':
        return t('stopped');
      case 'configured':
        return t('configured') || '已配置';
      case 'unconfigured':
        return t('unconfigured');
      case 'error':
        return t('error');
      default:
        return t('unknown');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-4 md:mb-6">
        <div className="flex items-center gap-2 md:gap-3 mb-2">
          <AppWindow size={28} className="text-blue-600 md:w-8 md:h-8" />
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
            {t('applicationServices')}
          </h1>
        </div>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
          {t('manageApplications')}
        </p>
      </div>

      {/* Applications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {applications.map((app) => (
          <div
            key={app.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
          >
            <div className="p-4 md:p-6">
              {/* App Header */}
              <div className="flex items-start justify-between mb-3 md:mb-4">
                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg flex-shrink-0">
                    <AppWindow size={20} className="text-blue-600 dark:text-blue-300 md:w-6 md:h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {app.name}
                    </h3>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 truncate">
                      {app.version}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 md:py-1 text-xs font-medium rounded-full whitespace-nowrap ${getStatusColor(app.status)}`}>
                  {getStatusText(app.status)}
                </span>
              </div>

              {/* App Description */}
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3 md:mb-4 line-clamp-2">
                {app.description}
              </p>

              {/* App Stats */}
              <div className="grid grid-cols-2 gap-3 md:gap-4 mb-3 md:mb-4 pb-3 md:pb-4 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {t('instances')}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {app.pods || 0} / {app.replicas || 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {t('endpoint')}
                  </p>
                  {app.endpoint ? (
                    <a
                      href={app.endpoint}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Globe size={14} />
                      <span className="truncate">{t('visit')}</span>
                    </a>
                  ) : (
                    <p className="text-sm font-semibold text-gray-400">-</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {/* Launch or Configure button */}
                {app.is_configured ? (
                  <button
                    onClick={() => handleLaunchInstance(app)}
                    disabled={actionLoading === `launch-${app.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm"
                  >
                    <Play size={14} className="md:w-4 md:h-4" />
                    <span>{actionLoading === `launch-${app.id}` ? t('launching') || '启动中...' : t('launch')}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleConfigureApp(app)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs md:text-sm"
                  >
                    <Settings size={14} className="md:w-4 md:h-4" />
                    <span>{t('configure')}</span>
                  </button>
                )}

                {/* Edit Config button - only show if configured */}
                {app.is_configured && (
                  <button
                    onClick={() => handleConfigureApp(app)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs md:text-sm"
                  >
                    <Settings size={14} className="md:w-4 md:h-4" />
                    <span>{t('editConfig')}</span>
                  </button>
                )}

                {/* Endpoint link - only show if has endpoint */}
                {app.endpoint && (
                  <a
                    href={app.endpoint}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                  >
                    <ExternalLink size={14} className="md:w-4 md:h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {applications.length === 0 && (
        <div className="text-center py-12">
          <AppWindow size={40} className="mx-auto text-gray-400 mb-4 md:w-12 md:h-12" />
          <h3 className="text-base md:text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t('noApplications')}
          </h3>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
            {t('noApplicationsDescription')}
          </p>
        </div>
      )}

      {/* Configuration Form Drawer */}
      <Drawer
        isOpen={showConfigFormDrawer}
        onClose={() => setShowConfigFormDrawer(false)}
        title={selectedApp ? `${t('configure')} ${selectedApp.name}` : t('configuration')}
      >
        {selectedApp && (
          <AppConfigForm
            application={selectedApp}
            onSaveConfig={handleSaveConfig}
            onCancel={() => setShowConfigFormDrawer(false)}
          />
        )}
      </Drawer>
    </div>
  );
}
