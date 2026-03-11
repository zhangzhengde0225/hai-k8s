# OpenClaw Launch Example

This document provides complete OpenClaw launch example code in different programming languages.

## Python Example

### Basic Version

```python
import requests
import time

# Configuration
BASE_URL = "http://localhost:42900"
USERNAME = "your_username"
PASSWORD = "your_password"

# 1. Authenticate
auth_response = requests.post(
    f"{BASE_URL}/api/auth/login/local",
    json={"username": USERNAME, "password": PASSWORD}
)
token = auth_response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 2. Find OpenClaw image
images_response = requests.get(f"{BASE_URL}/api/images", headers=headers)
openclaw_image = None
for img in images_response.json():
    if img.get("tags") and "openclaw" in img["tags"]:
        openclaw_image = img
        break

if not openclaw_image:
    print("OpenClaw image not found")
    exit(1)

print(f"Found image: {openclaw_image['name']} (ID: {openclaw_image['id']})")

# 3. Check config
config_url = f"{BASE_URL}/api/applications/openclaw/config"
config_response = requests.get(config_url, headers=headers)

if config_response.status_code == 404:
    # Create config
    print("Creating OpenClaw config...")
    config_data = {
        "image_id": openclaw_image["id"],
        "cpu_request": 4.0,
        "memory_request": 8.0,
        "gpu_request": 0,
        "ssh_enabled": False,
        "bound_ip": "192.168.1.100"  # Modify as needed
    }
    requests.post(config_url, headers=headers, json=config_data)
    print("Config created")
else:
    print("Using existing config")

# 4. Launch instance
print("Launching OpenClaw instance...")
launch_response = requests.post(
    f"{BASE_URL}/api/applications/openclaw/launch",
    headers=headers,
    json={"count": 1}
)

if launch_response.status_code == 400 and "running instance" in launch_response.json()["detail"]:
    print("OpenClaw already running")
else:
    launch_response.raise_for_status()
    print("Instance created")

# 5. Wait for instance ready
print("Waiting for instance ready...")
instances_url = f"{BASE_URL}/api/applications/openclaw/instances"
max_wait = 300  # 5 minutes
start_time = time.time()

while time.time() - start_time < max_wait:
    instances_response = requests.get(instances_url, headers=headers)
    instances = instances_response.json()["instances"]

    if not instances:
        print("Error: Instance not found")
        break

    instance = instances[0]
    k8s_status = instance.get("k8s_status")

    print(f"Status: {k8s_status}")

    if k8s_status == "Running":
        print("\n✅ OpenClaw is ready!")
        print(f"Access URL: http://{instance['bound_ip']}")
        print(f"Password: {instance['password']}")
        break
    elif k8s_status == "Failed":
        print("\n❌ Instance launch failed")
        break

    time.sleep(5)
else:
    print("\n⏱️ Timeout")
```

### Object-Oriented Version

```python
import requests
import time
from typing import Optional, Dict

class OpenClawClient:
    """OpenClaw client"""

    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url
        self.username = username
        self.password = password
        self.token = None
        self.headers = {}

    def authenticate(self):
        """Authenticate and get token"""
        response = requests.post(
            f"{self.base_url}/api/auth/login/local",
            json={"username": self.username, "password": self.password}
        )
        response.raise_for_status()
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        print("✓ Authenticated")

    def find_image(self) -> int:
        """Find OpenClaw image"""
        response = requests.get(
            f"{self.base_url}/api/images",
            headers=self.headers
        )
        response.raise_for_status()

        for img in response.json():
            if img.get("tags") and "openclaw" in img["tags"]:
                print(f"✓ Found image: {img['name']} (ID: {img['id']})")
                return img["id"]

        raise ValueError("OpenClaw image not found")

    def ensure_config(self, image_id: int, bound_ip: Optional[str] = None):
        """Ensure config exists"""
        config_url = f"{self.base_url}/api/applications/openclaw/config"
        response = requests.get(config_url, headers=self.headers)

        if response.status_code == 404:
            print("⚙️ Creating config...")
            config_data = {
                "image_id": image_id,
                "cpu_request": 4.0,
                "memory_request": 8.0,
                "gpu_request": 0,
                "ssh_enabled": False,
                "bound_ip": bound_ip
            }
            response = requests.post(
                config_url,
                headers=self.headers,
                json=config_data
            )
            response.raise_for_status()
            print("✓ Config created")
        else:
            print("✓ Using existing config")

    def launch(self) -> Dict:
        """Launch OpenClaw instance"""
        print("🚀 Launching instance...")
        response = requests.post(
            f"{self.base_url}/api/applications/openclaw/launch",
            headers=self.headers,
            json={"count": 1}
        )

        if response.status_code == 400:
            detail = response.json()["detail"]
            if "running instance" in detail:
                print("ℹ️ Instance already running, getting info...")
                return self.get_instance()
            raise ValueError(detail)

        response.raise_for_status()
        print("✓ Instance created")
        return response.json()["instances"][0]

    def get_instance(self) -> Dict:
        """Get instance info"""
        response = requests.get(
            f"{self.base_url}/api/applications/openclaw/instances",
            headers=self.headers
        )
        response.raise_for_status()
        instances = response.json()["instances"]
        if not instances:
            raise ValueError("No running instance")
        return instances[0]

    def wait_for_ready(self, max_wait: int = 300) -> Dict:
        """Wait for instance ready"""
        print("⏳ Waiting for instance ready...")
        start_time = time.time()

        while time.time() - start_time < max_wait:
            instance = self.get_instance()
            k8s_status = instance.get("k8s_status")

            if k8s_status == "Running":
                print("✅ Instance ready")
                return instance
            elif k8s_status == "Failed":
                raise RuntimeError("Instance launch failed")

            print(f"   Status: {k8s_status}")
            time.sleep(5)

        raise TimeoutError(f"Instance not ready after {max_wait}s")

    def run(self, bound_ip: Optional[str] = None) -> Dict:
        """Complete flow: launch OpenClaw"""
        self.authenticate()
        image_id = self.find_image()
        self.ensure_config(image_id, bound_ip)
        self.launch()
        instance = self.wait_for_ready()

        print("\n" + "="*50)
        print("🎉 OpenClaw launched successfully!")
        print(f"Access URL: http://{instance['bound_ip']}")
        print(f"Password: {instance['password']}")
        print("="*50)

        return instance

# Usage example
if __name__ == "__main__":
    client = OpenClawClient(
        base_url="http://localhost:42900",
        username="your_username",
        password="your_password"
    )

    try:
        instance = client.run(bound_ip="192.168.1.100")
    except Exception as e:
        print(f"❌ Error: {str(e)}")
```

