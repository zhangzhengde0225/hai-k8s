# OpenClaw启动示例

本文档提供完整的OpenClaw启动示例代码，适用于不同编程语言。

## Python示例

### 基础版本

```python
import requests
import time

# 配置
BASE_URL = "http://localhost:42900"
USERNAME = "your_username"
PASSWORD = "your_password"

# 1. 认证
auth_response = requests.post(
    f"{BASE_URL}/api/auth/login/local",
    json={"username": USERNAME, "password": PASSWORD}
)
token = auth_response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 2. 查找OpenClaw镜像
images_response = requests.get(f"{BASE_URL}/api/images", headers=headers)
openclaw_image = None
for img in images_response.json():
    if img.get("tags") and "openclaw" in img["tags"]:
        openclaw_image = img
        break

if not openclaw_image:
    print("未找到OpenClaw镜像")
    exit(1)

print(f"找到镜像: {openclaw_image['name']} (ID: {openclaw_image['id']})")

# 3. 检查配置
config_url = f"{BASE_URL}/api/applications/openclaw/config"
config_response = requests.get(config_url, headers=headers)

if config_response.status_code == 404:
    # 创建配置
    print("创建OpenClaw配置...")
    config_data = {
        "image_id": openclaw_image["id"],
        "cpu_request": 4.0,
        "memory_request": 8.0,
        "gpu_request": 0,
        "ssh_enabled": False,
        "bound_ip": "192.168.1.100"  # 根据实际情况修改
    }
    requests.post(config_url, headers=headers, json=config_data)
    print("配置已创建")
else:
    print("使用现有配置")

# 4. 启动实例
print("启动OpenClaw实例...")
launch_response = requests.post(
    f"{BASE_URL}/api/applications/openclaw/launch",
    headers=headers,
    json={"count": 1}
)

if launch_response.status_code == 400 and "已有运行中" in launch_response.json()["detail"]:
    print("OpenClaw已在运行中")
else:
    launch_response.raise_for_status()
    print("实例已创建")

# 5. 等待实例运行
print("等待实例准备就绪...")
instances_url = f"{BASE_URL}/api/applications/openclaw/instances"
max_wait = 300  # 5分钟
start_time = time.time()

while time.time() - start_time < max_wait:
    instances_response = requests.get(instances_url, headers=headers)
    instances = instances_response.json()["instances"]

    if not instances:
        print("错误：实例不存在")
        break

    instance = instances[0]
    k8s_status = instance.get("k8s_status")

    print(f"状态: {k8s_status}")

    if k8s_status == "Running":
        print("\n✅ OpenClaw已就绪！")
        print(f"访问地址: http://{instance['bound_ip']}")
        print(f"密码: {instance['password']}")
        break
    elif k8s_status == "Failed":
        print("\n❌ 实例启动失败")
        break

    time.sleep(5)
else:
    print("\n⏱️ 等待超时")
```

### 面向对象版本

