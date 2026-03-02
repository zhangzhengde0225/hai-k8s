"""
Application Service API endpoints
"""
import json
import asyncio
import logging
import secrets
import string
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel, Field as PydanticField
from typing import Optional
from datetime import datetime

from db.database import get_session
from db.models import User, Container, Image, ContainerStatus, ApplicationConfig, ConfigStatus
from k8s.pods import delete_pod, create_app_pod, get_pod_status
from k8s.services import delete_service
from auth.dependencies import get_current_user
from config import Config
from k8s.client import ensure_namespace
from utils.k8s_names import sanitize_k8s_name, make_namespace
from apps.openclaw.create_openclaw_pod import create_openclaw_pod

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/applications", tags=["Applications"])

# Application definitions
APPLICATIONS = {
    'openclaw': {
        'id': 'openclaw',
        'name': 'OpenClaw',
        'version': 'v1.0.0',
        'image_prefix': 'hai-openclaw',
        'default_replicas': 1,
    },
    # 隐藏 OpenDrSai
    # 'opendrsai': {
    #     'id': 'opendrsai',
    #     'name': 'OpenDrSai',
    #     'version': 'v1.0.0',
    #     'image_prefix': 'hai-opendrsai',
    #     'default_replicas': 2,
    # }
}


# Pydantic models for API requests/responses
class VolumeMountConfig(BaseModel):
    """卷挂载配置"""
    host_path: str
    mount_path: str


class SaveConfigRequest(BaseModel):
    """保存配置请求（创建或更新）"""
    image_id: int
    cpu_request: float = 2.0
    memory_request: float = 4.0
    gpu_request: int = 0
    ssh_enabled: bool = True
    storage_path: Optional[str] = None
    volume_mounts: Optional[list[VolumeMountConfig]] = None
    bound_ip: Optional[str] = None  # 绑定的IP地址
    # User sync configuration
    sync_user: bool = True
    user_uid: Optional[int] = None
    user_gid: Optional[int] = None
    user_home_dir: Optional[str] = None
    enable_sudo: bool = True
    root_password: Optional[str] = None  # None = 自动生成
    user_password: Optional[str] = None  # None = 与root密码相同


