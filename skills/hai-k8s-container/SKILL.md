---
name: hai-k8s-container
description: HAI-K8S 容器生命周期管理。管理用户在 hai-k8s 平台上创建的容器（创建/删除/重启/查看状态/在容器内执行命令）。当需要操作 hai-k8s 容器时使用此 skill，如：创建容器、删除容器、重启容器、查看容器状态、在容器内执行命令、列出用户的容器。
---

# hai-k8s-container

HAI-K8S 平台的容器管理 skill。通过 hai-k8s REST API 管理容器生命周期。

## 认证方式

**两层认证**：
- `X-Admin-API-Key`：共享的管理员 API Key（验证调用者身份）
- `Authorization: Bearer <user_jwt_token>`：用户的 JWT Token（验证权限边界，只能操作自己的容器）

## API 基础信息

- **Base URL**: `http://<hai-k8s-backend-host>:<port>`（默认 `http://localhost:42900`）
- **Headers**:
  ```
  X-Admin-API-Key: <shared_admin_key>
  Authorization: Bearer <user_jwt_token>
  Content-Type: application/json
  ```

## 可用工具

### 列出用户容器
```
GET /api/applications
```
返回用户的应用配置列表（包含容器状态信息）。

### 获取容器实例列表
```
GET /api/applications/{app_id}/instances
```
- `app_id`: 应用标识符，如 `openclaw`
- 返回该应用下用户所有实例（容器）

### 获取容器详情
```
GET /api/containers/{container_id}
```
返回容器详细信息，包括 k8s_pod_name、k8s_namespace、密码等。

### 在容器内执行命令
```
POST /api/containers/{container_id}/exec
Body: {
  "command": "string",
  "timeout": 30
}
```
- 在运行中的容器内执行命令并获取结果
- 容器必须处于 Running 状态
- 返回 stdout、stderr、exit_code

### 删除容器（停止 + 删除 K8s Pod）
通过 hai-k8s 管理界面或 API 删除容器。

## 封装脚本

推荐使用封装脚本执行操作：

### 列出容器
```bash
python3 scripts/list_containers.py list \
    --admin-api-key <key> \
    --user-jwt <token> \
    [--app-id openclaw]
```

### 获取容器详情
```bash
python3 scripts/list_containers.py get <container_id> \
    --admin-api-key <key> \
    --user-jwt <token>
```

### 在容器内执行命令
```bash
python3 scripts/exec_container.py <container_id> "<command>" \
    --admin-api-key <key> \
    --user-jwt <token> \
    [--timeout 30] \
    [--format json|simple]
```

## 响应格式

成功：
```json
{
  "success": true,
  "output": "...",
  "exit_code": 0
}
```

失败：
```json
{
  "success": false,
  "error": "错误信息",
  "exit_code": -1
}
```

## 注意事项

- 所有容器操作受用户配额限制
- exec 命令超时默认 30 秒，可通过 `timeout` 参数调整
- 容器必须处于 Running 状态才能执行 exec
- 操作前先确认容器存在且属于目标用户

## 参考文档

- API 详细文档：`references/api_reference.md`
