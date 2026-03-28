import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { AppWindow, Play, Square, Settings, Globe, List, Loader2, TriangleAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import Drawer from '../../../components/Drawer';
import AppConfigForm from '../../../components/AppConfigForm';
import client from '../../../api/client';
import type { Application, SaveConfigData, User } from '../../../types';
import { useAuthStore } from '../../../auth/AuthContext';

export default function AppService() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const clusterMissing = !!(user && (!user.cluster_username || user.cluster_uid == null || user.cluster_gid == null || !user.cluster_home_dir));
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  // Configuration management states
  const [showConfigFormDrawer, setShowConfigFormDrawer] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadApplications();
  }, []);

  const refreshUserInfo = async () => {
    try {
      const response = await client.get<User>('/users/me');
      updateUser(response.data);
    } catch (error) {
      console.error('Failed to refresh user info:', error);
    }
  };

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
        volume_mounts: configData.volumeMounts,
        bound_ip: configData.boundIp,
        // User sync configuration
        sync_user: configData.syncUser,
        user_uid: configData.userUid,
        user_gid: configData.userGid,
        user_home_dir: configData.userHomeDir,
        enable_sudo: configData.enableSudo,
        // Passwords
        root_password: configData.rootPassword || null,
        user_password: configData.userPassword || null,
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
    // Validate config completeness before launching
    const config = app.config;
    if (!config) {
      toast.error('配置不完整，请先完成配置');
      return;
    }
    if (!config.cpu_request || config.cpu_request <= 0 || !config.memory_request || config.memory_request <= 0) {
      toast.error('配置不完整：计算资源无效，请重新配置');
      return;
    }
    if (config.sync_user && (config.user_uid == null || config.user_gid == null)) {
      toast.error('配置不完整：已开启同步用户但集群账号信息缺失，请重新配置');
      return;
    }
    if (!config.bound_ip) {
      toast.error('配置不完整：需要分配独立 IP，请重新配置');
      return;
    }
    // Check that the configured image still exists and is available
    try {
      const imagesRes = await client.get('/images');
      const images: any[] = imagesRes.data;
      const availableImageIds = app.available_image_ids;
      const imageExists = availableImageIds?.length
        ? images.some((img: any) => img.id === config.image_id && availableImageIds.includes(img.id))
        : images.some((img: any) => img.id === config.image_id);
      if (!imageExists) {
        toast.error('配置的镜像已不可用，请重新配置');
        return;
      }
    } catch {
      // 镜像检查失败时不阻塞启动
    }

    setActionLoading(`launch-${app.id}`);
    try {
      const response = await client.post(`/applications/${app.id}/launch`, { count: 1 });
      toast.success(t('instanceLaunched') || '实例已启动');

      await loadApplications();
      // 刷新用户信息以更新资源使用量
      await refreshUserInfo();
      // 自动跳转到详情页面
      navigate(`/apps/${app.id}/details`);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || t('launchFailed') || '启动失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopApp = async (app: Application) => {
    setActionLoading(`stop-${app.id}`);
    try {
      await client.post(`/applications/${app.id}/stop`);
      toast.success('实例已删除');
      await loadApplications();
      // 刷新用户信息以更新资源使用量
      await refreshUserInfo();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: Application['status']) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'stopped':
        return 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300';
      case 'configured':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'unconfigured':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300';
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
      {/* Cluster account warning */}
      {user && (!user.cluster_username || user.cluster_uid == null || user.cluster_gid == null || !user.cluster_home_dir) && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-600/50 dark:bg-yellow-900/20 dark:text-yellow-300">
          <TriangleAlert size={16} className="mt-0.5 flex-shrink-0" />
          <span>
            您尚未开通HAI集群账号，部分功能受限，请前往{' '}
            <a
              href="https://ai.ihep.ac.cn/#/computing"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2 hover:text-yellow-900 dark:hover:text-yellow-200"
            >
              HAI平台-算力
            </a>
            {' '}查看和开通。
          </span>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-4 md:mb-6">
        <div className="flex items-center gap-2 md:gap-3 mb-2">
          <AppWindow size={28} className="text-blue-600 md:w-8 md:h-8" />
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:bg-gradient-to-r dark:from-blue-400 dark:to-cyan-400 dark:bg-clip-text dark:text-transparent">
            {t('applicationServices')}
          </h1>
        </div>
        <p className="text-sm md:text-base text-gray-600 dark:text-slate-400">
          {t('manageApplications')}
        </p>
      </div>

      {/* Applications Grid */}
      <div className="flex flex-wrap gap-4 md:gap-6">
        {applications.map((app) => (
          <div
            key={app.id}
            className="bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700/50 hover:shadow-lg dark:hover:border-blue-500/50 dark:hover:shadow-blue-500/20 transition-all w-full sm:w-auto sm:min-w-[380px] sm:max-w-[480px]"
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
                    <p className="text-xs md:text-sm text-gray-600 dark:text-slate-400 truncate">
                      {app.version}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 md:py-1 text-xs font-medium rounded-full whitespace-nowrap ${getStatusColor(app.status)}`}>
                  {getStatusText(app.status)}
                </span>
              </div>

              {/* App Description */}
              <p className="text-xs md:text-sm text-gray-600 dark:text-slate-400 mb-3 md:mb-4 line-clamp-2">
                {app.description}
              </p>

              {/* App Stats */}
              <div className="grid grid-cols-2 gap-3 md:gap-4 mb-3 md:mb-4 pb-3 md:pb-4 border-b border-gray-200 dark:border-slate-700">
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">
                    {t('instances')}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {app.pods || 0} / {app.replicas || 0}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {t('endpoint')}
                    </p>
                    {app.endpoint && app.status === 'running' && (
                      <span
                        className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded cursor-help relative group"
                        title="仅高能所内网可访问，或先连接高能VPN"
                      >
                        内网IP
                        <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded whitespace-nowrap z-10 pointer-events-none">
                          仅高能所内网可访问，或先连接高能VPN
                          <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></span>
                        </span>
                      </span>
                    )}
                  </div>
                  {app.endpoint && app.status === 'running' ? (
                    <a
                      href={`https://${app.endpoint.replace(/^https?:\/\//, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      title={`访问 https://${app.endpoint.replace(/^https?:\/\//, '')}`}
                    >
                      <Globe size={12} className="flex-shrink-0" />
                      <span className="truncate">
                        https://{app.endpoint.replace(/^https?:\/\//, '')}
                      </span>
                    </a>
                  ) : (
                    <p className="text-sm font-semibold text-gray-400">-</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {actionLoading === `launch-${app.id}` ? (
                  <button disabled className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg opacity-70 cursor-not-allowed text-xs md:text-sm">
                    <Loader2 size={14} className="animate-spin md:w-4 md:h-4" />
                    <span className="whitespace-nowrap">{t('launching') || '启动中...'}</span>
                  </button>
                ) : actionLoading === `stop-${app.id}` ? (
                  <button disabled className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-500 text-white rounded-lg opacity-70 cursor-not-allowed text-xs md:text-sm">
                    <Loader2 size={14} className="animate-spin md:w-4 md:h-4" />
                    <span className="whitespace-nowrap">停止中...</span>
                  </button>
                ) : app.status === 'running' ? (
                  <>
                    <button
                      onClick={() => handleStopApp(app)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-xs md:text-sm"
                    >
                      <Square size={14} className="md:w-4 md:h-4" />
                      <span className="whitespace-nowrap">{t('stopApp') || '停止'}</span>
                    </button>
                    <button
                      onClick={() => navigate(`/apps/${app.id}/details`)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-xs md:text-sm"
                    >
                      <List size={14} className="md:w-4 md:h-4" />
                      <span className="whitespace-nowrap">{t('viewDetails') || '查看详情'}</span>
                    </button>
                  </>
                ) : app.is_configured ? (
                  <>
                    <button
                      onClick={() => handleLaunchInstance(app)}
                      disabled={clusterMissing}
                      title={clusterMissing ? '请先开通 HAI 算力集群账号' : undefined}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs md:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play size={14} className="md:w-4 md:h-4" />
                      <span className="whitespace-nowrap">{t('launch')}</span>
                    </button>
                    {(app.total_instances ?? 0) > 0 ? (
                      <button
                        onClick={() => navigate(`/apps/${app.id}/details`)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-xs md:text-sm"
                      >
                        <List size={14} className="md:w-4 md:h-4" />
                        <span className="whitespace-nowrap">{t('viewDetails') || '查看详情'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConfigureApp(app)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-xs md:text-sm"
                      >
                        <Settings size={14} className="md:w-4 md:h-4" />
                        <span className="whitespace-nowrap">{t('editConfig')}</span>
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => handleConfigureApp(app)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs md:text-sm"
                  >
                    <Settings size={14} className="md:w-4 md:h-4" />
                    <span className="whitespace-nowrap">{t('configure')}</span>
                  </button>
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
          <p className="text-sm md:text-base text-gray-600 dark:text-slate-400">
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
