# 用户同步功能更新说明

## 概述
在 OpenClaw 配置界面的计算资源配置下方，添加了新的"同步用户"配置卡片。

## 功能说明

### 前端界面
1. **位置**：在"计算资源"配置卡片和"网络配置"卡片之间
2. **功能**：
   - 可选择是否同步用户到容器
   - 显示用户信息：用户名、UID、GID、家目录（只读，从后端获取）
   - 启用 sudo 选项：默认勾选，可以取消

### 后端 API
增强了 ApplicationConfig 配置，支持以下字段：
- `sync_user`: 是否同步用户（默认 true）
- `user_uid`: 用户 UID
- `user_gid`: 用户 GID
- `user_home_dir`: 用户家目录
- `enable_sudo`: 是否启用 sudo（默认 true）

## 修改的文件

### 后端
1. **haik8s/backend/db/models.py**
   - 在 `ApplicationConfig` 模型中添加了用户同步相关字段

2. **haik8s/backend/api/applications.py**
   - 更新 `SaveConfigRequest` 模型，支持用户同步字段
   - 更新配置保存和读取逻辑，处理用户同步数据
   - 在应用列表和配置详情 API 中返回用户同步配置

3. **haik8s/backend/db/migrations/add_user_sync_fields.sql**
   - 新增数据库迁移脚本

### 前端
1. **haik8s/frontend/src/types/index.ts**
   - 更新 `Application`、`AppConfig`、`SaveConfigData` 接口，添加用户同步字段

2. **haik8s/frontend/src/components/AppConfigForm.tsx**
   - 添加用户同步状态管理
   - 添加"同步用户"配置卡片 UI
   - 从后端加载和保存用户同步配置
   - 自动获取当前用户的系统信息（UID、GID、家目录）

3. **haik8s/frontend/src/i18n/locales/zh/common.json**
   - 添加中文翻译：`syncUser`、`username`、`homeDirectory`、`enableSudo`

4. **haik8s/frontend/src/i18n/locales/en/common.json**
   - 添加英文翻译：`syncUser`、`username`、`homeDirectory`、`enableSudo`

## 数据库迁移

项目使用的是 **SQLite 数据库**。

### 方法一：使用 sqlite3 命令行工具

```bash
cd /root/VSProjects/hai-k8s/haik8s/backend

sqlite3 db/haik8s.db < db/migrations/add_user_sync_fields.sql
```

### 方法二：手动执行 SQL

```bash
sqlite3 /root/VSProjects/hai-k8s/haik8s/backend/db/haik8s.db
```

然后在 sqlite3 命令行中执行：

```sql
ALTER TABLE application_configs ADD COLUMN sync_user BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE application_configs ADD COLUMN user_uid INTEGER;
ALTER TABLE application_configs ADD COLUMN user_gid INTEGER;
ALTER TABLE application_configs ADD COLUMN user_home_dir VARCHAR;
ALTER TABLE application_configs ADD COLUMN enable_sudo BOOLEAN NOT NULL DEFAULT 1;
.exit
```

### 验证迁移

检查字段是否添加成功：

```bash
sqlite3 /root/VSProjects/hai-k8s/haik8s/backend/db/haik8s.db "PRAGMA table_info(application_configs);"
```

应该能看到新添加的 5 个字段：
- sync_user (BOOLEAN)
- user_uid (INTEGER)
- user_gid (INTEGER)
- user_home_dir (VARCHAR)
- enable_sudo (BOOLEAN)

## 待完成事项

### 后端
1. **实现获取用户系统信息的 API**
   - 当前前端使用模拟数据（UID=1000, GID=1000）
   - 需要从系统或 LDAP/SSO 获取真实的用户 UID、GID 和家目录
   - 建议在 `haik8s/backend/api/users.py` 中添加新的端点：
     ```python
     @router.get("/me/system-info")
     async def get_user_system_info(current_user: User = Depends(get_current_user)):
         # 从系统获取真实的 uid, gid, home_dir
         return {
             "uid": ...,
             "gid": ...,
             "home_dir": ...,
         }
     ```

2. **在 Pod 创建时使用用户同步配置**
   - 修改 `haik8s/backend/k8s/pods.py` 或相关的 Pod 创建逻辑
   - 使用 `haik8s/backend/k8s/tests/inject_user.py` 中的函数生成用户注入脚本
   - 将配置中的 `sync_user`、`user_uid`、`user_gid`、`user_home_dir`、`enable_sudo` 传递给 Pod

### 前端
1. **调用真实的用户系统信息 API**
   - 在 `AppConfigForm.tsx` 的 useEffect 中，替换模拟数据为真实 API 调用
   - 示例：
     ```typescript
     useEffect(() => {
       if (!application.config?.user_uid) {
         client.get('/users/me/system-info').then(res => {
           setUserUid(res.data.uid);
           setUserGid(res.data.gid);
           setUserHomeDir(res.data.home_dir);
         });
       }
     }, [user, application.config]);
     ```

## 使用示例

用户在配置 OpenClaw 应用时：
1. 选择镜像和配置资源
2. 在"同步用户"卡片中查看自动获取的用户信息
3. 可以勾选/取消"启用 sudo"选项
4. 保存配置后，这些信息会在 Pod 启动时用于创建容器内的用户

## 注意事项

1. **数据库迁移必须执行**：修改了数据库模型，必须运行迁移脚本添加新字段
2. **当前使用模拟数据**：前端暂时使用固定值（UID=1000, GID=1000），需要后端实现真实的用户信息获取 API
3. **字段命名转换**：前端使用 camelCase（如 `syncUser`），后端使用 snake_case（如 `sync_user`），已在 API 调用中正确处理
4. **默认值**：`sync_user` 和 `enable_sudo` 默认为 `true`，用户可以取消勾选

## 相关文件引用
- 用户注入脚本生成：haik8s/backend/k8s/tests/inject_user.py:82
- Pod 创建逻辑：haik8s/backend/k8s/pods.py
- 应用配置 API：haik8s/backend/api/applications.py:318
