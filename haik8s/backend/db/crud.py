"""
CRUD operations for HAI-K8S database
"""
import logging
from datetime import datetime
from typing import Optional
from sqlmodel import Session, select, func

from db.models import (
    User, Container, Image, ApplicationConfig,
    ContainerStatus, UserRole, AuthProvider, ConfigStatus
)

logger = logging.getLogger(__name__)

LOCAL_USER_ID_START = 10000  # 本地用户 id 起始值


def _next_local_user_id(session: Session) -> int:
    """返回本地用户可用的下一个 id（>= LOCAL_USER_ID_START）"""
    max_id = session.exec(
        select(func.max(User.id)).where(User.id >= LOCAL_USER_ID_START)
    ).first()
    return (max_id + 1) if max_id else LOCAL_USER_ID_START


# ── User CRUD ──────────────────────────────────────────────────────────────

def get_user_by_id(session: Session, user_id: int) -> Optional[User]:
    return session.get(User, user_id)


def get_user_by_sso_id(session: Session, sso_id: str) -> Optional[User]:
    statement = select(User).where(User.sso_id == sso_id)
    return session.exec(statement).first()


def get_user_by_username(session: Session, username: str) -> Optional[User]:
    statement = select(User).where(User.username == username)
    return session.exec(statement).first()