## Bash Script Example

```bash
#!/bin/bash

# Configuration
BASE_URL="http://localhost:42900"
USERNAME="your_username"
PASSWORD="your_password"

# 1. Authenticate
echo "🔐 Authenticating..."
TOKEN=$(curl -s -X POST "${BASE_URL}/api/auth/login/local" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}" \
  | jq -r '.access_token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Authentication failed"
  exit 1
fi

echo "✓ Authenticated"

# 2. Find OpenClaw image
echo "🔍 Finding OpenClaw image..."
IMAGE_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "${BASE_URL}/api/images" \
  | jq -r '.[] | select(.tags != null and (.tags | contains(["openclaw"]))) | .id' \
  | head -1)

if [ -z "$IMAGE_ID" ]; then
  echo "❌ OpenClaw image not found"
  exit 1
fi

echo "✓ Found image ID: $IMAGE_ID"

# 3. Check config
echo "⚙️ Checking config..."
CONFIG_EXISTS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "${BASE_URL}/api/applications/openclaw/config")

if [ "$CONFIG_EXISTS" = "404" ]; then
  echo "Creating config..."
  curl -s -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"image_id\":${IMAGE_ID},\"cpu_request\":4.0,\"memory_request\":8.0,\"gpu_request\":0,\"bound_ip\":\"192.168.1.100\"}" \
    "${BASE_URL}/api/applications/openclaw/config" > /dev/null
  echo "✓ Config created"
else
  echo "✓ Using existing config"
fi

# 4. Launch instance
echo "🚀 Launching instance..."
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"count":1}' \
  "${BASE_URL}/api/applications/openclaw/launch" > /dev/null

# 5. Wait for instance ready
echo "⏳ Waiting for instance ready..."
MAX_WAIT=300
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
  STATUS=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "${BASE_URL}/api/applications/openclaw/instances" \
    | jq -r '.instances[0].k8s_status')

  echo "   Status: $STATUS"

  if [ "$STATUS" = "Running" ]; then
    echo "✅ Instance ready"
    break
  elif [ "$STATUS" = "Failed" ]; then
    echo "❌ Instance launch failed"
    exit 1
  fi

  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

# 6. Get access info
INSTANCE_INFO=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "${BASE_URL}/api/applications/openclaw/instances" \
  | jq -r '.instances[0]')

BOUND_IP=$(echo "$INSTANCE_INFO" | jq -r '.bound_ip')
PASSWORD=$(echo "$INSTANCE_INFO" | jq -r '.password')

echo ""
echo "=================================================="
echo "🎉 OpenClaw launched successfully!"
echo "Access URL: http://${BOUND_IP}"
echo "Password: ${PASSWORD}"
echo "=================================================="
```

## Common Questions

### Q: How to modify resource configuration?

A: Modify cpu_request, memory_request, and gpu_request parameters in config request.

### Q: How to use custom IP?

A: Set bound_ip field in config to an available MacVLAN IP address.

### Q: What to do if instance launch fails?

A: Check container events for detailed error information:
```bash
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:42900/api/containers/{id}/events
```

### Q: How to stop instance?

A: Call stop endpoint:
```bash
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     http://localhost:42900/api/applications/openclaw/stop
```
