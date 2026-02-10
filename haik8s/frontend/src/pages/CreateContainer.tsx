import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuthStore } from '../auth/AuthContext';
import type { Image } from '../types';
import toast from 'react-hot-toast';

export default function CreateContainer() {
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

  useEffect(() => {
    client.get('/images').then((res) => setImages(res.data));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !imageId) {
      toast.error('Name and image are required');
      return;
    }

    // Validate K8s-compatible name
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name)) {
      toast.error(
        'Name must be lowercase alphanumeric with hyphens, cannot start/end with hyphen'
      );
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
      toast.success('Container created');
      navigate(`/containers/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create container');
    } finally {
      setSubmitting(false);
    }
  };

  const cpuRemaining = (user?.cpu_quota ?? 0) - (user?.cpu_used ?? 0);
  const memRemaining = (user?.memory_quota ?? 0) - (user?.memory_used ?? 0);
  const gpuRemaining = (user?.gpu_quota ?? 0) - (user?.gpu_used ?? 0);

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Create Container
      </h2>

      <div className="bg-blue-50 rounded-md p-3 mb-6 text-sm text-blue-700">
        Remaining quota — CPU: {cpuRemaining} cores, Memory: {memRemaining} GB,
        GPU: {gpuRemaining}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 rounded-lg shadow">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Container Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-container"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Image
          </label>
          <select
            value={imageId}
            onChange={(e) => setImageId(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select an image</option>
            {images.map((img) => (
              <option key={img.id} value={img.id}>
                {img.name} ({img.registry_url})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CPU (cores)
            </label>
            <input
              type="number"
              min={0.1}
              max={32}
              step={0.1}
              value={cpu}
              onChange={(e) => setCpu(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Memory (GB)
            </label>
            <input
              type="number"
              min={0.5}
              max={128}
              step={0.5}
              value={memory}
              onChange={(e) => setMemory(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GPU
            </label>
            <input
              type="number"
              min={0}
              max={8}
              step={1}
              value={gpu}
              onChange={(e) => setGpu(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
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
          <label htmlFor="ssh" className="text-sm text-gray-700">
            Enable SSH access (allocates a NodePort)
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium cursor-pointer"
        >
          {submitting ? 'Creating...' : 'Create Container'}
        </button>
      </form>
    </div>
  );
}
