// 管理员-镜像新增/编辑页面：以独立页面形式创建或编辑容器镜像配置。
// Author: Zhengde Zhang (zhangzhengde0225@gmail.com)
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../../../api/client';
import type { Image } from '../../../types';

const PREDEFINED_TAGS = [
  'openclaw',
  'opendrsai',
  'gpu',
  'production',
  'development',
  'system',
];

export default function AddImage() {
  const navigate = useNavigate();
  const location = useLocation();
  const editingImage: Image | undefined = location.state?.image;
  const isEditing = !!editingImage;

  const [pullCommand, setPullCommand] = useState('');
  const [name, setName] = useState('');
  const [registryUrl, setRegistryUrl] = useState('');
  const [description, setDescription] = useState('');
  const [gpuRequired, setGpuRequired] = useState(false);
  const [version, setVersion] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (!editingImage) return;
    setName(editingImage.name);
    setRegistryUrl(editingImage.registry_url);
    setDescription(editingImage.description || '');
    setGpuRequired(editingImage.gpu_required);
    setVersion(editingImage.version || '');
    setTags(editingImage.tags || []);
  }, []);

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const parsePullCommand = (cmd: string) => {
    let imageRef = cmd.trim();
    if (imageRef.startsWith('docker pull ')) {
      imageRef = imageRef.slice('docker pull '.length).trim();
    }
    if (!imageRef) return;

    setRegistryUrl(imageRef);

    // 从路径最后一段提取镜像名（去掉 tag/digest 部分）
    const withoutDigest = imageRef.split('@')[0];
    const lastSegment = withoutDigest.split('/').pop() || '';
    const parsedName = lastSegment.split(':')[0];
    if (parsedName) setName(parsedName);

    // 提取版本：仅 :tag 格式，digest（@sha256:...）不填版本
    if (!imageRef.includes('@') && lastSegment.includes(':')) {
      setVersion(lastSegment.split(':')[1]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name,
        registry_url: registryUrl,
        description: description || null,
        gpu_required: gpuRequired,
        version: version || null,
        tags: tags.length > 0 ? tags : null,
      };

      if (isEditing) {
        await client.put(`/images/${editingImage!.id}`, payload);
        toast.success('Image updated');
      } else {
        await client.post('/images', payload);
        toast.success('Image added');
      }

      navigate('/admin/images');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save image');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/admin/images')}
          className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isEditing ? 'Edit Image' : 'Add New Image'}
        </h2>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 rounded-lg shadow p-6 space-y-4 max-w-3xl"
      >
        {/* Pull Command Parser */}
        {!isEditing && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Pull Command
            </label>
            <input
              type="text"
              value={pullCommand}
              onChange={(e) => {
                setPullCommand(e.target.value);
                parsePullCommand(e.target.value);
              }}
              placeholder="docker pull dockerhub.ihep.ac.cn/hepai/hai-openclaw@sha256:..."
              className="w-full border border-gray-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm dark:bg-slate-950 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
              粘贴拉取命令，自动解析到下方各字段
            </p>
          </div>
        )}

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

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm cursor-pointer"
          >
            {isEditing ? 'Update Image' : 'Add Image'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/images')}
            className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 text-sm cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
