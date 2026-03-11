# 容器管理

HAI-K8S容器管理API提供完整的容器生命周期控制。

## 核心端点

### 列出容器
```
GET /api/containers
```

返回当前用户的所有容器列表。

### 创建容器
```
POST /api/containers
```

创建新容器。参见[快速开始](getting-started)获取完整示例。

### 获取容器详情
```
GET /api/containers/{id}
```

获取指定容器的详细信息，包括Kubernetes状态和访问信息。

### 启动容器
```
POST /api/containers/{id}/start
```

启动已停止的容器。

### 停止容器
```
POST /api/containers/{id}/stop
```

停止运行中的容器，释放资源。

### 删除容器
```
DELETE /api/containers/{id}
```

删除容器（将状态标记为deleted）。

### 获取容器日志
```
GET /api/containers/{id}/logs
```

获取容器的标准输出日志。

### 获取容器事件
```
GET /api/containers/{id}/events
```

获取Kubernetes Pod事件，用于故障排查。

## 使用示例

参见[快速开始](getting-started)和[智能体集成](agent-integration)获取完整示例。

## 下一步

- **[应用服务](applications)**: 使用应用模板简化部署
- **[镜像管理](images)**: 查看和管理可用镜像
