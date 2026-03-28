// 基础配置：WebUI访问地址、Gateway Token、重启网关等基础操作。作者：Zhengde Zhang (zhangzhengde0225@gmail.com)
import { useState, useEffect } from 'react';
import { Settings2, Globe, RefreshCw, Copy, Eye, EyeOff, HelpCircle, ChevronDown, ChevronRight, Smartphone, Check, Loader2, Key, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AppInstance } from '../../types';
import { CommandExecutor } from '../../components/CommandExecutor';
import client from '../../../../../../api/client';

interface PendingDevice {
  requestId: string;
  deviceId: string;
  role: string;
  scopes: string[];
  platform?: string;
  clientId?: string;
  clientMode?: string;
}

interface PairedDevice {
  deviceId: string;
  role: string;
  roles: string[];
  scopes: string[];
  platform?: string;
  clientId?: string;
  clientMode?: string;
  tokens?: Array<{
    role: string;
    scopes: string[];
    createdAtMs?: number;
    lastUsedAtMs?: number;
  }>;
}

interface DeviceListResult {
  pending: PendingDevice[];
  paired: PairedDevice[];
}

interface Props {
  instance: AppInstance;
  refreshTrigger?: number;
}

export default function BasicConfiguration({ instance, refreshTrigger }: Props) {
  const [showCommandExecutor, setShowCommandExecutor] = useState(false);
  const [gatewayCommand, setGatewayCommand] = useState<'restart' | 'stop'>('restart');
  const [gatewayToken, setGatewayToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [deviceListExpanded, setDeviceListExpanded] = useState(true);
  const [pairedListExpanded, setPairedListExpanded] = useState(false);
  const [deviceList, setDeviceList] = useState<DeviceListResult>({ pending: [], paired: [] });
  const [deviceListLoading, setDeviceListLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const isRunning = instance.status === 'running';

  useEffect(() => {
    if (!isRunning) { setGatewayToken(''); return; }
    const cmd = instance.ssh_user
      ? `su - ${instance.ssh_user} -c "python3 -c \\"import json,os; print(json.load(open(os.path.expanduser('~/.openclaw/openclaw.json')))['gateway']['auth']['token'])\\""`
      : `python3 -c "import json,os; print(json.load(open(os.path.expanduser('~/.openclaw/openclaw.json')))['gateway']['auth']['token'])"`;
    client.post(`/containers/${instance.id}/exec`, { command: cmd, timeout: 10 })
      .then((res) => {
        setGatewayToken(res.data.success && res.data.output.trim() ? res.data.output.trim() : '');
      })
      .catch(() => setGatewayToken(''));
  }, [instance.id, isRunning, refreshTrigger]);

  const handleCopyToken = async () => {
    if (!gatewayToken) return;
    try {
      await navigator.clipboard.writeText(gatewayToken);
      toast.success('Token已复制到剪贴板');
    } catch {
      toast.error('复制失败');
    }
  };

  const formatToken = (token: string) => {
    if (token.length <= 8) return token;
    return `${token.slice(0, 4)}****${token.slice(-4)}`;
  };

  const parseDeviceList = (jsonStr: string): DeviceListResult => {
    try {
      const data = JSON.parse(jsonStr);
      return {
        pending: (data.pending || []).map((d: any) => ({
          requestId: d.requestId || '',
          deviceId: d.deviceId || '',
          role: d.role || '',
          scopes: d.scopes || [],
          platform: d.platform,
          clientId: d.clientId,
          clientMode: d.clientMode,
        })),
        paired: (data.paired || []).map((d: any) => ({
          deviceId: d.deviceId || '',
          role: d.role || '',
          roles: d.roles || [],
          scopes: d.scopes || [],
          platform: d.platform,
          clientId: d.clientId,
          clientMode: d.clientMode,
          tokens: d.tokens,
        })),
      };
    } catch {
      return { pending: [], paired: [] };
    }
  };

  const fetchDeviceList = () => {
    if (!isRunning) return;
    setDeviceListLoading(true);
    const cmd = instance.ssh_user
      ? `su - ${instance.ssh_user} -c "openclaw devices list --json"`
      : `openclaw devices list --json`;
    client.post(`/containers/${instance.id}/exec`, { command: cmd, timeout: 30 })
      .then((res) => {
        if (res.data.success && res.data.output) {
          setDeviceList(parseDeviceList(res.data.output));
        } else {
          setDeviceList({ pending: [], paired: [] });
        }
      })
      .catch(() => setDeviceList({ pending: [], paired: [] }))
      .finally(() => setDeviceListLoading(false));
  };

  useEffect(() => {
    if (deviceListExpanded) {
      fetchDeviceList();
    }
  }, [deviceListExpanded, instance.id, isRunning, refreshTrigger]);

  const handleApproveDevice = async (requestId: string) => {
    setApprovingId(requestId);
    const cmd = instance.ssh_user
      ? `su - ${instance.ssh_user} -c "openclaw devices approve ${requestId}"`
      : `openclaw devices approve ${requestId}`;
    try {
      const res = await client.post(`/containers/${instance.id}/exec`, { command: cmd, timeout: 30 });
      if (res.data.success) {
        toast.success('设备已批准');
        fetchDeviceList();
      } else {
        toast.error(res.data.output || '批准失败');
      }
    } catch {
      toast.error('批准失败');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    setRemovingId(deviceId);
    const cmd = instance.ssh_user
      ? `su - ${instance.ssh_user} -c "openclaw devices remove ${deviceId}"`
      : `openclaw devices remove ${deviceId}`;
    try {
      const res = await client.post(`/containers/${instance.id}/exec`, { command: cmd, timeout: 30 });
      if (res.data.success) {
        toast.success('设备已删除');
        fetchDeviceList();
      } else {
        toast.error(res.data.output || '删除失败');
      }
    } catch {
      toast.error('删除失败');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* 基础配置 */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">基础配置</h3>
          </div>

          <div className="space-y-3">
            {/* WebUI 访问地址 */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">WebUI 访问地址:</span>
              </div>
              {instance.bound_ip ? (
                gatewayToken ? (
                  <div className="flex items-center gap-1">
                    <a
                      href={`https://${instance.bound_ip}/?token=${gatewayToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-mono"
                    >
                      https://{instance.bound_ip}/?token=***
                    </a>
                    <button
                      onClick={() => navigator.clipboard.writeText(`https://${instance.bound_ip}/?token=${gatewayToken}`)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      title="复制链接"
                    >
                      <Copy className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500">
                    {isRunning ? '读取中...' : '容器未运行'}
                  </span>
                )
              ) : (
                <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                  未配置IP地址
                </span>
              )}
            </div>

            {/* Gateway Token */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Gateway Token:</span>
                <span
                  title="访问 OpenClaw 网页，在 Overview 中填入 Gateway Token，点击 Connect，即能成功连接"
                  className="text-gray-400 dark:text-slate-500 cursor-help"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </span>
              </div>
              {gatewayToken ? (
                <div className="flex items-center gap-1">
                  <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                    {showToken ? gatewayToken : formatToken(gatewayToken)}
                  </span>
                  <button
                    onClick={() => setShowToken((v) => !v)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    title={showToken ? '隐藏Token' : '查看完整Token'}
                  >
                    {showToken
                      ? <EyeOff className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                      : <Eye className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                    }
                  </button>
                  <button
                    onClick={handleCopyToken}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    title="复制完整Token"
                  >
                    <Copy className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              ) : (
                <span className="text-sm text-gray-400 dark:text-gray-500">
                  {isRunning ? '读取中...' : '容器未运行'}
                </span>
              )}
            </div>

            {/* 授权设备管理 */}
            <div className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 cursor-pointer"
                onClick={() => setDeviceListExpanded(!deviceListExpanded)}
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">授权设备管理</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({deviceList.pending.length} 待批准, {deviceList.paired.length} 已配对)
                  </span>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={fetchDeviceList}
                    disabled={deviceListLoading || !isRunning}
                    className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${deviceListLoading ? 'animate-spin' : ''}`} />
                    刷新授权设备
                  </button>
                  {deviceListExpanded
                    ? <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    : <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  }
                </div>
              </div>

              {deviceListExpanded && (
                <div className="p-3 border-t border-gray-200 dark:border-slate-600">
                  {!isRunning ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">容器未运行</p>
                  ) : deviceListLoading && deviceList.pending.length === 0 && deviceList.paired.length === 0 ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Pending Devices */}
                      {deviceList.pending.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-2">
                            待批准设备 ({deviceList.pending.length})
                          </h4>
                          <div className="space-y-2">
                            {deviceList.pending.map((device) => (
                              <div
                                key={device.requestId}
                                className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Request:</span>
                                    <span className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
                                      {device.requestId}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Device:</span>
                                    <span className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
                                      {device.deviceId}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Role:</span>
                                    <span className="text-xs text-gray-700 dark:text-gray-300">{device.role}</span>
                                    {device.platform && (
                                      <>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Platform:</span>
                                        <span className="text-xs text-gray-700 dark:text-gray-300">{device.platform}</span>
                                      </>
                                    )}
                                    {device.clientId && (
                                      <>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Client:</span>
                                        <span className="text-xs text-gray-700 dark:text-gray-300">{device.clientId}</span>
                                      </>
                                    )}
                                    {device.clientMode && (
                                      <>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Mode:</span>
                                        <span className="text-xs text-gray-700 dark:text-gray-300">{device.clientMode}</span>
                                      </>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Scopes:</span>
                                    <span className="text-xs text-gray-700 dark:text-gray-300">{device.scopes.join(', ')}</span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleApproveDevice(device.requestId)}
                                  disabled={approvingId === device.requestId}
                                  className="ml-2 flex items-center gap-1 px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-colors disabled:opacity-50"
                                >
                                  {approvingId === device.requestId ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                  批准
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Paired Devices */}
                      {deviceList.paired.length > 0 && (
                        <div>
                          <div
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => setPairedListExpanded(!pairedListExpanded)}
                          >
                            <h4 className="text-xs font-semibold text-green-600 dark:text-green-400">
                              已配对设备 ({deviceList.paired.length})
                            </h4>
                            {pairedListExpanded
                              ? <ChevronDown className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                              : <ChevronRight className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                            }
                          </div>
                          {pairedListExpanded && (
                            <div className="space-y-2 mt-2">
                              {deviceList.paired.map((device, idx) => (
                                <div
                                  key={`${device.deviceId}-${idx}`}
                                  className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
                                        {device.deviceId}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <span className="text-xs text-gray-500 dark:text-gray-400">Role:</span>
                                      <span className="text-xs text-gray-700 dark:text-gray-300">{device.roles.join(', ')}</span>
                                      {device.platform && (
                                        <>
                                          <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                                          <span className="text-xs text-gray-500 dark:text-gray-400">Platform:</span>
                                          <span className="text-xs text-gray-700 dark:text-gray-300">{device.platform}</span>
                                        </>
                                      )}
                                      {device.clientId && (
                                        <>
                                          <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                                          <span className="text-xs text-gray-500 dark:text-gray-400">Client:</span>
                                          <span className="text-xs text-gray-700 dark:text-gray-300">{device.clientId}</span>
                                        </>
                                      )}
                                      {device.clientMode && (
                                        <>
                                          <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                                          <span className="text-xs text-gray-500 dark:text-gray-400">Mode:</span>
                                          <span className="text-xs text-gray-700 dark:text-gray-300">{device.clientMode}</span>
                                        </>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <span className="text-xs text-gray-500 dark:text-gray-400">Scopes:</span>
                                      <span className="text-xs text-gray-700 dark:text-gray-300">{device.scopes.join(', ')}</span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveDevice(device.deviceId)}
                                    disabled={removingId === device.deviceId}
                                    className="ml-2 flex items-center gap-1 px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors disabled:opacity-50"
                                    title="删除设备"
                                  >
                                    {removingId === device.deviceId ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3 h-3" />
                                    )}
                                    删除
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {deviceList.pending.length === 0 && deviceList.paired.length === 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">暂无设备</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* OpenClaw 网关 */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <span className="text-sm font-medium text-gray-900 dark:text-white">OpenClaw网关</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setGatewayCommand('restart'); setShowCommandExecutor(true); }}
                  disabled={!isRunning}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-4 h-4" />
                  重启网关
                </button>
                <button
                  onClick={() => { setGatewayCommand('stop'); setShowCommandExecutor(true); }}
                  disabled={!isRunning}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  停止网关
                </button>
              </div>
            </div>

          </div>
        </div>
      </div> 

      {/* Command Executor Modal */}
      {showCommandExecutor && (
        <CommandExecutor
          containerId={instance.id}
          containerName={instance.name}
          onClose={() => setShowCommandExecutor(false)}
          initialCommand={
            gatewayCommand === 'stop'
              ? (instance.ssh_user
                  ? `su - ${instance.ssh_user} -c "pm2 delete openclaw-gateway"`
                  : `pm2 delete openclaw-gateway`)
              : (instance.ssh_user
                  ? `su - ${instance.ssh_user} -c "pm2 delete openclaw-gateway; pm2 start sh --name openclaw-gateway -- -c 'openclaw gateway --port 18789 --bind lan'"`
                  : `pm2 delete openclaw-gateway && pm2 start sh --name openclaw-gateway -- -c "openclaw gateway --port 18789 --bind lan"`)
          }
        />
      )}
    </>
  );
}
