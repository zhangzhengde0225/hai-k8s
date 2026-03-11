"""
Container request/response schemas
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator
import re


class CreateContainerRequest(BaseModel):
    """创建容器的请求schema"""

    name: str = Field(
        ...,
        min_length=1,
        max_length=63,
        description="容器名称（小写字母、数字和连字符，不能以连字符开头或结尾）",
        examples=["my-container", "gpu-workload-1", "dev-env"]
    )
    image_id: int = Field(
        ...,
        description="镜像ID（从 /api/images 端点获取）",
        examples=[1, 2, 5]
    )
    cpu_request: float = Field(
        default=1.0,
        ge=0.1,
        le=32.0,
        description="请求的CPU核心数（受用户配额限制）",
        examples=[1.0, 2.0, 4.0, 8.0]
    )
    memory_request: float = Field(
        default=2.0,
        ge=0.5,
        le=128.0,
        description="请求的内存（GB，受用户配额限制）",
        examples=[2.0, 4.0, 8.0, 16.0, 32.0]
    )
    gpu_request: int = Field(
        default=0,
        ge=0,
        le=8,
        description="NVIDIA GPU数量（受用户配额限制，GPU镜像必须>0）",
        examples=[0, 1, 2, 4]
    )
    ssh_enabled: bool = Field(
        default=False,
        description="通过NodePort启用SSH访问（端口范围30000-32767）"
    )

    @field_validator("name")
    @classmethod
    def validate_k8s_name(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9][a-z0-9\-]*[a-z0-9]$|^[a-z0-9]$", v):
            raise ValueError("Name must be lowercase alphanumeric with hyphens, cannot start/end with hyphen")
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "name": "python-dev",
                    "image_id": 2,
                    "cpu_request": 2.0,
                    "memory_request": 4.0,
                    "gpu_request": 0,
                    "ssh_enabled": True
                },
                {
                    "name": "pytorch-training",
                    "image_id": 5,
                    "cpu_request": 8.0,
                    "memory_request": 32.0,
                    "gpu_request": 2,
                    "ssh_enabled": True
                }
            ]
        }
    }


class ContainerResponse(BaseModel):
    """容器基本信息响应"""

    id: int = Field(..., description="容器ID")
    name: str = Field(..., description="容器名称")
    image_name: Optional[str] = Field(None, description="镜像显示名称")
    image_registry_url: Optional[str] = Field(None, description="镜像Registry URL")
    status: str = Field(..., description="容器状态（creating/running/stopped/failed/deleted）")
    cpu_request: float = Field(..., description="CPU核心数")
    memory_request: float = Field(..., description="内存（GB）")
    gpu_request: int = Field(..., description="GPU数量")
    ssh_enabled: bool = Field(..., description="是否启用SSH访问")
    ssh_node_port: Optional[int] = Field(None, description="SSH NodePort端口号（30000-32767）")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    model_config = {"from_attributes": True}


class ContainerDetailResponse(ContainerResponse):
    """容器详细信息响应（包含Kubernetes和访问信息）"""

    k8s_namespace: Optional[str] = Field(None, description="Kubernetes命名空间")
    k8s_pod_name: Optional[str] = Field(None, description="Kubernetes Pod名称")
    k8s_service_name: Optional[str] = Field(None, description="Kubernetes Service名称（如果有）")
    k8s_status: Optional[str] = Field(None, description="Kubernetes Pod状态（Pending/Running/Failed/Unknown）")
    ssh_command: Optional[str] = Field(None, description="SSH访问命令（如果启用SSH）")
    user_id: int = Field(..., description="所属用户ID")
    root_password: Optional[str] = Field(None, description="root用户密码")
    user_password: Optional[str] = Field(None, description="普通用户密码")
    ssh_user: Optional[str] = Field(None, description="SSH登录用户名")


class ExecCommandRequest(BaseModel):
    """在容器中执行命令的请求"""
    command: str = Field(..., min_length=1, description="要执行的命令")
    timeout: int = Field(default=30, ge=1, le=300, description="命令执行超时时间（秒）")
    working_dir: Optional[str] = Field(default=None, description="工作目录（可选）")


class ExecCommandResponse(BaseModel):
    """命令执行结果"""
    success: bool = Field(..., description="命令是否执行成功")
    output: str = Field(..., description="命令输出（stdout）")
    error: Optional[str] = Field(default=None, description="错误输出（stderr）")
    exit_code: int = Field(..., description="退出码")
    message: Optional[str] = Field(default=None, description="附加消息")
