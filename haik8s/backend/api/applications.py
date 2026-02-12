"""
Application Service API endpoints
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel, Field as PydanticField
from typing import Optional
from datetime import datetime

from db.database import get_session
from db.models import User, Container, Image, ContainerStatus, ApplicationConfig, ConfigStatus
from auth.dependencies import get_current_user
from k8s.pods import get_pod_status

router = APIRouter(prefix="/api/applications", tags=["Applications"])

# Application definitions
APPLICATIONS = {
    'openclaw': {
        'id': 'openclaw',
        'name': 'OpenClaw',
        'version': 'v1.0.0',
        'image_prefix': 'hai-openclaw',
        'default_replicas': 3,
    },
    'opendrsai': {
        'id': 'opendrsai',
        'name': 'OpenDrSai',
        'version': 'v1.0.0',
        'image_prefix': 'hai-opendrsai',
        'default_replicas': 2,
    }
}


# Pydantic models for API requests/responses
class SaveConfigRequest(BaseModel):
    """保存配置请求（创建或更新）"""
    image_id: int
    cpu_request: float = 2.0
    memory_request: float = 4.0
    gpu_request: int = 0
    ssh_enabled: bool = True
    storage_path: Optional[str] = None


class LaunchInstanceRequest(BaseModel):
    instance_name: Optional[str] = None
    count: int = PydanticField(1, ge=1, le=5, description="启动实例数量")


@router.get("")
async def list_applications(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    Get all applications with their status for current user
    """
    result = []

    for app_id, app_config in APPLICATIONS.items():
        # Find all active images with matching tag
        all_images = session.exec(
            select(Image).where(Image.is_active == True)
        ).all()

        # Filter images by tag (tag matches app_id)
        app_tag = app_config['id']  # 'openclaw' or 'opendrsai'
        images = []
        for img in all_images:
            if img.tags:
                try:
                    tags = json.loads(img.tags)
                    if app_tag in tags:
                        images.append(img)
                except (json.JSONDecodeError, TypeError):
                    continue

        image_ids = [img.id for img in images]

        # Get user's containers for this application
        containers = session.exec(
            select(Container).where(
                Container.user_id == current_user.id,
                Container.image_id.in_(image_ids),
                Container.status != ContainerStatus.DELETED
            )
        ).all()

        # Count running instances (sync with K8s)
        running_count = 0
        total_count = len(containers)

        for container in containers:
            # Sync status with K8s
            if container.status in (ContainerStatus.RUNNING, ContainerStatus.CREATING):
                if container.k8s_pod_name and container.k8s_namespace:
                    k8s_phase = get_pod_status(container.k8s_namespace, container.k8s_pod_name)
                    if k8s_phase == "Running":
                        running_count += 1

        # Get user's configuration for this application
        user_config = session.exec(
            select(ApplicationConfig).where(
                ApplicationConfig.user_id == current_user.id,
                ApplicationConfig.application_id == app_id,
                ApplicationConfig.status != ConfigStatus.ARCHIVED
            )
        ).first()

        # Determine application status
        has_config = user_config is not None
        if running_count > 0:
            status = 'running'
        elif total_count > 0:
            status = 'stopped'
        elif has_config:
            status = 'configured'  # Has config but no instances
        else:
            status = 'unconfigured'

        # Find endpoint (use the first running container's SSH info as example)
        endpoint = None
        for container in containers:
            if container.status == ContainerStatus.RUNNING and container.ssh_enabled and container.ssh_node_port:
                endpoint = f"ssh://aicpu004:{container.ssh_node_port}"
                break

        # Build response
        app_data = {
            'id': app_id,
            'name': app_config['name'],
            'version': app_config['version'],
            'status': status,
            'is_configured': has_config,
            'pods': running_count,
            'replicas': app_config['default_replicas'],
            'total_instances': total_count,
            'endpoint': endpoint,
            'defaultImage': app_config['image_prefix'],
        }

        # Add config info if exists
        if user_config:
            config_image = session.get(Image, user_config.image_id)
            app_data['config'] = {
                'id': user_config.id,
                'image_id': user_config.image_id,
                'image_name': config_image.name if config_image else None,
                'cpu_request': user_config.cpu_request,
                'memory_request': user_config.memory_request,
                'gpu_request': user_config.gpu_request,
                'ssh_enabled': user_config.ssh_enabled,
                'storage_path': user_config.storage_path,
                'status': user_config.status.value,
            }
        else:
            app_data['config'] = None

        result.append(app_data)

    return result


