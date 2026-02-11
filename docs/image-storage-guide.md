# HAI-K8S 镜像管理说明 📦

## 镜像存储位置

### 📊 元数据存储（数据库）

添加的镜像**元数据**存储在 **SQLite 数据库**中：

**数据库文件位置：**
```
/aifs/user/home/zdzhang/VSProjects/hai-k8s/haik8s/backend/db/haik8s.db
```

**数据库表结构：**
```sql
Table: images
├── id (主键)
├── name (镜像名称，唯一)
├── registry_url (镜像仓库地址) ⭐ 重要
├── description (描述)
├── default_cmd (默认命令，如 /bin/bash)
├── gpu_required (是否需要 GPU)
├── is_active (是否激活)
└── created_at (创建时间)
```

### 🐳 实际镜像存储（Docker/容器镜像）

**重要说明：** HAI-K8S **不存储实际的容器镜像文件**，而是存储**镜像的引用地址**。

实际的容器镜像存储在：
1. **Docker Hub** - 公共镜像仓库
2. **私有镜像仓库** - 如 `dockerhub.ihep.ac.cn`
3. **其他容器镜像仓库**

## 工作流程

### 1️⃣ 管理员添加镜像

当管理员在"镜像管理"页面添加镜像时：

```
Admin Images 页面
   ↓ (填写表单)
├── Name: almalinux9
├── Registry URL: dockerhub.ihep.ac.cn/almalinux9/almalinux9@sha256:...
├── Description: AlmaLinux 9 基础镜像
└── GPU Required: No
   ↓ (点击 "Add Image")
POST /api/images
   ↓ (后端处理)
保存到数据库 (haik8s.db)
```

**API 请求示例：**
```json
POST /api/images
{
  "name": "almalinux9",
  "registry_url": "dockerhub.ihep.ac.cn/almalinux9/almalinux9@sha256:bb921baae95e0bd1ed4f6ec7079f232b27ac01d9f0447fb96acea0242b7c896e",
  "description": "AlmaLinux 9 基础镜像",
  "gpu_required": false
}
```

### 2️⃣ 用户创建容器

当用户选择镜像创建容器时：

```
Create Container 页面
   ↓ (选择镜像)
选择 "almalinux9"
   ↓ (提交创建请求)
POST /api/containers
   ↓ (后端处理)
1. 从数据库读取 image.registry_url
2. 创建 Kubernetes Pod
3. Pod 配置使用 registry_url 拉取镜像
   ↓ (Kubernetes 执行)
从镜像仓库拉取实际镜像
   ↓
容器启动运行
```

## 查看数据库中的镜像

### 方法 1：使用 SQLite 命令行

```bash
# 进入后端目录
cd /aifs/user/home/zdzhang/VSProjects/hai-k8s/haik8s/backend

# 查询所有镜像
sqlite3 db/haik8s.db "SELECT id, name, registry_url FROM images WHERE is_active = 1;"

# 查看镜像详细信息
sqlite3 db/haik8s.db "SELECT * FROM images;"

# 查看镜像数量
sqlite3 db/haik8s.db "SELECT COUNT(*) FROM images WHERE is_active = 1;"
```

### 方法 2：使用 Web 界面

1. 登录 HAI-K8S
2. 使用管理员账号
3. 进入 **Admin → Images** 页面
4. 查看镜像列表

### 方法 3：使用 API

```bash
# 获取访问令牌后
curl -H "Authorization: Bearer <token>" \
     http://localhost:42900/api/images
```

## 镜像配置示例

### 公共镜像示例

```json
{
  "name": "ubuntu-22.04",
  "registry_url": "ubuntu:22.04",
  "description": "Ubuntu 22.04 LTS",
  "gpu_required": false
}
```

### 私有镜像仓库示例

```json
{
  "name": "pytorch-gpu",
  "registry_url": "dockerhub.ihep.ac.cn/ai/pytorch:2.0-cuda11.8",
  "description": "PyTorch 2.0 with CUDA 11.8",
  "gpu_required": true
}
```

### 使用 Digest 的镜像示例（推荐）

```json
{
  "name": "almalinux9",
  "registry_url": "dockerhub.ihep.ac.cn/almalinux9/almalinux9@sha256:bb921baae95e0bd1ed4f6ec7079f232b27ac01d9f0447fb96acea0242b7c896e",
  "description": "AlmaLinux 9 (固定版本)",
  "gpu_required": false
}
```

