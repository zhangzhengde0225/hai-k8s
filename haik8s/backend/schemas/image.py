"""
Image request/response schemas
"""
from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class CreateImageRequest(BaseModel):
    """创建镜像请求"""

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="镜像显示名称",
        examples=["Ubuntu 22.04 Dev", "PyTorch 2.0 GPU", "OpenClaw v1.0"]
    )
    registry_url: str = Field(
        ...,
        min_length=1,
        description="镜像Registry URL（包含tag）",
        examples=["registry.example.com/ubuntu:22.04", "harbor.ihep.ac.cn/pytorch:2.0-cuda11.8"]
    )
    description: Optional[str] = Field(
        None,
        description="镜像描述信息",
        examples=["Ubuntu 22.04 development environment", "PyTorch with CUDA 11.8 support"]
    )
    default_cmd: Optional[str] = Field(
        default="/bin/bash",
        description="容器默认启动命令",
        examples=["/bin/bash", "/usr/bin/supervisord", "python /app/main.py"]
    )
    gpu_required: bool = Field(
        default=False,
        description="是否需要GPU（如果true，创建容器时必须分配GPU）"
    )

    # Enhanced metadata fields
    version: Optional[str] = Field(None, description="镜像版本号", examples=["1.0.0", "2.0-cuda11.8"])
    tags: Optional[List[str]] = Field(None, description="标签列表（用于分类和搜索）", examples=[["openclaw", "ai"], ["gpu", "pytorch"]])
    env_vars: Optional[Dict[str, str]] = Field(None, description="预设环境变量", examples=[{"CUDA_VISIBLE_DEVICES": "0,1"}])
    ports: Optional[List[int]] = Field(None, description="暴露的端口列表", examples=[[8080, 8443], [22, 80]])
    recommended_resources: Optional[Dict[str, float]] = Field(
        None,
        description="推荐的资源配置",
        examples=[{"cpu": 2.0, "memory": 4.0, "gpu": 0}, {"cpu": 8.0, "memory": 32.0, "gpu": 2}]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "name": "PyTorch GPU",
                    "registry_url": "harbor.ihep.ac.cn/pytorch:2.0-cuda11.8",
                    "description": "PyTorch 2.0 with CUDA 11.8",
                    "gpu_required": True,
                    "version": "2.0",
                    "tags": ["gpu", "pytorch", "cuda"],
                    "recommended_resources": {"cpu": 8.0, "memory": 32.0, "gpu": 1}
                }
            ]
        }
    }


class ImageUpdateRequest(BaseModel):
    """Update image request (all fields optional)"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    registry_url: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    default_cmd: Optional[str] = None
    gpu_required: Optional[bool] = None
    version: Optional[str] = None
    tags: Optional[List[str]] = None
    env_vars: Optional[Dict[str, str]] = None
    ports: Optional[List[int]] = None
    recommended_resources: Optional[Dict[str, float]] = None


class ImageResponse(BaseModel):
    """镜像信息响应"""

    id: int = Field(..., description="镜像ID")
    name: str = Field(..., description="镜像显示名称")
    registry_url: str = Field(..., description="镜像Registry URL")
    description: Optional[str] = Field(None, description="镜像描述")
    default_cmd: Optional[str] = Field(None, description="默认启动命令")
    gpu_required: bool = Field(..., description="是否需要GPU")
    is_active: bool = Field(..., description="镜像是否可用")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    # Enhanced metadata fields (returned as frontend-friendly format)
    version: Optional[str] = Field(None, description="镜像版本号")
    tags: Optional[List[str]] = Field(None, description="标签列表（从JSON解析）")
    env_vars: Optional[Dict[str, str]] = Field(None, description="环境变量（从JSON解析）")
    ports: Optional[List[int]] = Field(None, description="暴露端口（从JSON解析）")
    recommended_resources: Optional[Dict[str, float]] = Field(None, description="推荐资源配置（从JSON解析）")

    model_config = {"from_attributes": True}
