"""
HAI-K8S Backend - FastAPI Application

Author: Zhengde ZHANG
"""
import sys
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from kubernetes.client.rest import ApiException

# Ensure the backend directory is on the path
sys.path.insert(0, str(Path(__file__).parent))

from config import Config
from db.database import init_db
from auth.security import set_jwt_config
from k8s.client import init_k8s_client

# Import routers
from auth.sso_router import router as sso_router
from auth.local_router import router as local_router
from api.containers import router as containers_router
from api.terminal import router as terminal_router
from api.users import router as users_router
from api.images import router as images_router
from api.admin import router as admin_router
from api.applications import router as applications_router
from api.ip_allocations import router as ip_allocations_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    set_jwt_config(
        secret_key=Config.JWT_SECRET_KEY,
        algorithm=Config.JWT_ALGORITHM,
        expire_minutes=Config.JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
    )
    init_k8s_client(Config.KUBECONFIG_PATH)
    yield
    # Shutdown (nothing to clean up)


app = FastAPI(
    title="HAI-K8S",
    description="Kubernetes container open platform for IHEP AI",
    version="0.0.1",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(sso_router)
app.include_router(local_router)
app.include_router(containers_router)
app.include_router(terminal_router)
app.include_router(users_router)
app.include_router(images_router)
app.include_router(admin_router)
app.include_router(applications_router)
app.include_router(ip_allocations_router)


# Legacy callback redirect for backward compatibility
@app.get("/umt/callback")
async def legacy_umt_callback(request: Request):
    """Redirect /umt/callback to /api/auth/umt/callback with all query parameters"""
    query_string = str(request.url.query)
    redirect_url = f"/api/auth/umt/callback?{query_string}" if query_string else "/api/auth/umt/callback"
    return RedirectResponse(url=redirect_url)


# Exception handlers
@app.exception_handler(ApiException)
async def k8s_exception_handler(request: Request, exc: ApiException):
    return JSONResponse(
        status_code=exc.status or 500,
        content={"detail": f"Kubernetes API error: {exc.reason}"},
    )

@app.get("/api/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=42900)




