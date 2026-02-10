"""
JWT token management for HAI-K8S

Ported from BubbleTracker_V3
Author: Zhengde ZHANG
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from db.models import User, UserRole


# JWT configuration (set from config at startup)
JWT_SECRET_KEY = ""
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 10080  # 7 days


def set_jwt_config(secret_key: str, algorithm: str = "HS256", expire_minutes: int = 10080):
    """Set JWT configuration"""
    global JWT_SECRET_KEY, JWT_ALGORITHM, JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    JWT_SECRET_KEY = secret_key
    JWT_ALGORITHM = algorithm
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES = expire_minutes


def create_access_token(user: User, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": str(user.id),
        "username": user.username,
        "email": user.email,
        "role": user.role.value if isinstance(user.role, UserRole) else user.role,
        "exp": expire,
        "iat": datetime.utcnow(),
    }

    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate JWT token. Raises JWTError on failure."""
    return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
