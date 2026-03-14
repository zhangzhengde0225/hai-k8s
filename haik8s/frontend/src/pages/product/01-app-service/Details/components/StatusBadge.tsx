import { getMeta } from '../constants';

export function StatusBadge({ status, k8sStatus }: { status: string; k8sStatus: string | null }) {
  const { label, badge } = getMeta(status);
  const display = (status === 'creating' && k8sStatus === 'Pending') ? '拉取镜像中...' : label;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>{display}</span>;
}
