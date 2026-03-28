"""
User API endpoints
"""
import pwd as _pwd

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from db.database import get_session
from db.models import User
from db.crud import get_user_resource_usage, update_cluster_info, update_hepai_api_key
from config import Config
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


@router.post("/me/sync-cluster-info", response_model=UserResponse)
async def sync_cluster_info(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """手动同步当前用户的集群账号、UID、GID 和家目录"""
    email = current_user.email
    cluster_username: str | None = None
    cluster_uid: int | None = None
    cluster_gid: int | None = None
    cluster_home_dir: str | None = None

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://newlogin.ihep.ac.cn/api/searchUserInfo",
                params={"username": email},
                timeout=5.0,
            )
            if resp.status_code == 200:
                body = resp.json()
                if body.get("code") == 1:
                    data = body["data"]
                    cluster_username = data.get("sn") or None
                    if cluster_username:
                        cluster_home_dir = f"/aifs/user/home/{cluster_username}"
                        try:
                            pw = _pwd.getpwnam(cluster_username)
                            cluster_uid = pw.pw_uid
                            cluster_gid = pw.pw_gid
                        except KeyError:
                            uid = data.get("uid")
                            if uid:
                                cluster_uid = int(uid)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch cluster info: {exc}",
        )

    if not cluster_username:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Could not retrieve cluster account from SSO service",
        )

    update_cluster_info(
        session, current_user.id,
        cluster_username=cluster_username,
        cluster_uid=cluster_uid,
        cluster_gid=cluster_gid,
        cluster_home_dir=cluster_home_dir,
    )
    session.refresh(current_user)

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


@router.post("/me/sync-hepai-key")
async def sync_hepai_key(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """从 HepAI 平台手动同步当前用户的 API Key"""
    if not Config.HEPAI_SUBAPP_ADMIN_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="HepAI API key sync is not configured",
        )

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://aiapi.ihep.ac.cn/apiv2/key/fetch_api_key",
                json={"username": current_user.email},
                headers={
                    "Authorization": f"Bearer {Config.HEPAI_SUBAPP_ADMIN_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=10.0,
            )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to fetch API key from HepAI platform",
                )
            data = resp.json()
            api_key = data.get("api_key")
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to connect to HepAI platform: {exc}",
        )

    if api_key:
        update_hepai_api_key(session, current_user.id, api_key)
        session.refresh(current_user)

    key = current_user.api_key_of_hepai
    if not key:
        return {"masked_key": None, "full_key": None}
    if len(key) <= 8:
        masked = "*" * len(key)
    else:
        masked = key[:4] + "****" + key[-4:]
    return {"masked_key": masked, "full_key": key}

