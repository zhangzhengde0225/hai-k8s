# 认证

HAI-K8S API使用JWT (JSON Web Token) Bearer认证。所有API端点（除`/api/auth/*`外）都需要有效的token。

## 认证方式

HAI-K8S支持两种认证方式：

1. **本地认证** - 使用用户名和密码
2. **SSO认证** - 通过统一认证平台（UMT）

## 本地认证

### 登录端点

```
POST /api/auth/login/local
```

### 请求体

```json
{
  "username": "your_username",
  "password": "your_password"
}
```

### 响应

**成功 (200):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer"
}
```

**失败 (401):**
```json
{
  "detail": "Incorrect username or password"
}
```

### curl示例

```bash
curl -X POST http://localhost:42900/api/auth/login/local \
     -H "Content-Type: application/json" \
     -d '{
       "username": "zhangsan",
       "password": "my_secure_password"
     }'
```

### Python示例

```python
import requests

response = requests.post(
    "http://localhost:42900/api/auth/login/local",
    json={
        "username": "zhangsan",
        "password": "my_secure_password"
    }
)

if response.status_code == 200:
    token = response.json()["access_token"]
    print(f"Token: {token}")
else:
    print(f"Login failed: {response.json()['detail']}")
```

## SSO认证

### OAuth2流程

SSO认证使用OAuth2授权码流程，通过IHEP统一认证平台（UMT）。

### 步骤1：获取授权URL

```
GET /api/auth/login/sso
```

**响应：**
```json
{
  "auth_url": "https://login.ihep.ac.cn/oauth2/authorize?client_id=...&redirect_uri=...&state=..."
}
```

### 步骤2：用户授权

在浏览器中打开`auth_url`，用户在UMT平台登录并授权。

### 步骤3：回调处理

授权后，UMT会重定向到：
```
/api/auth/umt/callback?code=...&state=...
```

后端自动处理回调，交换token并创建/更新用户。

### 步骤4：接收Token

回调成功后，前端会收到token（通过query参数或重定向）。

### 浏览器流程示例

```html
<!-- 前端代码 -->
<script>
async function loginWithSSO() {
  // 获取授权URL
  const response = await fetch('http://localhost:42900/api/auth/login/sso');
  const data = await response.json();

  // 跳转到UMT登录
  window.location.href = data.auth_url;
}

// 回调页面处理
function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    localStorage.setItem('access_token', token);
    console.log('Login successful!');
  }
}
</script>
```

## 使用Token

### HTTP Header格式

所有需要认证的请求都必须在Header中包含token：

```
Authorization: Bearer <your-jwt-token>
```

### curl示例

```bash
curl -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJh..." \
     http://localhost:42900/api/containers
```

### Python示例

```python
import requests

token = "eyJ0eXAiOiJKV1QiLCJh..."
headers = {"Authorization": f"Bearer {token}"}

# 使用token调用API
response = requests.get(
    "http://localhost:42900/api/containers",
    headers=headers
)
containers = response.json()
```

### JavaScript (fetch) 示例

```javascript
const token = localStorage.getItem('access_token');

fetch('http://localhost:42900/api/containers', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
  .then(response => response.json())
  .then(data => console.log(data));
```

## Token生命周期

### 有效期

- 默认有效期：**24小时**
- Token过期后需要重新登录

### 刷新Token

目前HAI-K8S不支持token刷新，过期后需要重新认证。

### Token失效

- 用户密码修改后，旧token立即失效
- 管理员禁用用户后，该用户所有token失效

## 错误处理

### 401 Unauthorized

```json
{
  "detail": "Could not validate credentials"
}
```

**原因：**
- Token缺失或格式错误
- Token已过期
- Token签名无效

**解决：**
重新登录获取新token。

### 403 Forbidden

```json
{
  "detail": "Not enough permissions"
}
```

**原因：**
- 用户没有访问该资源的权限
- 管理员操作但用户不是管理员

**解决：**
联系管理员获取相应权限。

## 安全最佳实践

### 1. Token存储

**浏览器环境：**
- 使用`localStorage`或`sessionStorage`
- 避免存储在cookies（防止CSRF）

**移动/桌面应用：**
- 使用安全的密钥存储（Keychain/KeyStore）

**脚本/CLI工具：**
- 存储在配置文件，设置600权限
- 使用环境变量

### 2. Token传输

- **始终使用HTTPS**（生产环境）
- 避免在URL中传递token
- 不要在日志中打印完整token

### 3. Token轮换

- 定期重新登录获取新token
- 长期运行的脚本应实现自动重新认证

## Python认证助手类

```python
import requests
import time
from typing import Optional

class HAIKubernetesAuth:
    def __init__(self, base_url: str = "http://localhost:42900"):
        self.base_url = base_url
        self.token: Optional[str] = None
        self.token_expires_at: Optional[float] = None

    def login_local(self, username: str, password: str) -> bool:
        """本地认证登录"""
        response = requests.post(
            f"{self.base_url}/api/auth/login/local",
            json={"username": username, "password": password}
        )
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            # JWT默认24小时过期
            self.token_expires_at = time.time() + 24 * 3600
            return True
        return False

    def get_headers(self) -> dict:
        """获取包含认证token的headers"""
        if not self.token:
            raise ValueError("Not authenticated. Call login_local() first.")
        if self.token_expires_at and time.time() > self.token_expires_at:
            raise ValueError("Token expired. Please re-authenticate.")
        return {"Authorization": f"Bearer {self.token}"}

    def request(self, method: str, endpoint: str, **kwargs):
        """发送认证请求"""
        url = f"{self.base_url}{endpoint}"
        headers = kwargs.pop("headers", {})
        headers.update(self.get_headers())
        return requests.request(method, url, headers=headers, **kwargs)

# 使用示例
auth = HAIKubernetesAuth()
auth.login_local("zhangsan", "password123")

# 获取容器列表
response = auth.request("GET", "/api/containers")
print(response.json())
```

## 下一步

- **[容器管理](containers)**: 创建和管理容器
- **[应用服务](applications)**: 启动OpenClaw等应用
- **[用户配额](users)**: 查看资源配额和使用情况
