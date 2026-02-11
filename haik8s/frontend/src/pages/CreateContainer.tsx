import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import client from '../api/client';
import { useAuthStore } from '../auth/AuthContext';
import type { Image } from '../types';
import toast from 'react-hot-toast';

// Helper function to sanitize name for Kubernetes
const sanitizeK8sName = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric with hyphen
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

// Extract username without email suffix
const getUsernameWithoutEmail = (user: { username: string; email: string } | null): string => {
  if (!user) return '';

  // Try to extract from email first (before @)
  if (user.email && user.email.includes('@')) {
    return user.email.split('@')[0];
  }

  // Fall back to username
  return user.username;
};

export default function CreateContainer() {
  const { t } = useTranslation('container');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [images, setImages] = useState<Image[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [imageId, setImageId] = useState<number | ''>('');
  const [cpu, setCpu] = useState(1);
  const [memory, setMemory] = useState(2);
  const [gpu, setGpu] = useState(0);
  const [sshEnabled, setSshEnabled] = useState(false);
  const [nameModified, setNameModified] = useState(false); // Track if user manually modified name

  useEffect(() => {
    client.get('/images').then((res) => setImages(res.data));
  }, []);

  // Auto-generate container name when image is selected
  useEffect(() => {
    if (imageId && !nameModified) {
      const selectedImage = images.find(img => img.id === imageId);
      if (selectedImage) {
        const imageName = selectedImage.name;
        // Only use image name - backend will add username prefix automatically
        const generatedName = sanitizeK8sName(imageName);
        setName(generatedName);
      }
    }
  }, [imageId, images, nameModified]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !imageId) {
      toast.error(t('nameAndImageRequired'));
      return;
    }

    // Validate K8s-compatible name
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name)) {
      toast.error(t('invalidName'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await client.post('/containers', {
        name,
        image_id: imageId,
        cpu_request: cpu,
        memory_request: memory,
        gpu_request: gpu,
        ssh_enabled: sshEnabled,
      });
      toast.success(t('containerCreated'));
      navigate(`/containers/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const cpuRemaining = (user?.cpu_quota ?? 0) - (user?.cpu_used ?? 0);
  const memRemaining = (user?.memory_quota ?? 0) - (user?.memory_used ?? 0);
  const gpuRemaining = (user?.gpu_quota ?? 0) - (user?.gpu_used ?? 0);

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t('createContainerResource')}
      </h2>

      <div className="bg-blue-50 dark:bg-blue-900 rounded-md p-3 mb-6 text-sm text-blue-700 dark:text-blue-300">
        {t('remainingQuota')} — {t('cpu')}: {cpuRemaining} {t('cores')}, {t('memory')}: {memRemaining} GB, {t('gpu')}: {gpuRemaining}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('containerName')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameModified(true); // Mark as manually modified
            }}
            placeholder={t('containerNamePlaceholder')}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-900 dark:text-white"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('containerNameHint')}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('image')}
          </label>
          <select
            value={imageId}
            onChange={(e) => setImageId(Number(e.target.value))}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-900 dark:text-white"
          >
            <option value="">{t('selectImage')}</option>
            {images.map((img) => (
              <option key={img.id} value={img.id}>
                {img.name} ({img.registry_url})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('cpuCores')}
            </label>
            <input
              type="number"
              min={0.1}
              max={32}
              step={0.1}
              value={cpu}
              onChange={(e) => setCpu(Number(e.target.value))}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('memoryGB')}
            </label>
            <input
              type="number"
              min={0.5}
              max={128}
              step={0.5}
              value={memory}
              onChange={(e) => setMemory(Number(e.target.value))}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('gpu')}
            </label>
            <input
              type="number"
              min={0}
              max={8}
              step={1}
              value={gpu}
              onChange={(e) => setGpu(Number(e.target.value))}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ssh"
            checked={sshEnabled}
            onChange={(e) => setSshEnabled(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="ssh" className="text-sm text-gray-700 dark:text-gray-300">
            {t('enableSSH')}
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium cursor-pointer"
        >
          {submitting ? t('creating') : t('createContainer')}
        </button>
      </form>
    </div>
  );
}
