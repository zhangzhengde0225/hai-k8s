# 快速开始

欢迎使用HAI-K8S API！本指南将帮助您在5分钟内创建第一个容器。

## 前置条件

- 有效的HAI-K8S账户
- 获得认证token（参见[认证](authentication)章节）

## 快速流程

### 1. 认证获取Token

**本地认证示例：**

```bash
curl -X POST http://localhost:42900/api/auth/login/local \
     -H "Content-Type: application/json" \
     -d '{
       "username": "your_username",
       "password": "your_password"
     }'
```

**响应：**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

保存access_token用于后续请求。

### 2. 查看可用镜像

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:42900/api/images
```

**响应示例：**
```json
[
  {
    "id": 1,
    "name": "Ubuntu 22.04 Dev",
    "registry_url": "registry.example.com/ubuntu:22.04-dev",
    "is_active": true,
    "gpu_required": false
  },
  {
    "id": 2,
    "name": "PyTorch GPU",
    "registry_url": "registry.example.com/pytorch:2.0-cuda11.8",
    "is_active": true,
    "gpu_required": true
  }
]
```

记下您想使用的镜像ID。

### 3. 检查资源配额

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:42900/api/users/me
```

**响应示例：**
```json
{
  "id": 1,
  "username": "your_username",
  "cpu_quota": 16.0,
  "memory_quota": 64.0,
  "gpu_quota": 2,
  "is_admin": false
}
```

确保您的配额足够创建容器。

### 4. 创建容器

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

**响应示例：**
```json
{
  "id": 123,
  "name": "my-first-container",
  "status": "creating",
  "ssh_command": "ssh -p 30123 root@node.example.com",
  "root_password": "GeneratedPassword123",
  "created_at": "2026-03-11T10:30:00Z"
}
```

### 5. 等待容器运行

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:42900/api/containers/123
```

等待status变为"running"（通常需要30-60秒）。

### 6. 访问容器

使用返回的SSH命令和密码登录：

```bash
ssh -p 30123 root@node.example.com
# 输入密码：GeneratedPassword123
```

## Python示例

```python
import requests
import time

# 认证
auth_response = requests.post(
    "http://localhost:42900/api/auth/login/local",
    json={"username": "your_username", "password": "your_password"}
)
token = auth_response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 创建容器
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

# 等待运行
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

## 下一步

- **[认证](authentication)**: 详细的认证流程和SSO集成
- **[容器管理](containers)**: 容器生命周期的完整操作
- **[应用服务](applications)**: 启动OpenClaw等应用服务
- **[智能体集成](agent-integration)**: 为AI代理提供的完整指南

## 常见问题

**Q: 容器创建后一直是"creating"状态？**
A: 这通常是正常的。大型镜像的首次拉取可能需要几分钟。如果超过5分钟，检查容器事件：
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:42900/api/containers/{id}/events
```

**Q: 配额不足怎么办？**
A: 联系管理员增加配额，或删除不用的容器释放资源。

**Q: 忘记了SSH密码？**
A: 通过`GET /api/containers/{id}`重新获取密码。

**Q: 如何停止容器？**
A: 使用`POST /api/containers/{id}/stop`停止容器释放资源。
