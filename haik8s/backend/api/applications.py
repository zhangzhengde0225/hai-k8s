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
from db.models import User, Container, Image, ContainerStatus, ApplicationConfig, ConfigStatus, ApplicationDefinition
from db.crud import update_container
from k8s_service.pods import delete_pod, create_app_pod, get_pod_status
from k8s_service.cache import get_pod_status_cached
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
    列出所有可用应用及用户配置状态

    返回平台支持的所有应用（如OpenClaw）及当前用户的配置状态、运行实例数等信息。

    ## 返回内容

    每个应用包含：
    - **id**: 应用标识符（如"openclaw"）
    - **name**: 应用显示名称
    - **version**: 应用版本
    - **status**: 应用状态（unconfigured/configured/stopped/running）
    - **is_configured**: 用户是否已保存配置
    - **pods**: 当前运行中的Pod数量
    - **total_instances**: 用户的总实例数（包括已停止）
    - **endpoint**: 应用访问URL（如果可用）
    - **config**: 用户配置详情（如果已配置）

    ## 应用状态说明

    - `unconfigured`: 用户未保存配置
    - `configured`: 已保存配置但未启动实例
    - `stopped`: 有实例但全部已停止
    - `running`: 有运行中的实例

    ## 使用示例

    ```bash
    curl -H "Authorization: Bearer <token>" \\
         http://localhost:42900/api/applications
    ```

    ## 典型响应

    ```json
    [
      {
        "id": "openclaw",
        "name": "OpenClaw",
        "version": "1.0.0",
        "status": "running",
        "is_configured": true,
        "pods": 1,
        "replicas": 1,
        "total_instances": 1,
        "endpoint": "http://192.168.1.100",
        "config": {
          "image_id": 5,
          "cpu_request": 4.0,
          "memory_request": 8.0,
          "gpu_request": 0,
          "ssh_enabled": false
        }
      }
    ]
    ```
    """
    result = []

    # Get all visible application definitions from database
    app_definitions = session.exec(
        select(ApplicationDefinition).where(ApplicationDefinition.is_visible == True)
    ).all()

    for app_def in app_definitions:
        app_id = app_def.app_id

        # Find all active images with matching tag
        all_images = session.exec(
            select(Image).where(Image.is_active == True)
        ).all()

        # Filter images by tag (tag matches app_id)
        images = []
        for img in all_images:
            if img.tags:
                try:
                    tags = json.loads(img.tags)
                    if app_id in tags:
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
            'name': app_def.name,
            'version': app_def.version,
            'status': status,
            'is_configured': has_config,
            'pods': running_count,
            'replicas': app_def.default_replicas,
            'total_instances': total_count,
            'endpoint': endpoint,
            'defaultImage': app_def.image_prefix,
            'recommended_cpu': app_def.recommended_cpu,
            'recommended_memory': app_def.recommended_memory,
            'recommended_gpu': app_def.recommended_gpu,
            'max_cpu': app_def.max_cpu,
            'max_memory': app_def.max_memory,
            'max_gpu': app_def.max_gpu,
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

    # Fallback to hard-coded APPLICATIONS if database is empty (for backward compatibility)
    if not result:
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
    获取指定应用的所有实例

    返回当前用户在指定应用下创建的所有实例（容器），包括运行中和已停止的实例。

    ## 路径参数

    - **app_id**: 应用标识符（如"openclaw"）

    ## 返回内容

    包含应用信息和实例列表：
    - **application**: 应用基本信息（id, name, version）
    - **instances**: 实例列表，每个实例包含：
      - **id**: 容器ID
      - **name**: 容器名称
      - **status**: 容器状态（creating/running/stopped等）
      - **k8s_status**: Kubernetes Pod状态
      - **cpu_request, memory_request, gpu_request**: 资源配置
      - **ssh_command**: SSH访问命令（如果启用）
      - **bound_ip**: 绑定的IP地址
      - **password**: 访问密码（root或user密码）
    - **total**: 实例总数

    ## 错误处理

    - **404**: 应用不存在

    ## 使用示例

    ```bash
    curl -H "Authorization: Bearer <token>" \\
         http://localhost:42900/api/applications/openclaw/instances
    ```

    ## 典型响应

    ```json
    {
      "application": {
        "id": "openclaw",
        "name": "OpenClaw",
        "version": "1.0.0"
      },
      "instances": [
        {
          "id": 123,
          "name": "openclaw-instance-1",
          "status": "running",
          "k8s_status": "Running",
          "cpu_request": 4.0,
          "memory_request": 8.0,
          "gpu_request": 0,
          "ssh_enabled": false,
          "bound_ip": "192.168.1.100",
          "password": "your_password_here"
        }
      ],
      "total": 1
    }
    ```
    """
    # Check database first, then fall back to hard-coded applications
    app_def = session.exec(
        select(ApplicationDefinition).where(ApplicationDefinition.app_id == app_id)
    ).first()

    app_config = None
    if app_def:
        app_config = {
            'id': app_def.app_id,
            'name': app_def.name,
            'version': app_def.version,
            'image_prefix': app_def.image_prefix,
            'default_replicas': app_def.default_replicas,
        }
    elif app_id not in APPLICATIONS:
        raise HTTPException(status_code=404, detail="Application not found")
    else:
        app_config = APPLICATIONS[app_id]

    # Find all active images with matching tag
    all_images = session.exec(
        select(Image).where(Image.is_active == True)
    ).all()

    # Filter images by tag (tag matches app_id)
    app_tag = app_id  # 'openclaw' or 'opendrsai'
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

    # Build response with K8s status sync (concurrent K8s calls via thread-pool)
    loop = asyncio.get_event_loop()

    async def _fetch_k8s_status(namespace, pod_name):
        return await loop.run_in_executor(None, get_pod_status_cached, namespace, pod_name)

    async def _none():
        return None

    k8s_tasks = [
        _fetch_k8s_status(c.k8s_namespace, c.k8s_pod_name)
        if (c.k8s_pod_name and c.k8s_namespace)
        else _none()
        for c in containers
    ]
    k8s_statuses = await asyncio.gather(*k8s_tasks)

    instances = []
    for container, k8s_status in zip(containers, k8s_statuses):
        # Get image info
        image = session.get(Image, container.image_id)

        # Sync DB status from K8s status (mirrors logic in GET /containers/{id})
        if container.status in (ContainerStatus.CREATING, ContainerStatus.RUNNING):
            if k8s_status is None:
                update_container(session, container.id, status=ContainerStatus.STOPPED)
                container.status = ContainerStatus.STOPPED
            elif k8s_status == "Running" and container.status != ContainerStatus.RUNNING:
                update_container(session, container.id, status=ContainerStatus.RUNNING)
                container.status = ContainerStatus.RUNNING
            elif k8s_status == "Failed":
                update_container(session, container.id, status=ContainerStatus.FAILED)
                container.status = ContainerStatus.FAILED
            # Pending → keep CREATING

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

    startup_scripts_config = None
    if app_def and app_def.startup_scripts_config:
        try:
            startup_scripts_config = json.loads(app_def.startup_scripts_config)
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        'application': {
            'id': app_id,
            'name': app_config['name'],
            'version': app_config['version'],
            'startup_scripts_config': startup_scripts_config,
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
    保存应用配置

    创建或更新应用配置。每个用户每个应用只能有一个活动配置。

    ## 路径参数

    - **app_id**: 应用标识符（如"openclaw"）

    ## 请求体

    - **image_id**: 镜像ID（必须是标记了对应应用标签的镜像）
    - **cpu_request**: CPU核心数（0.1-32.0，不超过用户配额）
    - **memory_request**: 内存GB（0.5-128.0，不超过用户配额）
    - **gpu_request**: GPU数量（0-8，不超过用户配额）
    - **ssh_enabled**: 是否启用SSH访问
    - **storage_path**: 存储路径（可选）
    - **bound_ip**: 绑定IP地址（可选）
    - **volume_mounts**: 挂载卷配置（可选）
    - **sync_user**: 是否同步用户（默认true）
    - **user_uid, user_gid**: 用户UID/GID（可选）
    - **user_home_dir**: 用户主目录（可选）
    - **enable_sudo**: 是否启用sudo（默认false）
    - **root_password, user_password**: 密码（可选，不设置会自动生成）

    ## 校验规则

    1. 镜像必须存在且is_active=True
    2. 镜像标签必须包含应用ID（如"openclaw"）
    3. GPU镜像要求gpu_request>0
    4. 资源请求不超过用户配额

    ## 返回内容

    保存的配置对象，包括自动生成的密码（如果未设置）

    ## 错误处理

    - **400**: 配额超限、镜像不匹配、GPU要求不满足
    - **404**: 应用或镜像不存在

    ## 使用示例

    ```bash
    curl -X POST \\
         -H "Authorization: Bearer <token>" \\
         -H "Content-Type: application/json" \\
         -d '{
           "image_id": 5,
           "cpu_request": 4.0,
           "memory_request": 8.0,
           "gpu_request": 0,
           "ssh_enabled": false
         }' \\
         http://localhost:42900/api/applications/openclaw/config
    ```

    ## 智能体注意事项

    - 首次配置使用POST，更新配置使用PUT（或POST覆盖）
    - 如果不指定密码，系统会自动生成16位随机密码
    - 保存配置后需要调用`POST /{app_id}/launch`来启动实例
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

    返回当前用户为指定应用保存的配置。每个用户每个应用只有一个活动配置。

    ## 路径参数

    - **app_id**: 应用标识符（如"openclaw"）

    ## 返回内容

    配置对象，包括：
    - **id**: 配置ID
    - **application_id**: 应用ID
    - **image_id, image_name**: 镜像信息
    - **cpu_request, memory_request, gpu_request**: 资源配置
    - **ssh_enabled**: SSH访问状态
    - **storage_path**: 存储路径
    - **volume_mounts**: 挂载卷配置
    - **bound_ip**: 绑定IP
    - **status**: 配置状态（validated/archived）
    - **instance_count**: 使用此配置的实例数
    - **sync_user**: 是否同步用户
    - **root_password, user_password**: 访问密码

    ## 错误处理

    - **404**: 应用不存在或用户未保存配置

    ## 使用示例

    ```bash
    curl -H "Authorization: Bearer <token>" \\
         http://localhost:42900/api/applications/openclaw/config
    ```

    ## 智能体注意事项

    - 在启动实例前检查是否已有配置
    - 如果返回404，需要先调用`POST /{app_id}/config`保存配置
    - 返回的密码用于SSH登录（如果启用）
    """
    # Check database first, then fall back to hard-coded applications
    app_def = session.exec(
        select(ApplicationDefinition).where(ApplicationDefinition.app_id == app_id)
    ).first()

    if not app_def and app_id not in APPLICATIONS:
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
    启动应用实例

    根据已保存的配置创建并启动应用实例（如OpenClaw）。这是智能体启动服务的核心端点。

    ## 路径参数

    - **app_id**: 应用标识符（如"openclaw"）

    ## 请求体

    - **count**: 启动实例数量（默认1，某些应用支持多实例）
    - **instance_name**: 实例名称（可选，单实例时使用）

    ## 前置条件

    1. 用户必须已保存配置（通过`POST /{app_id}/config`）
    2. 配置状态必须为validated
    3. 用户有足够的资源配额（CPU/内存/GPU）
    4. 镜像可用且is_active=True
    5. 同一应用不能有其他运行中的实例

    ## 处理流程

    1. 验证应用ID和用户配置
    2. 二次检查资源配额充足
    3. 检查是否已有运行中的实例（每个应用限一个）
    4. 生成root和user密码（如果未设置）
    5. 创建Kubernetes Pod（可能包含MacVLAN网络配置）
    6. 创建数据库Container记录
    7. 返回容器详情（包括访问信息和密码）

    ## 返回内容

    容器详情列表（通常为1个），每个包含：
    - **id**: 容器ID
    - **name**: 容器名称
    - **k8s_pod_name, k8s_namespace**: Kubernetes资源标识
    - **status**: 初始状态（通常为"creating"）
    - **bound_ip**: 绑定的IP地址（如果配置了）
    - **ssh_command**: SSH访问命令（如果启用）
    - **root_password, user_password**: 访问密码
    - **created_at**: 创建时间

    ## 错误处理

    - **400**: 配额超限、配置未校验、已有运行中实例
    - **404**: 应用不存在、配置不存在、镜像不可用
    - **409**: Pod名称冲突（正在删除旧Pod）

    ## 智能体使用示例

    完整的OpenClaw启动流程：

    ```python
    # Step 1: 检查是否已有配置
    response = requests.get(
        "http://localhost:42900/api/applications/openclaw/config",
        headers={"Authorization": f"Bearer {token}"}
    )

    if response.status_code == 404:
        # Step 2: 创建配置
        config_data = {
            "image_id": 5,
            "cpu_request": 4.0,
            "memory_request": 8.0,
            "gpu_request": 0,
            "ssh_enabled": False
        }
        requests.post(
            "http://localhost:42900/api/applications/openclaw/config",
            headers={"Authorization": f"Bearer {token}"},
            json=config_data
        )

    # Step 3: 启动实例
    response = requests.post(
        "http://localhost:42900/api/applications/openclaw/launch",
        headers={"Authorization": f"Bearer {token}"},
        json={"count": 1}
    )

    instance = response.json()[0]
    print(f"Instance created: {instance['name']}")
    print(f"Access URL: http://{instance['bound_ip']}")
    print(f"Password: {instance['user_password']}")

    # Step 4: 等待Pod运行（轮询状态）
    while True:
        response = requests.get(
            "http://localhost:42900/api/applications/openclaw/instances",
            headers={"Authorization": f"Bearer {token}"}
        )
        instances = response.json()['instances']
        if instances and instances[0]['k8s_status'] == 'Running':
            print("Instance is ready!")
            break
        time.sleep(5)
    ```

    ## 注意事项

    - 密码在启动时自动生成（如果配置中未设置）
    - 同一应用只能有一个运行中的实例，需要先删除旧实例
    - Pod创建是异步的，返回后状态为"creating"，需轮询状态直到"Running"
    - 绑定IP需要在配置中预先设置bound_ip字段
    """
    # Check database first, then fall back to hard-coded applications
    app_def = session.exec(
        select(ApplicationDefinition).where(ApplicationDefinition.app_id == app_id)
    ).first()

    if not app_def and app_id not in APPLICATIONS:
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
    """
    停止应用的所有实例

    删除当前用户在指定应用下的所有运行中和创建中的实例（Pod和Service），并将数据库记录标记为DELETED。

    ## 路径参数

    - **app_id**: 应用标识符（如"openclaw"）

    ## 处理流程

    1. 查找应用对应的所有镜像
    2. 查询用户所有运行中/创建中的容器
    3. 删除每个容器的Kubernetes资源（Pod和Service）
    4. 更新数据库状态为DELETED
    5. 返回删除的实例数量

    ## 返回内容

    ```json
    {
      "message": "删除了 N 个实例",
      "deleted": N
    }
    ```

    ## 错误处理

    - **404**: 应用不存在
    - 即使某些资源删除失败，也会继续处理其他实例

    ## 使用示例

    ```bash
    curl -X POST \\
         -H "Authorization: Bearer <token>" \\
         http://localhost:42900/api/applications/openclaw/stop
    ```

    ## 注意事项

    - 此操作会立即删除所有运行中的实例
    - Pod删除是异步的，实际终止需要几秒钟
    - 数据库记录标记为DELETED但不会物理删除
    - 停止后可以重新调用launch启动新实例
    """
    # Check database first, then fall back to hard-coded applications
    app_def = session.exec(
        select(ApplicationDefinition).where(ApplicationDefinition.app_id == app_id)
    ).first()

    app_cfg = None
    if app_def:
        app_cfg = {
            'id': app_def.app_id,
            'name': app_def.name,
            'version': app_def.version,
            'image_prefix': app_def.image_prefix,
            'default_replicas': app_def.default_replicas,
        }
    elif app_id not in APPLICATIONS:
        raise HTTPException(status_code=404, detail="Application not found")
    else:
        app_cfg = APPLICATIONS[app_id]

    all_images = session.exec(select(Image).where(Image.is_active == True)).all()

    app_tag = app_id
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
    agents: Optional[dict] = None


@router.get("/{app_id}/openclaw-config")
async def get_openclaw_config(
    app_id: str,
    instance_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    读取OpenClaw实例配置文件

    通过Kubernetes exec读取运行中OpenClaw实例的配置文件（~/.openclaw/openclaw.json）。

    ## 路径参数

    - **app_id**: 应用标识符（通常为"openclaw"）

    ## 查询参数

    - **instance_id**: 容器ID（从`/api/applications/{app_id}/instances`获取）

    ## 返回内容

    OpenClaw配置JSON对象，包含：
    - **models**: 模型提供商配置
    - **channels**: 通道配置
    - **agents**: 代理默认配置
    - **gateway**: 网关配置

    ## 错误处理

    - **400**: 容器不属于此应用或未运行
    - **404**: 容器不存在或不属于当前用户
    - **500**: Kubernetes exec失败或配置文件不存在

    ## 使用示例

    ```bash
    curl -H "Authorization: Bearer <token>" \\
         "http://localhost:42900/api/applications/openclaw/openclaw-config?instance_id=123"
    ```

    ## 注意事项

    - 容器必须处于Running状态
    - 配置文件路径：`~/.openclaw/openclaw.json`
    - 如果配置文件不存在，返回500错误
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
        ssh_user = container.user.cluster_username if container.user else None
        if ssh_user:
            exec_command = ['bash', '-c', f'su - {ssh_user} -c "if [ -f {config_path} ]; then cat {config_path}; else echo FILE_NOT_FOUND; fi"']
        else:
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
    更新OpenClaw实例配置文件

    通过Kubernetes exec更新运行中OpenClaw实例的配置文件。只更新提供的部分，其他配置保持不变。

    ## 路径参数

    - **app_id**: 应用标识符（通常为"openclaw"）

    ## 请求体

    - **instance_id**: 容器ID（必需）
    - **models**: 模型配置（可选，如果提供会完全替换models部分）
    - **channels**: 通道配置（可选，如果提供会完全替换channels部分）

    ## 处理流程

    1. 验证容器所有权和状态
    2. 读取现有配置文件
    3. 合并更新（只替换提供的sections）
    4. 写回配置文件

    ## 返回内容

    ```json
    {
      "message": "Configuration updated successfully"
    }
    ```

    ## 错误处理

    - **400**: 容器不属于此应用或未运行
    - **404**: 容器不存在或不属于当前用户
    - **500**: Kubernetes exec失败、JSON解析错误、文件写入失败

    ## 使用示例

    ```bash
    curl -X PUT \\
         -H "Authorization: Bearer <token>" \\
         -H "Content-Type: application/json" \\
         -d '{
           "instance_id": 123,
           "models": {
             "providers": {
               "anthropic": {
                 "api_key": "your-api-key"
               }
             }
           }
         }' \\
         http://localhost:42900/api/applications/openclaw/openclaw-config
    ```

    ## 注意事项

    - 容器必须处于Running状态
    - 只更新提供的sections（models或channels），其他部分保持不变
    - 配置文件路径：`~/.openclaw/openclaw.json`
    - 更新后OpenClaw服务可能需要重启以加载新配置
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
        ssh_user = container.user.cluster_username if container.user else None
        if ssh_user:
            exec_command = ['bash', '-c', f'su - {ssh_user} -c "cat {config_path}"']
        else:
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
        if request.agents is not None:
            import copy
            merged_agents = copy.deepcopy(config_json.get("agents", {}))
            def deep_merge(base: dict, override: dict) -> dict:
                for k, v in override.items():
                    if isinstance(v, dict) and isinstance(base.get(k), dict):
                        deep_merge(base[k], v)
                    else:
                        base[k] = v
                return base
            config_json["agents"] = deep_merge(merged_agents, request.agents)

        # Write back configuration file
        new_config = json.dumps(config_json, indent=2)
        new_config_escaped = new_config.replace("'", "'\"'\"'")

        if ssh_user:
            write_command = ['bash', '-c', f"su - {ssh_user} -c 'cat > {config_path}' <<'EOF'\n{new_config}\nEOF"]
        else:
            write_command = ['bash', '-c', f"cat > {config_path} <<'EOF'\n{new_config}\nEOF"]

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
