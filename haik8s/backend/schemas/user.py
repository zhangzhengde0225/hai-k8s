"""
User request/response schemas
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class UserResponse(BaseModel):
    """用户信息响应"""

    id: int = Field(..., description="用户ID")
    username: str = Field(..., description="用户名")
    email: str = Field(..., description="邮箱地址")
    full_name: Optional[str] = Field(None, description="全名")
    role: str = Field(..., description="用户角色（user/admin）")
    auth_provider: Optional[str] = Field(None, description="认证提供商（local/sso）")
    is_active: bool = Field(..., description="账户是否激活")
    cpu_quota: float = Field(..., description="CPU配额（核心数）")
    memory_quota: float = Field(..., description="内存配额（GB）")
    gpu_quota: int = Field(..., description="GPU配额（数量）")
    cpu_used: float = Field(default=0, description="已使用CPU（核心数）")
    memory_used: float = Field(default=0, description="已使用内存（GB）")
    gpu_used: int = Field(default=0, description="已使用GPU（数量）")
    created_at: datetime = Field(..., description="账户创建时间")
    last_login_at: Optional[datetime] = Field(None, description="最后登录时间")
    # Cluster info
    cluster_username: Optional[str] = Field(None, description="集群用户名（Linux用户名）")
    cluster_uid: Optional[int] = Field(None, description="集群UID")
    cluster_gid: Optional[int] = Field(None, description="集群GID")
    cluster_home_dir: Optional[str] = Field(None, description="集群主目录路径")

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    """管理员更新用户信息的请求（所有字段可选）"""

    role: Optional[str] = Field(None, description="用户角色（user/admin）")
    is_active: Optional[bool] = Field(None, description="账户是否激活")
    cpu_quota: Optional[float] = Field(None, ge=0, le=128.0, description="CPU配额（核心数）")
    memory_quota: Optional[float] = Field(None, ge=0, le=512.0, description="内存配额（GB）")
    gpu_quota: Optional[int] = Field(None, ge=0, le=16, description="GPU配额（数量）")
