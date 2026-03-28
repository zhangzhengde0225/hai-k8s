# 4. Implementation

## 4.1 Technology Stack

Our platform is implemented using the following technologies:

| Layer | Technology | Purpose |
|-------|------------|---------|
| Backend API | FastAPI (Python 3.11) | REST API for container and skill management |
| K8s Client | kubernetes-python-client | Kubernetes API integration |
| Database | SQLite + SQLModel | Metadata storage (configs, users) |
| Authentication | JWT (PyJWT) | User authentication and authorization |
| Frontend | React + TypeScript + Vite | Admin dashboard |
| Container Runtime | Docker + containerd | Container execution |
| Orchestration | Kubernetes | Container orchestration |

## 4.2 System Architecture

### 4.2.1 Backend Components

The backend consists of several modules:

**API Layer** (`api/`):
- `applications.py`: Application-level operations (config, launch, stop)
- `containers.py`: Container lifecycle operations and Skill API endpoints
- `admin.py`: Admin operations (user management, image management)
- `containers.py`: Skill endpoints for agent invocation
- `documentation.py`: API documentation serving

**Service Layer** (`k8s_service/`):
- `client.py`: Kubernetes API client singleton initialization
- `pods/interface.py`: Pod exec interface (command execution in containers)
- `pods/pods.py`: Pod creation and management
- `services.py`: Kubernetes Service management (NodePort for SSH)
- `cache.py`: Pod status TTL cache (5s) to reduce K8s API load

**Data Layer** (`db/`):
- `models.py`: SQLModel definitions for users, containers, images, configs
- `crud.py`: Database operations
- `database.py`: Database connection management

### 4.2.2 Database Schema

Key entities:

```
User
├── id, username, email
├── role (ADMIN/USER)
├── auth_provider (IHEP_SSO/LOCAL)
├── cluster_username, cluster_uid, cluster_gid
├── api_key_of_hepai
├── cpu_quota, memory_quota, gpu_quota
└── containers (1:N)

Container
├── id, name, k8s_namespace, k8s_pod_name
├── cpu_request, memory_request, gpu_request
├── ssh_enabled, ssh_node_port
├── status (CREATING/RUNNING/STOPPED/FAILED/DELETED)
├── bound_ip, k8s_service_name
└── user_id, image_id, config_id

ApplicationDefinition
├── app_id (e.g., "openclaw", "opendrsai")
├── startup_scripts_config (JSON)
├── models_config_template (JSON)
└── available_images (JSON)

ApplicationConfig (per-user per-app)
├── user_id, application_id, image_id
├── cpu_request, memory_request, gpu_request
├── root_password, user_password
├── bound_ip, volume_mounts
└── firewall_rules, enable_firewall
```

## 4.3 Key Implementation Details

### 4.3.1 Pod Creation

When launching an agent container, the platform:

1. Validates the user's quota (CPU, memory, GPU)
2. Selects an appropriate node (if GPU required)
3. Creates the Pod with:
   - Startup command: installs SSH, configures users, sets up networking
   - Resource limits: CPU, memory, GPU from config
   - Security context: non-root, capabilities restricted
   - Volume mounts: persistent storage if configured
   - Annotations: macvlan network config if `bound_ip` is specified

4. Creates a NodePort Service for SSH access
5. Stores container metadata in the database
6. Returns container info to the user

### 4.3.2 Two-Layer Authentication Implementation

The Skill API endpoint (`POST /api/skills/containers/{id}/exec`) enforces two-layer auth:

```python
# Layer 1: Admin API Key
if x_admin_api_key != Config.HAI_K8S_ADMIN_API_KEY:
    raise HTTPException(status_code=403)

# Layer 2: User JWT (extracts user_id, verifies container ownership)
user = decode_jwt(authorization)
if container.user_id != user.id:
    raise HTTPException(status_code=403)
```

This ensures that:
- Only authorized Orchestrators (holding the admin key) can invoke Skills
- Each user can only operate on their own containers

### 4.3.3 Command Execution in Containers

We use Kubernetes' `Exec-API` to run commands inside agent containers:

```python
from kubernetes.stream import stream as k8s_stream

resp = k8s_stream(
    v1.connect_get_namespaced_pod_exec,
    pod_name,
    namespace,
    command=["bash", "-c", command],
    stderr=True, stdout=True, stdin=False,
    tty=False,
    _preload_content=True,
    timeout=timeout
)
```

The response includes stdout, stderr, and exit code, enabling the Orchestrator to determine success or failure.

### 4.3.4 Config-Template API

For OpenClaw initialization, the platform provides a config-template API:

```
GET /api/skills/applications/{app_id}/config-template
```

This returns the `models_config_template` and `startup_scripts_config` from the `ApplicationDefinition`, which the Orchestrator uses to initialize new agent containers.

### 4.3.5 OpenClaw Initialization Pipeline

The `openclaw-manager` Skill executes the following initialization steps inside an OpenClaw container:

**Step 1 — Onboard**:
```bash
openclaw onboard --non-interactive --accept-risk --flow quickstart \
    --mode local --gateway-bind lan --gateway-auth token \
    --gateway-password "$PASSWORD" --skip-channels --skip-skills \
    --skip-health --install-daemon
```

**Step 2 — Enable Insecure HTTP**:
```bash
jq '.gateway.controlUi = {"allowInsecureAuth": true}' \
    ~/.openclaw/openclaw.json > /tmp/openclaw_new.json \
    && mv /tmp/openclaw_new.json ~/.openclaw/openclaw.json
```

**Step 3 — Configure Models**:
```bash
# Fetch models_config_template from platform
# Replace ${HEPAI_API_KEY} with user's actual key
# Write to ~/.openclaw/openclaw.json
```

**Step 4 — Start Gateway**:
```bash
export TZ="Asia/Shanghai"
nohup openclaw gateway --port 18789 --bind lan \
    > ~/.openclaw/logs/gateway.log 2>&1 &
```

## 4.4 Frontend

The React frontend provides:

- **Container Dashboard**: List and manage agent containers
- **Application Config**: Configure and launch agent instances
- **Documentation Browser**: Browse API docs and integration guides
- **Admin Panel**: Manage users, images, and system settings

The frontend communicates with the backend REST API using JWT authentication.

## 4.5 Deployment

The platform is deployed on a Kubernetes cluster with the following components:

- **Backend**: Deployed as a Kubernetes Deployment with 2 replicas
- **Database**: SQLite file stored on a persistent volume (can be migrated to PostgreSQL)
- **Frontend**: Deployed as a separate Kubernetes Deployment
- **Ingress**: Kubernetes Ingress for external access

Current deployment serves researchers at our institution, with support for GPU-enabled nodes for compute-intensive agent workloads.
