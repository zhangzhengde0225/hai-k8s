"""
Database models for HAI-K8S

Author: Zhengde ZHANG
"""
from datetime import datetime
from typing import Optional
from enum import Enum
from sqlmodel import SQLModel, Field, Relationship


class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"


class AuthProvider(str, Enum):
    IHEP_SSO = "ihep_sso"


class ContainerStatus(str, Enum):
    CREATING = "creating"
    RUNNING = "running"
    STOPPED = "stopped"
    FAILED = "failed"
    DELETED = "deleted"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    email: str = Field(unique=True)
    full_name: Optional[str] = None
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

    user: Optional[User] = Relationship(back_populates="containers")
    image: Optional[Image] = Relationship(back_populates="containers")
