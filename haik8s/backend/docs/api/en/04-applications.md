# Applications

HAI-K8S Application Service system provides pre-configured application templates (like OpenClaw) to simplify complex application deployment.

## Core Concepts

### Application vs Container

- **Container**: Generic Pod instance with full custom configuration
- **Application**: Pre-configured application template with simplified deployment

### Application Features

1. **Configuration Management**: Save app config, launch multiple times
2. **Password Management**: Auto-generate root and user passwords
3. **Network Configuration**: Support MacVLAN direct IP access
4. **User Synchronization**: Auto-create corresponding Linux user
5. **Firewall**: Optional iptables rules configuration

## Supported Applications

| App ID | Name | Description | Version |
|--------|------|-------------|---------|
| openclaw | OpenClaw | AI Agent Development Platform | 1.0.0 |

## Application Lifecycle

```
1. List applications     GET /api/applications
2. Save config           POST /api/applications/{app_id}/config
3. Get config            GET /api/applications/{app_id}/config
4. Launch instance       POST /api/applications/{app_id}/launch
5. View instances        GET /api/applications/{app_id}/instances
6. Stop instances        POST /api/applications/{app_id}/stop
```

## API Endpoints

### 1. List All Applications

```
GET /api/applications
```

**Response:**
```json
[
  {
    "id": "openclaw",
    "name": "OpenClaw",
    "version": "1.0.0",
    "status": "unconfigured",
    "is_configured": false,
    "pods": 0,
    "total_instances": 0,
    "endpoint": null,
    "config": null
  }
]
```

**Status values:**
- `unconfigured`: Not configured
- `configured`: Configured but not launched
- `stopped`: Has instances but all stopped
- `running`: Has running instances

### 2. Save Application Config

```
POST /api/applications/{app_id}/config
PUT /api/applications/{app_id}/config
```

**Request Body:**
```json
{
  "image_id": 5,
  "cpu_request": 4.0,
  "memory_request": 8.0,
  "gpu_request": 0,
  "ssh_enabled": false,
  "bound_ip": "192.168.1.100",
  "sync_user": true,
  "enable_sudo": false
}
```

### 3. Launch Application Instance

```
POST /api/applications/{app_id}/launch
```

**Request Body:**
```json
{
  "count": 1,
  "instance_name": "openclaw-prod"
}
```

**Prerequisites:**
- Must save config first
- Config status must be `validated`
- Sufficient resource quota
- No other running instances for same app

**Response:**
```json
{
  "message": "Successfully launched 1 instance(s)",
  "instances": [
    {
      "id": 123,
      "name": "openclaw-prod",
      "status": "creating",
      "bound_ip": "192.168.1.100",
      "ssh_command": "ssh root@192.168.1.100",
      "root_password": "GeneratedPass123",
      "user_password": "GeneratedPass456"
    }
  ]
}
```

## OpenClaw Quick Start

### Complete Flow Example

```bash
# Step 1: List applications
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:42900/api/applications

# Step 2: Find OpenClaw image
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:42900/api/images | jq '.[] | select(.tags | contains("openclaw"))'

# Step 3: Save OpenClaw config
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "image_id": 5,
       "cpu_request": 4.0,
       "memory_request": 8.0,
       "gpu_request": 0,
       "bound_ip": "192.168.1.100"
     }' \
     http://localhost:42900/api/applications/openclaw/config

# Step 4: Launch instance
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"count": 1}' \
     http://localhost:42900/api/applications/openclaw/launch

# Step 5: Wait for running (poll status)
while true; do
  STATUS=$(curl -s -H "Authorization: Bearer $TOKEN" \
           http://localhost:42900/api/applications/openclaw/instances \
           | jq -r '.instances[0].k8s_status')
  echo "Status: $STATUS"
  if [ "$STATUS" = "Running" ]; then
    echo "OpenClaw is ready!"
    break
  fi
  sleep 5
done

# Step 6: Get access info
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:42900/api/applications/openclaw/instances \
     | jq '.instances[0] | {bound_ip, password}'
```

### Python Complete Example

```python
import requests
import time

class OpenClawLauncher:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {token}"}

    def launch_openclaw(self, image_id, cpu=4.0, memory=8.0, bound_ip=None):
        """Launch OpenClaw instance"""

        # 1. Check existing config
        config_url = f"{self.base_url}/api/applications/openclaw/config"
        config_response = requests.get(config_url, headers=self.headers)

        if config_response.status_code == 404:
            # 2. Create config
            config_data = {
                "image_id": image_id,
                "cpu_request": cpu,
                "memory_request": memory,
                "gpu_request": 0,
                "bound_ip": bound_ip
            }
            print("Creating OpenClaw configuration...")
            requests.post(config_url, headers=self.headers, json=config_data)

        # 3. Launch instance
        launch_url = f"{self.base_url}/api/applications/openclaw/launch"
        print("Launching OpenClaw instance...")
        launch_response = requests.post(
            launch_url,
            headers=self.headers,
            json={"count": 1}
        )
        instance = launch_response.json()["instances"][0]

        # 4. Wait for running
        instances_url = f"{self.base_url}/api/applications/openclaw/instances"
        print("Waiting for instance to be ready...")
        while True:
            instances_response = requests.get(instances_url, headers=self.headers)
            instances = instances_response.json()["instances"]
            if instances and instances[0]["k8s_status"] == "Running":
                instance_info = instances[0]
                print(f"\nOpenClaw is ready!")
                print(f"Access URL: http://{instance_info['bound_ip']}")
                print(f"Password: {instance_info['password']}")
                return instance_info
            time.sleep(5)

# Usage
launcher = OpenClawLauncher("http://localhost:42900", "YOUR_TOKEN")
instance = launcher.launch_openclaw(image_id=5, bound_ip="192.168.1.100")
```

## Next Steps

- **[Agent Integration](agent-integration)**: How AI agents launch OpenClaw
- **[Containers](containers)**: Generic container operations
- **[IP Allocations](ip-allocations)**: MacVLAN IP management
