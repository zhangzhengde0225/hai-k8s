export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: string;
  auth_provider: string | null;
  is_active: boolean;
  cpu_quota: number;
  memory_quota: number;
  gpu_quota: number;
  cpu_used: number;
  memory_used: number;
  gpu_used: number;
  created_at: string;
  last_login_at: string | null;
  // Cluster info
  cluster_username: string | null;
  cluster_uid: number | null;
  cluster_gid: number | null;
  cluster_home_dir: string | null;
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

export interface VolumeMountConfig {
  host_path: string;
  mount_path: string;
}

export interface IPAllocation {
  has_ip: boolean;
  ip_address: string | null;
  allocated_at: string | null;
  notes?: string | null;
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
  recommended_cpu?: number;
  recommended_memory?: number;
  recommended_gpu?: number;
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
    volume_mounts: VolumeMountConfig[] | null;
    bound_ip: string | null;
    status: 'draft' | 'validated' | 'archived';
    // User sync configuration
    sync_user?: boolean;
    user_uid?: number | null;
    user_gid?: number | null;
    user_home_dir?: string | null;
    enable_sudo?: boolean;
    root_password?: string | null;
    user_password?: string | null;
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
  volume_mounts: VolumeMountConfig[] | null;
  bound_ip: string | null;
  status: 'draft' | 'validated' | 'archived';
  instance_count: number;
  created_at: string;
  updated_at: string;
  // User sync configuration
  sync_user?: boolean;
  user_uid?: number | null;
  user_gid?: number | null;
  user_home_dir?: string | null;
  enable_sudo?: boolean;
}

export interface SaveConfigData {
  imageId: number;
  cpu: number;
  memory: number;
  gpu: number;
  sshEnabled: boolean;
  storagePath?: string;
  volumeMounts?: VolumeMountConfig[];
  boundIp?: string | null;
  // User sync configuration
  syncUser?: boolean;
  userUid?: number | null;
  userGid?: number | null;
  userHomeDir?: string | null;
  enableSudo?: boolean;
  rootPassword?: string | null;
  userPassword?: string | null;
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

// ==================== 应用定义相关类型 ====================

export interface ApplicationDefinition {
  id: number;
  app_id: string;
  name: string;
  description: string | null;
  version: string;
  image_prefix: string;
  default_replicas: number;
  is_visible: boolean;
  recommended_cpu: number;
  recommended_memory: number;
  recommended_gpu: number;
  default_firewall_rules: FirewallRuleConfig[] | null;
  startup_scripts_config: StartupScriptsConfig | null;
  models_config_template: ModelsConfigTemplate | null;
  available_images: AvailableImage[];
  created_at: string;
  updated_at: string;
}

export interface AvailableImage {
  tag: string;
  registry_url: string;
  description: string;
  is_default: boolean;
}

export interface StartupScriptsConfig {
  enable_onboard: boolean;           // 非交互式初始化
  enable_insecure_http: boolean;     // 允许HTTP认证
  enable_config_models: boolean;     // 配置模型
  enable_start_gateway: boolean;      // 启动网关
  allow_port_18789: boolean;         // 放通端口18789
  gateway_password?: string;
  hepai_api_key?: string;
}

export interface ModelsConfigTemplate {
  providers?: Array<{
    baseUrl: string;
    apiKey?: string;
    api: string;
    models: Array<{
      id: string;
      name: string;
      maxTokens?: number;
    }>;
  }>;
  primary?: string;
  fallbacks?: string[];
}

export interface FirewallRuleConfig {
  port: number | string;
  protocol: string;
  source: string;
  action: string;
}
