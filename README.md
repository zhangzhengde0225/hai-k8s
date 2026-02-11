# HAI-K8S

Kubernetes container open platform for IHEP AI infrastructure. Provides authenticated users with a web interface to create, manage, and access containers on the taichu-cluster (aicpu004, aicpu005, aicpu006).

**Authors**: Zhengde ZHANG, Yiyu ZHANG
**Version**: 0.0.1

---

## Architecture Overview

```
Browser  <-->  React Frontend (Vite, port 42901)
                   |  proxy /api
                   v
              FastAPI Backend (uvicorn, port 42900)
                   |
          +--------+--------+
          |                 |
     SQLite DB        K8s API (aicpu004:6443)
    (users,            (pods, services,
     containers,        namespaces,
     images)            exec/stream)
```

### Key Technologies

**Backend:**
- FastAPI (async Python web framework)
- SQLModel (ORM based on SQLAlchemy + Pydantic)
- Kubernetes Python SDK (v25.3.0)
- IHEP SSO OAuth2 authentication + Local password authentication
- Passlib + bcrypt (password hashing)
- WebSocket terminal streaming

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS v4
- React Router (client-side routing)
- Zustand (state management)
- xterm.js (terminal emulator)

---

## Features

### User Features
- **Dual Authentication**: Login via IHEP SSO or local username/password
- **Default Admin Account**: Pre-configured admin user (username: `admin`, password: `admin123`)
- **Container Management**: Create, start, stop, delete containers
- **Resource Control**: Configure CPU, memory, GPU per container
- **SSH Access**: Optional SSH via NodePort (30000-32767)
- **Web Terminal**: Interactive shell via WebSocket
- **Container Logs**: View pod logs in real-time
- **Image Selection**: Choose from pre-configured images (Ubuntu, Python, CUDA)
- **Resource Quota**: Per-user CPU/memory/GPU limits

### Admin Features
- **User Management**: View/edit user roles and quotas
- **Image Management**: Add/deactivate container images
- **Cluster Overview**: Monitor node resources (CPU/memory/GPU)
- **Global Container View**: See all containers across users

---

## Prerequisites

- **Python**: 3.11+
- **Node.js**: 18+ (with npm)
- **Kubernetes**: Access to a K8s cluster (kubeconfig)
- **IHEP SSO**: OAuth2 client credentials

---

## Installation

### 1. Clone Repository

```bash
cd /aifs/user/home/zdzhang/VSProjects
git clone <repository-url> hai-k8s
cd hai-k8s
```

### 2. Backend Setup

```bash
# Install Python dependencies
cd haik8s/backend
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
# Install Node dependencies
cd haik8s/frontend
npm install
```

---

## Configuration

### 1. Backend Configuration

Edit `haik8s/backend/.env`:

```bash
# JWT Secret (generate with: openssl rand -hex 32)
JWT_SECRET_KEY=your-secret-key-here

# IHEP SSO Credentials
IHEP_SSO_CLIENT_ID=your-client-id
IHEP_SSO_CLIENT_SECRET=your-client-secret
IHEP_SSO_AUTHORIZE_URL=https://login.ihep.ac.cn/oauth2/authorize
IHEP_SSO_TOKEN_URL=https://login.ihep.ac.cn/oauth2/token
IHEP_SSO_CALLBACK_URL=http://localhost:42900/api/auth/umt/callback
FRONTEND_CALLBACK_URL=http://localhost:42901/auth/callback

# Database (default: SQLite in backend directory)
DATABASE_URL=sqlite:///haik8s.db

# Kubernetes config path
KUBECONFIG_PATH=/aifs/user/home/zdzhang/VSProjects/hai-k8s/.kube/config
```

### 2. Kubernetes Config

Ensure `.kube/config` has valid credentials:

```bash
# Test K8s access
kubectl --kubeconfig=.kube/config get nodes
```

### 3. Seed Default Images

```bash
cd haik8s/backend
python scripts/init_data.py
```

This creates three default images:
- Ubuntu 22.04
- Python 3.11
- NVIDIA CUDA 12.2 Ubuntu 22.04

---

## Running the Application

### Development Mode

#### Start Backend (Terminal 1)

