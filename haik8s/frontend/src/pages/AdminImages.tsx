import { useEffect, useState } from 'react';
import client from '../api/client';
import type { Image } from '../types';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';

export default function AdminImages() {
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState('');
  const [registryUrl, setRegistryUrl] = useState('');
  const [description, setDescription] = useState('');
  const [gpuRequired, setGpuRequired] = useState(false);

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.post('/images', {
        name,
        registry_url: registryUrl,
        description,
        gpu_required: gpuRequired,
      });
      toast.success('Image added');
      setShowForm(false);
      setName('');
      setRegistryUrl('');
      setDescription('');
      setGpuRequired(false);
      fetchImages();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to add image');
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

  if (loading) return <p className="text-gray-500 dark:text-gray-400">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Images</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium cursor-pointer"
        >
          {showForm ? 'Cancel' : 'Add Image'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 mb-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm dark:bg-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Registry URL
              </label>
              <input
                type="text"
                value={registryUrl}
                onChange={(e) => setRegistryUrl(e.target.value)}
                required
                placeholder="ubuntu:22.04"
                className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm dark:bg-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="gpu"
              checked={gpuRequired}
              onChange={(e) => setGpuRequired(e.target.checked)}
            />
            <label htmlFor="gpu" className="text-sm text-gray-700 dark:text-gray-300">
              GPU Required
            </label>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm cursor-pointer"
          >
            Add Image
          </button>
        </form>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 text-left text-gray-500 dark:text-gray-400 uppercase text-xs">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Registry URL</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">GPU</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {images.map((img) => (
              <tr key={img.id}>
                <td className="px-4 py-3 font-medium dark:text-white">{img.name}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                  {img.registry_url}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {img.description || '-'}
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
                  <button
                    onClick={() => handleDelete(img.id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