```python
import requests
import time
from typing import Optional, Dict

class OpenClawClient:
    """OpenClaw客户端"""

    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url
        self.username = username
        self.password = password
        self.token = None
        self.headers = {}

    def authenticate(self):
        """认证并获取token"""
        response = requests.post(
            f"{self.base_url}/api/auth/login/local",
            json={"username": self.username, "password": self.password}
        )
        response.raise_for_status()
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        print("✓ 认证成功")

    def find_image(self) -> int:
        """查找OpenClaw镜像"""
        response = requests.get(
            f"{self.base_url}/api/images",
            headers=self.headers
        )
        response.raise_for_status()

        for img in response.json():
            if img.get("tags") and "openclaw" in img["tags"]:
                print(f"✓ 找到镜像: {img['name']} (ID: {img['id']})")
                return img["id"]

        raise ValueError("未找到OpenClaw镜像")

    def ensure_config(self, image_id: int, bound_ip: Optional[str] = None):
        """确保配置存在"""
        config_url = f"{self.base_url}/api/applications/openclaw/config"
        response = requests.get(config_url, headers=self.headers)

        if response.status_code == 404:
            print("⚙️ 创建配置...")
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
            print("✓ 配置已创建")
        else:
            print("✓ 使用现有配置")

    def launch(self) -> Dict:
        """启动OpenClaw实例"""
        print("🚀 启动实例...")
        response = requests.post(
            f"{self.base_url}/api/applications/openclaw/launch",
            headers=self.headers,
            json={"count": 1}
        )

        if response.status_code == 400:
            detail = response.json()["detail"]
            if "已有运行中" in detail:
                print("ℹ️ 实例已运行，获取现有实例信息...")
                return self.get_instance()
            raise ValueError(detail)

        response.raise_for_status()
        print("✓ 实例已创建")
        return response.json()["instances"][0]

    def get_instance(self) -> Dict:
        """获取实例信息"""
        response = requests.get(
            f"{self.base_url}/api/applications/openclaw/instances",
            headers=self.headers
        )
        response.raise_for_status()
        instances = response.json()["instances"]
        if not instances:
            raise ValueError("没有运行中的实例")
        return instances[0]

    def wait_for_ready(self, max_wait: int = 300) -> Dict:
        """等待实例就绪"""
        print("⏳ 等待实例就绪...")
        start_time = time.time()

        while time.time() - start_time < max_wait:
            instance = self.get_instance()
            k8s_status = instance.get("k8s_status")

            if k8s_status == "Running":
                print("✅ 实例已就绪")
                return instance
            elif k8s_status == "Failed":
                raise RuntimeError("实例启动失败")

            print(f"   状态: {k8s_status}")
            time.sleep(5)

        raise TimeoutError(f"实例在{max_wait}秒内未就绪")

    def run(self, bound_ip: Optional[str] = None) -> Dict:
        """完整流程：启动OpenClaw"""
        self.authenticate()
        image_id = self.find_image()
        self.ensure_config(image_id, bound_ip)
        self.launch()
        instance = self.wait_for_ready()

        print("\n" + "="*50)
        print("🎉 OpenClaw启动成功！")
        print(f"访问地址: http://{instance['bound_ip']}")
        print(f"密码: {instance['password']}")
        print("="*50)

        return instance

# 使用示例
if __name__ == "__main__":
    client = OpenClawClient(
        base_url="http://localhost:42900",
        username="your_username",
        password="your_password"
    )

    try:
        instance = client.run(bound_ip="192.168.1.100")
    except Exception as e:
        print(f"❌ 错误: {str(e)}")
```

## Bash脚本示例

```bash
#!/bin/bash

# 配置
BASE_URL="http://localhost:42900"
USERNAME="your_username"
PASSWORD="your_password"

# 1. 认证
echo "🔐 正在认证..."
TOKEN=$(curl -s -X POST "${BASE_URL}/api/auth/login/local" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}" \
  | jq -r '.access_token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ 认证失败"
  exit 1
fi

echo "✓ 认证成功"

# 2. 查找OpenClaw镜像
echo "🔍 查找OpenClaw镜像..."
IMAGE_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "${BASE_URL}/api/images" \
  | jq -r '.[] | select(.tags != null and (.tags | contains(["openclaw"]))) | .id' \
  | head -1)

if [ -z "$IMAGE_ID" ]; then
  echo "❌ 未找到OpenClaw镜像"
  exit 1
fi

echo "✓ 找到镜像 ID: $IMAGE_ID"

# 3. 检查配置
echo "⚙️ 检查配置..."
CONFIG_EXISTS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "${BASE_URL}/api/applications/openclaw/config")

if [ "$CONFIG_EXISTS" = "404" ]; then
  echo "创建配置..."
  curl -s -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"image_id\":${IMAGE_ID},\"cpu_request\":4.0,\"memory_request\":8.0,\"gpu_request\":0,\"bound_ip\":\"192.168.1.100\"}" \
    "${BASE_URL}/api/applications/openclaw/config" > /dev/null
  echo "✓ 配置已创建"
else
  echo "✓ 使用现有配置"
fi

# 4. 启动实例
echo "🚀 启动实例..."
LAUNCH_RESULT=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"count":1}' \
  "${BASE_URL}/api/applications/openclaw/launch")

# 5. 等待实例运行
echo "⏳ 等待实例就绪..."
MAX_WAIT=300
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
  STATUS=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "${BASE_URL}/api/applications/openclaw/instances" \
    | jq -r '.instances[0].k8s_status')

  echo "   状态: $STATUS"

  if [ "$STATUS" = "Running" ]; then
    echo "✅ 实例已就绪"
    break
  elif [ "$STATUS" = "Failed" ]; then
    echo "❌ 实例启动失败"
    exit 1
  fi

  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  echo "⏱️ 等待超时"
  exit 1
fi

# 6. 获取访问信息
INSTANCE_INFO=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "${BASE_URL}/api/applications/openclaw/instances" \
  | jq -r '.instances[0]')

BOUND_IP=$(echo "$INSTANCE_INFO" | jq -r '.bound_ip')
PASSWORD=$(echo "$INSTANCE_INFO" | jq -r '.password')

echo ""
echo "=================================================="
echo "🎉 OpenClaw启动成功！"
echo "访问地址: http://${BOUND_IP}"
echo "密码: ${PASSWORD}"
echo "=================================================="
```