**使用 SHA256 Digest 的优势：**
- ✅ 确保拉取的镜像版本完全一致
- ✅ 避免标签被覆盖的问题
- ✅ 提高安全性和可重现性

## 数据库配置

### 默认配置

在 `haik8s/backend/config.py` 中：

```python
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{HERE / 'db' / 'haik8s.db'}"
)
```

### 自定义数据库位置

可以通过环境变量修改：

```bash
# 在 .env 文件中
DATABASE_URL=sqlite:////path/to/custom/location/haik8s.db

# 或使用 PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/haik8s
```

## 镜像生命周期

### 创建
```
POST /api/images → is_active = True
```

### 使用
```
用户在创建容器时选择镜像
↓
容器引用镜像的 registry_url
↓
Kubernetes 从仓库拉取实际镜像
```

### 删除（软删除）
```
DELETE /api/images/{id} → is_active = False
```

**注意：** 删除操作是**软删除**，只是将 `is_active` 设置为 `False`，数据仍保留在数据库中。

### 查看已删除的镜像

```sql
-- 查看所有镜像（包括已删除）
sqlite3 db/haik8s.db "SELECT id, name, is_active FROM images;"

-- 仅查看已删除的镜像
sqlite3 db/haik8s.db "SELECT id, name FROM images WHERE is_active = 0;"
```

## 重要概念

### ⚠️ HAI-K8S 不是镜像仓库

**HAI-K8S 不会：**
- ❌ 存储实际的镜像文件
- ❌ 构建 Docker 镜像
- ❌ 提供镜像推送功能
- ❌ 管理镜像层

**HAI-K8S 只是：**
- ✅ 存储镜像的**引用地址**（registry_url）
- ✅ 管理可用镜像的**列表**
- ✅ 提供镜像**选择界面**给用户
- ✅ 将镜像地址传递给 Kubernetes

### 镜像拉取过程

```
用户创建容器
   ↓
HAI-K8S 后端
   ├── 读取 image.registry_url 从数据库
   └── 创建 Kubernetes Pod (spec.containers[0].image = registry_url)
      ↓
Kubernetes 集群
   ├── 从镜像仓库拉取镜像
   ├── 缓存到节点本地
   └── 启动容器
```

## 数据备份

### 备份数据库

```bash
# 备份数据库文件
cp haik8s/backend/db/haik8s.db haik8s/backend/db/haik8s.db.backup

# 或使用 sqlite3 导出
sqlite3 haik8s/backend/db/haik8s.db .dump > backup.sql
```

### 恢复数据库

```bash
# 从备份文件恢复
cp haik8s/backend/db/haik8s.db.backup haik8s/backend/db/haik8s.db

# 或从 SQL 文件导入
sqlite3 haik8s/backend/db/haik8s.db < backup.sql
```

## 常见问题

### Q: 为什么我添加的镜像看不到了？
A: 可能被删除（软删除）了。检查 `is_active` 字段：
```sql
sqlite3 db/haik8s.db "SELECT name, is_active FROM images WHERE name = '你的镜像名';"
```

### Q: 可以使用私有镜像仓库吗？
A: 可以！只需在 `registry_url` 中填写完整的私有仓库地址，例如：
```
dockerhub.ihep.ac.cn/namespace/image:tag
```

但需要确保 Kubernetes 集群有权限访问该私有仓库（通过 imagePullSecrets 配置）。

### Q: 如何更新镜像信息？
A: 目前没有直接的更新接口。可以通过以下方式：
1. 软删除旧镜像
2. 添加新的镜像记录

或直接修改数据库（不推荐）：
```sql
sqlite3 db/haik8s.db "UPDATE images SET registry_url = '新地址' WHERE id = 1;"
```

### Q: 数据库文件可以移动到其他位置吗？
A: 可以。修改 `config.py` 中的 `DATABASE_URL` 或设置环境变量：
```bash
export DATABASE_URL="sqlite:////new/path/haik8s.db"
```

## 总结

📦 **镜像元数据存储位置：**
```
/aifs/user/home/zdzhang/VSProjects/hai-k8s/haik8s/backend/db/haik8s.db
(SQLite 数据库)
```

🐳 **实际镜像存储位置：**
```
Docker Hub / 私有镜像仓库 / 其他容器镜像仓库
(HAI-K8S 只存储引用地址，不存储镜像文件本身)
```

🔍 **查看镜像：**
- Web 界面：Admin → Images
- 命令行：`sqlite3 db/haik8s.db "SELECT * FROM images;"`
- API：`GET /api/images`

---

**最后更新**: 2026-02-11
