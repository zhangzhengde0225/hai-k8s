"""
IHEP SSO router for HAI-K8S

Ported from BubbleTracker_V3
Author: Zhengde Zhang (zhangzhengde0225@gmail.com)
"""
import hmac
import hashlib
import time
import base64
import secrets
from datetime import timedelta
from typing import Optional
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlmodel import Session
import httpx

from config import Config
from db.database import get_session
from db.crud import get_user_by_sso_id, create_sso_user, update_last_login, update_cluster_info
from auth.security import create_access_token


router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def _get_state_secret() -> str:
    return Config.SSO_STATE_SECRET or Config.JWT_SECRET_KEY


def _make_state() -> str:
    """生成含时间戳的 HMAC 签名 state token，无需服务端存储"""
    secret = _get_state_secret()
    nonce = secrets.token_urlsafe(16)
    ts = str(int(time.time()))
    payload = f"{nonce}.{ts}"
    sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}.{sig}".encode()).decode().rstrip("=")


def _verify_state(state: str, max_age: int = 600) -> bool:
    """验证 state 签名及有效期（默认10分钟）"""
    secret = _get_state_secret()
    try:
        # 补回 base64 padding
        padding = 4 - len(state) % 4
        decoded = base64.urlsafe_b64decode(state + "=" * (padding % 4)).decode()
        nonce, ts, sig = decoded.rsplit(".", 2)
        payload = f"{nonce}.{ts}"
        expected = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return False
        if int(time.time()) - int(ts) > max_age:
            return False
        return True
    except Exception:
        return False


@router.get("/login/sso")
async def sso_login():
    """Initiate IHEP SSO login — redirects user to IHEP authorization page"""
    if not Config.IHEP_SSO_CLIENT_ID or not Config.IHEP_SSO_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="IHEP SSO is not configured. Please set IHEP_SSO_CLIENT_ID and IHEP_SSO_CLIENT_SECRET.",
        )

    state = _make_state()

    params = {
        "client_id": Config.IHEP_SSO_CLIENT_ID,
        "redirect_uri": Config.IHEP_SSO_CALLBACK_URL,
        "response_type": "code",
        "state": state,
    }
    auth_url = f"{Config.IHEP_SSO_AUTHORIZE_URL}?{urlencode(params)}"
    return RedirectResponse(url=auth_url)


