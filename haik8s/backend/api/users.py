"""
User API endpoints
"""
from fastapi import APIRouter, Depends
from sqlmodel import Session

from db.database import get_session
from db.models import User
from db.crud import get_user_resource_usage
from auth.dependencies import get_current_user
from schemas.user import UserResponse


router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Get current user info with resource usage"""
    usage = get_user_resource_usage(session, current_user.id)
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.value,
        auth_provider=current_user.auth_provider.value if current_user.auth_provider else None,
        is_active=current_user.is_active,
        cpu_quota=current_user.cpu_quota,
        memory_quota=current_user.memory_quota,
        gpu_quota=current_user.gpu_quota,
        cpu_used=usage["cpu_used"],
        memory_used=usage["memory_used"],
        gpu_used=usage["gpu_used"],
        created_at=current_user.created_at,
        last_login_at=current_user.last_login_at,
        cluster_username=current_user.cluster_username,
        cluster_uid=current_user.cluster_uid,
        cluster_gid=current_user.cluster_gid,
        cluster_home_dir=current_user.cluster_home_dir,
    )


@router.get("/key")
async def get_user_key(current_user: User = Depends(get_current_user)):
    """返回当前用户的 HepAI API Key（full_key 用于脚本注入，masked_key 用于展示）"""
    key = current_user.api_key_of_hepai
    if not key:
        return {"masked_key": None, "full_key": None}
    if len(key) <= 8:
        masked = "*" * len(key)
    else:
        masked = key[:4] + "****" + key[-4:]
    return {"masked_key": masked, "full_key": key}

