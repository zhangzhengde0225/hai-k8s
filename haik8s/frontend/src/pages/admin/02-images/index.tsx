// 管理员-镜像管理页面：查看、添加、删除平台可用的容器镜像。
// Author: Zhengde Zhang (zhangzhengde0225@gmail.com)
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../../api/client';
import type { Image } from '../../../types';
import toast from 'react-hot-toast';
import { Trash2, Edit } from 'lucide-react';

export default function AdminImages() {
  const navigate = useNavigate();
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <p className="text-gray-500 dark:text-slate-400">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Images</h2>
        <button
          onClick={() => navigate('/admin/images/add')}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium cursor-pointer"
        >
          Add Image
        </button>
      </div>

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
                      onClick={() => navigate('/admin/images/add', { state: { image: img } })}
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
