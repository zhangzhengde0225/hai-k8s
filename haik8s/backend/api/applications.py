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
from k8s_service.pods import delete_pod, create_app_pod, get_pod_status
from k8s_service.services import delete_service
from auth.dependencies import get_current_user
from config import Config
from k8s_service.client import ensure_namespace
from utils.k8s_names import sanitize_k8s_name, make_namespace
from apps.openclaw.create_openclaw_pod import create_openclaw_pod

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/applications", tags=["Applications"])


def generate_and_save_passwords(config: ApplicationConfig, session: Session) -> tuple[str, str]:
    """
    生成密码并保存到数据库（仅在密码为空时生成）

    Args:
        config: 应用配置对象
        session: 数据库会话

    Returns:
        tuple[str, str]: (root_password, user_password)
    """
    password_updated = False

    # 生成 root 密码（如果未设置）
    if not config.root_password:
        _alphabet = string.ascii_letters + string.digits
        config.root_password = ''.join(secrets.choice(_alphabet) for _ in range(16))
        password_updated = True
        logger.info(f"Generated new root password for config_id={config.id}")

    # 生成 user 密码（如果未设置，则与 root 密码相同）
    if not config.user_password:
        config.user_password = config.root_password
        password_updated = True
        logger.info(f"Set user password for config_id={config.id}")

    # 保存到数据库
    if password_updated:
        session.add(config)
        session.commit()
        session.refresh(config)
        logger.info(f"Passwords saved to database for config_id={config.id}")

    return config.root_password, config.user_password

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


class FirewallRuleConfig(BaseModel):
    """防火墙规则配置"""
    port: int | str
    protocol: str = "tcp"
    source: str = "0.0.0.0/0"
    action: str = "allow"


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
    # Firewall configuration
    enable_firewall: bool = True  # 默认启用防火墙
    firewall_rules: Optional[list[FirewallRuleConfig]] = None
    firewall_default_policy: str = "DROP"  # 默认策略


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
            endpoint = f"http://{user_config.bound_ip}"

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
                'root_password': user_config.root_password,
                'user_password': user_config.user_password,
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
        ssh_user = None
        bound_ip = None
        root_password = None
        user_password = None

        if container.ssh_enabled and container.config_id:
            cfg = session.get(ApplicationConfig, container.config_id)
            if cfg:
                # Get passwords from config
                root_password = cfg.root_password
                user_password = cfg.user_password

                if cfg.bound_ip:
                    ssh_user = current_user.cluster_username or current_user.username if cfg.sync_user else "root"
                    ssh_command = f"ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {ssh_user}@{cfg.bound_ip}"
                    bound_ip = cfg.bound_ip

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
            'ssh_user': ssh_user,
            'bound_ip': bound_ip,
            'password': user_password if ssh_user and ssh_user != 'root' else root_password,  # Show appropriate password
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
        # Update firewall configuration
        existing_config.enable_firewall = req.enable_firewall
        if req.firewall_rules:
            existing_config.firewall_rules = json.dumps([r.dict() for r in req.firewall_rules])
        else:
            existing_config.firewall_rules = None
        existing_config.firewall_default_policy = req.firewall_default_policy
        existing_config.status = ConfigStatus.VALIDATED
        existing_config.updated_at = datetime.utcnow()

        session.add(existing_config)
        session.commit()
        session.refresh(existing_config)
        config = existing_config
        import logging
        logging.info(f"Updated existing config for user {current_user.username} and app {config}")
        print(f"Updated existing config for user {current_user.username} and app {config}")
    else:
        # 创建新配置
        # Prepare volume_mounts JSON
        volume_mounts_json = None
        if req.volume_mounts:
            volume_mounts_json = json.dumps([m.dict() for m in req.volume_mounts])

        # Prepare firewall_rules JSON
        firewall_rules_json = None
        if req.firewall_rules:
            firewall_rules_json = json.dumps([r.dict() for r in req.firewall_rules])

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
            # Firewall configuration
            enable_firewall=req.enable_firewall,
            firewall_rules=firewall_rules_json,
            firewall_default_policy=req.firewall_default_policy,
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
        'root_password': config.root_password,
        'user_password': config.user_password,
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
        'root_password': config.root_password,
        'user_password': config.user_password,
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

        # Parse firewall_rules from config
        firewall_rules_list = None
        if config.firewall_rules:
            try:
                firewall_rules_list = json.loads(config.firewall_rules)
            except (json.JSONDecodeError, TypeError):
                firewall_rules_list = None

        # If firewall is enabled but no rules provided, add default SSH rule
        if config.enable_firewall and not firewall_rules_list:
            firewall_rules_list = [
                {"port": 22, "protocol": "tcp", "source": "0.0.0.0/0", "action": "allow"}
            ]
            logger.info(f"No firewall rules provided, using default SSH rule for pod {pod_name}")

        # Determine macvlan settings
        macvlan_network = None
        if config.bound_ip:
            macvlan_network = Config.MACVLAN_NETWORK_NAME

        # 生成密码并保存到数据库（第一次生成时会写入数据库）
        actual_root_password, actual_user_password = generate_and_save_passwords(config, session)
        print(f"Launching instance for user: {current_user.username} with root password: {actual_root_password} and user password: {actual_user_password}")

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
                import logging
                logging.info(f"Creating OpenClaw pod with name {pod_name} in namespace {namespace} using image {image.registry_url}")
                logging.info(f"macvlan config: {macvlan_network}, {config.bound_ip}, {Config.MACVLAN_GATEWAY}, {Config.MACVLAN_SUBNET}")
                if config.bound_ip == "10.5.6.202":
                    logging.warning(f"Attempting to bind to reserved IP: {config}")
                    raise HTTPException(status_code=400, detail="IP地址 ")

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
                    # Firewall configuration
                    enable_firewall=config.enable_firewall,
                    firewall_rules=firewall_rules_list,
                    firewall_default_policy=config.firewall_default_policy,
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

        # Determine which username and password to show
        ssh_user = current_user.cluster_username or current_user.username if config.sync_user else "root"
        display_password = actual_user_password if config.sync_user else actual_root_password

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
            'ssh_user': ssh_user,
            'password': display_password,
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


