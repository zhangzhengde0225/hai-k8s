"""
JWT token management and password hashing for HAI-K8S

Ported from BubbleTracker_V3
Author: Zhengde ZHANG
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import hashlib
from jose import JWTError, jwt
from passlib.context import CryptContext
from db.models import User, UserRole


# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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


def hash_password(password: str) -> str:
    """
    Hash a password using SHA256+bcrypt.

    SHA256 is used first to avoid bcrypt's 72-byte limit while maintaining
    security for long passwords.
    """
    # SHA256 produces a fixed 64-character hex string (32 bytes), well under bcrypt's 72-byte limit
    password_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()
    return pwd_context.hash(password_hash)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.

    Uses SHA256+bcrypt matching the hash_password function.
    """
    # Apply SHA256 first to match what was hashed
    password_hash = hashlib.sha256(plain_password.encode('utf-8')).hexdigest()
    return pwd_context.verify(password_hash, hashed_password)


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
