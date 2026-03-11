# Getting Started

Welcome to HAI-K8S API! This guide will help you create your first container in 5 minutes.

## Prerequisites

- Valid HAI-K8S account
- Authentication token (see [Authentication](authentication) section)

## Quick Flow

### 1. Authenticate and Get Token

**Local Authentication Example:**

```bash
curl -X POST http://localhost:42900/api/auth/login/local \
     -H "Content-Type: application/json" \
     -d '{
       "username": "your_username",
       "password": "your_password"
     }'
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

Save the access_token for subsequent requests.

### 2. List Available Images

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:42900/api/images
```

### 3. Check Resource Quota

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:42900/api/users/me
```

### 4. Create Container

```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "my-first-container",
       "image_id": 1,
       "cpu_request": 2.0,
       "memory_request": 4.0,
       "gpu_request": 0,
       "ssh_enabled": true
     }' \
     http://localhost:42900/api/containers
```

### 5. Wait for Container Running

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:42900/api/containers/123
```

Wait for status to become "running" (usually takes 30-60 seconds).

### 6. Access Container

Use the returned SSH command and password to login:

```bash
ssh -p 30123 root@node.example.com
# Enter password: GeneratedPassword123
```

## Python Example

```python
import requests
import time

# Authenticate
auth_response = requests.post(
    "http://localhost:42900/api/auth/login/local",
    json={"username": "your_username", "password": "your_password"}
)
token = auth_response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Create container
create_response = requests.post(
    "http://localhost:42900/api/containers",
    headers=headers,
    json={
        "name": "my-container",
        "image_id": 1,
        "cpu_request": 2.0,
        "memory_request": 4.0,
        "gpu_request": 0,
        "ssh_enabled": True
    }
)
container = create_response.json()
container_id = container["id"]
print(f"Container created: {container_id}")

# Wait for running
while True:
    status_response = requests.get(
        f"http://localhost:42900/api/containers/{container_id}",
        headers=headers
    )
    status = status_response.json()["status"]
    print(f"Status: {status}")
    if status == "running":
        print("Container is ready!")
        print(f"SSH: {status_response.json()['ssh_command']}")
        print(f"Password: {status_response.json()['root_password']}")
        break
    time.sleep(5)
```

## Next Steps

- **[Authentication](authentication)**: Detailed authentication flow and SSO integration
- **[Containers](containers)**: Complete container lifecycle operations
- **[Applications](applications)**: Launch OpenClaw and other application services
- **[Agent Integration](agent-integration)**: Complete guide for AI agents

## Common Issues

**Q: Container stuck in "creating" status?**
A: This is usually normal. First pull of large images may take several minutes.

**Q: Insufficient quota?**
A: Contact administrator to increase quota, or delete unused containers.

**Q: Forgot SSH password?**
A: Retrieve password via `GET /api/containers/{id}`.

**Q: How to stop container?**
A: Use `POST /api/containers/{id}/stop` to stop container and release resources.
