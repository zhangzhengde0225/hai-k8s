export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  cpu_quota: number;
  memory_quota: number;
  gpu_quota: number;
  cpu_used: number;
  memory_used: number;
  gpu_used: number;
  created_at: string;
  last_login_at: string | null;
}

export interface Container {
  id: number;
  name: string;
  image_name: string | null;
  image_registry_url: string | null;
  status: string;
  cpu_request: number;
  memory_request: number;
  gpu_request: number;
  ssh_enabled: boolean;
  ssh_node_port: number | null;
  created_at: string;
  updated_at: string;
  // 新增字段
  config_id: number | null;
  config_name: string | null;
  application_id: string | null;
}

export interface ContainerDetail extends Container {
  k8s_namespace: string | null;
  k8s_pod_name: string | null;
  k8s_service_name: string | null;
  k8s_status: string | null;
  ssh_command: string | null;
  user_id: number;
}

export interface Image {
  id: number;
  name: string;
  registry_url: string;
  description: string | null;
  default_cmd: string | null;
  gpu_required: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Enhanced metadata fields
  version: string | null;
  tags: string[] | null;  // Tag array
  env_vars: Record<string, string> | null;  // Environment variables object
  ports: number[] | null;  // Port array
  recommended_resources: {  // Recommended resources
    cpu?: number;
    memory?: number;
    gpu?: number;
  } | null;
}

export interface ClusterNode {
  name: string;
  ready: boolean;
  cpu_capacity: string;
  memory_capacity: string;
  gpu_capacity: string;
  cpu_allocatable: string;
  memory_allocatable: string;
  gpu_allocatable: string;
}

export interface Application {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'stopped' | 'error' | 'unconfigured' | 'configured';
  is_configured: boolean;
  version: string;
  endpoint?: string;
  pods?: number;
  replicas?: number;
  total_instances?: number;
  defaultImage?: string;  // Default recommended image name (e.g., "Hai-OpenClaw")
  // Configuration information
  config?: {
    id: number;
    image_id: number;
    image_name: string | null;
    cpu_request: number;
    memory_request: number;
    gpu_request: number;
    ssh_enabled: boolean;
    storage_path: string | null;
    status: 'draft' | 'validated' | 'archived';
  } | null;
}

export interface DeployConfig {
  name: string;
  imageId: number;
  cpu: number;
  memory: number;
  gpu: number;
  sshEnabled: boolean;
}

// ==================== 应用配置相关类型 ====================

export interface AppConfig {
  id: number;
  application_id: string;
  image_id: number;
  image_name: string;
  cpu_request: number;
  memory_request: number;
  gpu_request: number;
  ssh_enabled: boolean;
  storage_path: string | null;
  status: 'draft' | 'validated' | 'archived';
  instance_count: number;
  created_at: string;
  updated_at: string;
}

export interface SaveConfigData {
  imageId: number;
  cpu: number;
  memory: number;
  gpu: number;
  sshEnabled: boolean;
  storagePath?: string;
}

// ==================== POD管理相关类型 ====================

export interface PodContainer {
  name: string;
  image: string;
  ready: boolean;
  restart_count: number;
}

export interface PodResourceInfo {
  cpu: string | null;
  memory: string | null;
  gpu: string | null;
}

export interface PodOwnerReference {
  kind: string;
  name: string;
}

export interface Pod {
  namespace: string;
  name: string;
  phase: string;
  pod_ip: string | null;
  node_name: string | null;
  created_at: string;
  containers: PodContainer[];
  labels: Record<string, string>;
  is_system_managed: boolean;
  container_id: number | null;
  resource_requests: PodResourceInfo;
  resource_limits: PodResourceInfo;
  owner_references: PodOwnerReference[];
}

export interface PodCondition {
  type: string;
  status: string;
  reason: string | null;
  message: string | null;
  last_transition_time: string | null;
}

export interface PodVolume {
  name: string;
  type: string;
  source: string | null;
}

export interface PodDetail {
  namespace: string;
  name: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  phase: string;
  pod_ip: string | null;
  host_ip: string | null;
  node_name: string | null;
  created_at: string | null;
  conditions: PodCondition[];
  volumes: PodVolume[];
  restart_policy: string | null;
  service_account: string | null;
}
