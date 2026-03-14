export interface AppInstance {
  id: number;
  name: string;
  image_name: string | null;
  image_registry_url: string | null;
  status: string;
  k8s_status: string | null;
  cpu_request: number;
  memory_request: number;
  gpu_request: number;
  ssh_enabled: boolean;
  ssh_node_port: number | null;
  ssh_command: string | null;
  ssh_user: string | null;
  password: string | null;
  bound_ip: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppInfo {
  id: string;
  name: string;
  version: string;
  startup_scripts_config?: {
    scripts?: Array<{
      id: string;
      group: number;
      name: string;
      command: string;
      language?: 'bash' | 'python';
      run_as?: 'root' | 'ssh_user' | 'frontend';
    }>;
    group_configs?: Record<string, { name?: string; auto_start?: boolean; auto_close?: boolean }>;
  } | null;
}

export interface PodEvent {
  type: string;
  reason: string;
  message: string;
  count: number;
  last_timestamp: string | null;
}

// 5 tabs for the new design
export type AppDetailTab =
  | 'server-overview'
  | 'app-details'
  | 'web-terminal'
  | 'container-logs'
  | 'container-events';

export interface TabConfig {
  key: AppDetailTab;
  label: string;
  i18nKey: string;
  icon: React.ReactNode;
  enabled: (appId: string, status: string) => boolean;
}

// Props for application-specific details components
export interface AppDetailsProps {
  appId: string;
  appInfo: AppInfo;
  instance: AppInstance;
}
