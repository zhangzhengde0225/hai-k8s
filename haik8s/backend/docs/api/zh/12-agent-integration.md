# 智能体集成指南

本指南专为AI智能体（AI Agent）设计，提供完整的API集成模式、错误处理和最佳实践。

## 核心概念

### 智能体任务类型

1. **应用服务启动** - 为用户启动OpenClaw等服务
2. **容器管理** - 创建、启动、停止容器
3. **资源监控** - 检查配额和使用情况
4. **故障诊断** - 分析日志和事件

### 认证流程

智能体必须代表用户进行操作，需要用户的JWT token：

```python
def authenticate_user(username: str, password: str) -> str:
    """认证并获取token"""
    response = requests.post(
        "http://localhost:42900/api/auth/login/local",
        json={"username": username, "password": password}
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    raise AuthenticationError(response.json()["detail"])
```

### 资源层级

```
User (用户)
 ├── Quota (配额): CPU, Memory, GPU
 ├── Applications (应用)
 │    ├── Config (配置)
 │    └── Instances (实例)
 └── Containers (容器)
```

### 生命周期状态

**容器/实例状态：**
- `creating` → `running` → `stopped` / `deleted`
- `failed` (错误状态)

**配置状态：**
- `validated` (可用)
- `archived` (已归档)

## 常见智能体任务

### 任务1：启动OpenClaw服务

**目标：** 为用户启动一个OpenClaw实例，提供访问URL和密码。

