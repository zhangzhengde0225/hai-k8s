# HAI-K8S 本地登录功能说明

## 功能概述

HAI-K8S 支持两种登录方式：
1. **本地账号登录** - 使用用户名和密码登录
2. **IHEP SSO 统一认证登录** - 使用高能所统一认证系统登录

## 默认管理员账号

系统首次启动时会自动创建默认管理员账号。

### 默认配置

默认值（可在 `.env` 中修改）：
- **用户名**: `admin`
- **密码**: `admin123`
- **邮箱**: `admin@haik8s.local`
- **角色**: 管理员

### 自定义管理员账号

在首次启动前，可以通过修改 `.env` 文件来自定义管理员账号：

```bash
# Default Admin User (created on first startup)
DEFAULT_ADMIN_USERNAME=myadmin
DEFAULT_ADMIN_PASSWORD=MySecurePassword123!
DEFAULT_ADMIN_EMAIL=myadmin@example.com
```

⚠️ **重要提示**：
- 配置仅在首次创建时生效
- 如果管理员已存在，不会重新创建
- 建议使用强密码（至少8位，包含大小写字母、数字和特殊字符）
- 生产环境必须修改默认密码！

## 使用方式

### 前端登录界面

1. 点击标题 "HAI-K8S" 可以切换登录模式
2. 本地登录模式下，输入用户名和密码
3. 统一认证模式下，点击按钮跳转到 IHEP SSO 登录页面

### 后端 API

#### 本地登录

```bash
POST /api/auth/login/local
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

响应：

```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "username": "admin",
  "email": "admin@haik8s.local",
  "role": "admin"
}
```

#### SSO 登录

```bash
GET /api/auth/login/sso
```

重定向到 IHEP SSO 授权页面。

## 数据库迁移

如果您已经有旧的数据库，需要进行迁移以添加 `password_hash` 字段：

### 方法一：删除旧数据库（推荐用于开发环境）

```bash
cd haik8s/backend
# 备份旧数据库
cp db/haik8s.db db/haik8s.db.backup
# 删除旧数据库
rm db/haik8s.db
# 重新启动后端，系统会自动创建新表结构
```

### 方法二：手动迁移（用于生产环境）

```bash
cd haik8s/backend
sqlite3 db/haik8s.db

-- 添加 password_hash 字段
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- 更新 auth_provider 枚举（如果需要）
UPDATE users SET auth_provider = 'ihep_sso' WHERE auth_provider IS NULL;
```

## 安装依赖

本地登录功能需要 `passlib` 和 `bcrypt` 库：

```bash
cd haik8s/backend
pip install -r requirements.txt
```

### 依赖说明

- `passlib[bcrypt]>=1.7.4` - 密码哈希库
- `bcrypt==4.0.1` - 加密后端（锁定版本以确保兼容性）

如果遇到 bcrypt 版本问题，确保使用兼容版本：

```bash
pip install bcrypt==4.0.1 --force-reinstall
```

## 创建本地用户

管理员可以通过 API 创建新的本地用户（功能待开发）。

## 安全建议

1. 生产环境必须修改 `JWT_SECRET_KEY`
2. 首次启动前设置强管理员密码
3. 定期更新密码
4. 使用强密码（至少8位，包含大小写字母、数字和特殊字符）
5. 避免在代码中硬编码密码，使用环境变量

## 故障排查

### bcrypt 版本错误

如果看到类似错误：
```
error reading bcrypt version
AttributeError: module 'bcrypt' has no attribute '__about__'
```

解决方法：
```bash
pip install bcrypt==4.0.1 --force-reinstall
```

### 数据库字段缺失

如果看到错误：
```
OperationalError: no such column: users.password_hash
```

解决方法：删除旧数据库重新创建（见"数据库迁移"章节）

### 管理员账号已存在

如果修改 `.env` 中的管理员配置后不生效，说明管理员账号已经创建。需要：
1. 删除数据库重新创建，或
2. 直接在数据库中修改管理员信息
