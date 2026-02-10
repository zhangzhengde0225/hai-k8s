"""
Container request/response schemas
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator
import re


class CreateContainerRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=63)
    image_id: int
    cpu_request: float = Field(default=1.0, ge=0.1, le=32.0)
    memory_request: float = Field(default=2.0, ge=0.5, le=128.0)  # GB
    gpu_request: int = Field(default=0, ge=0, le=8)
    ssh_enabled: bool = False

    @field_validator("name")
    @classmethod
    def validate_k8s_name(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9][a-z0-9\-]*[a-z0-9]$|^[a-z0-9]$", v):
            raise ValueError("Name must be lowercase alphanumeric with hyphens, cannot start/end with hyphen")
        return v


class ContainerResponse(BaseModel):
    id: int
    name: str
    image_name: Optional[str] = None
    image_registry_url: Optional[str] = None
    status: str
    cpu_request: float
    memory_request: float
    gpu_request: int
    ssh_enabled: bool
    ssh_node_port: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContainerDetailResponse(ContainerResponse):
    k8s_namespace: Optional[str] = None
    k8s_pod_name: Optional[str] = None
    k8s_service_name: Optional[str] = None
    k8s_status: Optional[str] = None  # live status from K8s
    ssh_command: Optional[str] = None
    user_id: int
