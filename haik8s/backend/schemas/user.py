"""
User request/response schemas
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    cpu_quota: float
    memory_quota: float
    gpu_quota: int
    cpu_used: float = 0
    memory_used: float = 0
    gpu_used: int = 0
    created_at: datetime
    last_login_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    cpu_quota: Optional[float] = None
    memory_quota: Optional[float] = None
    gpu_quota: Optional[int] = None
