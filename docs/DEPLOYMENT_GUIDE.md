# 用户同步功能 - 快速部署指南

## ✅ 已完成

### 1. 数据库迁移 ✓
数据库迁移已成功执行，新增字段：
- sync_user (BOOLEAN, 默认=1)
- user_uid (INTEGER)
- user_gid (INTEGER)
- user_home_dir (VARCHAR)
- enable_sudo (BOOLEAN, 默认=1)

验证命令：
```bash
sqlite3 /root/VSProjects/hai-k8s/haik8s/backend/db/haik8s.db "PRAGMA table_info(application_configs);"
```

### 2. 后端代码 ✓
- 数据库模型已更新
- API 接口已支持新字段
- 配置保存/读取逻辑已完善

### 3. 前端代码 ✓
- UI 界面已添加
- 状态管理已实现
- 多语言翻译已添加（中/英）
- TypeScript 类型定义已更新

## 🎯 如何使用

1. **重启后端服务**（如果正在运行）
   ```bash
   # 重启后端以加载新的模型和 API
   cd /root/VSProjects/hai-k8s/haik8s/backend
   # 根据你的启动方式重启服务
   ```

2. **重启前端服务**（如果正在运行）
   ```bash
   cd /root/VSProjects/hai-k8s/haik8s/frontend
   npm run dev
   ```

3. **测试功能**
   - 登录系统
   - 进入"应用服务"页面
   - 点击 OpenClaw 的"配置"按钮
   - 在"计算资源"配置下方可以看到新的"同步用户"卡片
   - 查看自动填充的用户信息（当前为模拟数据）
   - 可以勾选/取消"启用 sudo"选项
   - 保存配置

## ⚠️ 当前限制

**使用的是模拟数据**：
- UID: 1000
- GID: 1000
- 家目录: /home/{username}

## 📋 后续优化建议

### 1. 实现真实的用户信息获取 API

在 `haik8s/backend/api/users.py` 中添加：

```python
import pwd  # Unix 用户信息
import os

@router.get("/me/system-info")
async def get_user_system_info(
    current_user: User = Depends(get_current_user),
):
    """获取用户的系统信息（UID、GID、家目录）"""
    try:
        # 从用户名获取系统信息
        username = current_user.username
        if '@' in username:
            username = username.split('@')[0]

        # 尝试从系统获取用户信息
        try:
            user_info = pwd.getpwnam(username)
            uid = user_info.pw_uid
            gid = user_info.pw_gid
            home_dir = user_info.pw_dir
        except KeyError:
            # 用户不存在于系统中，使用默认值
            # 或者从 LDAP/SSO 获取
            uid = 1000
            gid = 1000
            home_dir = f"/home/{username}"

        return {
            "uid": uid,
            "gid": gid,
            "home_dir": home_dir,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取用户信息失败: {str(e)}")
```

### 2. 更新前端调用

在 `haik8s/frontend/src/components/AppConfigForm.tsx` 的 useEffect 中（第 157 行附近）：

```typescript
// Fetch user system information (uid, gid, home directory) from backend
useEffect(() => {
  // Only fetch if not already loaded from config
  if (application.config?.user_uid) {
    return;
  }

  // 调用真实 API
  if (user) {
    client.get('/users/me/system-info')
      .then(res => {
        setUserUid(res.data.uid);
        setUserGid(res.data.gid);
        setUserHomeDir(res.data.home_dir);
      })
      .catch(err => {
        console.error('Failed to get user system info:', err);
        // 使用默认值作为后备
        const username = user.email?.split('@')[0] || user.username;
        setUserUid(1000);
        setUserGid(1000);
        setUserHomeDir(`/home/${username}`);
      });
  }
}, [user, application.config]);
```

### 3. 在 Pod 创建时应用用户配置

修改 Pod 创建逻辑，使用配置中的用户信息调用 `inject_user.py` 生成用户注入脚本。

## 📄 完整文档

详细的更新说明请查看：`CHANGELOG_USER_SYNC.md`
