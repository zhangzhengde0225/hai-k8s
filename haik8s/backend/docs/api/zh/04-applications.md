# 应用服务

HAI-K8S应用服务系统提供预配置的应用模板（如OpenClaw），简化复杂应用的部署流程。

## 核心概念

### 应用 vs 容器

- **容器（Container）**: 通用的Pod实例，完全自定义配置
- **应用（Application）**: 预配置的应用模板，简化部署流程

### 应用特性

1. **配置管理**: 保存应用配置，一次配置多次启动
2. **密码管理**: 自动生成root和用户密码
3. **网络配置**: 支持MacVLAN直接IP访问
4. **用户同步**: 自动创建对应的Linux用户
5. **防火墙**: 可选的iptables规则配置

## 支持的应用

| 应用ID | 名称 | 描述 | 版本 |
|--------|------|------|------|
| openclaw | OpenClaw | AI代理开发平台 | 1.0.0 |

## 应用生命周期

```
1. 列出应用        GET /api/applications
2. 保存配置        POST /api/applications/{app_id}/config
3. 获取配置        GET /api/applications/{app_id}/config
4. 启动实例        POST /api/applications/{app_id}/launch
5. 查看实例        GET /api/applications/{app_id}/instances
6. 停止实例        POST /api/applications/{app_id}/stop
```

## API端点详解

### 1. 列出所有应用

```
GET /api/applications
```

**响应示例：**
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

**status字段说明：**
- `unconfigured`: 未配置
- `configured`: 已配置但未启动
- `stopped`: 有实例但已停止
- `running`: 有运行中的实例

### 2. 保存应用配置

```
POST /api/applications/{app_id}/config
PUT /api/applications/{app_id}/config
```

**请求体：**
```json
{
  "image_id": 5,
  "cpu_request": 4.0,
  "memory_request": 8.0,
  "gpu_request": 0,
  "ssh_enabled": false,
  "bound_ip": "192.168.1.100",
  "sync_user": true,
  "enable_sudo": false,
  "root_password": "optional_custom_password",
  "user_password": "optional_custom_password"
}
```

**字段说明：**
- `image_id`: 镜像ID（必须带有对应应用标签）
- `cpu_request`: CPU核心数（0.1-32.0）
- `memory_request`: 内存GB（0.5-128.0）
- `gpu_request`: GPU数量（0-8）
- `ssh_enabled`: 是否启用SSH（默认false）
- `bound_ip`: MacVLAN绑定IP（可选）
- `sync_user`: 是否同步用户到容器（默认true）
- `enable_sudo`: 用户是否有sudo权限（默认false）
- `root_password`: 自定义root密码（可选，不设置会自动生成）
- `user_password`: 自定义用户密码（可选，不设置会自动生成）

**响应：**
```json
{
  "id": 42,
  "application_id": "openclaw",
  "image_id": 5,
  "image_name": "OpenClaw v1.0.0",
  "cpu_request": 4.0,
  "memory_request": 8.0,
  "gpu_request": 0,
  "ssh_enabled": false,
  "bound_ip": "192.168.1.100",
  "root_password": "GeneratedPass123",
  "user_password": "GeneratedPass456",
  "status": "validated",
  "created_at": "2026-03-11T10:00:00Z"
}
```

### 3. 获取应用配置

```
GET /api/applications/{app_id}/config
```

**响应：** 同保存配置的响应格式

**错误：**
- `404`: 配置不存在（需要先保存配置）

### 4. 启动应用实例

```
POST /api/applications/{app_id}/launch
```

**请求体：**
```json
{
  "count": 1,
  "instance_name": "openclaw-prod"
}
```

**字段说明：**
- `count`: 启动实例数（默认1，某些应用支持多实例）
- `instance_name`: 实例名称（可选，单实例时使用）

**响应：**
```json
{
  "message": "成功启动 1 个实例",
  "instances": [
    {
      "id": 123,
      "name": "openclaw-prod",
      "config_id": 42,
      "status": "creating",
      "bound_ip": "192.168.1.100",
      "ssh_command": "ssh root@192.168.1.100",
      "root_password": "GeneratedPass123",
      "user_password": "GeneratedPass456",
      "created_at": "2026-03-11T10:30:00Z"
    }
  ]
}
```

**前置条件：**
- 必须先保存配置
- 配置状态为`validated`
- 资源配额充足
- 同一应用不能有其他运行中实例

**错误处理：**
```json
// 配置不存在
{"detail": "配置不存在，请先保存配置"}

// 已有运行中实例
{"detail": "该应用已有运行中的实例，请先删除后再启动"}

// 配额不足
{"detail": "CPU配额不足"}
```

### 5. 查看应用实例

```
GET /api/applications/{app_id}/instances
```

**响应：**
```json
{
  "application": {
    "id": "openclaw",
    "name": "OpenClaw",
    "version": "1.0.0"
  },
  "instances": [
    {
      "id": 123,
      "name": "openclaw-prod",
      "status": "running",
      "k8s_status": "Running",
      "cpu_request": 4.0,
      "memory_request": 8.0,
      "gpu_request": 0,
      "ssh_enabled": false,
      "bound_ip": "192.168.1.100",
      "password": "GeneratedPass456",
      "created_at": "2026-03-11T10:30:00Z"
    }
  ],
  "total": 1
}
```

**k8s_status说明：**
- `Pending`: Pod正在调度
- `Running`: Pod运行中
- `Failed`: Pod启动失败
- `Unknown`: 状态未知