```bash
./start_backend.sh
# Or manually:
# cd haik8s/backend && uvicorn main:app --host 0.0.0.0 --port 42900 --reload
```

Backend will be available at: http://localhost:42900
- Swagger UI: http://localhost:42900/docs
- Health check: http://localhost:42900/api/health

**First Run**: The backend will automatically create:
- Database tables
- Default admin user (username: `admin`, password: `admin123`)
- ⚠️ **Important**: Change the default password after first login!

#### Start Frontend (Terminal 2)

```bash
./start_frontend.sh
# Or manually:
# cd haik8s/frontend && npm run dev
```

Frontend will be available at: http://localhost:42901

### Production Build

```bash
# Build frontend
cd haik8s/frontend
npm run build

# Serve frontend build (example with nginx or serve)
npx serve -s dist -l 5173

# Run backend without --reload
cd haik8s/backend
uvicorn main:app --host 0.0.0.0 --port 42900
```

---

## Authentication

HAI-K8S supports **two login methods**:

### 1. Local Login (Default for Development)

**Default Admin Account:**
- Username: `admin`
- Password: `admin123`
- Role: Administrator

⚠️ **Security Warning**: Change the default password after first login!

**Login Process:**
1. Navigate to http://localhost:42901
2. Click "HAI-K8S" title to toggle login mode to "本地账号登录"
3. Enter username and password
4. Click "登录"

### 2. IHEP SSO Login

**Requirements:**
- IHEP SSO Client ID and Secret
- Configured callback URLs

**Login Process:**
1. Navigate to http://localhost:42901
2. Click "统一认证登录" (or ensure login mode is SSO)
3. Redirected to IHEP SSO login page
4. Authenticate with IHEP credentials
5. Redirected back to dashboard

**First SSO Login:**
New users are created automatically with default role `user` and quotas:
- CPU: 4 cores
- Memory: 8 GB
- GPU: 1

For more details, see [Local Authentication Guide](docs/LOCAL_AUTH.md)

---

## Usage

### First Login

#### Using Local Account
1. Navigate to http://localhost:42901
2. Toggle to "本地账号登录" by clicking "HAI-K8S" title
3. Login with admin/admin123
4. Change password (feature to be implemented)

#### Using IHEP SSO
1. Navigate to http://localhost:42901
2. Ensure login mode is "统一认证登录"
3. Click "统一认证登录"
4. Authenticate with IHEP credentials
5. Redirect back to dashboard

### Creating a Container

1. Click "New Container" in sidebar
2. Fill in form:
   - **Name**: lowercase alphanumeric + hyphens (e.g., `my-container`)
   - **Image**: Select from dropdown
   - **Resources**: CPU (cores), Memory (GB), GPU (count)
   - **SSH**: Enable for SSH access
3. Click "Create Container"

The system will:
- Validate quota
- Allocate NodePort (if SSH enabled)
- Create namespace `haik8s-{username}`
- Deploy pod with resource limits
- Create NodePort service (if SSH)

### Accessing Container

**Web Terminal:**
- Open container detail page
- Click "Terminal" tab
- Interactive shell via WebSocket

**SSH (if enabled):**
```bash
ssh root@aicpu004 -p {node_port}
```

Example: `ssh root@aicpu004 -p 30123`

### Admin Tasks

Admins can:
- View/edit user roles (user ↔ admin)
- Modify user quotas
- Deactivate users
- Add/remove container images
- Monitor cluster resources

---

## Directory Structure

