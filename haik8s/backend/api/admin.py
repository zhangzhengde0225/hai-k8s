"""
Admin API endpoints

Author: Zhengde Zhang (zhangzhengde0225@gmail.com)
"""
import json
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel

from config import Config
from db.database import get_session
from db.models import User, UserRole, ContainerStatus, ApplicationDefinition
from db.crud import (
    list_users,
    update_user,
    get_user_by_id,
    get_user_resource_usage,
    list_all_containers,
    get_image_by_id,
    get_user_by_username,
)
from auth.dependencies import require_role
from auth.security import verify_password, create_access_token
from schemas.user import UserResponse, UserUpdateRequest, UserDetailResponse
from schemas.container import ContainerResponse
from k8s_service.client import get_core_v1
from k8s_service.pods import (
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


@router.get("/users/{user_id}", response_model=UserDetailResponse)
async def admin_get_user(
    user_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: Session = Depends(get_session),
):
    """Get full user details (admin only)"""
    user = get_user_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    usage = get_user_resource_usage(session, user.id)

    key = user.api_key_of_hepai
    if key and len(key) > 8:
        api_key_masked = key[:4] + "****" + key[-4:]
    elif key:
        api_key_masked = "*" * len(key)
    else:
        api_key_masked = None

    return UserDetailResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value if isinstance(user.role, UserRole) else user.role,
        auth_provider=user.auth_provider.value if user.auth_provider else None,
        is_active=user.is_active,
        cpu_quota=user.cpu_quota,
        memory_quota=user.memory_quota,
        gpu_quota=user.gpu_quota,
        cpu_used=usage["cpu_used"],
        memory_used=usage["memory_used"],
        gpu_used=usage["gpu_used"],
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        cluster_username=user.cluster_username,
        cluster_uid=user.cluster_uid,
        cluster_gid=user.cluster_gid,
        cluster_home_dir=user.cluster_home_dir,
        sso_id=user.sso_id,
        has_password=bool(user.password_hash),
        api_key_masked=api_key_masked,
    )


class SwitchUserRequest(BaseModel):
    target_username: str
    admin_password: str