### 6. 停止应用实例

```
POST /api/applications/{app_id}/stop
```

**响应：**
```json
{
  "message": "删除了 1 个实例",
  "deleted": 1
}
```

**注意：**
- 此操作会删除所有运行中和创建中的实例
- Pod删除是异步的，完全终止需要几秒钟
- 数据库记录标记为DELETED但不会物理删除

## OpenClaw快速启动指南

### 完整流程示例

```bash
# 步骤1：列出应用，确认OpenClaw可用
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:42900/api/applications

# 步骤2：查找OpenClaw镜像
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:42900/api/images | jq '.[] | select(.tags | contains("openclaw"))'

# 步骤3：保存OpenClaw配置
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "image_id": 5,
       "cpu_request": 4.0,
       "memory_request": 8.0,
       "gpu_request": 0,
       "ssh_enabled": false,
       "bound_ip": "192.168.1.100"
     }' \
     http://localhost:42900/api/applications/openclaw/config

# 步骤4：启动实例
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"count": 1}' \
     http://localhost:42900/api/applications/openclaw/launch

# 步骤5：等待实例运行（轮询状态）
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

# 步骤6：获取访问信息
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:42900/api/applications/openclaw/instances \
     | jq '.instances[0] | {bound_ip, password}'
```

### Python完整示例

```python
import requests
import time

class OpenClawLauncher:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {token}"}

    def launch_openclaw(self, image_id, cpu=4.0, memory=8.0, bound_ip=None):
        """启动OpenClaw实例"""

        # 1. 检查现有配置
        config_url = f"{self.base_url}/api/applications/openclaw/config"
        config_response = requests.get(config_url, headers=self.headers)

        if config_response.status_code == 404:
            # 2. 创建配置
            config_data = {
                "image_id": image_id,
                "cpu_request": cpu,
                "memory_request": memory,
                "gpu_request": 0,
                "ssh_enabled": False,
                "bound_ip": bound_ip,
                "sync_user": True
            }
            print("Creating OpenClaw configuration...")
            create_response = requests.post(
                config_url,
                headers=self.headers,
                json=config_data
            )
            create_response.raise_for_status()
            print("Configuration saved successfully")

        # 3. 启动实例
        launch_url = f"{self.base_url}/api/applications/openclaw/launch"
        print("Launching OpenClaw instance...")
        launch_response = requests.post(
            launch_url,
            headers=self.headers,
            json={"count": 1}
        )
        launch_response.raise_for_status()
        instance = launch_response.json()["instances"][0]
        print(f"Instance created: {instance['name']} (ID: {instance['id']})")

        # 4. 等待运行
        instances_url = f"{self.base_url}/api/applications/openclaw/instances"
        print("Waiting for instance to be ready...")
        while True:
            instances_response = requests.get(instances_url, headers=self.headers)
            instances = instances_response.json()["instances"]
            if instances and instances[0]["k8s_status"] == "Running":
                instance_info = instances[0]
                print("\nOpenClaw is ready!")
                print(f"Access URL: http://{instance_info['bound_ip']}")
                print(f"Password: {instance_info['password']}")
                return instance_info
            time.sleep(5)

# 使用示例
launcher = OpenClawLauncher("http://localhost:42900", "YOUR_TOKEN")
instance = launcher.launch_openclaw(
    image_id=5,
    cpu=4.0,
    memory=8.0,
    bound_ip="192.168.1.100"
)
```

## 配置高级选项

### 自定义挂载卷

```json
{
  "image_id": 5,
  "cpu_request": 4.0,
  "memory_request": 8.0,
  "volume_mounts": [
    {
      "name": "data-volume",
      "mount_path": "/data",
      "pvc_name": "my-pvc"
    }
  ]
}
```

### 防火墙配置

```json
{
  "image_id": 5,
  "cpu_request": 4.0,
  "memory_request": 8.0,
  "enable_firewall": true,
  "firewall_rules": [
    {
      "port": 22,
      "protocol": "tcp",
      "source": "10.0.0.0/8",
      "action": "allow"
    },
    {
      "port": 80,
      "protocol": "tcp",
      "source": "0.0.0.0/0",
      "action": "allow"
    }
  ],
  "firewall_default_policy": "drop"
}
```

### 用户同步配置

```json
{
  "image_id": 5,
  "cpu_request": 4.0,
  "memory_request": 8.0,
  "sync_user": true,
  "user_uid": 1000,
  "user_gid": 1000,
  "user_home_dir": "/home/myuser",
  "enable_sudo": true
}
```

## 故障排查

### 问题1：启动失败（状态一直是creating）

**检查Pod状态：**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:42900/api/applications/openclaw/instances
```

查看`k8s_status`字段。如果是`Pending`或`Failed`，可能是：
- 镜像拉取失败
- 资源不足（CPU/内存/GPU）
- MacVLAN IP冲突

### 问题2：无法访问bound_ip

**检查：**
1. IP是否在MacVLAN网段内
2. 防火墙规则是否正确
3. Pod是否Running

### 问题3：密码不正确

**获取当前密码：**
```bash
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:42900/api/applications/openclaw/config \
     | jq '{root_password, user_password}'
```

## 下一步

- **[智能体集成](agent-integration)**: AI代理如何启动OpenClaw
- **[容器管理](containers)**: 通用容器操作
- **[IP分配](ip-allocations)**: MacVLAN IP管理