@router.get("/{app_id}/instances")
async def get_application_instances(
    app_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    Get all instances (containers) for a specific application
    """
    if app_id not in APPLICATIONS:
        raise HTTPException(status_code=404, detail="Application not found")

    app_config = APPLICATIONS[app_id]

    # Find all active images with matching tag
    all_images = session.exec(
        select(Image).where(Image.is_active == True)
    ).all()

    # Filter images by tag (tag matches app_id)
    app_tag = app_config['id']  # 'openclaw' or 'opendrsai'
    images = []
    for img in all_images:
        if img.tags:
            try:
                tags = json.loads(img.tags)
                if app_tag in tags:
                    images.append(img)
            except (json.JSONDecodeError, TypeError):
                continue

    image_ids = [img.id for img in images]

    containers = session.exec(
        select(Container).where(
            Container.user_id == current_user.id,
            Container.image_id.in_(image_ids),
            Container.status != ContainerStatus.DELETED
        )
    ).all()

    # Build response with K8s status sync
    instances = []
    for container in containers:
        # Get image info
        image = session.get(Image, container.image_id)

        # Sync K8s status
        k8s_status = None
        if container.k8s_pod_name and container.k8s_namespace:
            k8s_status = get_pod_status(container.k8s_namespace, container.k8s_pod_name)

        ssh_command = None
        if container.ssh_enabled and container.ssh_node_port:
            ssh_command = f"ssh root@aicpu004 -p {container.ssh_node_port}"

        instances.append({
            'id': container.id,
            'name': container.name,
            'image_name': image.name if image else None,
            'image_registry_url': image.registry_url if image else None,
            'status': container.status.value if isinstance(container.status, ContainerStatus) else container.status,
            'k8s_status': k8s_status,
            'cpu_request': container.cpu_request,
            'memory_request': container.memory_request,
            'gpu_request': container.gpu_request,
            'ssh_enabled': container.ssh_enabled,
            'ssh_node_port': container.ssh_node_port,
            'ssh_command': ssh_command,
            'created_at': container.created_at.isoformat() if container.created_at else None,
            'updated_at': container.updated_at.isoformat() if container.updated_at else None,
        })

    return {
        'application': {
            'id': app_id,
            'name': app_config['name'],
            'version': app_config['version'],
        },
        'instances': instances,
        'total': len(instances),
    }


# ==================== 配置管理API ====================

def validate_config(
    req: SaveConfigRequest,
    user: User,
    app_id: str,
    session: Session,
) -> None:
    """配置保存时的校验"""
    app_config = APPLICATIONS.get(app_id)
    if not app_config:
        raise HTTPException(status_code=404, detail="Application not found")

    # 1. 镜像有效性：镜像存在且is_active=True
    image = session.get(Image, req.image_id)
    if not image or not image.is_active:
        raise HTTPException(status_code=404, detail="镜像不存在或已禁用")

    # 2. 镜像标签匹配：镜像必须包含应用对应的标签
    app_tag = app_config['id']  # 'openclaw' or 'opendrsai'
    if image.tags:
        try:
            tags = json.loads(image.tags)
            if app_tag not in tags:
                raise HTTPException(
                    status_code=400,
                    detail=f"镜像 '{image.name}' 不适用于应用 '{app_config['name']}'"
                )
        except (json.JSONDecodeError, TypeError):
            raise HTTPException(
                status_code=400,
                detail=f"镜像 '{image.name}' 标签格式错误"
            )
    else:
        # If image has no tags, reject usage
        raise HTTPException(
            status_code=400,
            detail=f"镜像 '{image.name}' 未标记应用类型"
        )

    # 3. GPU依赖：如果镜像需要GPU，gpu_request必须>0
    if image.gpu_required and req.gpu_request <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"镜像 '{image.name}' 需要GPU，但GPU请求为0"
        )

    # 4. 资源配额：不超过用户配额（预校验）
    if req.cpu_request > user.cpu_quota:
        raise HTTPException(
            status_code=400,
            detail=f"CPU请求 {req.cpu_request} 超过配额 {user.cpu_quota}"
        )

    if req.memory_request > user.memory_quota:
        raise HTTPException(
            status_code=400,
            detail=f"内存请求 {req.memory_request}GB 超过配额 {user.memory_quota}GB"
        )

    if req.gpu_request > user.gpu_quota:
        raise HTTPException(
            status_code=400,
            detail=f"GPU请求 {req.gpu_request} 超过配额 {user.gpu_quota}"
        )


@router.post("/{app_id}/config", status_code=201)
@router.put("/{app_id}/config")
async def save_application_config(
    app_id: str,
    req: SaveConfigRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    保存应用配置（创建或更新，每个用户每个应用只能有1个配置）
    """
    # 校验配置
    validate_config(req, current_user, app_id, session)

    # 检查是否已存在配置
    existing_config = session.exec(
        select(ApplicationConfig).where(
            ApplicationConfig.user_id == current_user.id,
            ApplicationConfig.application_id == app_id,
            ApplicationConfig.status != ConfigStatus.ARCHIVED
        )
    ).first()

    if existing_config:
        # 更新现有配置
        existing_config.image_id = req.image_id
        existing_config.cpu_request = req.cpu_request
        existing_config.memory_request = req.memory_request
        existing_config.gpu_request = req.gpu_request
        existing_config.ssh_enabled = req.ssh_enabled
        existing_config.storage_path = req.storage_path
        existing_config.status = ConfigStatus.VALIDATED
        existing_config.updated_at = datetime.utcnow()

        session.add(existing_config)
        session.commit()
        session.refresh(existing_config)
        config = existing_config
    else:
        # 创建新配置
        config = ApplicationConfig(
            user_id=current_user.id,
            application_id=app_id,
            image_id=req.image_id,
            cpu_request=req.cpu_request,
            memory_request=req.memory_request,
            gpu_request=req.gpu_request,
            ssh_enabled=req.ssh_enabled,
            storage_path=req.storage_path,
            status=ConfigStatus.VALIDATED,
        )

        session.add(config)
        session.commit()
        session.refresh(config)

    # 获取镜像信息
    image = session.get(Image, config.image_id)

    # 统计实例数量
    instance_count = len(session.exec(
        select(Container).where(
            Container.config_id == config.id,
            Container.status != ContainerStatus.DELETED
        )
    ).all())

    return {
        'id': config.id,
        'application_id': config.application_id,
        'image_id': config.image_id,
        'image_name': image.name if image else None,
        'cpu_request': config.cpu_request,
        'memory_request': config.memory_request,
        'gpu_request': config.gpu_request,
        'ssh_enabled': config.ssh_enabled,
        'storage_path': config.storage_path,
        'status': config.status.value,
        'instance_count': instance_count,
        'created_at': config.created_at.isoformat() if config.created_at else None,
        'updated_at': config.updated_at.isoformat() if config.updated_at else None,
    }


@router.get("/{app_id}/config")
async def get_application_config(
    app_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    获取应用配置
    """
    if app_id not in APPLICATIONS:
        raise HTTPException(status_code=404, detail="Application not found")

    # 查询用户的配置
    config = session.exec(
        select(ApplicationConfig).where(
            ApplicationConfig.user_id == current_user.id,
            ApplicationConfig.application_id == app_id,
            ApplicationConfig.status != ConfigStatus.ARCHIVED
        )
    ).first()

    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")

    # 获取镜像信息
    image = session.get(Image, config.image_id)

    # 统计实例数量
    instance_count = len(session.exec(
        select(Container).where(
            Container.config_id == config.id,
            Container.status != ContainerStatus.DELETED
        )
    ).all())

    return {
        'id': config.id,
        'application_id': config.application_id,
        'image_id': config.image_id,
        'image_name': image.name if image else None,
        'cpu_request': config.cpu_request,
        'memory_request': config.memory_request,
        'gpu_request': config.gpu_request,
        'ssh_enabled': config.ssh_enabled,
        'storage_path': config.storage_path,
        'status': config.status.value,
        'instance_count': instance_count,
        'created_at': config.created_at.isoformat() if config.created_at else None,
        'updated_at': config.updated_at.isoformat() if config.updated_at else None,
    }


@router.post("/{app_id}/launch", status_code=201)
async def launch_instance_from_config(
    app_id: str,
    req: LaunchInstanceRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    从配置启动实例
    """
    if app_id not in APPLICATIONS:
        raise HTTPException(status_code=404, detail="Application not found")

    # 查询配置
    config = session.exec(
        select(ApplicationConfig).where(
            ApplicationConfig.user_id == current_user.id,
            ApplicationConfig.application_id == app_id,
            ApplicationConfig.status != ConfigStatus.ARCHIVED
        )
    ).first()

    if not config:
        raise HTTPException(status_code=404, detail="配置不存在，请先保存配置")

    if config.status != ConfigStatus.VALIDATED:
        raise HTTPException(status_code=400, detail="配置未通过校验，无法启动实例")

    # 获取镜像
    image = session.get(Image, config.image_id)
    if not image or not image.is_active:
        raise HTTPException(status_code=400, detail="镜像不可用")

    # 二次校验资源配额
    if config.cpu_request > current_user.cpu_quota:
        raise HTTPException(status_code=400, detail="CPU配额不足")
    if config.memory_request > current_user.memory_quota:
        raise HTTPException(status_code=400, detail="内存配额不足")
    if config.gpu_request > current_user.gpu_quota:
        raise HTTPException(status_code=400, detail="GPU配额不足")

    # 创建实例
    created_instances = []
    for i in range(req.count):
        # 生成实例名称
        if req.instance_name and req.count == 1:
            instance_name = req.instance_name
        else:
            # 自动生成名称：app-timestamp-index
            timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
            instance_name = f"{app_id}-{timestamp}-{i}"

        # 创建Container记录
        container = Container(
            name=instance_name,
            user_id=current_user.id,
            image_id=config.image_id,
            config_id=config.id,
            application_id=app_id,
            cpu_request=config.cpu_request,
            memory_request=config.memory_request,
            gpu_request=config.gpu_request,
            ssh_enabled=config.ssh_enabled,
            status=ContainerStatus.CREATING,
        )

        session.add(container)
        session.flush()  # 获取container.id

        # TODO: 在此处调用K8s API创建Pod和Service
        # from k8s.pods import create_pod
        # create_pod(container, image, current_user)

        created_instances.append({
            'id': container.id,
            'name': container.name,
            'config_id': config.id,
            'status': container.status.value,
        })

    session.commit()

    return {
        'message': f'成功启动 {req.count} 个实例',
        'instances': created_instances
    }
