"""
Image request/response schemas
"""
from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class CreateImageRequest(BaseModel):
    """Create image request"""
    name: str = Field(..., min_length=1, max_length=100)
    registry_url: str = Field(..., min_length=1)
    description: Optional[str] = None
    default_cmd: Optional[str] = "/bin/bash"
    gpu_required: bool = False

    # Enhanced metadata fields
    version: Optional[str] = None
    tags: Optional[List[str]] = None  # Frontend sends array, backend converts to JSON
    env_vars: Optional[Dict[str, str]] = None  # Frontend sends object, backend converts to JSON
    ports: Optional[List[int]] = None  # Frontend sends array, backend converts to JSON
    recommended_resources: Optional[Dict[str, float]] = None  # {"cpu": 2.0, "memory": 4.0, "gpu": 0}


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
    """Image response"""
    id: int
    name: str
    registry_url: str
    description: Optional[str] = None
    default_cmd: Optional[str] = None
    gpu_required: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    # Enhanced metadata fields (returned as frontend-friendly format)
    version: Optional[str] = None
    tags: Optional[List[str]] = None  # Parsed from JSON string to array
    env_vars: Optional[Dict[str, str]] = None  # Parsed from JSON string to object
    ports: Optional[List[int]] = None  # Parsed from JSON string to array
    recommended_resources: Optional[Dict[str, float]] = None  # Parsed from JSON string to object

    model_config = {"from_attributes": True}
