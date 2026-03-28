# hai-k8s Container API Reference

Author: Zhengde ZHANG

## Authentication

All API calls require two authentication headers:

```
X-Admin-API-Key: <shared_admin_key>
Authorization: Bearer <user_jwt_token>
```

- `X-Admin-API-Key`: Shared admin key stored in hai-k8s Config (verifies caller is authorized skill)
- `JWT Token`: User's own JWT token (verifies user owns the containers being operated on)

## Endpoints

### List User Applications
```
GET /api/applications
```
Returns list of user's application configs with status.

### List Application Instances
```
GET /api/applications/{app_id}/instances
```
Returns all instances for specified app under current user.

### Get Container Details
```
GET /api/containers/{container_id}
```
Returns container details including:
- `id`: Container ID
- `name`: Container name
- `status`: Container status (creating/running/stopped/failed)
- `k8s_pod_name`: K8s Pod name
- `k8s_namespace`: K8s namespace
- `bound_ip`: Assigned IP (if any)
- `ssh_enabled`: Whether SSH is enabled
- `ssh_node_port`: SSH NodePort (if enabled)
- `root_password` / `user_password`: Login passwords

### Execute Command in Container
```
POST /api/containers/{container_id}/exec
Content-Type: application/json

{
  "command": "ls -la /root",
  "timeout": 30
}
```

Response:
```json
{
  "success": true,
  "output": "total 64\ndrwxr-xr-x   1 root root 4096 ...",
  "error": "",
  "exit_code": 0,
  "message": "命令执行成功"
}
```

Error response (container not running):
```json
{
  "detail": "Container must be running to execute commands. Current status: stopped"
}
```

## Container Status Values

| Status | Meaning |
|--------|---------|
| `creating` | Pod is being created |
| `running` | Container is running (exec available) |
| `stopped` | Container stopped |
| `failed` | Container failed to start |
| `deleting` | Being deleted |

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| 400 | Bad request (e.g., container not running) |
| 401 | Authentication failed |
| 403 | Not authorized (container belongs to another user) |
| 404 | Container not found |
| 500 | Server error executing command |

## Tips

- Always check `container.status == "running"` before exec
- Use `timeout > 30` for long-running commands (e.g., package installs)
- For multi-step operations, execute commands sequentially
- Capture both `stdout` and `stderr` from response
