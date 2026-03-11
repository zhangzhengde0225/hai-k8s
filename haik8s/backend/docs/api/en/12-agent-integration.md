# Agent Integration Guide

This guide is designed for AI Agents, providing complete API integration patterns, error handling, and best practices.

## Core Concepts

### Agent Task Types

1. **Application Service Launch** - Launch OpenClaw and other services
2. **Container Management** - Create, start, stop containers
3. **Resource Monitoring** - Check quotas and usage
4. **Troubleshooting** - Analyze logs and events

### Authentication Flow

Agents must operate on behalf of users and require user JWT tokens:

```python
def authenticate_user(username: str, password: str) -> str:
    """Authenticate and get token"""
    response = requests.post(
        "http://localhost:42900/api/auth/login/local",
        json={"username": username, "password": password}
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    raise AuthenticationError(response.json()["detail"])
```

### Resource Hierarchy

```
User
 ├── Quota: CPU, Memory, GPU
 ├── Applications
 │    ├── Config
 │    └── Instances
 └── Containers
```

### Lifecycle States

**Container/Instance states:**
- `creating` → `running` → `stopped` / `deleted`
- `failed` (error state)

**Config states:**
- `validated` (usable)
- `archived` (archived)

## Common Agent Tasks

### Task 1: Launch OpenClaw Service

**Goal:** Launch an OpenClaw instance for user, provide access URL and password.

**Complete Implementation:**

```python
import requests
import time
from typing import Optional, Dict

class OpenClawAgent:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {token}"}

    def start_openclaw(
        self,
        image_id: Optional[int] = None,
        cpu: float = 4.0,
        memory: float = 8.0,
        bound_ip: Optional[str] = None
    ) -> Dict:
        """
        Launch OpenClaw instance

        Args:
            image_id: Image ID (auto-find if None)
            cpu: CPU cores
            memory: Memory GB
            bound_ip: Bound IP (optional)

        Returns:
            Instance info dict
        """

        # Step 1: Find OpenClaw image (if not specified)
        if image_id is None:
            print("🔍 Finding OpenClaw image...")
            image_id = self._find_openclaw_image()
            print(f"✓ Found image ID: {image_id}")

        # Step 2: Check user quota
        print("📊 Checking resource quota...")
        if not self._check_quota(cpu, memory, 0):
            raise QuotaExceededError("Insufficient quota")
        print("✓ Quota sufficient")

        # Step 3: Check/create config
        print("⚙️ Checking application config...")
        config = self._get_or_create_config(image_id, cpu, memory, bound_ip)
        print(f"✓ Config ready (ID: {config['id']})")

        # Step 4: Launch instance
        print("🚀 Launching OpenClaw instance...")
        instance = self._launch_instance()
        print(f"✓ Instance created: {instance['name']}")

        # Step 5: Wait for Pod running
        print("⏳ Waiting for instance ready...")
        instance_info = self._wait_for_running(max_wait=300)
        print("✅ OpenClaw ready!")

        return {
            "id": instance_info["id"],
            "name": instance_info["name"],
            "status": instance_info["status"],
            "access_url": f"http://{instance_info['bound_ip']}" if instance_info.get("bound_ip") else None,
            "password": instance_info["password"],
            "created_at": instance_info["created_at"]
        }

    def _find_openclaw_image(self) -> int:
        """Find OpenClaw image"""
        response = requests.get(
            f"{self.base_url}/api/images",
            headers=self.headers
        )
        response.raise_for_status()

        for image in response.json():
            if image.get("tags") and "openclaw" in image["tags"]:
                return image["id"]

        raise ImageNotFoundError("OpenClaw image not found")

    def _check_quota(self, cpu: float, memory: float, gpu: int) -> bool:
        """Check user quota"""
        response = requests.get(
            f"{self.base_url}/api/users/me",
            headers=self.headers
        )
        response.raise_for_status()
        user = response.json()

        return (
            cpu <= user["cpu_quota"] and
            memory <= user["memory_quota"] and
            gpu <= user["gpu_quota"]
        )

    def _get_or_create_config(
        self,
        image_id: int,
        cpu: float,
        memory: float,
        bound_ip: Optional[str]
    ) -> Dict:
        """Get or create OpenClaw config"""
        response = requests.get(
            f"{self.base_url}/api/applications/openclaw/config",
            headers=self.headers
        )

        if response.status_code == 200:
            return response.json()

        # Create new config
        config_data = {
            "image_id": image_id,
            "cpu_request": cpu,
            "memory_request": memory,
            "gpu_request": 0,
            "ssh_enabled": False,
            "bound_ip": bound_ip,
            "sync_user": True
        }

        response = requests.post(
            f"{self.base_url}/api/applications/openclaw/config",
            headers=self.headers,
            json=config_data
        )
        response.raise_for_status()
        return response.json()

    def _launch_instance(self) -> Dict:
        """Launch OpenClaw instance"""
        response = requests.post(
            f"{self.base_url}/api/applications/openclaw/launch",
            headers=self.headers,
            json={"count": 1}
        )

        if response.status_code == 400:
            error_detail = response.json()["detail"]
            if "running instance" in error_detail:
                return self._get_existing_instance()
            raise LaunchError(error_detail)

        response.raise_for_status()
        return response.json()["instances"][0]

    def _get_existing_instance(self) -> Dict:
        """Get existing instance info"""
        response = requests.get(
            f"{self.base_url}/api/applications/openclaw/instances",
            headers=self.headers
        )
        response.raise_for_status()
        instances = response.json()["instances"]
        if instances:
            return instances[0]
        raise InstanceNotFoundError("No running instance found")

    def _wait_for_running(self, max_wait: int = 300) -> Dict:
        """Wait for instance to reach Running state"""
        start_time = time.time()

        while time.time() - start_time < max_wait:
            response = requests.get(
                f"{self.base_url}/api/applications/openclaw/instances",
                headers=self.headers
            )
            response.raise_for_status()

            instances = response.json()["instances"]
            if not instances:
                raise InstanceNotFoundError("Instance deleted")

            instance = instances[0]
            k8s_status = instance.get("k8s_status")

            if k8s_status == "Running":
                return instance
            elif k8s_status == "Failed":
                raise InstanceFailedError("Instance launch failed")

            time.sleep(5)

        raise TimeoutError(f"Instance not ready after {max_wait}s")

# Usage example
agent = OpenClawAgent("http://localhost:42900", "YOUR_TOKEN")
try:
    result = agent.start_openclaw(
        cpu=4.0,
        memory=8.0,
        bound_ip="192.168.1.100"
    )
    print(f"✅ OpenClaw launched!")
    print(f"Access: {result['access_url']}")
    print(f"Password: {result['password']}")
except QuotaExceededError:
    print("❌ Insufficient quota")
except Exception as e:
    print(f"❌ Launch failed: {str(e)}")
```