# ==================== OpenClaw Configuration API ====================


class UpdateOpenClawConfigRequest(BaseModel):
    """Update OpenClaw configuration request"""
    instance_id: int
    models: Optional[dict] = None
    channels: Optional[dict] = None


@router.get("/{app_id}/openclaw-config")
async def get_openclaw_config(
    app_id: str,
    instance_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    Read OpenClaw instance configuration file (~/.openclaw/openclaw.json)

    Returns:
        {
            "models": { "providers": {...} },
            "channels": {...},
            "agents": { "defaults": {...} },
            "gateway": {...}
        }
    """
    # Verify instance ownership
    container = session.get(Container, instance_id)
    if not container or container.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Container not found")

    if container.application_id != app_id:
        raise HTTPException(status_code=400, detail="Container does not belong to this application")

    if container.status != ContainerStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Container is not running")

    # Read configuration file
    try:
        from kubernetes import client as k8s_client
        from kubernetes.stream import stream

        v1 = k8s_client.CoreV1Api()
        namespace = container.k8s_namespace
        pod_name = container.k8s_pod_name

        # Execute command to check if config file exists and read it
        config_path = "~/.openclaw/openclaw.json"
        # Use 'test -f' to check if file exists, then cat if it does
        exec_command = ['bash', '-c', f'if [ -f {config_path} ]; then cat {config_path}; else echo "FILE_NOT_FOUND"; fi']

        resp = stream(
            v1.connect_get_namespaced_pod_exec,
            pod_name,
            namespace,
            command=exec_command,
            stderr=True,
            stdin=False,
            stdout=True,
            tty=False,
            _preload_content=False
        )

        config_content = ""
        stderr_content = ""
        while resp.is_open():
            resp.update(timeout=1)
            if resp.peek_stdout():
                config_content += resp.read_stdout()
            if resp.peek_stderr():
                stderr_content += resp.read_stderr()
        resp.close()

        # Check if file doesn't exist
        if config_content.strip() == "FILE_NOT_FOUND":
            logger.info(f"OpenClaw config file not found for container {instance_id}, returning empty config")
            # Return empty config structure
            return {
                "models": {"providers": {}},
                "channels": {},
                "agents": {"defaults": {"model": {"primary": ""}, "models": {}}},
                "gateway": {},
                "file_exists": False,
            }

        # Parse JSON
        if not config_content.strip():
            # Empty file or no output
            return {
                "models": {"providers": {}},
                "channels": {},
                "agents": {"defaults": {"model": {"primary": ""}, "models": {}}},
                "gateway": {},
                "file_exists": False,
            }

        config_json = json.loads(config_content)

        return {
            "models": config_json.get("models", {}),
            "channels": config_json.get("channels", {}),
            "agents": config_json.get("agents", {}),
            "gateway": config_json.get("gateway", {}),
            "file_exists": True,
        }

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse OpenClaw config for container {instance_id}: {str(e)}")
        logger.error(f"Config content: {config_content[:500]}")
        raise HTTPException(
            status_code=500,
            detail="配置文件格式错误，请检查JSON语法是否正确"
        )
    except Exception as e:
        logger.error(f"Error reading OpenClaw config for container {instance_id}: {str(e)}")
        if stderr_content:
            logger.error(f"Stderr: {stderr_content}")
        raise HTTPException(status_code=500, detail=f"读取配置失败: {str(e)}")


@router.put("/{app_id}/openclaw-config")
async def update_openclaw_config(
    app_id: str,
    request: UpdateOpenClawConfigRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    Update OpenClaw instance configuration file

    Only updates the provided sections (models or channels), keeps other config unchanged
    """
    # Verify instance ownership
    container = session.get(Container, request.instance_id)
    if not container or container.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Container not found")

    if container.application_id != app_id:
        raise HTTPException(status_code=400, detail="Container does not belong to this application")

    if container.status != ContainerStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Container is not running")

    # Read existing configuration first
    try:
        from kubernetes import client as k8s_client
        from kubernetes.stream import stream

        v1 = k8s_client.CoreV1Api()
        namespace = container.k8s_namespace
        pod_name = container.k8s_pod_name

        # Read current config
        config_path = "~/.openclaw/openclaw.json"
        exec_command = ['bash', '-c', f'cat {config_path}']

        resp = stream(
            v1.connect_get_namespaced_pod_exec,
            pod_name,
            namespace,
            command=exec_command,
            stderr=True,
            stdin=False,
            stdout=True,
            tty=False,
            _preload_content=False
        )

        config_content = ""
        while resp.is_open():
            resp.update(timeout=1)
            if resp.peek_stdout():
                config_content += resp.read_stdout()
        resp.close()

        config_json = json.loads(config_content)

        # Merge updates
        if request.models is not None:
            config_json["models"] = request.models
        if request.channels is not None:
            config_json["channels"] = request.channels

        # Write back configuration file
        new_config = json.dumps(config_json, indent=2)

        # Escape single quotes for bash heredoc
        new_config_escaped = new_config.replace("'", "'\"'\"'")

        # Use heredoc to write file
        write_command = [
            'bash', '-c',
            f"cat > {config_path} <<'EOF'\n{new_config}\nEOF"
        ]

        resp = stream(
            v1.connect_get_namespaced_pod_exec,
            pod_name,
            namespace,
            command=write_command,
            stderr=True,
            stdin=False,
            stdout=True,
            tty=False,
            _preload_content=False
        )

        # Wait for command to complete
        while resp.is_open():
            resp.update(timeout=1)
        resp.close()

        return {"message": "Configuration updated successfully"}

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse OpenClaw config file")
    except Exception as e:
        logger.error(f"Error updating OpenClaw config: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update config: {str(e)}")
