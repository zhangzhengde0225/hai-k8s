import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Save, X, Eye, EyeOff, TriangleAlert } from 'lucide-react';
import { useAuthStore } from '../auth/AuthContext';
import client from '../api/client';
import type { Image, SaveConfigData, VolumeMountConfig, IPAllocation } from '../types';

// Categorize image based on tags (frontend logic)
const categorizeImage = (image: Image): 'app' | 'system' | 'custom' => {
  if (!image.tags || image.tags.length === 0) return 'custom';

  // App images: contain openclaw or opendrsai tags
  if (image.tags.includes('openclaw') || image.tags.includes('opendrsai')) {
    return 'app';
  }

  // System images: contain system tag
  if (image.tags.includes('system')) {
    return 'system';
  }

  // Others are custom images
  return 'custom';
};

interface Application {
  id: string;
  name: string;
  description: string;
  defaultImage?: string;
  recommended_cpu?: number;
  recommended_memory?: number;
  recommended_gpu?: number;
  max_cpu?: number | null;
  max_memory?: number | null;
  max_gpu?: number | null;
  available_image_ids?: number[];
}

interface AppConfigFormProps {
  application: Application;
  onSaveConfig: (config: SaveConfigData) => Promise<void>;
  onCancel: () => void;
}

export default function AppConfigForm({ application, onSaveConfig, onCancel }: AppConfigFormProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [saving, setSaving] = useState(false);

  // Image selection
  const [activeTab, setActiveTab] = useState<'app' | 'system' | 'custom'>('app');
  const [images, setImages] = useState<Image[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<number | ''>('');

  // Resource fields (stored as strings to allow clearing while typing)
  const [cpu, setCpu] = useState('2');
  const [memory, setMemory] = useState('4');
  const [gpu, setGpu] = useState('0');
  const [sshEnabled, setSshEnabled] = useState(true); // Default enabled
  const [storagePath, setStoragePath] = useState('');

  // Volume mounts
  const [volumeMounts, setVolumeMounts] = useState<VolumeMountConfig[]>([]);

  // IP allocation
  const [boundIp, setBoundIp] = useState<string | null>(null);
  const [ipAllocation, setIpAllocation] = useState<IPAllocation | null>(null);
  const [allocatingIp, setAllocatingIp] = useState(false);
  const [useIndependentIp, setUseIndependentIp] = useState(true);

  // User sync fields
  const [syncUser, setSyncUser] = useState(true);
  const [userUid, setUserUid] = useState<number | null>(null);
  const [userGid, setUserGid] = useState<number | null>(null);
  const [userHomeDir, setUserHomeDir] = useState<string | null>(null);
  const [enableSudo, setEnableSudo] = useState(true);
  const [clusterUsername, setClusterUsername] = useState<string | null>(null);

  // Password fields
  const [rootPassword, setRootPassword] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [showRootPassword, setShowRootPassword] = useState(false);
  const [showUserPassword, setShowUserPassword] = useState(false);

  // Storage checkbox states
  const [mountHomeDir, setMountHomeDir] = useState(true);
  const [mountDataDir, setMountDataDir] = useState(true);

  // Load images and existing config
  useEffect(() => {
    client.get('/images').then((res) => {
      setImages(res.data);

      // If editing existing config, load it
      if (application.config) {
        const config = application.config;
        setSelectedImageId(config.image_id);
        setCpu(String(config.cpu_request));
        setMemory(String(config.memory_request));
        setGpu(String(config.gpu_request));
        setSshEnabled(config.ssh_enabled);
        if (config.storage_path) {
          setStoragePath(config.storage_path);
        }
        if (config.volume_mounts && config.volume_mounts.length > 0) {
          setVolumeMounts(config.volume_mounts);
          setMountHomeDir(config.volume_mounts.some((m: VolumeMountConfig) => m.host_path?.includes('/aifs/user/home/')));
          setMountDataDir(config.volume_mounts.some((m: VolumeMountConfig) => m.host_path?.includes('/aifs/user/data/')));
        }
        if (config.bound_ip) {
          setBoundIp(config.bound_ip);
          setUseIndependentIp(true);
        } else {
          setUseIndependentIp(false);
        }

        // Load user sync configuration
        if (config.sync_user !== undefined) {
          setSyncUser(config.sync_user);
        }
        if (config.user_uid !== undefined && config.user_uid !== null) {
          setUserUid(config.user_uid);
        }
        if (config.user_gid !== undefined && config.user_gid !== null) {
          setUserGid(config.user_gid);
        }
        if (config.user_home_dir) {
          setUserHomeDir(config.user_home_dir);
        }
        if (config.enable_sudo !== undefined) {
          setEnableSudo(config.enable_sudo);
        }
        if (config.root_password) {
          setRootPassword(config.root_password);
        }
        if (config.user_password) {
          setUserPassword(config.user_password);
        }

        // Set active tab based on image
        const configImage = res.data.find((img: Image) => img.id === config.image_id);
        if (configImage) {
          setActiveTab(categorizeImage(configImage));
        }
      } else {
        // Auto-select default image if no config exists
        if (application.defaultImage) {
          const defaultImg = res.data.find((img: Image) =>
            img.name.toLowerCase().includes(application.defaultImage!.toLowerCase())
          );
          if (defaultImg) {
            setSelectedImageId(defaultImg.id);
            setActiveTab(categorizeImage(defaultImg));
          }
        }
      }
    });
  }, [application.config, application.defaultImage]);

  // Filter images by active tab, then further restrict to application's available_image_ids
  const filteredImages = useMemo(() => {
    return images.filter(img => categorizeImage(img) === activeTab);
  }, [images, activeTab]);

  // When admin has configured specific images for this app, show only those (bypass tabs)
  const availableImages = useMemo(() => {
    if (application.available_image_ids && application.available_image_ids.length > 0) {
      return images.filter(img => application.available_image_ids!.includes(img.id));
    }
    return null; // null = use tab UI
  }, [images, application.available_image_ids]);

  // Auto-generate storage path when image is selected or application changes (only for new configs)
  useEffect(() => {
    // Skip auto-generation if editing existing config with a storage path
    if (application.config?.storage_path) {
      return;
    }

    if (selectedImageId || application) {
      // Prefer cluster_username from DB; fall back to email prefix or username
      let username = clusterUsername || user?.username || 'user';
      if (!clusterUsername && user?.email && user.email.includes('@')) {
        username = user.email.split('@')[0];
      }

      // Generate storage path based on application
      let generatedPath: string;
      if (application.id === 'openclaw') {
        generatedPath = `/aifs/user/home/${username}/.hai-openclaw`;
      } else if (application.id === 'opendrsai') {
        generatedPath = `/aifs/user/home/${username}/.hai-opendrsai`;
      } else {
        const selectedImage = images.find(img => img.id === selectedImageId);
        const imageName = selectedImage ? selectedImage.name.toLowerCase() : 'data';
        generatedPath = `/aifs/user/home/${username}/${imageName}`;
      }

      setStoragePath(generatedPath);
    }
  }, [selectedImageId, images, user, clusterUsername, application]);

  // Fetch user system information (uid, gid, home directory) from backend
  useEffect(() => {
    client.get('/users/me').then((res) => {
      const u = res.data;
      if (u.cluster_uid != null) setUserUid(u.cluster_uid);
      if (u.cluster_gid != null) setUserGid(u.cluster_gid);
      if (u.cluster_home_dir) setUserHomeDir(u.cluster_home_dir);
      if (u.cluster_username) setClusterUsername(u.cluster_username);

      // Auto-add default mounts for new configs (checkboxes default to true)
      if (!application.config) {
        const username = u.cluster_username || (user?.email?.includes('@') ? user.email.split('@')[0] : user?.username) || 'user';
        const home = u.cluster_home_dir || `/aifs/user/home/${username}`;
        const data = `/aifs/user/data/${username}`;
        setVolumeMounts(prev => {
          if (prev.length > 0) return prev;
          return [
            { host_path: home, mount_path: home },
            { host_path: data, mount_path: data },
          ];
        });
      }
    }).catch(() => {
      // Fallback: leave fields empty, user can fill manually
    });
  }, [application.config]);

  // Fetch user's IP allocation
  useEffect(() => {
    client.get('/ip-allocations/my-ip')
      .then(res => {
        setIpAllocation(res.data);
        // For new configs, default useIndependentIp=true, auto-bind if IP available
        if (res.data.has_ip && !application.config) {
          setBoundIp(res.data.ip_address);
          setUseIndependentIp(true);
        }
      })
      .catch(err => {
        console.error('Failed to fetch IP allocation:', err);
      });
  }, [application.config]);

  // Update boundIp when IP allocation changes and useIndependentIp is enabled
  useEffect(() => {
    if (ipAllocation?.has_ip && useIndependentIp) {
      setBoundIp(ipAllocation.ip_address);
    }
  }, [ipAllocation?.ip_address, useIndependentIp]);

  const getComputedHomePath = () => {
    let u = clusterUsername || user?.username || 'user';
    if (!clusterUsername && user?.email?.includes('@')) u = user.email.split('@')[0];
    return userHomeDir || `/aifs/user/home/${u}`;
  };

  const getComputedDataPath = () => {
    let u = clusterUsername || user?.username || 'user';
    if (!clusterUsername && user?.email?.includes('@')) u = user.email.split('@')[0];
    return `/aifs/user/data/${u}`;
  };

  const handleUseIndependentIpChange = (checked: boolean) => {
    setUseIndependentIp(checked);
    if (checked) {
      if (ipAllocation?.has_ip) setBoundIp(ipAllocation.ip_address);
    } else {
      setBoundIp(null);
    }
  };

  const handleSyncUserChange = (checked: boolean) => {
    setSyncUser(checked);
    if (!checked) {
      // Remove home/data mounts when sync user is disabled
      setVolumeMounts(prev => prev.filter(
        m => !m.host_path.includes('/aifs/user/home/') && !m.host_path.includes('/aifs/user/data/')
      ));
    } else {
      // Re-add mounts based on current checkbox states
      const home = getComputedHomePath();
      const data = getComputedDataPath();
      setVolumeMounts(prev => {
        let next = [...prev];
        if (mountHomeDir && !next.some(m => m.host_path === home)) {
          next = [...next, { host_path: home, mount_path: home }];
        }
        if (mountDataDir && !next.some(m => m.host_path === data)) {
          next = [...next, { host_path: data, mount_path: data }];
        }
        return next;
      });
    }
  };

  const handleMountHomeDirChange = (checked: boolean) => {
    setMountHomeDir(checked);
    if (checked) {
      const path = getComputedHomePath();
      if (!volumeMounts.some(m => m.host_path === path)) {
        setVolumeMounts(prev => [...prev, { host_path: path, mount_path: path }]);
      }
    } else {
      setVolumeMounts(prev => prev.filter(m => !m.host_path.includes('/aifs/user/home/')));
    }
  };

  const handleMountDataDirChange = (checked: boolean) => {
    setMountDataDir(checked);
    if (checked) {
      const path = getComputedDataPath();
      if (!volumeMounts.some(m => m.host_path === path)) {
        setVolumeMounts(prev => [...prev, { host_path: path, mount_path: path }]);
      }
    } else {
      setVolumeMounts(prev => prev.filter(m => !m.host_path.includes('/aifs/user/data/')));
    }
  };

  const handleAllocateIp = async () => {
    setAllocatingIp(true);
    try {
      const res = await client.post('/ip-allocations/allocate');
      setIpAllocation({
        has_ip: true,
        ip_address: res.data.ip_address,
        allocated_at: res.data.allocated_at,
      });
      setBoundIp(res.data.ip_address);
      toast.success(t('ipAllocated') || `IP已分配: ${res.data.ip_address}`);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || t('ipAllocationFailed') || 'IP分配失败';
      toast.error(errorMsg);
    } finally {
      setAllocatingIp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!selectedImageId) {
      toast.error(t('imageRequired') || '请选择镜像');
      return;
    }

    if (syncUser && (userUid === null || userGid === null)) {
      toast.error('请先开通 HAI 算力集群账号后再保存配置');
      return;
    }

    setSaving(true);
    try {
      await onSaveConfig({
        imageId: selectedImageId as number,
        cpu: parseFloat(cpu) || 0,
        memory: parseFloat(memory) || 0,
        gpu: parseInt(gpu, 10) || 0,
        sshEnabled,
        storagePath,
        volumeMounts,
        boundIp,
        syncUser,
        userUid,
        userGid,
        userHomeDir,
        enableSudo,
        rootPassword: rootPassword || null,
        userPassword: userPassword || null,
      });
      toast.success(t('configSaved'));
    } catch (error: any) {
      toast.error(error.message || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const cpuRemaining = (user?.cpu_quota ?? 0) - (user?.cpu_used ?? 0);
  const memRemaining = (user?.memory_quota ?? 0) - (user?.memory_used ?? 0);
  const gpuRemaining = (user?.gpu_quota ?? 0) - (user?.gpu_used ?? 0);

  // Application descriptions
  const descriptions: Record<string, string> = {
    openclaw: `OpenClaw是一款开源的AI智能体助手，能通过消息应用接收指令并直接执行任务。`,
    opendrsai: `OpenDrSai是一款强大的AI驱动科研助手，专为科研工作者和数据分析人员设计。支持大规模数据处理、模型训练和实验管理，提供完整的科研工作流支持。`,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Description */}
      {descriptions[application.id] && (
        <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-3 md:p-4 text-xs md:text-sm text-blue-700 dark:text-blue-300 whitespace-pre-line">
          {descriptions[application.id]}
        </div>
      )}

      {/* Section 1: Image Selection */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-4 md:p-5 shadow-sm border border-gray-200 dark:border-slate-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
          {t('imageSelection')}
        </label>

        {availableImages !== null ? (
          /* Admin has configured specific images: flat list, no tabs */
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {availableImages.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400 py-2">暂无可用镜像</p>
            ) : (
              availableImages.map((img) => (
                <label
                  key={img.id}
                  className={`block p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedImageId === img.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="image"
                      value={img.id}
                      checked={selectedImageId === img.id}
                      onChange={(e) => setSelectedImageId(Number(e.target.value))}
                      className="mt-1 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 dark:text-white">{img.name}</span>
                        {img.version && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded">
                            {img.version}
                          </span>
                        )}
                        {img.gpu_required && (
                          <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded">
                            GPU
                          </span>
                        )}
                      </div>
                      <div className="mt-1 ml-1 text-xs text-gray-500 dark:text-slate-400 font-mono">{img.registry_url}</div>
                      {img.description && (
                        <div className="mt-1 ml-1 text-xs text-gray-600 dark:text-slate-400">{img.description}</div>
                      )}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        ) : (
          /* No restriction: tab UI showing all images */
          <>
            <div className="flex border-b border-gray-200 dark:border-slate-700 mb-3">
              <button
                type="button"
                onClick={() => setActiveTab('app')}
                className={`px-3 md:px-4 py-2 text-xs md:text-sm border-b-2 transition-colors ${
                  activeTab === 'app'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-medium'
                    : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {t('appImages')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('system')}
                className={`px-3 md:px-4 py-2 text-xs md:text-sm border-b-2 transition-colors ${
                  activeTab === 'system'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-medium'
                    : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {t('systemImages')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('custom')}
                className={`px-3 md:px-4 py-2 text-xs md:text-sm border-b-2 transition-colors ${
                  activeTab === 'custom'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-medium'
                    : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {t('customImages')}
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredImages.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-slate-400 py-2">暂无可用镜像</p>
              ) : (
                filteredImages.map((img) => (
                  <label
                    key={img.id}
                    className={`block p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedImageId === img.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="image"
                        value={img.id}
                        checked={selectedImageId === img.id}
                        onChange={(e) => setSelectedImageId(Number(e.target.value))}
                        className="mt-1 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-900 dark:text-white">{img.name}</span>
                          {img.version && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded">
                              {img.version}
                            </span>
                          )}
                          {img.gpu_required && (
                            <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded">
                              GPU
                            </span>
                          )}
                        </div>
                        <div className="mt-1 ml-1 text-xs text-gray-500 dark:text-slate-400 font-mono">{img.registry_url}</div>
                        {img.description && (
                          <div className="mt-1 ml-1 text-xs text-gray-600 dark:text-slate-400">{img.description}</div>
                        )}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Section 2: Compute Resources */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-4 md:p-5 shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
            {t('computeResources')}
          </label>
          <button
            type="button"
            onClick={() => {
              const selectedImage = images.find(img => img.id === selectedImageId);
              const rec = selectedImage?.recommended_resources;
              setCpu(String(application.recommended_cpu ?? rec?.cpu ?? user?.cpu_quota ?? 2));
              setMemory(String(application.recommended_memory ?? rec?.memory ?? user?.memory_quota ?? 4));
              setGpu(String(application.recommended_gpu ?? rec?.gpu ?? 0));
              toast.success('已应用推荐配额');
            }}
            className="text-xs px-3 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800 transition-colors"
          >
            应用推荐配额
          </button>
        </div>

        {/* Remaining Quota */}
        <div className="bg-blue-50 dark:bg-blue-900 rounded-md p-3 mb-3 text-xs md:text-sm text-blue-700 dark:text-blue-300">
          {t('remainingQuota')} — CPU: {cpuRemaining} {t('cores')}, {t('memory')}: {memRemaining} GB, GPU: {gpuRemaining}
        </div>

        {/* Resource Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              vCPU（核）{application.max_cpu != null && <span className="ml-1 text-gray-400 font-normal">最大 {application.max_cpu}</span>}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={cpu}
              onChange={(e) => setCpu(e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 text-gray-900 dark:text-white ${
                application.max_cpu != null && parseFloat(cpu) > application.max_cpu
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-gray-300 dark:border-slate-600'
              }`}
            />
            {application.max_cpu != null && parseFloat(cpu) > application.max_cpu && (
              <p className="mt-1 text-xs text-red-500">超出最大限制 {application.max_cpu} 核</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('memoryGB')}{application.max_memory != null && <span className="ml-1 text-gray-400 font-normal">最大 {application.max_memory} GiB</span>}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={memory}
              onChange={(e) => setMemory(e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 text-gray-900 dark:text-white ${
                application.max_memory != null && parseFloat(memory) > application.max_memory
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-gray-300 dark:border-slate-600'
              }`}
            />
            {application.max_memory != null && parseFloat(memory) > application.max_memory && (
              <p className="mt-1 text-xs text-red-500">超出最大限制 {application.max_memory} GiB</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('gpu')}{application.max_gpu != null && <span className="ml-1 text-gray-400 font-normal">最大 {application.max_gpu}</span>}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={gpu}
              onChange={(e) => setGpu(e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 text-gray-900 dark:text-white ${
                application.max_gpu != null && parseInt(gpu, 10) > application.max_gpu
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-gray-300 dark:border-slate-600'
              }`}
            />
            {application.max_gpu != null && parseInt(gpu, 10) > application.max_gpu && (
              <p className="mt-1 text-xs text-red-500">超出最大限制 {application.max_gpu} 个</p>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: User Config */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-4 md:p-5 shadow-sm border border-gray-200 dark:border-slate-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
          {t('userConfig') || '用户配置'}
        </label>

        {/* Root user row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('rootUser') || 'root 用户'}
            </label>
            <input
              type="text"
              value="root"
              readOnly
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 cursor-default"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('rootPassword') || 'root 密码'}
            </label>
            <div className="relative">
              <input
                type={showRootPassword ? 'text' : 'password'}
                value={rootPassword}
                onChange={(e) => setRootPassword(e.target.value)}
                placeholder={t('passwordAutoGenerate') || '留空则自动生成'}
                className="w-full px-3 py-2 pr-9 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowRootPassword(!showRootPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
              >
                {showRootPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>

        {/* Sync user toggle */}
        <div className="flex items-center gap-2 border-t border-gray-200 dark:border-slate-700 pt-3">
          <input
            type="checkbox"
            id="syncUser"
            checked={syncUser}
            onChange={(e) => handleSyncUserChange(e.target.checked)}
            className="rounded border-gray-300 dark:border-slate-600"
          />
          <label htmlFor="syncUser" className="text-sm text-gray-700 dark:text-slate-300 cursor-pointer select-none">
            {t('syncUserToContainer') || '同步用户到容器'}
          </label>
        </div>

        {syncUser && (
          <div className="space-y-3 pl-6 border-l-2 border-blue-200 dark:border-blue-800 mt-3">
            {/* Warning: cluster account not activated */}
            {(userUid === null || userGid === null) && (
              <div className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-600/50 dark:bg-yellow-900/20 dark:text-yellow-300">
                <TriangleAlert size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  您尚未开通 HAI 算力集群账号，无法使用同步用户到容器功能，请前往{' '}
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
            {/* User Info Display (Read-only) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  {t('username') || '用户名'}
                </label>
                <input
                  type="text"
                  value={clusterUsername || user?.username || ''}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 cursor-default"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  UID
                </label>
                <input
                  type="text"
                  value={userUid !== null ? userUid : ''}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 cursor-default"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  GID
                </label>
                <input
                  type="text"
                  value={userGid !== null ? userGid : ''}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 cursor-default"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  {t('homeDirectory') || '家目录'}
                </label>
                <input
                  type="text"
                  value={userHomeDir || ''}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 cursor-default"
                />
              </div>
            </div>

            {/* User password */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                {t('userPassword') || '用户密码'}
              </label>
              <div className="relative">
                <input
                  type={showUserPassword ? 'text' : 'password'}
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder={t('userPasswordPlaceholder') || '留空则与root密码相同'}
                  className="w-full px-3 py-2 pr-9 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowUserPassword(!showUserPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                >
                  {showUserPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Enable sudo checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enableSudo"
                checked={enableSudo}
                onChange={(e) => setEnableSudo(e.target.checked)}
                className="rounded border-gray-300 dark:border-slate-600"
              />
              <label htmlFor="enableSudo" className="text-sm text-gray-700 dark:text-slate-300">
                {t('enableSudo') || '启用 sudo'}
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Storage Config - Volume Mounts */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-4 md:p-5 shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            {t('storageConfig')}
          </label>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-1.5 ${!syncUser ? 'opacity-40 cursor-not-allowed' : ''}`}>
              <input
                type="checkbox"
                id="mountHomeDir"
                checked={mountHomeDir}
                disabled={!syncUser}
                onChange={(e) => handleMountHomeDirChange(e.target.checked)}
                className="rounded border-gray-300 dark:border-slate-600 disabled:cursor-not-allowed"
              />
              <label htmlFor="mountHomeDir" className={`text-sm text-gray-700 dark:text-slate-300 select-none ${syncUser ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                挂载家目录
              </label>
            </div>
            <div className={`flex items-center gap-1.5 ${!syncUser ? 'opacity-40 cursor-not-allowed' : ''}`}>
              <input
                type="checkbox"
                id="mountDataDir"
                checked={mountDataDir}
                disabled={!syncUser}
                onChange={(e) => handleMountDataDirChange(e.target.checked)}
                className="rounded border-gray-300 dark:border-slate-600 disabled:cursor-not-allowed"
              />
              <label htmlFor="mountDataDir" className={`text-sm text-gray-700 dark:text-slate-300 select-none ${syncUser ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                挂载数据目录
              </label>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden mb-3">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_2rem] bg-gray-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-gray-600 dark:text-slate-400 gap-2">
            <span>共享存储路径</span>
            <span>容器挂载路径</span>
            <span />
          </div>

          {/* Rows */}
          {volumeMounts.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-400 dark:text-slate-500 text-center">
              暂无挂载点
            </div>
          ) : (
            volumeMounts.map((mount, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_2rem] gap-2 px-3 py-2 border-t border-gray-200 dark:border-slate-700 items-center"
              >
                <input
                  type="text"
                  value={mount.host_path}
                  onChange={(e) => {
                    const updated = [...volumeMounts];
                    updated[index] = { ...updated[index], host_path: e.target.value };
                    setVolumeMounts(updated);
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  value={mount.mount_path}
                  onChange={(e) => {
                    const updated = [...volumeMounts];
                    updated[index] = { ...updated[index], mount_path: e.target.value };
                    setVolumeMounts(updated);
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setVolumeMounts(volumeMounts.filter((_, i) => i !== index))}
                  className="flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            ))
          )}
        </div>

      </div>

      {/* Section 5: Network Config */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-4 md:p-5 shadow-sm border border-gray-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            {t('networkConfig')}
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="checkbox"
              id="useIndependentIp"
              checked={useIndependentIp}
              onChange={(e) => handleUseIndependentIpChange(e.target.checked)}
              className="rounded border-gray-300 dark:border-slate-600"
            />
            <label htmlFor="useIndependentIp" className="text-sm text-gray-700 dark:text-slate-300 cursor-pointer select-none">
              {t('useIndependentIp')}
            </label>
          </div>
        </div>

        {/* IP info - always visible */}
        <div className="mb-3">
          {ipAllocation?.has_ip ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-gray-900 dark:text-white">{ipAllocation.ip_address}</span>
              {ipAllocation.allocated_at && (
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  {t('allocatedAt')}: {new Date(ipAllocation.allocated_at).toLocaleString()}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 dark:text-slate-400">{t('noIpAllocated')}</span>
              {useIndependentIp && (
                <button
                  type="button"
                  onClick={handleAllocateIp}
                  disabled={allocatingIp}
                  className="text-xs px-2 py-0.5 rounded border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {allocatingIp ? t('allocating') : t('allocateIp')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* SSH Enable - only interactive when useIndependentIp */}
        <div className={`flex items-center gap-2 border-t border-gray-200 dark:border-slate-700 pt-3 ${!useIndependentIp ? 'opacity-40' : ''}`}>
          <input
            type="checkbox"
            id="ssh"
            checked={sshEnabled}
            disabled={!useIndependentIp}
            onChange={(e) => setSshEnabled(e.target.checked)}
            className="rounded border-gray-300 dark:border-slate-600 disabled:cursor-not-allowed"
          />
          <label htmlFor="ssh" className={`text-sm text-gray-700 dark:text-slate-300 ${useIndependentIp ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
            {t('enableSSH')}
          </label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-4 md:p-5 shadow-sm border border-gray-200 dark:border-slate-700">
        {syncUser && (userUid === null || userGid === null) && (
          <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-3">
            请先开通 HAI 算力集群账号，再保存配置。
          </p>
        )}
        <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || (syncUser && (userUid === null || userGid === null))}
          title={syncUser && (userUid === null || userGid === null) ? '请先开通 HAI 算力集群账号' : undefined}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={18} />
          <span>{saving ? t('saving') : t('save')}</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X size={18} />
          <span>{t('cancel')}</span>
        </button>
        </div>
      </div>
    </form>
  );
}