**完整实现：**

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
        启动OpenClaw实例

        Args:
            image_id: 镜像ID（如果为None会自动查找）
            cpu: CPU核心数
            memory: 内存GB
            bound_ip: 绑定IP（可选）

        Returns:
            实例信息字典
        """

        # Step 1: 查找OpenClaw镜像（如果未指定）
        if image_id is None:
            print("🔍 查找OpenClaw镜像...")
            image_id = self._find_openclaw_image()
            print(f"✓ 找到镜像 ID: {image_id}")

        # Step 2: 检查用户配额
        print("📊 检查资源配额...")
        if not self._check_quota(cpu, memory, 0):
            raise QuotaExceededError("资源配额不足")
        print("✓ 配额充足")

        # Step 3: 检查/创建配置
        print("⚙️ 检查应用配置...")
        config = self._get_or_create_config(image_id, cpu, memory, bound_ip)
        print(f"✓ 配置已就绪 (ID: {config['id']})")

        # Step 4: 启动实例
        print("🚀 启动OpenClaw实例...")
        instance = self._launch_instance()
        print(f"✓ 实例已创建: {instance['name']}")

        # Step 5: 等待Pod运行
        print("⏳ 等待实例准备就绪...")
        instance_info = self._wait_for_running(max_wait=300)
        print("✅ OpenClaw已就绪!")

        return {
            "id": instance_info["id"],
            "name": instance_info["name"],
            "status": instance_info["status"],
            "access_url": f"http://{instance_info['bound_ip']}" if instance_info.get("bound_ip") else None,
            "password": instance_info["password"],
            "created_at": instance_info["created_at"]
        }

    def _find_openclaw_image(self) -> int:
        """查找OpenClaw镜像"""
        response = requests.get(
            f"{self.base_url}/api/images",
            headers=self.headers
        )
        response.raise_for_status()

        for image in response.json():
            if image.get("tags") and "openclaw" in image["tags"]:
                return image["id"]

        raise ImageNotFoundError("未找到OpenClaw镜像")

    def _check_quota(self, cpu: float, memory: float, gpu: int) -> bool:
        """检查用户配额"""
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
        """获取或创建OpenClaw配置"""
        # 尝试获取现有配置
        response = requests.get(
            f"{self.base_url}/api/applications/openclaw/config",
            headers=self.headers
        )

        if response.status_code == 200:
            return response.json()

        # 配置不存在，创建新配置
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
        """启动OpenClaw实例"""
        response = requests.post(
            f"{self.base_url}/api/applications/openclaw/launch",
            headers=self.headers,
            json={"count": 1}
        )

        if response.status_code == 400:
            error_detail = response.json()["detail"]
            if "已有运行中的实例" in error_detail:
                # 返回现有实例
                return self._get_existing_instance()
            raise LaunchError(error_detail)

        response.raise_for_status()
        return response.json()["instances"][0]

    def _get_existing_instance(self) -> Dict:
        """获取现有实例信息"""
        response = requests.get(
            f"{self.base_url}/api/applications/openclaw/instances",
            headers=self.headers
        )
        response.raise_for_status()
        instances = response.json()["instances"]
        if instances:
            return instances[0]
        raise InstanceNotFoundError("未找到运行中的实例")

    def _wait_for_running(self, max_wait: int = 300) -> Dict:
        """等待实例进入Running状态"""
        start_time = time.time()

        while time.time() - start_time < max_wait:
            response = requests.get(
                f"{self.base_url}/api/applications/openclaw/instances",
                headers=self.headers
            )
            response.raise_for_status()

            instances = response.json()["instances"]
            if not instances:
                raise InstanceNotFoundError("实例已被删除")

            instance = instances[0]
            k8s_status = instance.get("k8s_status")

            if k8s_status == "Running":
                return instance
            elif k8s_status == "Failed":
                raise InstanceFailedError("实例启动失败")

            time.sleep(5)

        raise TimeoutError(f"实例在{max_wait}秒内未能启动")

# 使用示例
agent = OpenClawAgent("http://localhost:42900", "YOUR_TOKEN")
try:
    result = agent.start_openclaw(
        cpu=4.0,
        memory=8.0,
        bound_ip="192.168.1.100"
    )
    print(f"✅ OpenClaw已启动！")
    print(f"访问地址: {result['access_url']}")
    print(f"密码: {result['password']}")
except QuotaExceededError:
    print("❌ 配额不足，请联系管理员增加配额")
except Exception as e:
    print(f"❌ 启动失败: {str(e)}")
```

### 任务2：创建GPU容器

**目标：** 为用户创建一个GPU工作站容器。

```python
def create_gpu_container(
    token: str,
    name: str,
    cpu: float = 4.0,
    memory: float = 16.0,
    gpu: int = 1
) -> Dict:
    """创建GPU容器"""
    headers = {"Authorization": f"Bearer {token}"}

    # 1. 检查GPU配额
    user_response = requests.get(
        "http://localhost:42900/api/users/me",
        headers=headers
    )
    user = user_response.json()

    if gpu > user["gpu_quota"]:
        raise QuotaExceededError(
            f"GPU请求({gpu})超过配额({user['gpu_quota']})"
        )

    # 2. 查找GPU镜像
    images_response = requests.get(
        "http://localhost:42900/api/images",
        headers=headers
    )
    gpu_images = [
        img for img in images_response.json()
        if img["gpu_required"] and img["is_active"]
    ]

    if not gpu_images:
        raise ImageNotFoundError("未找到可用的GPU镜像")

    # 使用第一个GPU镜像
    image_id = gpu_images[0]["id"]

    # 3. 创建容器
    container_data = {
        "name": name,
        "image_id": image_id,
        "cpu_request": cpu,
        "memory_request": memory,
        "gpu_request": gpu,
        "ssh_enabled": True
    }

    create_response = requests.post(
        "http://localhost:42900/api/containers",
        headers=headers,
        json=container_data
    )
    create_response.raise_for_status()

    container = create_response.json()
    print(f"✅ GPU容器已创建: {container['name']}")
    print(f"SSH命令: {container['ssh_command']}")
    print(f"密码: {container['root_password']}")

    return container
```

### 任务3：监控容器日志

**目标：** 获取容器日志并分析问题。

```python
def monitor_container_logs(
    token: str,
    container_id: int,
    tail_lines: int = 100
) -> str:
    """获取容器日志"""
    headers = {"Authorization": f"Bearer {token}"}

    response = requests.get(
        f"http://localhost:42900/api/containers/{container_id}/logs",
        headers=headers,
        params={"tail": tail_lines}
    )

    if response.status_code == 404:
        raise ContainerNotFoundError(f"容器{container_id}不存在")
    elif response.status_code == 400:
        # 容器未运行，尝试获取事件
        events_response = requests.get(
            f"http://localhost:42900/api/containers/{container_id}/events",
            headers=headers
        )
        if events_response.status_code == 200:
            events = events_response.json()
            error_events = [
                e for e in events
                if e.get("type") == "Warning" or e.get("reason") == "Failed"
            ]
            if error_events:
                return f"容器启动失败，错误事件:\n" + "\n".join(
                    f"- {e['reason']}: {e['message']}"
                    for e in error_events
                )
        return "容器未运行且无错误事件"

    response.raise_for_status()
    return response.text

# 使用示例
logs = monitor_container_logs("YOUR_TOKEN", 123, tail_lines=50)
print(logs)
```

## 错误处理模式

### 智能体友好的错误代码

| HTTP状态码 | 错误类型 | 智能体应对策略 |
|-----------|---------|--------------|
| 400 | 配额超限 | 通知用户增加配额或减少资源请求 |
| 400 | 配置缺失 | 先创建配置再启动 |
| 400 | 实例已存在 | 返回现有实例信息或停止后重启 |
| 401 | 未认证 | 重新获取token |
| 403 | 权限不足 | 通知用户权限不足 |
| 404 | 资源不存在 | 检查ID是否正确或资源是否已删除 |
| 409 | 资源冲突 | 等待并重试 |
| 500 | 服务器错误 | 记录错误并通知用户 |
| 503 | 资源耗尽 | 等待资源释放或通知用户 |

### 错误处理示例

```python
def handle_api_error(response: requests.Response, context: str):
    """统一的API错误处理"""
    status = response.status_code
    detail = response.json().get("detail", "未知错误")

    if status == 400:
        if "配额" in detail or "quota" in detail.lower():
            return f"⚠️ {context}失败：资源配额不足。{detail}"
        elif "配置不存在" in detail:
            return f"⚠️ {context}失败：请先创建应用配置。"
        elif "已有运行中" in detail:
            return f"ℹ️ 该应用已有运行中的实例。"
        else:
            return f"❌ {context}失败：{detail}"

    elif status == 401:
        return "🔐 认证失败，请重新登录。"

    elif status == 403:
        return f"🚫 权限不足：{detail}"

    elif status == 404:
        return f"🔍 未找到资源：{detail}"

    elif status == 409:
        return f"⏸️ 资源冲突（{detail}），请稍后重试。"

    elif status == 500:
        return f"💥 服务器错误：{detail}，请联系管理员。"

    elif status == 503:
        if "NodePort" in detail:
            return "⏳ 服务端口资源不足，请稍后重试。"
        return f"⏳ 服务暂时不可用：{detail}"

    return f"❌ 未知错误 ({status}): {detail}"

# 使用示例
response = requests.post(...)
if not response.ok:
    error_msg = handle_api_error(response, "启动OpenClaw")
    print(error_msg)
    # 根据错误类型决定下一步操作
```

## 配额管理模式

### 检查可用资源

```python
def get_available_resources(token: str) -> Dict:
    """获取用户可用资源"""
    headers = {"Authorization": f"Bearer {token}"}

    # 获取配额
    user_response = requests.get(
        "http://localhost:42900/api/users/me",
        headers=headers
    )
    user = user_response.json()

    # 获取运行中的容器
    containers_response = requests.get(
        "http://localhost:42900/api/containers",
        headers=headers
    )
    containers = containers_response.json()

    # 计算已使用资源
    used_cpu = sum(
        c["cpu_request"]
        for c in containers
        if c["status"] in ["running", "creating"]
    )
    used_memory = sum(
        c["memory_request"]
        for c in containers
        if c["status"] in ["running", "creating"]
    )
    used_gpu = sum(
        c["gpu_request"]
        for c in containers
        if c["status"] in ["running", "creating"]
    )

    return {
        "cpu": {
            "total": user["cpu_quota"],
            "used": used_cpu,
            "available": user["cpu_quota"] - used_cpu
        },
        "memory": {
            "total": user["memory_quota"],
            "used": used_memory,
            "available": user["memory_quota"] - used_memory
        },
        "gpu": {
            "total": user["gpu_quota"],
            "used": used_gpu,
            "available": user["gpu_quota"] - used_gpu
        }
    }

# 使用示例
resources = get_available_resources("YOUR_TOKEN")
print(f"可用CPU: {resources['cpu']['available']}/{resources['cpu']['total']}")
print(f"可用内存: {resources['memory']['available']}GB/{resources['memory']['total']}GB")
print(f"可用GPU: {resources['gpu']['available']}/{resources['gpu']['total']}")
```

## 轮询策略

### 智能重试

```python
import time
from typing import Callable, Any

def poll_until(
    check_func: Callable[[], Any],
    condition: Callable[[Any], bool],
    max_wait: int = 300,
    interval: int = 5,
    on_progress: Callable[[Any], None] = None
) -> Any:
    """
    轮询直到条件满足

    Args:
        check_func: 检查函数
        condition: 条件判断函数
        max_wait: 最大等待时间（秒）
        interval: 检查间隔（秒）
        on_progress: 进度回调函数

    Returns:
        满足条件的结果
    """
    start_time = time.time()
    attempts = 0

    while time.time() - start_time < max_wait:
        attempts += 1
        result = check_func()

        if condition(result):
            return result

        if on_progress:
            on_progress(result)

        time.sleep(interval)

    raise TimeoutError(
        f"在{max_wait}秒内未满足条件（尝试{attempts}次）"
    )

# 使用示例：等待Pod运行
def check_pod_status(container_id: int, token: str) -> str:
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(
        f"http://localhost:42900/api/containers/{container_id}",
        headers=headers
    )
    return response.json()["k8s_status"]

try:
    status = poll_until(
        check_func=lambda: check_pod_status(123, "YOUR_TOKEN"),
        condition=lambda s: s == "Running",
        max_wait=300,
        interval=5,
        on_progress=lambda s: print(f"当前状态: {s}")
    )
    print("✅ Pod已运行")
except TimeoutError:
    print("❌ 等待超时")
```

## 最佳实践

### 1. Token管理

```python
class TokenManager:
    def __init__(self, username: str, password: str, base_url: str):
        self.username = username
        self.password = password
        self.base_url = base_url
        self.token = None
        self.expires_at = None

    def get_token(self) -> str:
        """获取有效token（自动刷新）"""
        if self.token and self.expires_at and time.time() < self.expires_at:
            return self.token

        # Token过期或不存在，重新认证
        response = requests.post(
            f"{self.base_url}/api/auth/login/local",
            json={"username": self.username, "password": self.password}
        )
        response.raise_for_status()

        self.token = response.json()["access_token"]
        # JWT默认24小时，提前1小时刷新
        self.expires_at = time.time() + 23 * 3600

        return self.token
```

### 2. 错误上下文

始终在错误处理中保留足够的上下文信息：

```python
try:
    response = requests.post(url, headers=headers, json=data)
    response.raise_for_status()
except requests.exceptions.HTTPError as e:
    # 包含请求详情
    error_context = {
        "endpoint": url,
        "method": "POST",
        "status_code": e.response.status_code,
        "error_detail": e.response.json().get("detail"),
        "request_data": data
    }
    logger.error(f"API请求失败: {error_context}")
    raise
```

### 3. 资源清理

确保在异常情况下清理资源：

```python
def safe_launch_and_use(token: str):
    """安全地启动和使用容器"""
    container_id = None
    try:
        # 启动容器
        container = launch_container(token, ...)
        container_id = container["id"]

        # 使用容器
        perform_task(container_id, token)

    except Exception as e:
        logger.error(f"任务失败: {e}")
        # 清理资源
        if container_id:
            cleanup_container(container_id, token)
        raise

    finally:
        # 确保清理
        if container_id:
            stop_container(container_id, token)
```

## 完整的智能体基类

```python
class HAIKubernetesAgent:
    """HAI-K8S智能体基类"""

    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url
        self.token_manager = TokenManager(username, password, base_url)

    @property
    def headers(self) -> Dict:
        return {"Authorization": f"Bearer {self.token_manager.get_token()}"}

    def api_request(
        self,
        method: str,
        endpoint: str,
        **kwargs
    ) -> requests.Response:
        """统一的API请求方法"""
        url = f"{self.base_url}{endpoint}"
        headers = kwargs.pop("headers", {})
        headers.update(self.headers)

        response = requests.request(
            method,
            url,
            headers=headers,
            **kwargs
        )

        # 处理401错误（token过期）
        if response.status_code == 401:
            # 强制刷新token
            self.token_manager.token = None
            headers.update(self.headers)
            response = requests.request(
                method,
                url,
                headers=headers,
                **kwargs
            )

        return response

    def get_user_info(self) -> Dict:
        """获取用户信息"""
        response = self.api_request("GET", "/api/users/me")
        response.raise_for_status()
        return response.json()

    def list_containers(self) -> List[Dict]:
        """列出容器"""
        response = self.api_request("GET", "/api/containers")
        response.raise_for_status()
        return response.json()

    def launch_openclaw(self, **kwargs) -> Dict:
        """启动OpenClaw（调用前面实现的方法）"""
        agent = OpenClawAgent(self.base_url, self.token_manager.get_token())
        return agent.start_openclaw(**kwargs)

# 使用示例
agent = HAIKubernetesAgent(
    "http://localhost:42900",
    "zhangsan",
    "password123"
)

# 获取用户信息
user = agent.get_user_info()
print(f"用户: {user['username']}, 配额: CPU={user['cpu_quota']}")

# 启动OpenClaw
openclaw = agent.launch_openclaw(cpu=4.0, memory=8.0)
print(f"OpenClaw访问地址: {openclaw['access_url']}")
```

## 下一步

- **[应用服务](applications)**: OpenClaw详细API参考
- **[容器管理](containers)**: 容器生命周期操作
- **[错误处理](error-handling)**: 完整的错误代码列表