## Error Handling Patterns

### Agent-Friendly Error Codes

| HTTP Status | Error Type | Agent Strategy |
|-------------|-----------|----------------|
| 400 | Quota exceeded | Notify user to increase quota |
| 400 | Config missing | Create config first |
| 400 | Instance exists | Return existing or stop and restart |
| 401 | Unauthorized | Re-authenticate |
| 403 | Forbidden | Notify user of insufficient permissions |
| 404 | Not found | Check ID or if deleted |
| 409 | Conflict | Wait and retry |
| 500 | Server error | Log and notify user |
| 503 | Resources exhausted | Wait or notify user |

### Error Handling Example

```python
def handle_api_error(response: requests.Response, context: str):
    """Unified API error handling"""
    status = response.status_code
    detail = response.json().get("detail", "Unknown error")

    if status == 400:
        if "quota" in detail.lower():
            return f"⚠️ {context} failed: Insufficient quota. {detail}"
        elif "config" in detail.lower():
            return f"⚠️ {context} failed: Create config first."
        else:
            return f"❌ {context} failed: {detail}"

    elif status == 401:
        return "🔐 Authentication failed, please re-login."

    elif status == 403:
        return f"🚫 Insufficient permissions: {detail}"

    elif status == 404:
        return f"🔍 Resource not found: {detail}"

    elif status == 500:
        return f"💥 Server error: {detail}"

    return f"❌ Unknown error ({status}): {detail}"
```

## Best Practices

### 1. Token Management

```python
class TokenManager:
    def __init__(self, username: str, password: str, base_url: str):
        self.username = username
        self.password = password
        self.base_url = base_url
        self.token = None
        self.expires_at = None

    def get_token(self) -> str:
        """Get valid token (auto-refresh)"""
        if self.token and self.expires_at and time.time() < self.expires_at:
            return self.token

        # Re-authenticate
        response = requests.post(
            f"{self.base_url}/api/auth/login/local",
            json={"username": self.username, "password": self.password}
        )
        response.raise_for_status()

        self.token = response.json()["access_token"]
        self.expires_at = time.time() + 23 * 3600
        return self.token
```

### 2. Polling Strategy

```python
def poll_until(
    check_func,
    condition,
    max_wait: int = 300,
    interval: int = 5
):
    """Poll until condition met"""
    start_time = time.time()

    while time.time() - start_time < max_wait:
        result = check_func()
        if condition(result):
            return result
        time.sleep(interval)

    raise TimeoutError(f"Condition not met after {max_wait}s")
```

## Next Steps

- **[Applications](applications)**: OpenClaw detailed API reference
- **[Containers](containers)**: Container lifecycle operations
- **[Error Handling](error-handling)**: Complete error code list
