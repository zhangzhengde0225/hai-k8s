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