```
hai-k8s/
├── .kube/
│   └── config                    # Kubernetes config
├── haik8s/
│   ├── version.py                # Version info
│   ├── backend/
│   │   ├── main.py               # FastAPI app entry point
│   │   ├── config.py             # Configuration
│   │   ├── .env                  # Environment variables
│   │   ├── requirements.txt      # Python dependencies
│   │   ├── auth/
│   │   │   ├── sso_router.py     # IHEP SSO OAuth2 flow
│   │   │   ├── security.py       # JWT create/decode
│   │   │   └── dependencies.py   # get_current_user, require_role
│   │   ├── db/
│   │   │   ├── models.py         # SQLModel: User, Container, Image
│   │   │   ├── database.py       # Engine init, session
│   │   │   └── crud.py           # CRUD + quota + NodePort
│   │   ├── k8s/
│   │   │   ├── client.py         # K8s API init
│   │   │   ├── pods.py           # Pod CRUD with GPU
│   │   │   ├── services.py       # NodePort services
│   │   │   └── terminal.py       # Exec stream
│   │   ├── api/
│   │   │   ├── containers.py     # Container endpoints
│   │   │   ├── terminal.py       # WebSocket terminal
│   │   │   ├── users.py          # /users/me
│   │   │   ├── images.py         # Image endpoints
│   │   │   └── admin.py          # Admin panel
│   │   ├── schemas/
│   │   │   ├── container.py      # Pydantic schemas
│   │   │   ├── user.py
│   │   │   └── image.py
│   │   └── scripts/
│   │       └── init_data.py      # Seed images
│   └── frontend/
│       ├── package.json
│       ├── vite.config.ts        # Vite + Tailwind + proxy
│       ├── tsconfig.json
│       └── src/
│           ├── main.tsx          # React entry
│           ├── App.tsx           # Router
│           ├── index.css         # Tailwind imports
│           ├── config.ts         # API base URL
│           ├── api/
│           │   └── client.ts     # Axios with auth interceptor
│           ├── auth/
│           │   ├── AuthContext.tsx   # Zustand store
│           │   ├── LoginPage.tsx
│           │   ├── CallbackPage.tsx
│           │   └── jwt.ts
│           ├── components/
│           │   ├── Layout.tsx        # Sidebar + header
│           │   ├── ProtectedRoute.tsx
│           │   └── Terminal.tsx      # xterm.js
│           ├── pages/
│           │   ├── Dashboard.tsx
│           │   ├── CreateContainer.tsx
│           │   ├── ContainerDetail.tsx
│           │   ├── AdminUsers.tsx
│           │   ├── AdminImages.tsx
│           │   └── AdminCluster.tsx
│           └── types/
│               └── index.ts
├── start_backend.sh              # Backend launcher
├── start_frontend.sh             # Frontend launcher
└── README.md                     # This file
```

---

## API Endpoints

### Authentication
- `GET /api/auth/login/sso` - Initiate SSO login
- `GET /api/auth/umt/callback` - OAuth2 callback
- `POST /api/auth/login/local` - Local username/password login

### Containers
- `GET /api/containers` - List user's containers
- `POST /api/containers` - Create container
- `GET /api/containers/{id}` - Get container detail
- `POST /api/containers/{id}/start` - Start stopped container
- `POST /api/containers/{id}/stop` - Stop running container
- `DELETE /api/containers/{id}` - Delete container
- `GET /api/containers/{id}/logs` - Get pod logs
- `WS /api/containers/{id}/terminal?token=...` - WebSocket terminal

### User
- `GET /api/users/me` - Current user profile with resource usage

### Images
- `GET /api/images` - List active images
- `POST /api/images` - Create image (admin)
- `DELETE /api/images/{id}` - Deactivate image (admin)