## JavaScript/Node.js示例

```javascript
const axios = require('axios');

const BASE_URL = 'http://localhost:42900';
const USERNAME = 'your_username';
const PASSWORD = 'your_password';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function launchOpenClaw() {
  try {
    // 1. 认证
    console.log('🔐 正在认证...');
    const authResponse = await axios.post(`${BASE_URL}/api/auth/login/local`, {
      username: USERNAME,
      password: PASSWORD
    });
    const token = authResponse.data.access_token;
    const headers = { Authorization: `Bearer ${token}` };
    console.log('✓ 认证成功');

    // 2. 查找镜像
    console.log('🔍 查找OpenClaw镜像...');
    const imagesResponse = await axios.get(`${BASE_URL}/api/images`, { headers });
    const openclawImage = imagesResponse.data.find(
      img => img.tags && img.tags.includes('openclaw')
    );

    if (!openclawImage) {
      throw new Error('未找到OpenClaw镜像');
    }
    console.log(`✓ 找到镜像: ${openclawImage.name} (ID: ${openclawImage.id})`);

    // 3. 检查配置
    console.log('⚙️ 检查配置...');
    const configUrl = `${BASE_URL}/api/applications/openclaw/config`;
    try {
      await axios.get(configUrl, { headers });
      console.log('✓ 使用现有配置');
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('创建配置...');
        await axios.post(configUrl, {
          image_id: openclawImage.id,
          cpu_request: 4.0,
          memory_request: 8.0,
          gpu_request: 0,
          ssh_enabled: false,
          bound_ip: '192.168.1.100'
        }, { headers });
        console.log('✓ 配置已创建');
      } else {
        throw error;
      }
    }

    // 4. 启动实例
    console.log('🚀 启动实例...');
    try {
      await axios.post(
        `${BASE_URL}/api/applications/openclaw/launch`,
        { count: 1 },
        { headers }
      );
      console.log('✓ 实例已创建');
    } catch (error) {
      if (error.response && error.response.data.detail.includes('已有运行中')) {
        console.log('ℹ️ 实例已运行');
      } else {
        throw error;
      }
    }

    // 5. 等待实例就绪
    console.log('⏳ 等待实例就绪...');
    const maxWait = 300000; // 5分钟
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const instancesResponse = await axios.get(
        `${BASE_URL}/api/applications/openclaw/instances`,
        { headers }
      );
      const instances = instancesResponse.data.instances;

      if (!instances || instances.length === 0) {
        throw new Error('实例不存在');
      }

      const instance = instances[0];
      const k8sStatus = instance.k8s_status;

      console.log(`   状态: ${k8sStatus}`);

      if (k8sStatus === 'Running') {
        console.log('✅ 实例已就绪');
        console.log('\n' + '='.repeat(50));
        console.log('🎉 OpenClaw启动成功！');
        console.log(`访问地址: http://${instance.bound_ip}`);
        console.log(`密码: ${instance.password}`);
        console.log('='.repeat(50));
        return instance;
      } else if (k8sStatus === 'Failed') {
        throw new Error('实例启动失败');
      }

      await sleep(5000);
    }

    throw new Error('等待超时');

  } catch (error) {
    console.error('❌ 错误:', error.message);
    throw error;
  }
}

// 运行
launchOpenClaw()
  .then(() => console.log('完成'))
  .catch(() => process.exit(1));
```

## 常见问题

### Q: 如何修改资源配置？

A: 修改config请求中的cpu_request、memory_request和gpu_request参数。

### Q: 如何使用自定义IP？

A: 在config中设置bound_ip字段为可用的MacVLAN IP地址。

### Q: 实例启动失败怎么办？

A: 检查容器事件获取详细错误信息：
```bash
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:42900/api/containers/{id}/events
```

### Q: 如何停止实例？

A: 调用stop端点：
```bash
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     http://localhost:42900/api/applications/openclaw/stop
```
