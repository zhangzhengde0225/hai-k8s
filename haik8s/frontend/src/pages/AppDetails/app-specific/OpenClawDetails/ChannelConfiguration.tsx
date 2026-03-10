import { useState } from 'react';
import { Radio, Edit2, Trash2, X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../../../../api/client';

interface Props {
  config: any;
  instanceId: number;
  appId: string;
  onConfigUpdate: () => void;
}

export default function ChannelConfiguration({ config, instanceId, appId, onConfigUpdate }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const channels = config?.channels || {};
  const channelEntries = Object.entries(channels);

  const handleDeleteChannel = async (channelName: string) => {
    if (!confirm(`确认删除通道 "${channelName}" 吗？`)) return;

    setSaving(true);
    try {
      const newChannels = { ...channels };
      delete newChannels[channelName];
      await client.put(`/applications/${appId}/openclaw-config`, {
        instance_id: instanceId,
        channels: newChannels,
      });
      toast.success('已删除');
      onConfigUpdate();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '删除失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">通道配置</h3>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
        >
          {isEditing ? <X size={14} /> : <Edit2 size={14} />}
          {isEditing ? '取消' : '编辑'}
        </button>
      </div>

      {channelEntries.length === 0 ? (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <p className="mb-2 text-sm">暂未配置通道</p>
          {isEditing && (
            <p className="text-xs">编辑功能即将推出，请在SSH终端中手动编辑配置文件</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {channelEntries.map(([name, channelConfig]: [string, any]) => (
            <div
              key={name}
              className="border border-gray-200 dark:border-slate-700 rounded p-3 bg-gray-50 dark:bg-slate-950/40"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 capitalize text-sm">
                    {name}
                  </h4>
                  <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs px-2 py-0.5 rounded">
                    已配置
                  </span>
                </div>
                {isEditing && (
                  <button
                    onClick={() => handleDeleteChannel(name)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400"
                    disabled={saving}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                {channelConfig.dmPolicy && (
                  <div className="flex justify-between">
                    <span>私聊策略:</span>
                    <span>{channelConfig.dmPolicy}</span>
                  </div>
                )}
                {channelConfig.groupPolicy && (
                  <div className="flex justify-between">
                    <span>群组策略:</span>
                    <span>{channelConfig.groupPolicy}</span>
                  </div>
                )}
                {channelConfig.allowFrom && (
                  <div className="flex justify-between">
                    <span>白名单:</span>
                    <span>{channelConfig.allowFrom.length} 个号码</span>
                  </div>
                )}
                {Object.keys(channelConfig).length <= 1 && (
                  <div className="text-gray-500">配置详情请在SSH终端中查看</div>
                )}
              </div>
            </div>
          ))}

          {isEditing && (
            <div className="text-center py-4 text-xs text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded">
              <Plus size={16} className="mx-auto mb-1 text-gray-400" />
              <p>添加和编辑功能即将推出</p>
              <p className="mt-1">请在SSH终端中手动编辑 ~/.openclaw/openclaw.json</p>
            </div>
          )}
        </div>
      )}

      {/* Channel Guide */}
      {!isEditing && channelEntries.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            💡 提示: OpenClaw支持WhatsApp、Telegram、Discord等多种通道。点击"编辑"可以删除通道。
          </p>
        </div>
      )}
    </div>
  );
}
