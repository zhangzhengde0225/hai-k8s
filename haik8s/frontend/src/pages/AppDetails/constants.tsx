import { LayoutGrid, FileCode, Terminal, FileText, Clock } from 'lucide-react';
import type { TabConfig } from './types';

// Status metadata
export const STATUS_META: Record<string, { label: string; dot: string; badge: string }> = {
  running: {
    label: '运行中',
    dot: 'bg-green-400 animate-pulse',
    badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  },
  creating: {
    label: '启动中',
    dot: 'bg-yellow-400 animate-spin',
    badge: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  },
  stopped: {
    label: '已停止',
    dot: 'bg-gray-500 dark:bg-slate-500',
    badge: 'bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300',
  },
  failed: {
    label: '已失败',
    dot: 'bg-red-500',
    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  },
};

export const getMeta = (s: string) => STATUS_META[s] ?? STATUS_META['stopped'];

// Tab configurations
export const TAB_CONFIGS: TabConfig[] = [
  {
    key: 'server-overview',
    label: '容器概览',
    i18nKey: 'serverOverview',
    icon: <LayoutGrid size={13} />,
    enabled: () => true,
  },
  {
    key: 'app-details',
    label: '应用详情',
    i18nKey: 'appDetails',
    icon: <FileCode size={13} />,
    enabled: () => true,
  },
  {
    key: 'web-terminal',
    label: '网页终端',
    i18nKey: 'webTerminal',
    icon: <Terminal size={13} />,
    enabled: (_, status) => status === 'running',
  },
  {
    key: 'container-logs',
    label: '容器日志',
    i18nKey: 'containerLogs',
    icon: <FileText size={13} />,
    enabled: () => true,
  },
  {
    key: 'container-events',
    label: '容器事件',
    i18nKey: 'containerEvents',
    icon: <Clock size={13} />,
    enabled: () => true,
  },
];
