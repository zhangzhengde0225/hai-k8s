// 应用基本配置子组件：编辑应用ID、名称、版本、镜像前缀、描述、默认副本数、推荐资源配额（CPU/内存/GPU）、镜像配置（多版本）及可见性；OpenClaw应用额外支持模型配置模板。
// Author: Zhengde Zhang (zhangzhengde0225@gmail.com)
import { Plus, Trash2 } from 'lucide-react';
import type { ApplicationDefinition, AvailableImage } from '../../../types';

interface Props {
  application: ApplicationDefinition;
  editData: Record<string, any>;
  setEditData: (data: Record<string, any>) => void;
  isEditing: boolean;
}

export default function BasicConfig({ application, editData, setEditData, isEditing }: Props) {
  const updateField = (field: string, value: any) => {
    setEditData({ ...editData, [field]: value });
  };

  const images: AvailableImage[] = editData.available_images || [];

  const addImage = () => {
    const newImage: AvailableImage = {
      tag: '',
      registry_url: '',
      description: '',
      is_default: images.length === 0,
    };
    updateField('available_images', [...images, newImage]);
  };

  const updateImage = (index: number, field: keyof AvailableImage, value: any) => {
    const updated = images.map((img, i) => {
      if (i !== index) {
        // If setting is_default to true, clear others
        return field === 'is_default' && value ? { ...img, is_default: false } : img;
      }
      return { ...img, [field]: value };
    });
    updateField('available_images', updated);
  };

  const removeImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    // If removed image was default, set first remaining as default
    if (images[index].is_default && updated.length > 0) {
      updated[0] = { ...updated[0], is_default: true };
    }
    updateField('available_images', updated);
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">基本信息</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">应用ID *</label>
            <input
              type="text"
              value={editData.app_id || ''}
              onChange={(e) => updateField('app_id', e.target.value)}
              disabled={!isEditing || !!application.id}
              placeholder="e.g., openclaw"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">应用名称 *</label>
            <input
              type="text"
              value={editData.name || ''}
              onChange={(e) => updateField('name', e.target.value)}
              disabled={!isEditing}
              placeholder="e.g., OpenClaw"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">版本</label>
            <input
              type="text"
              value={editData.version || ''}
              onChange={(e) => updateField('version', e.target.value)}
              disabled={!isEditing}
              placeholder="v1.0.0"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">镜像前缀 *</label>
            <input
              type="text"
              value={editData.image_prefix || ''}
              onChange={(e) => updateField('image_prefix', e.target.value)}
              disabled={!isEditing}
              placeholder="e.g., hai-openclaw"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">描述</label>
            <textarea
              value={editData.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              disabled={!isEditing}
              placeholder="Application description"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed resize-none"
            />
          </div>
        </div>
      </div>

      {/* Image Config */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">镜像配置</h3>
          {isEditing && (
            <button
              onClick={addImage}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <Plus size={12} />
              添加版本
            </button>
          )}
        </div>
        {images.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-slate-500 py-2">
            暂无镜像版本，{isEditing ? '点击「添加版本」配置可用镜像。' : '请编辑后添加。'}
          </p>
        ) : (
          <div className="space-y-3">
            {images.map((img, index) => (
              <div
                key={index}
                className="border border-gray-200 dark:border-slate-700 rounded-lg p-3 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id={`default_img_${index}`}
                      name="default_image"
                      checked={img.is_default}
                      onChange={() => updateImage(index, 'is_default', true)}
                      disabled={!isEditing}
                      className="w-3.5 h-3.5 text-blue-600 disabled:cursor-not-allowed"
                    />
                    <label
                      htmlFor={`default_img_${index}`}
                      className="text-xs text-gray-600 dark:text-slate-400 cursor-pointer"
                    >
                      {img.is_default ? '默认版本' : '设为默认'}
                    </label>
                  </div>
                  {isEditing && (
                    <button
                      onClick={() => removeImage(index)}
                      className="p-1 text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">版本标签 *</label>
                    <input
                      type="text"
                      value={img.tag}
                      onChange={(e) => updateImage(index, 'tag', e.target.value)}
                      disabled={!isEditing}
                      placeholder="e.g., v1.0.0"
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">镜像地址 *</label>
                    <input
                      type="text"
                      value={img.registry_url}
                      onChange={(e) => updateImage(index, 'registry_url', e.target.value)}
                      disabled={!isEditing}
                      placeholder="e.g., harbor.ihep.ac.cn/hai/hai-openclaw:v1.0.0"
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">描述</label>
                    <input
                      type="text"
                      value={img.description}
                      onChange={(e) => updateImage(index, 'description', e.target.value)}
                      disabled={!isEditing}
                      placeholder="e.g., 稳定版"
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Default Config */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">默认算力配置</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">最大实例数</label>
            <input
              type="number"
              min="1"
              value={editData.default_replicas || 1}
              onChange={(e) => updateField('default_replicas', parseInt(e.target.value) || 1)}
              disabled={!isEditing}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">推荐CPU</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={editData.recommended_cpu || 2.0}
              onChange={(e) => updateField('recommended_cpu', parseFloat(e.target.value) || 2.0)}
              disabled={!isEditing}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">推荐内存 (GiB)</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={editData.recommended_memory || 4.0}
              onChange={(e) => updateField('recommended_memory', parseFloat(e.target.value) || 4.0)}
              disabled={!isEditing}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">推荐GPU</label>
            <input
              type="number"
              min="0"
              value={editData.recommended_gpu || 0}
              onChange={(e) => updateField('recommended_gpu', parseInt(e.target.value) || 0)}
              disabled={!isEditing}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">最大CPU</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={editData.max_cpu ?? ''}
              onChange={(e) => updateField('max_cpu', e.target.value === '' ? null : parseFloat(e.target.value))}
              disabled={!isEditing}
              placeholder="不限"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">最大内存 (GiB)</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={editData.max_memory ?? ''}
              onChange={(e) => updateField('max_memory', e.target.value === '' ? null : parseFloat(e.target.value))}
              disabled={!isEditing}
              placeholder="不限"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">最大GPU</label>
            <input
              type="number"
              min="0"
              value={editData.max_gpu ?? ''}
              onChange={(e) => updateField('max_gpu', e.target.value === '' ? null : parseInt(e.target.value))}
              disabled={!isEditing}
              placeholder="不限"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <input
            type="checkbox"
            id="is_visible"
            checked={editData.is_visible || false}
            onChange={(e) => updateField('is_visible', e.target.checked)}
            disabled={!isEditing}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
          />
          <label htmlFor="is_visible" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            可见（显示在应用中心）
          </label>
        </div>
      </div>
    </div>
  );
}

