"""
Database models for HAI-K8S

Author: Zhengde ZHANG
"""
from datetime import datetime
from typing import Optional
from enum import Enum
from sqlmodel import SQLModel, Field, Relationship, UniqueConstraint


class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"


class AuthProvider(str, Enum):
    IHEP_SSO = "ihep_sso"
    LOCAL = "local"


class ContainerStatus(str, Enum):
    CREATING = "creating"
    RUNNING = "running"
    STOPPED = "stopped"
    FAILED = "failed"
    DELETED = "deleted"


class ConfigStatus(str, Enum):
    """配置状态"""
    DRAFT = "draft"          # 草稿
    VALIDATED = "validated"  # 已校验（可启动）
    ARCHIVED = "archived"    # 已归档


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    email: str = Field(unique=True)
    full_name: Optional[str] = None
    password_hash: Optional[str] = None  # For local authentication
    role: UserRole = Field(default=UserRole.USER)
    auth_provider: AuthProvider = Field(default=AuthProvider.IHEP_SSO)
    sso_id: Optional[str] = Field(default=None, unique=True, index=True)
    is_active: bool = Field(default=True)
    cpu_quota: float = Field(default=4.0)  # CPU cores
    memory_quota: float = Field(default=8.0)  # GB
    gpu_quota: int = Field(default=1)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login_at: Optional[datetime] = None

    containers: list["Container"] = Relationship(back_populates="user")
    application_configs: list["ApplicationConfig"] = Relationship(back_populates="user")


class Image(SQLModel, table=True):
    __tablename__ = "images"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)
    registry_url: str
    description: Optional[str] = None
    default_cmd: Optional[str] = Field(default="/bin/bash")
    gpu_required: bool = Field(default=False)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Enhanced metadata fields
    version: Optional[str] = None  # Version like "v1.0.0", "latest"
    tags: Optional[str] = None  # JSON string storing tag array, e.g. '["openclaw", "gpu", "production"]'
    env_vars: Optional[str] = None  # JSON string for environment variables, e.g. '{"PYTHON_VERSION": "3.11"}'
    ports: Optional[str] = None  # JSON string for port list, e.g. '[8080, 8443]'
    recommended_resources: Optional[str] = None  # JSON string for recommended resources, e.g. '{"cpu": 2.0, "memory": 4.0, "gpu": 0}'

    containers: list["Container"] = Relationship(back_populates="image")


class Container(SQLModel, table=True):
    __tablename__ = "containers"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    user_id: int = Field(foreign_key="users.id")
    image_id: int = Field(foreign_key="images.id")
    k8s_namespace: Optional[str] = None
    k8s_pod_name: Optional[str] = None
    k8s_service_name: Optional[str] = None
    cpu_request: float = Field(default=1.0)  # CPU cores
    memory_request: float = Field(default=2.0)  # GB
    gpu_request: int = Field(default=0)
    ssh_enabled: bool = Field(default=False)
    ssh_node_port: Optional[int] = None
    status: ContainerStatus = Field(default=ContainerStatus.CREATING)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # 新增字段
    config_id: Optional[int] = Field(default=None, foreign_key="application_configs.id")
    application_id: Optional[str] = Field(default=None, index=True)

    user: Optional[User] = Relationship(back_populates="containers")
    image: Optional[Image] = Relationship(back_populates="containers")
    config: Optional["ApplicationConfig"] = Relationship(back_populates="instances")


class ApplicationConfig(SQLModel, table=True):
    """应用配置表 - 存储用户的应用配置（每个用户每个应用只能有1个配置）"""
    __tablename__ = "application_configs"

    id: Optional[int] = Field(default=None, primary_key=True)

    # 关联关系 - 每个用户每个应用只能有1个配置
    user_id: int = Field(foreign_key="users.id")
    application_id: str = Field(index=True)  # "openclaw", "opendrsai"
    image_id: int = Field(foreign_key="images.id")

    # 资源配置
    cpu_request: float = Field(default=2.0)
    memory_request: float = Field(default=4.0)
    gpu_request: int = Field(default=0)
    ssh_enabled: bool = Field(default=True)
    storage_path: Optional[str] = None

    # 状态
    status: ConfigStatus = Field(default=ConfigStatus.DRAFT)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # 关系
    user: Optional[User] = Relationship(back_populates="application_configs")
    image: Optional[Image] = Relationship()
    instances: list["Container"] = Relationship(back_populates="config")

    class Config:
        """SQLModel配置"""
        table = True
        arbitrary_types_allowed = True

    __table_args__ = (
        UniqueConstraint('user_id', 'application_id',
                        name='uq_user_app'),
    )
