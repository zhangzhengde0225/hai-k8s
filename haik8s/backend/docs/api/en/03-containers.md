# Container Management

HAI-K8S Container Management API provides complete container lifecycle control.

## Core Endpoints

### List Containers
```
GET /api/containers
```

Returns all containers for current user.

### Create Container
```
POST /api/containers
```

Create new container. See [Getting Started](getting-started) for complete example.

### Get Container Details
```
GET /api/containers/{id}
```

Get detailed information about specific container, including Kubernetes status and access info.

### Start Container
```
POST /api/containers/{id}/start
```

Start a stopped container.

### Stop Container
```
POST /api/containers/{id}/stop
```

Stop a running container and release resources.

### Delete Container
```
DELETE /api/containers/{id}
```

Delete container (mark status as deleted).

### Get Container Logs
```
GET /api/containers/{id}/logs
```

Get container stdout logs.

### Get Container Events
```
GET /api/containers/{id}/events
```

Get Kubernetes Pod events for troubleshooting.

## Usage Examples

See [Getting Started](getting-started) and [Agent Integration](agent-integration) for complete examples.

## Next Steps

- **[Applications](applications)**: Simplify deployment with application templates
- **[Images](images)**: View and manage available images
