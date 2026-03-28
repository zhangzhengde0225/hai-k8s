// 通道配置：管理 OpenClaw 通道，支持配置微信等渠道。作者：Zhengde Zhang (zhangzhengde0225@gmail.com)
import { useState } from 'react';
import { Radio, RefreshCw, Trash2, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../../../../../../api/client';
import { MultiStepCommandExecutor } from '../../../instance_detail/components/MultiStepCommandExecutor';

interface Props {
  config: any;
  instanceId: number;
  appId: string;
  onConfigUpdate: () => void;
  instance?: any;
}

export default function ChannelConfiguration({ config, instanceId, appId, onConfigUpdate, instance }: Props) {
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [showWechatInstaller, setShowWechatInstaller] = useState(false);
  // 从容器直接读取的插件启用状态，null 表示尚未读取（使用 config 值）
  const [pluginEnabledLocal, setPluginEnabledLocal] = useState<boolean | null>(null);

  const channels = config?.channels || {};
  const channelEntries = Object.entries(channels);
  const wechatConfig = channels['openclaw-weixin'] as any | undefined;
  const wechatPluginEntry = config?.plugins?.entries?.['openclaw-weixin'];
  const wechatInstalled = pluginEnabledLocal !== null ? true : !!wechatPluginEntry;
  const wechatEnabled = pluginEnabledLocal !== null ? pluginEnabledLocal : (wechatPluginEntry?.enabled !== false);
  const isRunning = instance?.status === 'running';

  const handleReadFromContainer = async () => {
    if (!isRunning) return;
    setReading(true);
    try {
      const pyScript = `import os,json; cfg=os.path.expanduser('~/.openclaw/openclaw.json'); e=json.load(open(cfg)).get('plugins',{}).get('entries',{}).get('openclaw-weixin',{}).get('enabled',False) if os.path.isfile(cfg) else False; print('true' if e else 'false')`;
      const cmd = instance.ssh_user
        ? `su - ${instance.ssh_user} -c "python3 -c \\"${pyScript}\\""`
        : `python3 -c "${pyScript}"`;
      const res = await client.post(`/containers/${instanceId}/exec`, { command: cmd, timeout: 10 });
      if (res.data.success && res.data.output) {
        const enabled = res.data.output.trim() === 'true';
        setPluginEnabledLocal(enabled);
      }
      onConfigUpdate();
    } catch {
      toast.error('读取失败');
    } finally {
      setReading(false);
    }
  };

  const handleToggleWechat = async () => {
    if (!isRunning) return;
    const newEnabled = !wechatEnabled;
    try {
      await client.put(`/applications/${appId}/openclaw-config`, {
        instance_id: instanceId,
        plugins: {
          entries: {
            'openclaw-weixin': { enabled: newEnabled },
          },
        },
      });
      toast.success(newEnabled ? '已启用微信插件' : '已禁用微信插件');
      setPluginEnabledLocal(null);
      onConfigUpdate();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '操作失败');
    }
  };

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
    <>
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">通道配置</h3>
        </div>
        <button
          onClick={handleReadFromContainer}
          disabled={reading || !isRunning}
          className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 flex items-center gap-1 disabled:opacity-50"
          title="从容器内 ~/.openclaw/openclaw.json 读取"
        >
          <RefreshCw size={14} className={reading ? 'animate-spin' : ''} />
          {reading ? '读取中...' : '从容器读取'}
        </button>
      </div>

      <div className="space-y-3">
        {/* openclaw-weixin 行：始终显示 */}
        <div className="border border-gray-200 dark:border-slate-700 rounded p-3 bg-gray-50 dark:bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">openclaw-weixin</h4>
              {wechatConfig ? (
                <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs px-2 py-0.5 rounded">已配置</span>
              ) : (
                <span className="bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 text-xs px-2 py-0.5 rounded">未配置</span>
              )}
              {wechatInstalled && !wechatEnabled && (
                <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs px-2 py-0.5 rounded">已禁用</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowWechatInstaller(true)}
                disabled={!isRunning}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs text-white rounded transition-colors disabled:cursor-not-allowed ${wechatConfig ? 'bg-gray-400 hover:bg-gray-500 disabled:bg-gray-300' : 'bg-green-500 hover:bg-green-600 disabled:bg-gray-300'}`}
              >
                <MessageCircle size={12} />
                配置微信
              </button>
              {wechatInstalled && (
                <button
                  onClick={handleToggleWechat}
                  disabled={!isRunning}
                  className={`px-2.5 py-1 text-xs rounded transition-colors disabled:cursor-not-allowed ${
                    wechatEnabled
                      ? 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 disabled:opacity-50'
                      : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50'
                  }`}
                >
                  {wechatEnabled ? '禁用' : '启用'}
                </button>
              )}
            </div>
          </div>
          {wechatConfig && (
            <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
              {wechatConfig.dmPolicy && (
                <div className="flex justify-between">
                  <span>私聊策略:</span>
                  <span>{wechatConfig.dmPolicy}</span>
                </div>
              )}
              {wechatConfig.groupPolicy && (
                <div className="flex justify-between">
                  <span>群组策略:</span>
                  <span>{wechatConfig.groupPolicy}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 其他通道 */}
        {channelEntries
          .filter(([name]) => name !== 'openclaw-weixin')
          .map(([name, channelConfig]: [string, any]) => (
            <div
              key={name}
              className="border border-gray-200 dark:border-slate-700 rounded p-3 bg-gray-50 dark:bg-slate-950/40"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 capitalize text-sm">{name}</h4>
                  <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs px-2 py-0.5 rounded">已配置</span>
                </div>
                <button
                  onClick={() => handleDeleteChannel(name)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400"
                  disabled={saving}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                {channelConfig.dmPolicy && (
                  <div className="flex justify-between"><span>私聊策略:</span><span>{channelConfig.dmPolicy}</span></div>
                )}
                {channelConfig.groupPolicy && (
                  <div className="flex justify-between"><span>群组策略:</span><span>{channelConfig.groupPolicy}</span></div>
                )}
                {channelConfig.allowFrom && (
                  <div className="flex justify-between"><span>白名单:</span><span>{channelConfig.allowFrom.length} 个号码</span></div>
                )}
                {Object.keys(channelConfig).length <= 1 && (
                  <div className="text-gray-500">配置详情请在SSH终端中查看</div>
                )}
              </div>
            </div>
          ))}

        {/* 其他通道 */}
      </div>
    </div>

    {/* WeChat Installer Modal */}
    {showWechatInstaller && instance && (() => {
      const wrap = (cmd: string) =>
        instance.ssh_user ? `su - ${instance.ssh_user} -c "${cmd.replace(/"/g, '\\"')}"` : cmd;
      const wrapScript = (script: string) =>
        instance.ssh_user
          ? `su - ${instance.ssh_user} << 'CMDEOF'\n${script}\nCMDEOF`
          : script;
      const killScript = `pm2 delete openclaw-gateway
PORT=18789
echo "正在监控端口 $PORT，等待进程出现..."
while true; do
    process_info=$(ss -tanlp 2>/dev/null | grep ":$PORT ")
    if [ -n "$process_info" ]; then
        echo "找到占用端口 $PORT 的进程:"
        echo "$process_info"
        pid=$(echo "$process_info" | grep -o 'pid=[0-9]*' | head -1 | cut -d'=' -f2)
        if [ -n "$pid" ]; then
            echo "正在终止进程 PID: $pid"
            kill -9 "$pid"
            if ! kill -0 "$pid" 2>/dev/null; then
                echo "进程 $pid 已成功终止"
            else
                echo "警告：进程 $pid 可能仍在运行"
            fi
            break
        else
            echo "无法提取PID，尝试其他方式..."
            if command -v lsof >/dev/null 2>&1; then
                pid=$(lsof -ti:$PORT | head -1)
                if [ -n "$pid" ]; then
                    echo "通过lsof找到PID: $pid"
                    kill -9 "$pid"
                    echo "进程 $pid 已终止"
                    break
                fi
            fi
            echo "无法获取PID，退出"
            exit 1
        fi
    else
        echo "端口 $PORT 暂无进程占用，继续监控..."
        sleep 1
    fi
done
echo "脚本执行完成"`;
      return (
        <MultiStepCommandExecutor
          containerId={instanceId}
          containerName={instance.name}
          onClose={() => { setShowWechatInstaller(false); onConfigUpdate(); }}
          steps={[
            {
              title: '安装微信插件',
              description: '下载并安装插件',
              command: wrap('npx -y @tencent-weixin/openclaw-weixin-cli@latest install'),
            },
            {
              title: '停止后台进程',
              description: '停止pm2并终止端口18789进程',
              command: wrapScript(killScript),
              ignoreFailure: true,
            },
            {
              title: '重启网关',
              description: '重启pm2网关',
              command: wrap("pm2 start sh --name openclaw-gateway -- -c 'openclaw gateway --port 18789 --bind lan'"),
            },
          ]}
        />
      );
    })()}
    </>
  );
}
