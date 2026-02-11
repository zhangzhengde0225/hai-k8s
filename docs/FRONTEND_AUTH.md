# HAI-K8S 前端认证持久化说明

## 功能概述

前端实现了完整的认证持久化功能，用户登录后凭据会保存到浏览器本地存储（localStorage），默认 7 天有效期。在 Token 有效期内，刷新页面不会弹出登录界面。

## 工作原理

### 1. 登录流程

#### 本地登录
1. 用户输入用户名和密码
2. 调用 `/api/auth/login/local` 接口
3. 获取 JWT Token
4. 调用 `/api/users/me` 获取完整用户信息
5. 保存 Token 和用户信息到 localStorage
6. 设置 Zustand 状态 `isAuthenticated=true`
7. 跳转到主页

#### SSO 登录
1. 用户点击"统一认证登录"
2. 跳转到 IHEP SSO 授权页面
3. 用户在 SSO 页面登录
4. 回调到 `/auth/callback?token=...`
5. 解析 Token，获取用户信息
6. 保存 Token 和用户信息到 localStorage
7. 跳转到主页

### 2. 持久化存储

Token 和用户信息存储在 localStorage 中：

```javascript
localStorage.setItem('token', jwt_token);
localStorage.setItem('user', JSON.stringify(user_info));
```

**存储的数据**：
- `token`: JWT 访问令牌
- `user`: 完整的用户信息对象（包括配额、资源使用等）

### 3. 应用初始化

应用启动时（`App.tsx`）：

```typescript
useEffect(() => {
  loadFromStorage();
}, []);
```

`loadFromStorage()` 函数会：
1. 从 localStorage 读取 token 和 user
2. 解码 JWT Token，检查过期时间（`exp` 字段）
3. 如果 Token 有效（未过期）：
   - 设置 `isAuthenticated=true`
   - 恢复用户状态
4. 如果 Token 无效或过期：
   - 清除 localStorage
   - 保持未登录状态

### 4. 路由保护

使用 `ProtectedRoute` 组件保护需要登录的页面：

```typescript
if (!isAuthenticated) {
  return <Navigate to="/login" replace />;
}
```

只有在 `isAuthenticated=true` 时才能访问受保护的路由。

### 5. API 请求认证

所有 API 请求自动附加 Bearer Token（`api/client.ts`）：

```typescript
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### 6. Token 过期处理

当 API 返回 401 未授权错误时：

```typescript
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 清除本地凭据
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // 重定向到登录页
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 7. 退出登录

用户点击退出时：

```typescript
logout: () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  set({ isAuthenticated: false, token: null, user: null });
}
```

## Token 有效期

- **后端设置**: JWT Token 默认有效期为 7 天（10080 分钟）
- **配置位置**: `haik8s/backend/.env` 中的 `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`
- **前端验证**: 每次 `loadFromStorage()` 时检查 Token 的 `exp` 字段

## 安全考虑

### 优点
1. ✅ 用户体验好：刷新页面不需要重新登录
2. ✅ Token 有过期时间，自动失效
3. ✅ 前端验证 Token 过期时间，避免使用过期 Token
4. ✅ 后端返回 401 时自动清除凭据

### 注意事项
1. ⚠️ localStorage 可被同域名的 JavaScript 访问（XSS 风险）
2. ⚠️ Token 泄露可能导致账户被冒用（在有效期内）
3. ⚠️ 建议使用 HTTPS 保护传输安全
4. ⚠️ 生产环境应设置合理的 Token 有效期

### 最佳实践
- 使用 HTTPS（生产环境必须）
- 定期审计安全日志
- 实施 CORS 策略
- 考虑实现 Token 刷新机制（长期改进）
- 监控异常登录行为

## 测试验证

### 测试步骤
1. **登录测试**
   - 使用管理员账号登录
   - 检查浏览器 DevTools > Application > Local Storage
   - 确认 `token` 和 `user` 已保存

2. **持久化测试**
   - 登录后刷新页面（F5）
   - 确认不会跳转到登录页
   - 确认用户状态保持

3. **过期测试**
   - 修改 localStorage 中的 token（添加过期的 exp）
   - 刷新页面
   - 确认自动清除并跳转到登录页

4. **401 测试**
   - 登录后，在后端删除用户或修改 JWT 密钥
   - 发起任何 API 请求
   - 确认自动清除凭据并跳转到登录页

5. **退出测试**
   - 登录后点击退出
   - 确认 localStorage 被清除
   - 确认跳转到登录页

## 故障排查

### 问题：刷新后仍然跳转到登录页

**可能原因**：
1. Token 已过期
2. localStorage 中没有 token
3. Token 格式错误

**解决方法**：
```javascript
// 打开浏览器控制台
console.log(localStorage.getItem('token'));
console.log(localStorage.getItem('user'));

// 手动解码 Token 检查过期时间
const token = localStorage.getItem('token');
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  console.log('Token expires at:', new Date(payload.exp * 1000));
  console.log('Current time:', new Date());
}
```

### 问题：API 请求返回 401

**可能原因**：
1. Token 在后端已失效
2. 后端 JWT 密钥更改
3. 用户被停用

**解决方法**：
- 清除浏览器数据重新登录
- 检查后端日志
- 确认用户状态

## 配置项

### 后端配置

`haik8s/backend/.env`:
```bash
# JWT Token 有效期（分钟）
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=10080  # 7天

# JWT 密钥（必须修改）
JWT_SECRET_KEY=your-strong-secret-key
```

### 前端配置

不需要额外配置，Token 有效期由后端控制。

## 未来改进

- [ ] 实现 Refresh Token 机制（长期会话）
- [ ] 添加"记住我"选项
- [ ] 实现多设备会话管理
- [ ] 添加安全日志（登录IP、设备信息）
- [ ] Token 即将过期时自动刷新
