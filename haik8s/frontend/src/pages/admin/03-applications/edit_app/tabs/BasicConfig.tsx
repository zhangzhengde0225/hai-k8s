// 应用基本配置子组件：编辑应用ID、名称、版本、镜像前缀、描述、默认副本数、推荐资源配额（CPU/内存/GPU）、镜像配置（多版本）及可见性；OpenClaw应用额外支持模型配置模板。
// Author: Zhengde Zhang (zhangzhengde0225@gmail.com)
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import type { ApplicationDefinition, AvailableImage, Image } from '../../../../types';
import client from '../../../../../api/client';

interface Props {
  application: ApplicationDefinition;
  editData: Record<string, any>;
  setEditData: (data: Record<string, any>) => void;
  isEditing: boolean;
}

export default function BasicConfig({ application, editData, setEditData, isEditing }: Props) {
  const [allImages, setAllImages] = useState<Image[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    client.get('/images').then((res) => setAllImages(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const updateField = (field: string, value: any) => {
    setEditData({ ...editData, [field]: value });
  };

  const images: AvailableImage[] = editData.available_images || [];

  const addImageFromRegistry = (img: Image) => {
    updateField('available_images', [
      ...images,
      {
        image_id: img.id,
        tag: img.version || img.name,
        registry_url: img.registry_url,
        description: img.description || '',
        is_default: images.length === 0,
      } as AvailableImage,
    ]);
    setShowPicker(false);
  };

  const setDefault = (index: number) => {
    updateField(
      'available_images',
      images.map((img, i) => ({ ...img, is_default: i === index }))
    );
  };

  const removeImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    if (images[index].is_default && updated.length > 0) {
      updated[0] = { ...updated[0], is_default: true };
    }
    updateField('available_images', updated);
  };

  const addedIds = new Set(images.map((i) => i.image_id).filter(Boolean));
  const addedUrls = new Set(images.map((i) => i.registry_url));
  const pickable = allImages.filter(
    (img) => !addedIds.has(img.id) && !addedUrls.has(img.registry_url)
  );

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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">镜像配置</h3>
          {isEditing && (
            <div className="relative" ref={pickerRef}>
              <button
                onClick={() => setShowPicker((p) => !p)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                从镜像库添加
                <ChevronDown size={12} />
              </button>
              {showPicker && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                  {pickable.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-slate-500 px-3 py-4 text-center">
                      没有可添加的镜像
                    </p>
                  ) : (
                    pickable.map((img) => (
                      <button
                        key={img.id}
                        onClick={() => addImageFromRegistry(img)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700 border-b border-gray-100 dark:border-slate-700 last:border-0 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-900 dark:text-white">{img.name}</span>
                          {img.version && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded">
                              {img.version}
                            </span>
                          )}
                          {img.gpu_required && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">
                              GPU
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400 dark:text-slate-500 truncate mt-0.5">
                          {img.registry_url}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {images.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-slate-500 py-2">
            暂无镜像，{isEditing ? '点击「从镜像库添加」选择可用镜像。' : '请编辑后添加。'}
          </p>
        ) : (
          <div className="space-y-2">
            {images.map((img, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 transition-colors ${
                  img.is_default
                    ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10'
                    : 'border-gray-200 dark:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  checked={img.is_default}
                  onChange={() => setDefault(index)}
                  disabled={!isEditing}
                  className="w-3.5 h-3.5 text-blue-600 disabled:cursor-not-allowed flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium text-gray-900 dark:text-white">{img.tag}</span>
                    {img.is_default && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded">
                        默认
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400 dark:text-slate-500 truncate mt-0.5">
                    {img.registry_url}
                  </div>
                  {img.description && (
                    <div className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{img.description}</div>
                  )}
                </div>
                {isEditing && (
                  <button
                    onClick={() => removeImage(index)}
                    className="p-1 text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
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