def create_sso_user(
    session: Session,
    sso_id: str,
    username: str,
    email: str,
    full_name: Optional[str] = None,
    cluster_username: Optional[str] = None,
    cluster_uid: Optional[int] = None,
    cluster_gid: Optional[int] = None,
    cluster_home_dir: Optional[str] = None,
    api_key_of_hepai: Optional[str] = None,
    user_id: Optional[int] = None,  # 来自 SSO umtId，显式指定 id
) -> User:
    user = User(
        id=user_id,
        username=username,
        email=email,
        full_name=full_name or username,
        role=UserRole.USER,
        auth_provider=AuthProvider.IHEP_SSO,
        sso_id=sso_id,
        cluster_username=cluster_username,
        cluster_uid=cluster_uid,
        cluster_gid=cluster_gid,
        cluster_home_dir=cluster_home_dir,
        api_key_of_hepai=api_key_of_hepai,
        last_login_at=datetime.utcnow(),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def create_local_user(
    session: Session,
    username: str,
    email: str,
    password_hash: str,
    full_name: Optional[str] = None,
    role: UserRole = UserRole.USER,
) -> User:
    """Create a local user with password, id starts from LOCAL_USER_ID_START (10000)"""
    user = User(
        id=_next_local_user_id(session),
        username=username,
        email=email,
        full_name=full_name or username,
        password_hash=password_hash,
        role=role,
        auth_provider=AuthProvider.LOCAL,
        last_login_at=datetime.utcnow(),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def update_last_login(session: Session, user_id: int):
    user = session.get(User, user_id)
    if user:
        user.last_login_at = datetime.utcnow()
        session.add(user)
        session.commit()


def update_cluster_info(
    session: Session,
    user_id: int,
    cluster_username: Optional[str] = None,
    cluster_uid: Optional[int] = None,
    cluster_gid: Optional[int] = None,
    cluster_home_dir: Optional[str] = None,
):
    """回填集群账号信息（sn/uid/gid/home_dir），仅覆盖传入的非 None 字段"""
    user = session.get(User, user_id)
    if not user:
        return
    if cluster_username is not None:
        user.cluster_username = cluster_username
    if cluster_uid is not None:
        user.cluster_uid = cluster_uid
    if cluster_gid is not None:
        user.cluster_gid = cluster_gid
    if cluster_home_dir is not None:
        user.cluster_home_dir = cluster_home_dir
    session.add(user)
    session.commit()


def list_users(session: Session) -> list[User]:
    return list(session.exec(select(User)).all())


def update_user(session: Session, user_id: int, **kwargs) -> Optional[User]:
    user = session.get(User, user_id)
    if not user:
        return None
    for key, value in kwargs.items():
        if hasattr(user, key):
            setattr(user, key, value)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


# ── Container CRUD ─────────────────────────────────────────────────────────

def create_container(session: Session, **kwargs) -> Container:
    container = Container(**kwargs)
    session.add(container)
    session.commit()
    session.refresh(container)
    return container


def get_container_by_id(session: Session, container_id: int) -> Optional[Container]:
    return session.get(Container, container_id)


def list_containers_by_user(session: Session, user_id: int) -> list[Container]:
    statement = select(Container).where(
        Container.user_id == user_id,
        Container.status != ContainerStatus.DELETED,
    )
    return list(session.exec(statement).all())


def list_all_containers(session: Session) -> list[Container]:
    statement = select(Container).where(Container.status != ContainerStatus.DELETED)
    return list(session.exec(statement).all())


def update_container(session: Session, container_id: int, **kwargs) -> Optional[Container]:
    container = session.get(Container, container_id)
    if not container:
        return None
    for key, value in kwargs.items():
        if hasattr(container, key):
            setattr(container, key, value)
    container.updated_at = datetime.utcnow()
    session.add(container)
    session.commit()
    session.refresh(container)
    return container


# ── Quota Checking ─────────────────────────────────────────────────────────

def get_user_resource_usage(session: Session, user_id: int) -> dict:
    """Sum resources of running/creating containers for a user"""
    statement = select(Container).where(
        Container.user_id == user_id,
        Container.status.in_([ContainerStatus.RUNNING, ContainerStatus.CREATING]),
    )
    containers = session.exec(statement).all()
    return {
        "cpu_used": sum(c.cpu_request for c in containers),
        "memory_used": sum(c.memory_request for c in containers),
        "gpu_used": sum(c.gpu_request for c in containers),
    }


def check_quota(session: Session, user: User, cpu: float, memory: float, gpu: int) -> tuple[bool, str]:
    """Check if user has enough quota for requested resources. Returns (ok, message)."""
    usage = get_user_resource_usage(session, user.id)
    if usage["cpu_used"] + cpu > user.cpu_quota:
        return False, f"CPU quota exceeded: {usage['cpu_used']}+{cpu} > {user.cpu_quota}"
    if usage["memory_used"] + memory > user.memory_quota:
        return False, f"Memory quota exceeded: {usage['memory_used']}+{memory} > {user.memory_quota}"
    if usage["gpu_used"] + gpu > user.gpu_quota:
        return False, f"GPU quota exceeded: {usage['gpu_used']}+{gpu} > {user.gpu_quota}"
    return True, "OK"


# ── NodePort Allocation ───────────────────────────────────────────────────

def find_available_nodeport(
    session: Session,
    range_start: int = 30000,
    range_end: int = 32767,
    extra_excluded: Optional[set] = None,
) -> Optional[int]:
    """Find the next unused NodePort in the given range.

    Args:
        extra_excluded: Additional ports to exclude (e.g. ports already allocated
                        in K8s that are not yet recorded in the DB).
    """
    statement = select(Container.ssh_node_port).where(
        Container.ssh_node_port.isnot(None),
        Container.status != ContainerStatus.DELETED,
    )
    used_ports = set(session.exec(statement).all())
    if extra_excluded:
        used_ports |= extra_excluded
    for port in range(range_start, range_end + 1):
        if port not in used_ports:
            return port
    return None


# ── Image CRUD ─────────────────────────────────────────────────────────────

def get_image_by_name(session: Session, name: str) -> Optional[Image]:
    """Get image by name (including inactive ones)"""
    statement = select(Image).where(Image.name == name)
    return session.exec(statement).first()


def create_image(session: Session, **kwargs) -> Image:
    """Create a new image or reactivate existing one with the same name"""
    # Check if an inactive image with the same name exists
    existing_image = get_image_by_name(session, kwargs.get('name'))

    if existing_image:
        # Reactivate and update the existing image
        logger.info(f"Reactivating image: {existing_image.name} (ID: {existing_image.id})")
        existing_image.registry_url = kwargs.get('registry_url', existing_image.registry_url)
        existing_image.description = kwargs.get('description', existing_image.description)
        existing_image.default_cmd = kwargs.get('default_cmd', existing_image.default_cmd)
        existing_image.gpu_required = kwargs.get('gpu_required', existing_image.gpu_required)
        existing_image.is_active = True
        existing_image.created_at = datetime.utcnow()  # Update timestamp

        session.add(existing_image)
        session.commit()
        session.refresh(existing_image)
        return existing_image
    else:
        # Create new image
        logger.info(f"Creating new image: {kwargs.get('name')}")
        image = Image(**kwargs)
        session.add(image)
        session.commit()
        session.refresh(image)
        return image


def get_image_by_id(session: Session, image_id: int) -> Optional[Image]:
    return session.get(Image, image_id)


def list_images(session: Session, active_only: bool = True) -> list[Image]:
    statement = select(Image)
    if active_only:
        statement = statement.where(Image.is_active == True)
    return list(session.exec(statement).all())


def delete_image(session: Session, image_id: int) -> bool:
    image = session.get(Image, image_id)
    if not image:
        return False
    image.is_active = False
    session.add(image)
    session.commit()
    return True


# ── ApplicationConfig CRUD ────────────────────────────────────────────────

def create_or_update_app_config(
    session: Session,
    user_id: int,
    app_id: str,
    config_name: str,
    **kwargs
) -> ApplicationConfig:
    """Create or update application configuration"""
    # Check if config exists
    existing = session.exec(
        select(ApplicationConfig).where(
            ApplicationConfig.user_id == user_id,
            ApplicationConfig.application_id == app_id,
            ApplicationConfig.config_name == config_name
        )
    ).first()

    if existing:
        # Update existing config
        for key, value in kwargs.items():
            if hasattr(existing, key):
                setattr(existing, key, value)
        existing.updated_at = datetime.utcnow()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    else:
        # Create new config
        config = ApplicationConfig(
            user_id=user_id,
            application_id=app_id,
            config_name=config_name,
            **kwargs
        )
        session.add(config)
        session.commit()
        session.refresh(config)
        return config


def get_app_config(
    session: Session,
    user_id: int,
    app_id: str,
    config_id: int
) -> Optional[ApplicationConfig]:
    """Get specific application configuration"""
    return session.exec(
        select(ApplicationConfig).where(
            ApplicationConfig.id == config_id,
            ApplicationConfig.user_id == user_id,
            ApplicationConfig.application_id == app_id,
            ApplicationConfig.status != ConfigStatus.ARCHIVED
        )
    ).first()


def list_app_configs(
    session: Session,
    user_id: int,
    app_id: str
) -> list[ApplicationConfig]:
    """List all configurations for a specific application"""
    return list(session.exec(
        select(ApplicationConfig).where(
            ApplicationConfig.user_id == user_id,
            ApplicationConfig.application_id == app_id,
            ApplicationConfig.status != ConfigStatus.ARCHIVED
        ).order_by(ApplicationConfig.created_at.desc())
    ).all())


def delete_app_config(session: Session, config_id: int) -> bool:
    """Soft delete application configuration"""
    config = session.get(ApplicationConfig, config_id)
    if not config:
        return False
    config.status = ConfigStatus.ARCHIVED
    config.updated_at = datetime.utcnow()
    session.add(config)
    session.commit()
    return True


def set_default_config(
    session: Session,
    user_id: int,
    app_id: str,
    config_id: int
) -> bool:
    """Set a configuration as default and unset others"""
    # Get the config to set as default
    config = session.exec(
        select(ApplicationConfig).where(
            ApplicationConfig.id == config_id,
            ApplicationConfig.user_id == user_id,
            ApplicationConfig.application_id == app_id
        )
    ).first()

    if not config:
        return False

    # Unset all other configs as default
    other_configs = session.exec(
        select(ApplicationConfig).where(
            ApplicationConfig.user_id == user_id,
            ApplicationConfig.application_id == app_id,
            ApplicationConfig.id != config_id
        )
    ).all()

    for other in other_configs:
        other.is_default = False
        session.add(other)

    # Set this config as default
    config.is_default = True
    session.add(config)

    session.commit()
    return True


def get_config_instance_count(session: Session, config_id: int) -> int:
    """Count active instances for a configuration"""
    return len(session.exec(
        select(Container).where(
            Container.config_id == config_id,
            Container.status != ContainerStatus.DELETED
        )
    ).all())
