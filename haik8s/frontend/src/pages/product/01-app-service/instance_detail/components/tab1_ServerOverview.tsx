import { Copy, Check, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import type { AppInstance } from '../types';
import type { ContainerDetail } from '../../../../../types';
import { InfoSection, InfoRow } from './InfoSection';

interface Props {
  instance: AppInstance;
  detail: ContainerDetail | null;
}

export function ServerOverview({ instance, detail }: Props) {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleCopySSH = async () => {
    if (!instance.ssh_command) return;
    await navigator.clipboard.writeText(instance.ssh_command);
    setCopiedId(instance.id);
    toast.success('SSH 命令已复制到剪贴板');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Basic info */}
      <InfoSection title="基本信息">
        <InfoRow
          label="镜像"
          value={detail?.image_name ?? instance.image_name ?? instance.image_registry_url ?? '-'}
        />
        <InfoRow label="CPU" value={`${instance.cpu_request} 核`} />
        <InfoRow label="内存" value={`${instance.memory_request} GB`} />
        <InfoRow label="GPU" value={String(instance.gpu_request)} />
        <InfoRow label="创建时间" value={new Date(instance.created_at).toLocaleString()} />
        <InfoRow label="更新时间" value={new Date(instance.updated_at).toLocaleString()} />
      </InfoSection>

      {/* K8s info */}
      {detail && (
        <InfoSection title="集群信息">
          <InfoRow label="命名空间" value={detail.k8s_namespace ?? '-'} mono />
          <InfoRow label="Pod 名称" value={detail.k8s_pod_name ?? '-'} mono />
          <InfoRow label="K8s 状态" value={detail.k8s_status ?? '-'} />
        </InfoSection>
      )}

      {/* SSH connection */}
      {instance.ssh_enabled && instance.ssh_command && (
        <InfoSection title="SSH 连接">
          <InfoRow label="用户名" value={instance.ssh_user || '-'} />
          <InfoRow
            label="IP 地址"
            value={
              instance.bound_ip ? (
                <div className="flex items-center gap-2">
                  <span>{instance.bound_ip}</span>
                  <span
                    className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded cursor-help relative group"
                    title="仅高能所内网可访问，或先连接高能VPN"
                  >
                    内网IP
                    <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded whitespace-nowrap z-10 pointer-events-none">
                      仅高能所内网可访问，或先连接高能VPN
                      <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></span>
                    </span>
                  </span>
                </div>
              ) : (
                '-'
              )
            }
          />
          {instance.password ? (
            <InfoRow
              label="密码"
              value={
                <div className="flex items-center gap-2">
                  <code className="text-blue-600 dark:text-cyan-300">
                    {showPassword ? instance.password : '•••••••••'}
                  </code>
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 rounded text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(instance.password!);
                      toast.success('密码已复制');
                    }}
                    className="p-1 rounded text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              }
            />
          ) : (
            <InfoRow
              label="密码"
              value={
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-slate-500">
                    密码仅在启动时显示,请查看配置页面
                  </span>
                </div>
              }
            />
          )}
          <InfoRow label="端口" value="22" />
          <div className="mt-2">
            <p className="text-xs text-gray-600 dark:text-slate-400 mb-1.5">连接命令</p>
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-950 border border-gray-300 dark:border-slate-700/50 rounded-lg px-3 py-2.5">
              <code className="flex-1 text-xs font-mono text-blue-600 dark:text-cyan-300 break-all">
                {instance.ssh_command}
              </code>
              <button
                onClick={handleCopySSH}
                className="flex-shrink-0 p-1 rounded text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              >
                {copiedId === instance.id ? (
                  <Check size={14} className="text-green-600 dark:text-green-400" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
          </div>
        </InfoSection>
      )}
    </div>
  );
}
