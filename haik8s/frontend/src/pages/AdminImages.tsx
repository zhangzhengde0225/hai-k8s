import { useEffect, useState } from 'react';
import client from '../api/client';
import type { Image } from '../types';
import toast from 'react-hot-toast';
import { Trash2, Edit, Plus, X } from 'lucide-react';

// Predefined tags for easy selection
const PREDEFINED_TAGS = [
  'openclaw',
  'opendrsai',
  'gpu',
  'production',
  'development',
  'system',
];

export default function AdminImages() {
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingImage, setEditingImage] = useState<Image | null>(null);

  // Basic fields
  const [name, setName] = useState('');
  const [registryUrl, setRegistryUrl] = useState('');
  const [description, setDescription] = useState('');
  const [gpuRequired, setGpuRequired] = useState(false);

  // Enhanced fields
  const [version, setVersion] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);
  const [ports, setPorts] = useState('');
  const [recommendedCpu, setRecommendedCpu] = useState('');
  const [recommendedMemory, setRecommendedMemory] = useState('');
  const [recommendedGpu, setRecommendedGpu] = useState('');

  const fetchImages = () => {
    client
      .get('/images')
      .then((res) => setImages(res.data))
      .catch(() => toast.error('Failed to load images'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const resetForm = () => {
    setName('');
    setRegistryUrl('');
    setDescription('');
    setGpuRequired(false);
    setVersion('');
    setTags([]);
    setEnvVars([]);
    setPorts('');
    setRecommendedCpu('');
    setRecommendedMemory('');
    setRecommendedGpu('');
    setEditingImage(null);
  };

  const handleEdit = (image: Image) => {
    setEditingImage(image);
    setName(image.name);
    setRegistryUrl(image.registry_url);
    setDescription(image.description || '');
    setGpuRequired(image.gpu_required);
    setVersion(image.version || '');
    setTags(image.tags || []);

    // Convert env_vars object to array
    if (image.env_vars) {
      setEnvVars(Object.entries(image.env_vars).map(([key, value]) => ({ key, value })));
    } else {
      setEnvVars([]);
    }

    setPorts(image.ports ? image.ports.join(', ') : '');
    setRecommendedCpu(image.recommended_resources?.cpu?.toString() || '');
    setRecommendedMemory(image.recommended_resources?.memory?.toString() || '');
    setRecommendedGpu(image.recommended_resources?.gpu?.toString() || '');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Prepare payload
      const payload: any = {
        name,
        registry_url: registryUrl,
        description: description || null,
        gpu_required: gpuRequired,
        version: version || null,
        tags: tags.length > 0 ? tags : null,
      };

      // Convert env vars array to object
      if (envVars.length > 0) {
        const envVarsObj: Record<string, string> = {};
        envVars.forEach(({ key, value }) => {
          if (key) envVarsObj[key] = value;
        });
        payload.env_vars = Object.keys(envVarsObj).length > 0 ? envVarsObj : null;
      } else {
        payload.env_vars = null;
      }

      // Parse ports
      if (ports.trim()) {
        payload.ports = ports.split(',').map((p) => parseInt(p.trim())).filter((p) => !isNaN(p));
      } else {
        payload.ports = null;
      }

      // Parse recommended resources
      const hasRecommendedResources = recommendedCpu || recommendedMemory || recommendedGpu;
      if (hasRecommendedResources) {
        payload.recommended_resources = {
          cpu: recommendedCpu ? parseFloat(recommendedCpu) : 0,
          memory: recommendedMemory ? parseFloat(recommendedMemory) : 0,
          gpu: recommendedGpu ? parseFloat(recommendedGpu) : 0,
        };
      } else {
        payload.recommended_resources = null;
      }

      if (editingImage) {
        // Update existing image
        await client.put(`/images/${editingImage.id}`, payload);
        toast.success('Image updated');
      } else {
        // Create new image
        await client.post('/images', payload);
        toast.success('Image added');
      }

      setShowForm(false);
      resetForm();
      fetchImages();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save image');
    }
  };

  const handleDelete = async (imageId: number) => {
    if (!confirm('Deactivate this image?')) return;
    try {
      await client.delete(`/images/${imageId}`);
      toast.success('Image deactivated');
      fetchImages();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to deactivate');
    }
  };

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envVars];
    updated[index][field] = value;
    setEnvVars(updated);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  if (loading) return <p className="text-gray-500 dark:text-slate-400">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Images</h2>
        <button
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              resetForm();
            } else {
              setShowForm(true);
            }
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium cursor-pointer"
        >
          {showForm ? 'Cancel' : 'Add Image'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 rounded-lg shadow p-5 mb-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingImage ? 'Edit Image' : 'Add New Image'}
          </h3>

          {/* Basic Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border border-gray-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Registry URL *
              </label>
              <input
                type="text"
                value={registryUrl}
                onChange={(e) => setRegistryUrl(e.target.value)}
                required
                placeholder="ubuntu:22.04"
                className="w-full border border-gray-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-gray-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Version
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="v1.0.0"
                className="w-full border border-gray-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          {/* GPU Required */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="gpu"
              checked={gpuRequired}
              onChange={(e) => setGpuRequired(e.target.checked)}
            />
            <label htmlFor="gpu" className="text-sm text-gray-700 dark:text-slate-300">
              GPU Required
            </label>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 text-xs rounded-full cursor-pointer ${
                    tags.includes(tag)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Ports */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Ports (comma-separated)
            </label>
            <input
              type="text"
              value={ports}
              onChange={(e) => setPorts(e.target.value)}
              placeholder="8080, 8443"
              className="w-full border border-gray-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm dark:bg-slate-950 dark:text-white"
            />
          </div>

          {/* Environment Variables */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Environment Variables
              </label>
              <button
                type="button"
                onClick={addEnvVar}
                className="text-blue-600 dark:text-blue-400 text-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Add
              </button>
            </div>
            {envVars.map((env, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={env.key}
                  onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                  placeholder="KEY"
                  className="flex-1 border border-gray-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm dark:bg-slate-950 dark:text-white"
                />
                <input
                  type="text"
                  value={env.value}
                  onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                  placeholder="VALUE"
                  className="flex-1 border border-gray-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm dark:bg-slate-950 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => removeEnvVar(index)}
                  className="text-red-600 dark:text-red-400 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>

          {/* Recommended Resources */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Recommended Resources
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">
                  CPU (cores)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={recommendedCpu}
                  onChange={(e) => setRecommendedCpu(e.target.value)}
                  placeholder="2.0"
                  className="w-full border border-gray-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">
                  Memory (GB)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={recommendedMemory}
                  onChange={(e) => setRecommendedMemory(e.target.value)}
                  placeholder="4.0"
                  className="w-full border border-gray-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">
                  GPU
                </label>
                <input
                  type="number"
                  step="1"
                  value={recommendedGpu}
                  onChange={(e) => setRecommendedGpu(e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm cursor-pointer"
          >
            {editingImage ? 'Update Image' : 'Add Image'}
          </button>
        </form>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-950 text-left text-gray-500 dark:text-slate-400 uppercase text-xs">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Tags</th>
              <th className="px-4 py-3">Registry URL</th>
              <th className="px-4 py-3">GPU</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {images.map((img) => (
              <tr key={img.id}>
                <td className="px-4 py-3 font-medium dark:text-white">{img.name}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-slate-400">
                  {img.version || '-'}
                </td>
                <td className="px-4 py-3">
                  {img.tags && img.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {img.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-slate-400 font-mono text-xs">
                  {img.registry_url}
                </td>
                <td className="px-4 py-3">
                  {img.gpu_required ? (
                    <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full">
                      Yes
                    </span>
                  ) : (
                    <span className="dark:text-white">No</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(img)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-600 cursor-pointer"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(img.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
