"""
IHEP SSO router for HAI-K8S

Ported from BubbleTracker_V3
Author: Zhengde ZHANG
"""
import secrets
from datetime import timedelta
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlmodel import Session
import httpx

from config import Config
from db.database import get_session
from db.crud import get_user_by_sso_id, create_sso_user, update_last_login
from auth.security import create_access_token


router = APIRouter(prefix="/api/auth")

# In-memory CSRF state storage
sso_states: dict[str, bool] = {}


@router.get("/login/sso")
async def sso_login():
    """Initiate IHEP SSO login — redirects user to IHEP authorization page"""
    if not Config.IHEP_SSO_CLIENT_ID or not Config.IHEP_SSO_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="IHEP SSO is not configured. Please set IHEP_SSO_CLIENT_ID and IHEP_SSO_CLIENT_SECRET.",
        )

    state = secrets.token_urlsafe(32)
    sso_states[state] = True

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
        if state not in sso_states:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid state parameter",
            )
        del sso_states[state]

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

    # Create or update user
    user = get_user_by_sso_id(session, sso_id)
    if not user:
        user = create_sso_user(
            session=session,
            sso_id=sso_id,
            username=username,
            email=email,
            full_name=full_name,
        )
    else:
        update_last_login(session, user.id)

    # Generate JWT and redirect to frontend
    jwt_token = create_access_token(
        user,
        expires_delta=timedelta(minutes=Config.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    frontend_callback_url = f"{Config.FRONTEND_CALLBACK_URL}?token={jwt_token}"
    return RedirectResponse(url=frontend_callback_url)
