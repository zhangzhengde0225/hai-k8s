"""
Admin API endpoints
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from db.database import get_session
from db.models import User, UserRole, ContainerStatus
from db.crud import (
    list_users,
    update_user,
    get_user_by_id,
    get_user_resource_usage,
    list_all_containers,
    get_image_by_id,
)
from auth.dependencies import require_role
from schemas.user import UserResponse, UserUpdateRequest
from schemas.container import ContainerResponse
from k8s.client import get_core_v1
from k8s.pods import (
    list_all_pods_in_cluster,
    get_pod_describe,
    get_pod_logs,
    get_pod_events,
    delete_pod,
)
from schemas.pod import (
    PodListResponse,
    PodDetailResponse,
    PodLogsResponse,
    PodEventResponse,
    ContainerInfo,
    ResourceInfo,
    OwnerReference,
)


router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/users", response_model=list[UserResponse])
async def admin_list_users(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: Session = Depends(get_session),
):
    """List all users with resource usage"""
    users = list_users(session)
    result = []
    for u in users:
        usage = get_user_resource_usage(session, u.id)
        result.append(UserResponse(
            id=u.id,
            username=u.username,
            email=u.email,
            full_name=u.full_name,
            role=u.role.value,
            is_active=u.is_active,
            cpu_quota=u.cpu_quota,
            memory_quota=u.memory_quota,
            gpu_quota=u.gpu_quota,
            cpu_used=usage["cpu_used"],
            memory_used=usage["memory_used"],
            gpu_used=usage["gpu_used"],
            created_at=u.created_at,
            last_login_at=u.last_login_at,
        ))
    return result


@router.patch("/users/{user_id}", response_model=UserResponse)
async def admin_update_user(
    user_id: int,
    req: UserUpdateRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: Session = Depends(get_session),
):
    """Update user (role, quota, active status)"""
    update_data = req.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    user = update_user(session, user_id, **update_data)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    usage = get_user_resource_usage(session, user.id)
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value if isinstance(user.role, UserRole) else user.role,
        is_active=user.is_active,
        cpu_quota=user.cpu_quota,
        memory_quota=user.memory_quota,
        gpu_quota=user.gpu_quota,
        cpu_used=usage["cpu_used"],
        memory_used=usage["memory_used"],
        gpu_used=usage["gpu_used"],
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


@router.get("/cluster")
async def admin_cluster_info(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Get cluster node resource overview"""
    v1 = get_core_v1()
    nodes = v1.list_node()
    result = []
    for node in nodes.items:
        allocatable = node.status.allocatable or {}
        capacity = node.status.capacity or {}
        conditions = node.status.conditions or []
        ready = any(
            c.type == "Ready" and c.status == "True" for c in conditions
        )
        result.append({
            "name": node.metadata.name,
            "ready": ready,
            "cpu_capacity": capacity.get("cpu", "0"),
            "memory_capacity": capacity.get("memory", "0"),
            "gpu_capacity": capacity.get("nvidia.com/gpu", "0"),
            "cpu_allocatable": allocatable.get("cpu", "0"),
            "memory_allocatable": allocatable.get("memory", "0"),
            "gpu_allocatable": allocatable.get("nvidia.com/gpu", "0"),
        })
    return {"nodes": result}


@router.get("/containers", response_model=list[ContainerResponse])
async def admin_list_containers(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: Session = Depends(get_session),
):
    """List all containers across all users"""
    containers = list_all_containers(session)
    result = []
    for c in containers:
        image = get_image_by_id(session, c.image_id)
        result.append(ContainerResponse(
            id=c.id,
            name=c.name,
            image_name=image.name if image else None,
            image_registry_url=image.registry_url if image else None,
            status=c.status.value if isinstance(c.status, ContainerStatus) else c.status,
            cpu_request=c.cpu_request,
            memory_request=c.memory_request,
            gpu_request=c.gpu_request,
            ssh_enabled=c.ssh_enabled,
            ssh_node_port=c.ssh_node_port,
            created_at=c.created_at,
            updated_at=c.updated_at,
        ))
    return result


