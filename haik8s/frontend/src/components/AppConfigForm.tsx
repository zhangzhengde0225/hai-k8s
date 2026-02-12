import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Save, X, Lightbulb } from 'lucide-react';
import { useAuthStore } from '../auth/AuthContext';
import client from '../api/client';
import type { Image, SaveConfigData } from '../types';

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

  // Resource fields
  const [cpu, setCpu] = useState(2);
  const [memory, setMemory] = useState(4);
  const [gpu, setGpu] = useState(0);
  const [sshEnabled, setSshEnabled] = useState(true); // Default enabled
  const [storagePath, setStoragePath] = useState('');

  // Load images and existing config
  useEffect(() => {
    client.get('/images').then((res) => {
      setImages(res.data);

      // If editing existing config, load it
      if (application.config) {
        const config = application.config;
        setSelectedImageId(config.image_id);
        setCpu(config.cpu_request);
        setMemory(config.memory_request);
        setGpu(config.gpu_request);
        setSshEnabled(config.ssh_enabled);
        if (config.storage_path) {
          setStoragePath(config.storage_path);
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

  // Filter images by active tab
  const filteredImages = useMemo(() => {
    return images.filter(img => categorizeImage(img) === activeTab);
  }, [images, activeTab]);

  // Auto-generate storage path when image is selected or application changes (only for new configs)
  useEffect(() => {
    // Skip auto-generation if editing existing config with a storage path
    if (application.config?.storage_path) {
      return;
    }

    if (selectedImageId || application) {
      // Extract username (remove email suffix if present)
      let username = user?.username || 'user';
      if (user?.email && user.email.includes('@')) {
        username = user.email.split('@')[0];
      }

      // Generate storage path based on application
      let generatedPath: string;

      if (application.id === 'openclaw') {
        // OpenClaw: /aifs/user/home/<username>/.hai-openclaw
        generatedPath = `/aifs/user/home/${username}/.hai-openclaw`;
      } else if (application.id === 'opendrsai') {
        // OpenDrSai: /aifs/user/home/<username>/.hai-opendrsai
        generatedPath = `/aifs/user/home/${username}/.hai-opendrsai`;
      } else {
        // Default: /aifs/user/home/<username>/<imagename-lowercase>
        const selectedImage = images.find(img => img.id === selectedImageId);
        const imageName = selectedImage ? selectedImage.name.toLowerCase() : 'data';
        generatedPath = `/aifs/user/home/${username}/${imageName}`;
      }

      setStoragePath(generatedPath);
    }
  }, [selectedImageId, images, user, application]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!selectedImageId) {
      toast.error(t('imageRequired') || '请选择镜像');
      return;
    }

    setSaving(true);
    try {
      await onSaveConfig({
        imageId: selectedImageId as number,
        cpu,
        memory,
        gpu,
        sshEnabled,
        storagePath,
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
    openclaw: `OpenClaw是一款开源的AI 助手，能通过消息应用接收指令并直接执行任务。请您在使用前对该软件的安全性与稳定性进行充分了解，并确保遵循该软件的许可协议。`,
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
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('imageSelection')}
        </label>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-3">
          <button
            type="button"
            onClick={() => setActiveTab('app')}
            className={`px-3 md:px-4 py-2 text-xs md:text-sm border-b-2 transition-colors ${
              activeTab === 'app'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-medium'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
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
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
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
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {t('customImages')}
          </button>
        </div>

        {/* Image Selection (Radio List) */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filteredImages.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
              暂无可用镜像
            </p>
          ) : (
            filteredImages.map((img) => (
              <label
                key={img.id}
                className={`block p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedImageId === img.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-gray-700'
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
                      <span className="font-medium text-sm text-gray-900 dark:text-white">
                        {img.name}
                      </span>
                      {img.version && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded">
                          {img.version}
                        </span>
                      )}
                      {img.gpu_required && (
                        <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded">
                          GPU
                        </span>
                      )}
                    </div>
                    <div className="mt-1 ml-1 text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {img.registry_url}
                    </div>
                    {img.description && (
                      <div className="mt-1 ml-1 text-xs text-gray-600 dark:text-gray-400">
                        {img.description}
                      </div>
                    )}
                  </div>
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      {/* Section 2: Compute Resources */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('computeResources')}
        </label>

        {/* Remaining Quota */}
        <div className="bg-blue-50 dark:bg-blue-900 rounded-md p-3 mb-3 text-xs md:text-sm text-blue-700 dark:text-blue-300">
          {t('remainingQuota')} — CPU: {cpuRemaining} {t('cores')}, {t('memory')}: {memRemaining} GB, GPU: {gpuRemaining}
        </div>

        {/* Recommended Resources Display */}
        {selectedImageId && (() => {
          const selectedImage = images.find(img => img.id === selectedImageId);
          if (selectedImage?.recommended_resources) {
            const { cpu: recCpu, memory: recMem, gpu: recGpu } = selectedImage.recommended_resources;
            return (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-3">
                <div className="flex items-start gap-2">
                  <Lightbulb size={16} className="text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                      推荐配置
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      CPU: {recCpu} 核 | 内存: {recMem} GB | GPU: {recGpu}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setCpu(recCpu || 2);
                        setMemory(recMem || 4);
                        setGpu(recGpu || 0);
                        toast.success('已应用推荐配置');
                      }}
                      className="mt-2 text-xs px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                    >
                      应用推荐配置
                    </button>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Resource Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              vCPU（核）
            </label>
            <input
              type="number"
              min={0.1}
              max={32}
              step={0.1}
              value={cpu}
              onChange={(e) => setCpu(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('memoryGB')}
            </label>
            <input
              type="number"
              min={0.5}
              max={128}
              step={0.5}
              value={memory}
              onChange={(e) => setMemory(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('gpu')}
            </label>
            <input
              type="number"
              min={0}
              max={8}
              step={1}
              value={gpu}
              onChange={(e) => setGpu(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Network Config */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('networkConfig')}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ssh"
            checked={sshEnabled}
            onChange={(e) => setSshEnabled(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          <label htmlFor="ssh" className="text-sm text-gray-700 dark:text-gray-300">
            {t('enableSSH')}
          </label>
        </div>
      </div>

      {/* Section 4: Storage Config */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('storageConfig')}
        </label>
        <input
          type="text"
          value={storagePath}
          readOnly
          placeholder={t('storagePathPlaceholder')}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-default"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t('storagePathHint')}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={18} />
          <span>{saving ? t('saving') : t('save')}</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X size={18} />
          <span>{t('cancel')}</span>
        </button>
        </div>
      </div>
    </form>
  );
}
