"""
Container API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from db.database import get_session
from db.models import User, ContainerStatus
from db.crud import (
    create_container,
    get_container_by_id,
    list_containers_by_user,
    update_container,
    check_quota,
    find_available_nodeport,
    get_image_by_id,
)
from auth.dependencies import get_current_user
from schemas.container import CreateContainerRequest, ContainerResponse, ContainerDetailResponse
from config import Config
from k8s.client import ensure_namespace
from k8s.pods import create_pod, delete_pod, get_pod_status, get_pod_logs
from k8s.services import create_ssh_service, delete_service


router = APIRouter(prefix="/api/containers", tags=["containers"])


def _make_namespace(username: str) -> str:
    return f"{Config.K8S_NAMESPACE_PREFIX}{username}"


def _container_to_response(c, image=None) -> ContainerResponse:
    return ContainerResponse(
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
    )


@router.get("", response_model=list[ContainerResponse])
async def list_containers(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """List current user's containers with on-demand K8s status sync"""
    containers = list_containers_by_user(session, current_user.id)
    result = []
    for c in containers:
        # Sync status from K8s for active containers
        if c.status in (ContainerStatus.RUNNING, ContainerStatus.CREATING) and c.k8s_pod_name and c.k8s_namespace:
            k8s_phase = get_pod_status(c.k8s_namespace, c.k8s_pod_name)
            if k8s_phase is None:
                update_container(session, c.id, status=ContainerStatus.STOPPED)
                c.status = ContainerStatus.STOPPED
            elif k8s_phase == "Running":
                if c.status != ContainerStatus.RUNNING:
                    update_container(session, c.id, status=ContainerStatus.RUNNING)
                    c.status = ContainerStatus.RUNNING
            elif k8s_phase == "Failed":
                update_container(session, c.id, status=ContainerStatus.FAILED)
                c.status = ContainerStatus.FAILED
        image = get_image_by_id(session, c.image_id)
        result.append(_container_to_response(c, image))
    return result


