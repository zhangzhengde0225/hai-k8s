"""
Image request/response schemas
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class CreateImageRequest(BaseModel):
    name: str
    registry_url: str
    description: Optional[str] = None
    default_cmd: Optional[str] = "/bin/bash"
    gpu_required: bool = False


class ImageResponse(BaseModel):
    id: int
    name: str
    registry_url: str
    description: Optional[str] = None
    default_cmd: Optional[str] = None
    gpu_required: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
