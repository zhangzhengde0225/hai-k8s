"""
FastAPI authentication dependencies for HAI-K8S

Ported from BubbleTracker_V3
Author: Zhengde ZHANG
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session
from jose import JWTError

from db.database import get_session
from db.models import User, UserRole
from db.crud import get_user_by_id
from auth.security import decode_access_token


security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session),
) -> User:
    """Get current user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = get_user_by_id(session, int(user_id))
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    return user


def require_role(*allowed_roles: UserRole):
    """Dependency to require specific roles"""
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User role '{current_user.role}' not authorized. Required: {[r.value for r in allowed_roles]}",
            )
        return current_user
    return role_checker


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    session: Session = Depends(get_session),
) -> Optional[User]:
    """Get current user if token provided, else None"""
    if not credentials:
        return None
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        user = get_user_by_id(session, int(user_id))
        return user if user and user.is_active else None
    except JWTError:
        return None
