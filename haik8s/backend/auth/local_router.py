"""
Local authentication router for HAI-K8S

Author: Zhengde ZHANG
"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlmodel import Session
from pydantic import BaseModel

from config import Config
from db.database import get_session
from db.crud import get_user_by_username, update_last_login
from auth.security import verify_password, create_access_token


router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    email: str
    role: str


@router.post("/login/local", response_model=LoginResponse)
async def local_login(
    login_data: LoginRequest,
    session: Session = Depends(get_session),
):
    """
    Local username/password authentication

    Returns JWT token on success
    """
    # Find user
    user = get_user_by_username(session, login_data.username)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Check if user uses local authentication
    if user.auth_provider.value != "local":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This user does not use local authentication. Please use SSO login.",
        )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    # Verify password
    if not user.password_hash or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Update last login
    update_last_login(session, user.id)

    # Generate JWT token
    jwt_token = create_access_token(
        user,
        expires_delta=timedelta(minutes=Config.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return LoginResponse(
        access_token=jwt_token,
        username=user.username,
        email=user.email,
        role=user.role.value,
    )
