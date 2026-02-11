"""
Admin API endpoints
"""
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
