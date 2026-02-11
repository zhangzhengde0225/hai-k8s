"""
Configuration for HAI-K8S backend
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file
load_dotenv(Path(__file__).parent / ".env")

HERE = Path(__file__).parent
REPO_ROOT = HERE.parent.parent


class Config:
    # Paths
    KUBECONFIG_PATH: str = os.getenv("KUBECONFIG_PATH", str(REPO_ROOT / ".kube" / "config"))
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{HERE / 'db' / 'haik8s.db'}")

    # JWT
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 days

    # Default Admin User
    DEFAULT_ADMIN_USERNAME: str = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
    DEFAULT_ADMIN_PASSWORD: str = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123")
    DEFAULT_ADMIN_EMAIL: str = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@haik8s.local")

    # IHEP SSO
    IHEP_SSO_CLIENT_ID: str = os.getenv("IHEP_SSO_CLIENT_ID", "")
    IHEP_SSO_CLIENT_SECRET: str = os.getenv("IHEP_SSO_CLIENT_SECRET", "")
    IHEP_SSO_AUTHORIZE_URL: str = os.getenv("IHEP_SSO_AUTHORIZE_URL", "https://login.ihep.ac.cn/oauth2/authorize")
    IHEP_SSO_TOKEN_URL: str = os.getenv("IHEP_SSO_TOKEN_URL", "https://login.ihep.ac.cn/oauth2/token")
    IHEP_SSO_CALLBACK_URL: str = os.getenv("IHEP_SSO_CALLBACK_URL", "http://localhost:42900/api/auth/umt/callback")
    FRONTEND_CALLBACK_URL: str = os.getenv("FRONTEND_CALLBACK_URL", "http://localhost:42901/auth/callback")

    # K8s
    K8S_NAMESPACE_PREFIX: str = "haik8s-"
    NODEPORT_RANGE_START: int = 30000
    NODEPORT_RANGE_END: int = 32767

    # CORS
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else [
        "http://localhost:42901",
        "http://127.0.0.1:42901",
        "https://k8s-ai.ihep.ac.cn",
    ]