@router.post("", response_model=ContainerDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_container_endpoint(
    req: CreateContainerRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Create a new container"""
    # Validate image
    image = get_image_by_id(session, req.image_id)
    if not image or not image.is_active:
        raise HTTPException(status_code=404, detail="Image not found or inactive")

    # Check quota
    ok, msg = check_quota(session, current_user, req.cpu_request, req.memory_request, req.gpu_request)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    # Allocate NodePort if SSH
    node_port = None
    if req.ssh_enabled:
        node_port = find_available_nodeport(
            session, Config.NODEPORT_RANGE_START, Config.NODEPORT_RANGE_END
        )
        if node_port is None:
            raise HTTPException(status_code=503, detail="No available NodePorts")

    namespace = _make_namespace(current_user.username)
    pod_name = f"{current_user.username}-{req.name}"
    service_name = f"{pod_name}-ssh" if req.ssh_enabled else None

    # Create DB record
    container = create_container(
        session,
        name=req.name,
        user_id=current_user.id,
        image_id=req.image_id,
        k8s_namespace=namespace,
        k8s_pod_name=pod_name,
        k8s_service_name=service_name,
        cpu_request=req.cpu_request,
        memory_request=req.memory_request,
        gpu_request=req.gpu_request,
        ssh_enabled=req.ssh_enabled,
        ssh_node_port=node_port,
        status=ContainerStatus.CREATING,
    )

    # Create K8s resources
    try:
        ensure_namespace(namespace)
        create_pod(
            namespace=namespace,
            name=pod_name,
            image=image.registry_url,
            cpu=req.cpu_request,
            memory=req.memory_request,
            gpu=req.gpu_request,
            ssh_enabled=req.ssh_enabled,
        )
        if req.ssh_enabled and node_port:
            create_ssh_service(namespace, pod_name, node_port)

        update_container(session, container.id, status=ContainerStatus.RUNNING)
        container.status = ContainerStatus.RUNNING
    except Exception as e:
        update_container(session, container.id, status=ContainerStatus.FAILED)
        container.status = ContainerStatus.FAILED
        raise HTTPException(status_code=500, detail=f"Failed to create K8s resources: {str(e)}")

    ssh_command = None
    if req.ssh_enabled and node_port:
        ssh_command = f"ssh root@aicpu004 -p {node_port}"

    return ContainerDetailResponse(
        id=container.id,
        name=container.name,
        image_name=image.name,
        image_registry_url=image.registry_url,
        status=container.status.value if isinstance(container.status, ContainerStatus) else container.status,
        cpu_request=container.cpu_request,
        memory_request=container.memory_request,
        gpu_request=container.gpu_request,
        ssh_enabled=container.ssh_enabled,
        ssh_node_port=container.ssh_node_port,
        created_at=container.created_at,
        updated_at=container.updated_at,
        k8s_namespace=container.k8s_namespace,
        k8s_pod_name=container.k8s_pod_name,
        k8s_service_name=container.k8s_service_name,
        k8s_status="Running",
        ssh_command=ssh_command,
        user_id=container.user_id,
    )


@router.get("/{container_id}", response_model=ContainerDetailResponse)
async def get_container(
    container_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Get container detail with live K8s status"""
    container = get_container_by_id(session, container_id)
    if not container or container.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Container not found")

    k8s_status = None
    if container.k8s_pod_name and container.k8s_namespace:
        k8s_status = get_pod_status(container.k8s_namespace, container.k8s_pod_name)

    image = get_image_by_id(session, container.image_id)

    ssh_command = None
    if container.ssh_enabled and container.ssh_node_port:
        ssh_command = f"ssh root@aicpu004 -p {container.ssh_node_port}"

    return ContainerDetailResponse(
        id=container.id,
        name=container.name,
        image_name=image.name if image else None,
        image_registry_url=image.registry_url if image else None,
        status=container.status.value if isinstance(container.status, ContainerStatus) else container.status,
        cpu_request=container.cpu_request,
        memory_request=container.memory_request,
        gpu_request=container.gpu_request,
        ssh_enabled=container.ssh_enabled,
        ssh_node_port=container.ssh_node_port,
        created_at=container.created_at,
        updated_at=container.updated_at,
        k8s_namespace=container.k8s_namespace,
        k8s_pod_name=container.k8s_pod_name,
        k8s_service_name=container.k8s_service_name,
        k8s_status=k8s_status,
        ssh_command=ssh_command,
        user_id=container.user_id,
    )


@router.post("/{container_id}/stop")
async def stop_container(
    container_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Stop a container (delete pod, keep DB record)"""
    container = get_container_by_id(session, container_id)
    if not container or container.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Container not found")

    if container.k8s_pod_name and container.k8s_namespace:
        delete_pod(container.k8s_namespace, container.k8s_pod_name)
    if container.k8s_service_name and container.k8s_namespace:
        delete_service(container.k8s_namespace, container.k8s_service_name)

    update_container(session, container.id, status=ContainerStatus.STOPPED)
    return {"message": "Container stopped"}


@router.post("/{container_id}/start")
async def start_container(
    container_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Start a stopped container (re-create pod)"""
    container = get_container_by_id(session, container_id)
    if not container or container.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Container not found")

    if container.status not in (ContainerStatus.STOPPED, ContainerStatus.FAILED):
        raise HTTPException(status_code=400, detail="Container is not stopped")

    image = get_image_by_id(session, container.image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Check quota again
    ok, msg = check_quota(session, current_user, container.cpu_request, container.memory_request, container.gpu_request)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    try:
        ensure_namespace(container.k8s_namespace)
        create_pod(
            namespace=container.k8s_namespace,
            name=container.k8s_pod_name,
            image=image.registry_url,
            cpu=container.cpu_request,
            memory=container.memory_request,
            gpu=container.gpu_request,
            ssh_enabled=container.ssh_enabled,
        )
        if container.ssh_enabled and container.ssh_node_port:
            create_ssh_service(container.k8s_namespace, container.k8s_pod_name, container.ssh_node_port)

        update_container(session, container.id, status=ContainerStatus.RUNNING)
    except Exception as e:
        update_container(session, container.id, status=ContainerStatus.FAILED)
        raise HTTPException(status_code=500, detail=f"Failed to start container: {str(e)}")

    return {"message": "Container started"}


@router.delete("/{container_id}")
async def delete_container(
    container_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Delete a container (pod + service + mark deleted in DB)"""
    container = get_container_by_id(session, container_id)
    if not container or container.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Container not found")

    if container.k8s_pod_name and container.k8s_namespace:
        delete_pod(container.k8s_namespace, container.k8s_pod_name)
    if container.k8s_service_name and container.k8s_namespace:
        delete_service(container.k8s_namespace, container.k8s_service_name)

    update_container(session, container.id, status=ContainerStatus.DELETED)
    return {"message": "Container deleted"}


@router.get("/{container_id}/logs")
async def get_container_logs(
    container_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Get container logs"""
    container = get_container_by_id(session, container_id)
    if not container or container.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Container not found")

    if not container.k8s_pod_name or not container.k8s_namespace:
        return {"logs": ""}

    logs = get_pod_logs(container.k8s_namespace, container.k8s_pod_name)
    return {"logs": logs}
