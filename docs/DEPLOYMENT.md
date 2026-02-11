# HAI-K8S 环境配置说明

## 前后端地址配置

### 开发环境
- **前端**: http://localhost:42901
- **后端**: http://localhost:42900
- **API 代理**: 前端 `/api` 请求通过 Vite proxy 自动转发到 `http://localhost:42900`

### 生产环境
- **域名**: https://k8s-ai.ihep.ac.cn
- **前端**: https://k8s-ai.ihep.ac.cn
- **后端 API**: https://k8s-ai.ihep.ac.cn/api

## 登录方式

HAI-K8S 支持两种登录方式：

### 1. 本地账号登录
- 使用用户名和密码登录
- 默认管理员账号：
  - **用户名**: `admin`
  - **密码**: `admin123`
  - ⚠️ 首次登录后请立即修改默认密码！

### 2. IHEP SSO 统一认证登录
- 使用高能所统一认证系统登录
- 需要配置 SSO Client ID 和 Secret

详细说明请参考 [本地登录功能文档](docs/LOCAL_AUTH.md)

## 快速启动

### 安装依赖

后端：
```bash
cd haik8s/backend
pip install -r requirements.txt
```

前端：
```bash
cd haik8s/frontend
npm install
```

### 启动后端
```bash
./start_backend.sh
```

首次启动时会自动创建数据库和默认管理员账号。

### 启动前端
```bash
./start_frontend.sh
```

## 前端环境变量配置

前端配置文件位于 `haik8s/frontend/`：

- `.env.development` - 开发环境配置
- `.env.production` - 生产环境配置
- `.env.example` - 配置示例

### 自定义 API 地址

如需自定义后端 API 地址，创建 `.env.local` 文件：

```bash
# 开发环境使用自定义后端
VITE_API_BASE=http://your-custom-backend:8080/api
```

## 后端环境变量配置

后端配置文件位于 `haik8s/backend/`：

- `.env` - 当前环境配置
- `.env.example` - 配置示例

### 主要配置项

```bash
# JWT 密钥（生产环境必须修改）
JWT_SECRET_KEY=change-me-in-production

# IHEP SSO 配置
IHEP_SSO_CLIENT_ID=your-client-id
IHEP_SSO_CLIENT_SECRET=your-client-secret

# 回调地址配置
# 开发环境
IHEP_SSO_CALLBACK_URL=http://localhost:42900/api/auth/umt/callback
FRONTEND_CALLBACK_URL=http://localhost:42901/auth/callback

# 生产环境（取消注释并修改）
# IHEP_SSO_CALLBACK_URL=https://k8s-ai.ihep.ac.cn/api/auth/umt/callback
# FRONTEND_CALLBACK_URL=https://k8s-ai.ihep.ac.cn/auth/callback

# CORS 跨域配置（可选，留空使用默认值）
# CORS_ORIGINS=http://localhost:42901,https://k8s-ai.ihep.ac.cn
```

## 生产环境部署

### 1. 构建前端

```bash
cd haik8s/frontend
npm run build
```

构建产物位于 `dist/` 目录，使用 Nginx 等 Web 服务器部署。

### 2. 配置 Nginx

```nginx
server {
    listen 443 ssl;
    server_name k8s-ai.ihep.ac.cn;

    # SSL 证书配置
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # 前端静态文件
    location / {
        root /path/to/haik8s/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://localhost:42900;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. 配置后端环境变量

修改 `haik8s/backend/.env`：

```bash
# 生产环境回调地址
IHEP_SSO_CALLBACK_URL=https://k8s-ai.ihep.ac.cn/api/auth/umt/callback
FRONTEND_CALLBACK_URL=https://k8s-ai.ihep.ac.cn/auth/callback

# JWT 密钥（必须修改为强密码）
JWT_SECRET_KEY=your-strong-secret-key-here
```

### 4. 启动后端服务

```bash
cd haik8s/backend
python main.py
```

或使用 systemd 服务管理。

## 端口说明

- **42900**: 后端 API 服务端口
- **42901**: 前端开发服务器端口

## 注意事项

1. **JWT 密钥**: 生产环境必须修改 `JWT_SECRET_KEY`
2. **SSO 配置**: 需要在 IHEP SSO 系统中注册应用并获取 Client ID 和 Secret
3. **回调地址**: SSO 回调地址必须与实际部署地址一致
4. **CORS 配置**: 确保后端 CORS 配置包含前端域名
