# 应用配置与实例分离实施总结（简化版）

## 实施完成 ✓

应用配置与实例分离功能已实施完成，采用简化设计：**每个用户每个应用只能有1个配置**。

---

## 核心设计决策

### 简化方案
- ❌ ~~多配置管理~~（每个应用可以有多个配置：开发环境、生产环境等）
- ✅ **单配置管理**（每个用户每个应用只能有1个配置）

### 优势
1. **更简单的用户体验**：无需配置命名，直接配置即可
2. **更清晰的逻辑**：一个应用→一份配置→多个实例
3. **更少的代码**：无需管理配置列表、删除配置等功能
4. **更快的实现**：大大降低开发复杂度

---

## 核心功能

### 用户工作流

**1. 首次配置应用**
- 进入"应用服务"页面 → OpenClaw显示"未配置"
- 点击"配置"按钮 → 打开配置表单
- 选择镜像、设置资源（CPU/内存/GPU）
- 点击"保存" → **仅保存到数据库，不创建Pod**

**2. 启动实例**
- 点击"启动"按钮（已配置的应用）
- **直接从配置创建Container + K8s Pod**
- 可以多次点击启动，创建多个实例

**3. 修改配置**
- 点击"编辑配置"按钮
- 修改镜像或资源配置
- 保存 → **已运行的实例不受影响**
- 新启动的实例使用新配置

---

## 数据库设计

### ApplicationConfig 表

```sql
CREATE TABLE application_configs (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,           -- 用户ID
    application_id TEXT NOT NULL,       -- 应用ID (openclaw/opendrsai)
    image_id INTEGER NOT NULL,          -- 镜像ID

    -- 资源配置
    cpu_request REAL DEFAULT 2.0,
    memory_request REAL DEFAULT 4.0,
    gpu_request INTEGER DEFAULT 0,
    ssh_enabled BOOLEAN DEFAULT TRUE,
    storage_path TEXT,

    -- 状态和时间戳
    status TEXT DEFAULT 'draft',        -- draft/validated/archived
    created_at TIMESTAMP,
    updated_at TIMESTAMP,

    -- 唯一约束：每个用户每个应用只能有1个配置
    UNIQUE(user_id, application_id)
);
```

### Container 表（更新）

新增字段：
- `config_id`: 关联的配置ID
- `application_id`: 应用ID

---

## API设计

### 简化后的端点

1. **保存/更新配置**（Upsert）
```
POST /api/applications/{app_id}/config
PUT /api/applications/{app_id}/config

请求体:
{
  "image_id": 1,
  "cpu_request": 2.0,
  "memory_request": 4.0,
  "gpu_request": 0,
  "ssh_enabled": true,
  "storage_path": "/aifs/user/home/username/imagename"
}

响应: 配置详情 + instance_count
```

2. **获取配置**
```
GET /api/applications/{app_id}/config

响应: 配置详情 + instance_count
如果不存在: 404 错误
```

3. **启动实例**
```
POST /api/applications/{app_id}/launch

请求体:
{
  "instance_name": "optional",
  "count": 1
}

响应: 创建的实例列表
```

### 配置校验

保存时自动校验：
- 镜像存在且激活
- 镜像前缀匹配应用（Hai-OpenClaw → openclaw）
- GPU依赖（镜像需要GPU则gpu_request必须>0）
- 资源配额不超限

---

## 前端实现

### 组件变化

**AppConfigForm**（配置表单）
- ✅ 镜像选择（应用镜像/系统镜像/自定义镜像）
- ✅ 资源配置（CPU/内存/GPU）
- ✅ 网络配置（SSH开关）
- ✅ 存储配置（自动生成路径）
- ❌ ~~配置名称字段~~（已移除）
- ❌ ~~配置描述字段~~（已移除）

**AppService**（应用服务页面）
- 未配置应用：显示"配置"按钮 → 打开配置表单
- 已配置应用：显示"启动"按钮 → 直接启动实例
- 已配置应用：显示"编辑配置"按钮 → 修改配置
- ❌ ~~配置列表Drawer~~（已移除）
- ❌ ~~删除配置按钮~~（已移除）

### API调用

```typescript
// 保存配置
POST /applications/${appId}/config
{
  image_id, cpu_request, memory_request,
  gpu_request, ssh_enabled, storage_path
}

// 启动实例
POST /applications/${appId}/launch
{ count: 1 }
```

---

## 文件清单

### 后端文件（已修改）
1. ✅ `haik8s/backend/db/models.py` - ApplicationConfig模型简化
2. ✅ `haik8s/backend/api/applications.py` - API简化为3个端点
3. ✅ `haik8s/backend/db/crud.py` - CRUD操作（未使用，可选）