@router.get("/umt/callback")
async def sso_callback(
    code: str = Query(...),
    state: str = Query(None),
    session: Session = Depends(get_session),
):
    """
    IHEP SSO callback — exchanges authorization code for token,
    creates/updates user, and redirects to frontend with JWT.
    """
    # Verify CSRF state if provided
    if state:
        if not _verify_state(state):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid state parameter",
            )

    try:
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                Config.IHEP_SSO_TOKEN_URL,
                data={
                    "client_id": Config.IHEP_SSO_CLIENT_ID,
                    "client_secret": Config.IHEP_SSO_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": Config.IHEP_SSO_CALLBACK_URL,
                    "grant_type": "authorization_code",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            if token_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Failed to exchange authorization code: {token_response.text}",
                )

            token_data = token_response.json()
            access_token = token_data.get("access_token")

            if not access_token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="No access token in SSO response",
                )

            user_info = token_data.get("userInfo", {})
            if isinstance(user_info, str):
                import json
                user_info = json.loads(user_info)
            if not user_info:
                user_info = token_data

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to connect to IHEP SSO: {str(e)}",
        )

    # Extract user data
    sso_id = user_info.get("umtId") or user_info.get("id") or user_info.get("sub")
    username = (
        user_info.get("cstnetId")
        or user_info.get("username")
        or user_info.get("preferred_username")
        or user_info.get("email")
    )
    email = user_info.get("email") or user_info.get("cstnetId")
    full_name = user_info.get("cstnetId")

    if not sso_id or not username or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required fields in SSO response",
        )
    
    # 从数据库中查找
    user = get_user_by_sso_id(session, sso_id)

    # Fetch cluster info (sn/uid/gid/home_dir) — non-critical
    cluster_username = user.cluster_username if user else None
    cluster_uid = user.cluster_uid if user else None
    cluster_gid = user.cluster_gid if user else None
    cluster_home_dir = user.cluster_home_dir if user else None

    if not all([cluster_username, cluster_uid, cluster_gid, cluster_home_dir]):
        try:
            async with httpx.AsyncClient() as info_client:
                info_resp = await info_client.get(
                    "https://newlogin.ihep.ac.cn/api/searchUserInfo",
                    params={"username": email},
                    timeout=5.0,
                )
                if info_resp.status_code == 200:
                    body = info_resp.json()
                    if body.get("code") == 1:
                        data = body["data"]
                        if not cluster_username:
                            cluster_username = data.get("sn") or None
                        if cluster_username and not cluster_home_dir:
                            cluster_home_dir = f"/aifs/user/home/{cluster_username}"
                        if not all([cluster_uid, cluster_gid]) and cluster_username:
                            try:
                                import pwd
                                pw = pwd.getpwnam(cluster_username)
                                cluster_uid = cluster_uid or pw.pw_uid
                                cluster_gid = cluster_gid or pw.pw_gid
                            except KeyError:
                                uid = data.get("uid")
                                if uid and not cluster_uid:
                                    cluster_uid = int(uid)
        except Exception:
            pass  # 非关键步骤，获取失败不影响登录

    # Fetch HepAI API key for new user — non-critical
    api_key_of_hepai = user.api_key_of_hepai if user else None
    if not api_key_of_hepai and not user:
        if Config.HEPAI_SUBAPP_ADMIN_KEY:
            try:
                async with httpx.AsyncClient() as hepai_client:
                    hepai_resp = await hepai_client.post(
                        "https://aiapi.ihep.ac.cn/apiv2/key/fetch_api_key",
                        json={"username": email},
                        headers={
                            "Authorization": f"Bearer {Config.HEPAI_SUBAPP_ADMIN_KEY}",
                            "Content-Type": "application/json",
                        },
                        timeout=10.0,
                    )
                    if hepai_resp.status_code == 200:
                        api_key_of_hepai = hepai_resp.json().get("api_key")
            except Exception:
                pass  # 非关键步骤，获取失败不影响登录

    # Create or update user
    # umtId (sso_id) 用作数据库 user id，如无法转换则交由数据库自增
    umt_user_id: Optional[int] = user.id if user else None
    try:
        umt_user_id = int(sso_id)
    except (ValueError, TypeError):
        pass

    
    if not user:
        user = create_sso_user(
            session=session,
            sso_id=sso_id,
            username=username,
            email=email,
            full_name=full_name,
            cluster_username=cluster_username,
            cluster_uid=cluster_uid,
            cluster_gid=cluster_gid,
            cluster_home_dir=cluster_home_dir,
            api_key_of_hepai=api_key_of_hepai,
            user_id=umt_user_id,
        )
    else:
        update_last_login(session, user.id)
        # 补填尚未设置的集群信息
        if any([
            user.cluster_username is None and cluster_username,
            user.cluster_uid is None and cluster_uid,
        ]):
            update_cluster_info(
                session, user.id,
                cluster_username=cluster_username if user.cluster_username is None else None,
                cluster_uid=cluster_uid if user.cluster_uid is None else None,
                cluster_gid=cluster_gid if user.cluster_gid is None else None,
                cluster_home_dir=cluster_home_dir if user.cluster_home_dir is None else None,
            )

    # Generate JWT and redirect to frontend
    jwt_token = create_access_token(
        user,
        expires_delta=timedelta(minutes=Config.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    frontend_callback_url = f"{Config.FRONTEND_CALLBACK_URL}?token={jwt_token}"
    return RedirectResponse(url=frontend_callback_url)
