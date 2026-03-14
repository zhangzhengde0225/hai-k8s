"""
HAI-K8S Backend - FastAPI Application

Author: Zhengde ZHANG
"""
import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.openapi.utils import get_openapi
from kubernetes.client.rest import ApiException

# Ensure the backend directory is on the path
sys.path.insert(0, str(Path(__file__).parent))

from config import Config
from db.database import init_db
from auth.security import set_jwt_config
from k8s_service.client import init_k8s_client

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
from api.documentation import router as docs_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
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
    title="HAI-K8S API",
    description="""
# Kubernetes容器管理平台API

HAI-K8S为认证用户提供容器生命周期管理、应用服务和集群资源的程序化访问。

## 认证

所有API端点（除 `/api/auth/*`）都需要JWT bearer token认证：

```
Authorization: Bearer <your-jwt-token>
```

获取token的方式：
- **本地认证**: POST `/api/auth/login/local` 使用用户名/密码
- **SSO认证**: GET `/api/auth/login/sso` (OAuth2流程)

## Base URL

- 开发环境: `http://localhost:42900`
- 生产环境: `https://k8s-ai.ihep.ac.cn`

## 版本历史

- v0.0.6 (2026-03-11): 应用服务、OpenClaw集成
- v0.0.5: IP分配管理
- v0.0.4: 管理员Pod管理
    """,
    version="0.0.6",
    contact={
        "name": "HAI-K8S Support",
        "email": "zdzhang@ihep.ac.cn",
    },
    license_info={
        "name": "Copyright © 2026 IHEP",
    },
    openapi_tags=[
        {
            "name": "Authentication",
            "description": "本地和SSO登录端点。返回API访问的JWT token。",
        },
        {
            "name": "Containers",
            "description": "容器生命周期管理：创建、启动、停止、删除。访问日志和交互式终端。",
        },
        {
            "name": "Applications",
            "description": "应用服务管理（OpenClaw等）。配置和启动多实例应用。",
        },
        {
            "name": "Images",
            "description": "容器镜像注册表管理。管理员可添加/删除可用镜像。",
        },
        {
            "name": "IP Allocations",
            "description": "MacVLAN IP地址分配，用于需要外部网络访问的容器。",
        },
        {
            "name": "Users",
            "description": "用户配置文件和资源配额信息。",
        },
        {
            "name": "Admin",
            "description": "管理端点：用户管理、集群监控、全局Pod操作。需要管理员角色。",
        },
        {
            "name": "Terminal",
            "description": "基于WebSocket的运行容器交互式终端访问。",
        },
    ],
    swagger_ui_parameters={
        "defaultModelsExpandDepth": -1,  # 默认隐藏schemas
        "docExpansion": "list",  # 只展开tags，不展开operations
        "filter": True,  # 启用搜索
        "persistAuthorization": True,  # 记住认证token
    },
    servers=[
        {"url": "http://localhost:42900", "description": "开发环境"},
        {"url": "https://k8s-ai.ihep.ac.cn", "description": "生产环境"},
    ],
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
app.include_router(docs_router)


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


def custom_openapi():
    """自定义OpenAPI schema，添加安全配置"""
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )

    # 添加安全schemes
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "从 /api/auth/login/local 或 /api/auth/login/sso 获取的JWT token"
        }
    }

    # 全局应用安全（除auth端点外）
    for path, path_item in openapi_schema["paths"].items():
        if not path.startswith("/api/auth/login"):
            for operation in path_item.values():
                if isinstance(operation, dict) and "operationId" in operation:
                    operation["security"] = [{"BearerAuth": []}]

    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=42900)