@router.post("/switch-user")
async def admin_switch_user(
    req: SwitchUserRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: Session = Depends(get_session),
):
    """
    Admin impersonates a target user by verifying admin password and issuing a JWT for that user.
    Only admin users with a local password can use this feature.
    """
    # Admin must have a local password to verify
    if not current_user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin account does not have a local password. Cannot verify identity.",
        )

    # Verify admin password
    if not verify_password(req.admin_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin password",
        )

    # Find target user
    target_user = get_user_by_username(session, req.target_username)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not target_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Target user account is disabled",
        )

    # Generate JWT token for target user
    jwt_token = create_access_token(
        target_user,
        expires_delta=timedelta(minutes=Config.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return {
        "access_token": jwt_token,
        "token_type": "bearer",
        "username": target_user.username,
        "email": target_user.email,
        "role": target_user.role.value if isinstance(target_user.role, UserRole) else target_user.role,
    }


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


# ==================== Application Management Endpoints ====================


class ApplicationDefinitionCreate(BaseModel):
    """Create application definition request"""
    app_id: str
    name: str
    description: Optional[str] = None
    version: str = "v1.0.0"
    image_prefix: str = ""
    default_replicas: int = 1
    is_visible: bool = True
    recommended_cpu: float = 2.0
    recommended_memory: float = 4.0
    recommended_gpu: int = 0
    max_cpu: Optional[float] = None
    max_memory: Optional[float] = None
    max_gpu: Optional[int] = None
    default_firewall_rules: Optional[list[dict]] = None
    startup_scripts_config: Optional[dict] = None
    models_config_template: Optional[dict] = None
    available_images: Optional[list[dict]] = None


class ApplicationDefinitionUpdate(BaseModel):
    """Update application definition request"""
    name: Optional[str] = None
    description: Optional[str] = None
    version: Optional[str] = None
    image_prefix: Optional[str] = None
    default_replicas: Optional[int] = None
    is_visible: Optional[bool] = None
    recommended_cpu: Optional[float] = None
    recommended_memory: Optional[float] = None
    recommended_gpu: Optional[int] = None
    max_cpu: Optional[float] = None
    max_memory: Optional[float] = None
    max_gpu: Optional[int] = None
    default_firewall_rules: Optional[list[dict]] = None
    startup_scripts_config: Optional[dict] = None
    models_config_template: Optional[dict] = None
    available_images: Optional[list[dict]] = None


class ApplicationDefinitionResponse:
    """Application definition response"""
    def __init__(self, app: ApplicationDefinition):
        self.id = app.id
        self.app_id = app.app_id
        self.name = app.name
        self.description = app.description
        self.version = app.version
        self.image_prefix = app.image_prefix
        self.default_replicas = app.default_replicas
        self.is_visible = app.is_visible
        self.recommended_cpu = app.recommended_cpu
        self.recommended_memory = app.recommended_memory
        self.recommended_gpu = app.recommended_gpu
        self.default_firewall_rules = json.loads(app.default_firewall_rules) if app.default_firewall_rules else None
        self.startup_scripts_config = json.loads(app.startup_scripts_config) if app.startup_scripts_config else None
        self.models_config_template = json.loads(app.models_config_template) if app.models_config_template else None
        self.created_at = app.created_at
        self.updated_at = app.updated_at


def application_response_dict(app: ApplicationDefinition) -> dict:
    """Convert ApplicationDefinition to response dict"""
    return {
        "id": app.id,
        "app_id": app.app_id,
        "name": app.name,
        "description": app.description,
        "version": app.version,
        "image_prefix": app.image_prefix,
        "default_replicas": app.default_replicas,
        "is_visible": app.is_visible,
        "recommended_cpu": app.recommended_cpu,
        "recommended_memory": app.recommended_memory,
        "recommended_gpu": app.recommended_gpu,
        "max_cpu": app.max_cpu,
        "max_memory": app.max_memory,
        "max_gpu": app.max_gpu,
        "default_firewall_rules": json.loads(app.default_firewall_rules) if app.default_firewall_rules else None,
        "startup_scripts_config": json.loads(app.startup_scripts_config) if app.startup_scripts_config else None,
        "models_config_template": json.loads(app.models_config_template) if app.models_config_template else None,
        "available_images": json.loads(app.available_images) if app.available_images else [],
        "created_at": app.created_at,
        "updated_at": app.updated_at,
    }


@router.get("/applications")
async def admin_list_applications(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: Session = Depends(get_session),
):
    """List all application definitions"""
    apps = session.exec(select(ApplicationDefinition)).all()
    return [application_response_dict(app) for app in apps]


@router.get("/applications/{app_id}", response_model=dict)
async def admin_get_application(
    app_id: str,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: Session = Depends(get_session),
):
    """Get a specific application definition"""
    app = session.exec(
        select(ApplicationDefinition).where(ApplicationDefinition.app_id == app_id)
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return application_response_dict(app)


@router.post("/applications")
async def admin_create_application(
    req: ApplicationDefinitionCreate,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: Session = Depends(get_session),
):
    """Create a new application definition"""
    # Check if app_id already exists
    existing = session.exec(
        select(ApplicationDefinition).where(ApplicationDefinition.app_id == req.app_id)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Application with id '{req.app_id}' already exists")

    app = ApplicationDefinition(
        app_id=req.app_id,
        name=req.name,
        description=req.description,
        version=req.version,
        image_prefix=req.image_prefix,
        default_replicas=req.default_replicas,
        is_visible=req.is_visible,
        recommended_cpu=req.recommended_cpu,
        recommended_memory=req.recommended_memory,
        recommended_gpu=req.recommended_gpu,
        max_cpu=req.max_cpu,
        max_memory=req.max_memory,
        max_gpu=req.max_gpu,
        default_firewall_rules=json.dumps(req.default_firewall_rules) if req.default_firewall_rules else None,
        startup_scripts_config=json.dumps(req.startup_scripts_config) if req.startup_scripts_config else None,
        models_config_template=json.dumps(req.models_config_template) if req.models_config_template else None,
        available_images=json.dumps(req.available_images) if req.available_images else None,
    )
    session.add(app)
    session.commit()
    session.refresh(app)
    return application_response_dict(app)


@router.put("/applications/{app_id}")
async def admin_update_application(
    app_id: str,
    req: ApplicationDefinitionUpdate,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: Session = Depends(get_session),
):
    """Update an application definition"""
    app = session.exec(
        select(ApplicationDefinition).where(ApplicationDefinition.app_id == app_id)
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Update fields if provided using model_dump()
    update_data = req.model_dump(exclude_unset=True)
    nullable_fields = {'max_cpu', 'max_memory', 'max_gpu'}
    for key, value in update_data.items():
        # Skip empty string values; allow None for nullable fields
        if value == "":
            continue
        if value is None and key not in nullable_fields:
            continue

        if key in ['default_firewall_rules', 'startup_scripts_config', 'models_config_template', 'available_images']:
            # Convert to JSON only if it's a dict/list (not already a string)
            if isinstance(value, (dict, list)):
                setattr(app, key, json.dumps(value))
            else:
                setattr(app, key, value)
        else:
            setattr(app, key, value)

    app.updated_at = datetime.utcnow()
    session.add(app)
    session.commit()
    session.refresh(app)
    return application_response_dict(app)


@router.delete("/applications/{app_id}")
async def admin_delete_application(
    app_id: str,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: Session = Depends(get_session),
):
    """Delete an application definition"""
    app = session.exec(
        select(ApplicationDefinition).where(ApplicationDefinition.app_id == app_id)
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    session.delete(app)
    session.commit()
    return {"message": f"Application '{app_id}' deleted successfully"}


@router.patch("/applications/{app_id}/toggle-visibility")
async def admin_toggle_application_visibility(
    app_id: str,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: Session = Depends(get_session),
):
    """Toggle application visibility"""
    app = session.exec(
        select(ApplicationDefinition).where(ApplicationDefinition.app_id == app_id)
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    app.is_visible = not app.is_visible
    app.updated_at = datetime.utcnow()
    session.add(app)
    session.commit()
    session.refresh(app)
    return application_response_dict(app)