### 前端文件（已修改）
1. ✅ `haik8s/frontend/src/components/AppConfigForm.tsx` - 去掉配置命名
2. ✅ `haik8s/frontend/src/pages/AppService.tsx` - 简化为单配置逻辑
3. ✅ `haik8s/frontend/src/types/index.ts` - 类型定义简化
4. ✅ `haik8s/frontend/src/i18n/locales/zh/common.json` - 中文翻译
5. ✅ `haik8s/frontend/src/i18n/locales/en/common.json` - 英文翻译

---

## 数据迁移

### 迁移脚本

**文件**: `haik8s/backend/scripts/migrate_to_config_separation.py`

**功能**:
- 为每个现有容器创建对应的ApplicationConfig
- 自动推断application_id（基于镜像名称）
- 建立Container和ApplicationConfig的关联
- 包含备份提醒和验证功能

### 执行步骤

```bash
# 1. 备份数据库（重要！）
cd /aifs/user/home/zdzhang/VSProjects/hai-k8s/haik8s/backend
cp db/haik8s.db db/haik8s.db.backup.$(date +%Y%m%d_%H%M%S)

# 2. 执行迁移脚本
python scripts/migrate_to_config_separation.py

# 3. 重启后端服务
# （使用你的启动方式）
```

---

## 验证测试

### 后端测试

```bash
# 1. 保存配置
curl -X POST http://localhost:8000/api/applications/openclaw/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "image_id": 1,
    "cpu_request": 2.0,
    "memory_request": 4.0,
    "gpu_request": 0,
    "ssh_enabled": true
  }'

# 2. 获取配置
curl http://localhost:8000/api/applications/openclaw/config \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. 启动实例
curl -X POST http://localhost:8000/api/applications/openclaw/launch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"count": 1}'
```

### 前端测试

1. **配置应用**
   - 访问"应用服务"页面
   - 点击OpenClaw的"配置"按钮
   - 选择镜像、设置资源
   - 点击"保存" → 应看到"配置已保存"提示
   - **验证**：未创建K8s Pod

2. **启动实例**
   - 刷新页面，应用状态变为"已配置"
   - 点击"启动"按钮
   - 应看到"实例已启动"提示
   - **验证**：创建了Container记录和K8s Pod

3. **修改配置**
   - 点击"编辑配置"按钮
   - 修改CPU为4核
   - 保存
   - **验证**：已运行实例仍为2核
   - 点击"启动"新实例
   - **验证**：新实例为4核

4. **多次启动**
   - 连续点击"启动"按钮3次
   - **验证**：创建3个实例，都使用相同配置

---

## 与原方案的对比

| 功能 | 原方案（多配置） | 简化方案（单配置） |
|------|-----------------|-------------------|
| **配置数量** | 每个应用可以有多个配置 | 每个应用只能有1个配置 |
| **配置命名** | 需要配置名称和描述 | 无需配置名称 |
| **配置列表** | 需要配置列表界面 | 无需列表界面 |
| **配置选择** | 启动时选择配置 | 直接从唯一配置启动 |
| **删除配置** | 支持删除配置 | 不支持删除（只能修改） |
| **数据库** | 唯一约束：user_id + app_id + config_name | 唯一约束：user_id + app_id |
| **API端点** | 6个端点（CRUD+启动） | 3个端点（获取/保存/启动） |
| **用户体验** | 灵活但复杂 | 简单直观 |
| **实现复杂度** | 高 | 低 |

---

## 优化建议

### 短期
1. **加载现有配置**：打开配置表单时，如果配置存在，自动填充字段
2. **配置历史**：记录配置变更历史（可选）
3. **批量启动**：支持一次启动多个实例

### 长期
如果确实需要多配置管理，可以在后续版本中升级：
1. 添加配置名称字段
2. 修改唯一约束为 `user_id + app_id + config_name`
3. 添加配置列表界面
4. 添加配置删除功能

---

## 故障排查

### 问题1：保存配置时报错"配置已存在"
**原因**：该用户该应用已有配置
**解决**：使用PUT方法更新配置，或删除旧配置后重新创建

### 问题2：启动实例时报错"配置不存在"
**原因**：用户还没有保存配置
**解决**：先点击"配置"按钮保存配置

### 问题3：修改配置后实例还是旧配置
**原因**：配置更新不影响已运行实例（这是设计行为）
**解决**：删除旧实例，重新启动新实例

---

## 总结

✅ **核心功能完成**
- 配置与实例完全分离
- 保存配置不创建Pod
- 从配置启动实例
- 配置更新不影响已运行实例

✅ **简化设计优势**
- 用户体验更简单
- 代码复杂度更低
- 更容易维护

✅ **向后兼容**
- 数据迁移脚本就绪
- 现有容器自动转换为配置

🚀 **准备就绪**
- 执行数据迁移
- 重启服务
- 开始使用

---

**祝部署顺利！** 🎉