# POD Management Endpoints

@router.get("/pods", response_model=list[PodListResponse])
async def admin_list_all_pods(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: Session = Depends(get_session),
):
    """
    List all PODs in the K8s cluster (all namespaces).
    Automatically associates with container info from database (if POD was created through the system).
    """
    # Get all PODs
    pods = list_all_pods_in_cluster()

    # Get all containers from database, build mapping from namespace+POD name to container ID
    containers = list_all_containers(session)
    container_map = {
        (c.k8s_namespace, c.k8s_pod_name): c.id
        for c in containers
        if c.k8s_namespace and c.k8s_pod_name
    }

    # Build response
    result = []
    for pod in pods:
        key = (pod["namespace"], pod["name"])
        container_id = container_map.get(key)

        result.append(PodListResponse(
            namespace=pod["namespace"],
            name=pod["name"],
            phase=pod["phase"],
            pod_ip=pod.get("pod_ip"),
            node_name=pod.get("node_name"),
            created_at=pod["created_at"],
            containers=[ContainerInfo(**c) for c in pod["containers"]],
            labels=pod["labels"],
            is_system_managed=pod["is_system_managed"],
            container_id=container_id,
            resource_requests=ResourceInfo(**pod["resource_requests"]),
            resource_limits=ResourceInfo(**pod["resource_limits"]),
            owner_references=[OwnerReference(**o) for o in pod["owner_references"]],
        ))

    return result


@router.get("/pods/{namespace}/{pod_name}", response_model=PodDetailResponse)
async def admin_get_pod_detail(
    namespace: str,
    pod_name: str,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Get POD detailed description info (similar to kubectl describe pod)"""
    try:
        detail = get_pod_describe(namespace, pod_name)
        return PodDetailResponse(**detail)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Pod not found: {str(e)}")


@router.get("/pods/{namespace}/{pod_name}/logs", response_model=PodLogsResponse)
async def admin_get_pod_logs(
    namespace: str,
    pod_name: str,
    container: Optional[str] = None,
    tail_lines: int = 200,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """
    Get POD logs.
    For multi-container PODs, can specify container parameter to select container.
    """
    logs = get_pod_logs(namespace, pod_name, container, tail_lines)
    return PodLogsResponse(logs=logs)


@router.get("/pods/{namespace}/{pod_name}/events", response_model=PodEventResponse)
async def admin_get_pod_events(
    namespace: str,
    pod_name: str,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Get POD-related K8s events"""
    events = get_pod_events(namespace, pod_name)
    return PodEventResponse(events=events)


@router.delete("/pods/{namespace}/{pod_name}")
async def admin_delete_pod(
    namespace: str,
    pod_name: str,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: Session = Depends(get_session),
):
    """
    Delete POD.
    If POD is system-managed (has corresponding database container record), will also update container status.
    """
    try:
        # Check if this is a system-managed container
        containers = list_all_containers(session)
        for c in containers:
            if c.k8s_namespace == namespace and c.k8s_pod_name == pod_name:
                # Update database status
                from db.crud import update_container
                update_container(session, c.id, status=ContainerStatus.DELETED)
                break

        # Delete POD
        delete_pod(namespace, pod_name)

        return {"message": "Pod deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete pod: {str(e)}")


@router.post("/pods/{namespace}/{pod_name}/restart")
async def admin_restart_pod(
    namespace: str,
    pod_name: str,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """
    Restart POD (by deleting, will be automatically recreated if POD has a controller).
    Warning: For standalone PODs (no controller), will not be automatically recreated after deletion.
    """
    try:
        delete_pod(namespace, pod_name)
        return {"message": "Pod restart initiated (deleted, will be recreated by controller if exists)"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restart pod: {str(e)}")