class LaunchInstanceRequest(BaseModel):
    instance_name: Optional[str] = None
    count: int = PydanticField(1, ge=1, le=1, description="启动实例数量（固定为1）")


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

        # Count active instances (running or creating)
        running_count = 0
        active_count = 0
        total_count = len(containers)

        for container in containers:
            if container.status in (ContainerStatus.RUNNING, ContainerStatus.CREATING):
                active_count += 1
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
        if active_count > 0:
            status = 'running'
        elif total_count > 0:
            status = 'stopped'
        elif has_config:
            status = 'configured'  # Has config but no instances
        else:
            status = 'unconfigured'

        # Find endpoint from config bound_ip
        endpoint = None
        if user_config and user_config.bound_ip:
            endpoint = f"ssh://{user_config.bound_ip}"

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

            # Parse volume_mounts from JSON
            volume_mounts_list = None
            if user_config.volume_mounts:
                try:
                    volume_mounts_list = json.loads(user_config.volume_mounts)
                except (json.JSONDecodeError, TypeError):
                    volume_mounts_list = None

            app_data['config'] = {
                'id': user_config.id,
                'image_id': user_config.image_id,
                'image_name': config_image.name if config_image else None,
                'cpu_request': user_config.cpu_request,
                'memory_request': user_config.memory_request,
                'gpu_request': user_config.gpu_request,
                'ssh_enabled': user_config.ssh_enabled,
                'storage_path': user_config.storage_path,
                'volume_mounts': volume_mounts_list,
                'bound_ip': user_config.bound_ip,
                'status': user_config.status.value,
                # User sync configuration
                'sync_user': user_config.sync_user,
                'user_uid': user_config.user_uid,
                'user_gid': user_config.user_gid,
                'user_home_dir': user_config.user_home_dir,
                'enable_sudo': user_config.enable_sudo,
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
        if container.ssh_enabled and container.config_id:
            cfg = session.get(ApplicationConfig, container.config_id)
            if cfg and cfg.bound_ip:
                ssh_user = current_user.cluster_username or current_user.username if cfg.sync_user else "root"
                ssh_command = f"ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {ssh_user}@{cfg.bound_ip}"

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
        existing_config.bound_ip = req.bound_ip
        # Save volume_mounts as JSON
        if req.volume_mounts:
            existing_config.volume_mounts = json.dumps([m.dict() for m in req.volume_mounts])
        else:
            existing_config.volume_mounts = None
        # Update user sync configuration
        existing_config.sync_user = req.sync_user
        existing_config.user_uid = req.user_uid
        existing_config.user_gid = req.user_gid
        existing_config.user_home_dir = req.user_home_dir
        existing_config.enable_sudo = req.enable_sudo
        existing_config.root_password = req.root_password or None
        existing_config.user_password = req.user_password or None
        existing_config.status = ConfigStatus.VALIDATED
        existing_config.updated_at = datetime.utcnow()

        session.add(existing_config)
        session.commit()
        session.refresh(existing_config)
        config = existing_config
    else:
        # 创建新配置
        # Prepare volume_mounts JSON
        volume_mounts_json = None
        if req.volume_mounts:
            volume_mounts_json = json.dumps([m.dict() for m in req.volume_mounts])

        config = ApplicationConfig(
            user_id=current_user.id,
            application_id=app_id,
            image_id=req.image_id,
            cpu_request=req.cpu_request,
            memory_request=req.memory_request,
            gpu_request=req.gpu_request,
            ssh_enabled=req.ssh_enabled,
            storage_path=req.storage_path,
            volume_mounts=volume_mounts_json,
            bound_ip=req.bound_ip,
            # User sync configuration
            sync_user=req.sync_user,
            user_uid=req.user_uid,
            user_gid=req.user_gid,
            user_home_dir=req.user_home_dir,
            enable_sudo=req.enable_sudo,
            root_password=req.root_password or None,
            user_password=req.user_password or None,
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

    # Parse volume_mounts from JSON
    volume_mounts_list = None
    if config.volume_mounts:
        try:
            volume_mounts_list = json.loads(config.volume_mounts)
        except (json.JSONDecodeError, TypeError):
            volume_mounts_list = None

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
        'volume_mounts': volume_mounts_list,
        'bound_ip': config.bound_ip,
        'status': config.status.value,
        'instance_count': instance_count,
        'created_at': config.created_at.isoformat() if config.created_at else None,
        'updated_at': config.updated_at.isoformat() if config.updated_at else None,
        # User sync configuration
        'sync_user': config.sync_user,
        'user_uid': config.user_uid,
        'user_gid': config.user_gid,
        'user_home_dir': config.user_home_dir,
        'enable_sudo': config.enable_sudo,
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

    # Parse volume_mounts from JSON
    volume_mounts_list = None
    if config.volume_mounts:
        try:
            volume_mounts_list = json.loads(config.volume_mounts)
        except (json.JSONDecodeError, TypeError):
            volume_mounts_list = None

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
        'volume_mounts': volume_mounts_list,
        'bound_ip': config.bound_ip,
        'status': config.status.value,
        'instance_count': instance_count,
        'created_at': config.created_at.isoformat() if config.created_at else None,
        'updated_at': config.updated_at.isoformat() if config.updated_at else None,
        # User sync configuration
        'sync_user': config.sync_user,
        'user_uid': config.user_uid,
        'user_gid': config.user_gid,
        'user_home_dir': config.user_home_dir,
        'enable_sudo': config.enable_sudo,
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

    # 检查是否已有运行中的实例（每个应用限一个）
    existing = session.exec(
        select(Container).where(
            Container.user_id == current_user.id,
            Container.config_id == config.id,
            Container.status.in_([ContainerStatus.RUNNING, ContainerStatus.CREATING]),
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该应用已有运行中的实例，请先删除后再启动")

    # 创建实例
    created_instances = []
    namespace = make_namespace(current_user.username)
    sanitized_username = sanitize_k8s_name(current_user.username)

    for i in range(req.count):
        # 生成实例名称
        if req.instance_name and req.count == 1:
            instance_name = req.instance_name
        else:
            instance_name = f"{app_id}-{i}"

        # pod_name = f"{sanitized_username}-{instance_name}"
        pod_name = f'hai-{instance_name}'
        # SSH 通过 bound_ip:22 直接访问，不需要 NodePort Service
        node_port = None
        service_name = None

        # 数据库创建Container记录
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
            ssh_node_port=node_port,
            k8s_namespace=namespace,
            k8s_pod_name=pod_name,
            k8s_service_name=service_name,
            status=ContainerStatus.CREATING,
        )

        session.add(container)
        session.flush()  # 获取container.id

        # Parse volume_mounts from config
        vol_mounts = None
        if config.volume_mounts:
            try:
                vol_mounts = json.loads(config.volume_mounts)
            except (json.JSONDecodeError, TypeError):
                vol_mounts = None

        # Determine macvlan settings
        macvlan_network = None
        if config.bound_ip:
            macvlan_network = Config.MACVLAN_NETWORK_NAME

        # Resolve passwords (generate if not set)
        _alphabet = string.ascii_letters + string.digits
        actual_root_password = config.root_password or ''.join(secrets.choice(_alphabet) for _ in range(16))
        actual_user_password = config.user_password or actual_root_password
        print(f"Launching instance with root password: {actual_root_password} and user password: {actual_user_password}")

        # Create K8s resources
        try:
            ensure_namespace(namespace)

            # Wait for old pod to be deleted if it exists
            for attempt in range(10):
                existing_status = get_pod_status(namespace, pod_name)
                if existing_status is None:
                    break
                if attempt < 9:
                    await asyncio.sleep(2)
                else:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Pod名称 '{pod_name}' 已被使用或正在删除中，请稍等后重试。"
                    )

            # Call app-specific pod creation functions
            if app_id == 'openclaw':
                # Use OpenClaw-specific pod creation
                create_openclaw_pod(
                    namespace=namespace,
                    name=pod_name,
                    image=image.registry_url,
                    cpu=config.cpu_request,
                    memory=config.memory_request,
                    gpu=config.gpu_request,
                    root_password=actual_root_password,
                    # User configuration
                    enable_user_mounts=config.sync_user,
                    custom_user=current_user.cluster_username or current_user.username if config.sync_user else None,
                    custom_uid=config.user_uid if config.sync_user else None,
                    custom_gid=config.user_gid if config.sync_user else None,
                    custom_home=config.user_home_dir if config.sync_user else None,
                    enable_sudo=config.enable_sudo,
                    custom_bashrc=None,
                    # Volume configuration
                    enable_volume_mounts=bool(vol_mounts),
                    volume_mounts=vol_mounts,
                    # Network configuration
                    enable_network_mounts=bool(config.bound_ip),
                    macvlan_network=macvlan_network,
                    macvlan_ip=config.bound_ip,
                    macvlan_gateway=Config.MACVLAN_GATEWAY,
                    macvlan_subnet=Config.MACVLAN_SUBNET,
                    ssh_enabled=config.ssh_enabled,
                )
            else:
                # Use generic pod creation for other apps
                create_app_pod(
                    namespace=namespace,
                    name=pod_name,
                    image=image.registry_url,
                    cpu=config.cpu_request,
                    memory=config.memory_request,
                    gpu=config.gpu_request,
                    root_password=actual_root_password,
                    user_password=actual_user_password,
                    sync_user=config.sync_user,
                    custom_user=current_user.username if config.sync_user else None,
                    custom_uid=config.user_uid if config.sync_user else None,
                    custom_gid=config.user_gid if config.sync_user else None,
                    custom_home=config.user_home_dir if config.sync_user else None,
                    enable_sudo=config.enable_sudo,
                    volume_mounts=vol_mounts,
                    bound_ip=config.bound_ip,
                    macvlan_network=macvlan_network,
                    macvlan_gateway=Config.MACVLAN_GATEWAY,
                    macvlan_subnet=Config.MACVLAN_SUBNET,
                    ssh_enabled=config.ssh_enabled,
                )

        except HTTPException:
            container.status = ContainerStatus.FAILED
            session.add(container)
            session.commit()
            raise
        except Exception as e:
            logger.exception("Failed to create K8s resources for pod %s", pod_name)
            container.status = ContainerStatus.FAILED
            session.add(container)
            session.commit()
            error_msg = str(e)
            if "already exists" in error_msg.lower():
                raise HTTPException(
                    status_code=409,
                    detail=f"Pod名称 '{instance_name}' 已被使用，请使用不同名称或删除旧实例后重试。"
                )
            raise HTTPException(status_code=500, detail=f"创建K8s资源失败: {error_msg}")

        # Build SSH command: use bound_ip:22 (macvlan direct access)
        ssh_command = None
        if config.ssh_enabled and config.bound_ip:
            ssh_user = current_user.cluster_username or current_user.username if config.sync_user else "root"
            ssh_command = f"ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {ssh_user}@{config.bound_ip}"

        created_instances.append({
            'id': container.id,
            'name': container.name,
            'config_id': config.id,
            'status': container.status.value,
            'k8s_namespace': namespace,
            'k8s_pod_name': pod_name,
            'ssh_node_port': node_port,
            'ssh_command': ssh_command,
            'bound_ip': config.bound_ip,
        })

    session.commit()

    return {
        'message': f'成功启动 {req.count} 个实例',
        'instances': created_instances
    }


@router.post("/{app_id}/stop")
async def stop_application_instances(
    app_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """删除该应用所有运行中的实例（Pod + DB记录标记为DELETED）"""
    if app_id not in APPLICATIONS:
        raise HTTPException(status_code=404, detail="Application not found")

    app_cfg = APPLICATIONS[app_id]
    all_images = session.exec(select(Image).where(Image.is_active == True)).all()

    app_tag = app_cfg['id']
    image_ids = []
    for img in all_images:
        if img.tags:
            try:
                tags = json.loads(img.tags)
                if app_tag in tags:
                    image_ids.append(img.id)
            except (json.JSONDecodeError, TypeError):
                continue

    if not image_ids:
        return {'message': '删除了 0 个实例', 'deleted': 0}

    containers = session.exec(
        select(Container).where(
            Container.user_id == current_user.id,
            Container.image_id.in_(image_ids),
            Container.status.in_([ContainerStatus.RUNNING, ContainerStatus.CREATING]),
        )
    ).all()

    deleted = 0
    for container in containers:
        if container.k8s_pod_name and container.k8s_namespace:
            delete_pod(container.k8s_namespace, container.k8s_pod_name)
        if container.k8s_service_name and container.k8s_namespace:
            delete_service(container.k8s_namespace, container.k8s_service_name)
        container.status = ContainerStatus.DELETED
        session.add(container)
        deleted += 1

    session.commit()
    return {'message': f'删除了 {deleted} 个实例', 'deleted': deleted}