### Admin
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users/{id}` - Update user
- `GET /api/admin/cluster` - Cluster node resources
- `GET /api/admin/containers` - All containers

---

## Database Schema

### Users
- `id`, `username`, `email`, `full_name`, `password_hash`
- `role` (admin/user), `auth_provider` (ihep_sso/local), `sso_id`
- `is_active`, `created_at`, `last_login_at`
- **Quotas**: `cpu_quota`, `memory_quota`, `gpu_quota`

### Containers
- `id`, `name`, `user_id`, `image_id`
- `k8s_namespace`, `k8s_pod_name`, `k8s_service_name`
- **Resources**: `cpu_request`, `memory_request`, `gpu_request`
- **SSH**: `ssh_enabled`, `ssh_node_port`
- `status` (creating/running/stopped/failed/deleted)
- `created_at`, `updated_at`

### Images
- `id`, `name`, `registry_url`, `description`
- `default_cmd`, `gpu_required`, `is_active`
- `created_at`

---

## Design Decisions

### Per-User Namespaces
Each user gets a dedicated K8s namespace `haik8s-{username}` for natural isolation. Namespaces are created lazily on first container.

### Bare Pods (Not Deployments)
Interactive containers use bare Pods for simpler exec/terminal access. No autoscaling needed.

### NodePort for SSH
Each SSH-enabled container gets a unique NodePort (30000-32767) mapped to container port 22.

### On-Demand Status Sync
Container list queries K8s live status only when user requests (no background polling initially).

### WebSocket Terminal Bridge
Backend bridges WebSocket ↔ K8s exec stream using:
- Background thread for synchronous `kubernetes.stream`
- asyncio Queue for async WebSocket forwarding

---

## Troubleshooting

### Backend fails to start

**Check K8s config:**
```bash
kubectl --kubeconfig=.kube/config get nodes
```

**Check database:**
```bash
# If DB corrupted, delete and re-init
rm haik8s/backend/haik8s.db
cd haik8s/backend
python scripts/init_data.py
```

### SSO login fails

- Verify `IHEP_SSO_CLIENT_ID` and `IHEP_SSO_CLIENT_SECRET` in `.env`
- Check callback URL matches SSO configuration
- Inspect backend logs for OAuth2 errors

### Container stuck in "creating"

- Check pod status: `kubectl get pods -n haik8s-{username}`
- Check events: `kubectl describe pod {pod-name} -n haik8s-{username}`
- Common issues:
  - Image pull errors (invalid `registry_url`)
  - Resource unavailable (insufficient cluster capacity)
  - GPU not available (missing nvidia device plugin)

### Terminal not connecting

- Ensure container status is "running"
- Check WebSocket proxy in `vite.config.ts` (`ws: true`)
- Verify pod has shell: `kubectl exec -it {pod-name} -n {namespace} -- /bin/bash`

### NodePort already allocated

If NodePort allocation fails:
```bash
# Find used ports
kubectl get svc --all-namespaces | grep NodePort

# Manually verify DB state
sqlite3 haik8s/backend/haik8s.db "SELECT ssh_node_port FROM containers WHERE ssh_node_port IS NOT NULL;"
```

---

## Development Notes

### Adding New Images

**Via Admin UI:**
1. Login as admin
2. Go to "Images" page
3. Click "Add Image"
4. Fill in form with registry URL (e.g., `pytorch/pytorch:2.0.0-cuda11.8-cudnn8-runtime`)

**Via Script:**
Edit `scripts/init_data.py` and re-run.

### Modifying User Quotas

**Via Admin UI:**
1. Go to "Users" page
2. Click "Edit" on user row
3. Update quotas, click "Save"

**Via Database:**
```bash
sqlite3 haik8s/backend/haik8s.db
UPDATE users SET cpu_quota=16, memory_quota=32, gpu_quota=2 WHERE username='someuser';
```

### Making a User Admin

```bash
sqlite3 haik8s/backend/haik8s.db
UPDATE users SET role='admin' WHERE username='admin-user';
```

### Testing Without SSO

HAI-K8S includes local authentication for development and testing:
1. Start backend - default admin user is created automatically
2. Login with username: `admin`, password: `admin123`
3. Toggle login mode by clicking "HAI-K8S" title on login page
4. See [Local Authentication Guide](docs/LOCAL_AUTH.md) for details

---

## Security Considerations

- **JWT Secret**: Use strong random key in production (32+ bytes)
- **HTTPS**: Use reverse proxy (nginx/tracer) with TLS in production
- **Container Isolation**: Pods run in user namespaces but share node resources
- **SSH Security**: NodePorts are exposed cluster-wide; consider VPN or firewall rules
- **Quota Enforcement**: Backend validates quotas, but K8s ultimately enforces limits
- **Image Registry**: Only admins can add images; validate registry URLs

---

## Future Enhancements

- [ ] **Persistent Storage**: Attach PVCs to containers for data persistence
- [ ] **Network Policies**: Isolate user namespaces
- [ ] **Resource Usage Metrics**: Integrate Prometheus for real-time monitoring
- [ ] **Container Templates**: Save/reuse container configurations
- [ ] **Collaborative Access**: Share containers between users
- [ ] **Scheduled Shutdown**: Auto-stop idle containers
- [ ] **Billing/Accounting**: Track resource usage per user
- [ ] **Multi-Cluster Support**: Federate across clusters

---

## License

Copyright © 2026 IHEP. All rights reserved.

---

## Support

For issues or questions:
- GitHub Issues: `<repository-url>/issues`
- Email: zdzhang@ihep.ac.cn
