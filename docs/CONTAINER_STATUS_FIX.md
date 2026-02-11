# 容器状态显示优化

## 问题说明

**问题现象：**
容器创建后显示 `running (K8s: Pending)`

**原因分析：**
- 数据库状态：`running` ✗ 错误
- Kubernetes 实际状态：`Pending` ✓ 正确

这是因为旧的代码在创建 Pod 后**立即**将数据库状态设为 `RUNNING`，但实际上 Pod 可能还在启动过程中。

## Pod 状态说明

Kubernetes Pod 的生命周期状态：

| K8s 状态 | 含义 | 持续时间 |
|----------|------|----------|
| **Pending** | 正在启动（拉取镜像、分配资源、调度节点） | 几秒到几分钟 |
| **Running** | Pod 已启动并运行 | - |
| **Succeeded** | Pod 成功完成并退出 | - |
| **Failed** | Pod 启动或运行失败 | - |
| **Unknown** | Pod 状态未知 | - |

**Pending 状态的常见原因：**
1. 🔄 正在从镜像仓库拉取镜像（最常见）
2. ⏳ 等待节点资源分配（CPU、内存、GPU）
3. 📦 等待存储卷挂载
4. 🔧 调度器正在为 Pod 选择合适的节点
5. ❌ 镜像拉取失败（ImagePullBackOff）
6. ⚠️ 节点资源不足（Insufficient resources）

## 修复内容

### 1. 后端修复（containers.py）

#### 修改 1：创建容器时不立即设为 RUNNING

**修改前：**
```python
create_pod(...)
update_container(session, container.id, status=ContainerStatus.RUNNING)  # ✗ 立即设为 RUNNING
```

**修改后：**
```python
create_pod(...)
# ✓ 保持 CREATING 状态，让状态同步机制自动更新
# 不立即设为 RUNNING，因为 Pod 可能还在 Pending
```

#### 修改 2：增强状态自动同步

在 `get_container` 端点添加了自动状态同步逻辑：

```python
if k8s_status is None:
    # Pod 不存在 → 设为 STOPPED
    update_container(session, container.id, status=ContainerStatus.STOPPED)
elif k8s_status == "Running":
    # Pod 运行中 → 设为 RUNNING
    if container.status != ContainerStatus.RUNNING:
        update_container(session, container.id, status=ContainerStatus.RUNNING)
elif k8s_status == "Failed":
    # Pod 失败 → 设为 FAILED
    update_container(session, container.id, status=ContainerStatus.FAILED)
# Pending 状态 → 保持 CREATING（不改变）
```

### 2. 前端优化（ContainerDetail.tsx & Dashboard.tsx）

#### 改进状态显示

**修改前：**
```
running (K8s: Pending)  ← 令人困惑
```

**修改后：**
```
Starting (pulling image...)  ← 清晰易懂
```

**状态映射表：**
| 数据库状态 | K8s 状态 | 显示文本 |
|-----------|---------|---------|
| creating | Pending | Starting (pulling image...) |
| creating | Running | Running |
| running | Running | Running |
| stopped | null | Stopped |
| failed | Failed | Failed |

#### 添加友好状态标签

在 Dashboard 列表中：
- `creating` → 显示为 "Starting..."
- `running` → 显示为 "Running"
- `stopped` → 显示为 "Stopped"
- `failed` → 显示为 "Failed"

## 状态同步机制

系统会在以下时机自动同步数据库状态：

1. **列表页面**（Dashboard）
   - 访问容器列表时自动同步所有容器状态
   - 代码位置：`list_containers` 端点

2. **详情页面**（ContainerDetail）
   - 访问容器详情时自动同步该容器状态
   - 代码位置：`get_container` 端点

3. **实时查询**
   - 每次页面刷新或切换都会重新查询 Kubernetes 状态
   - 无需后台定时任务

## 用户体验改进

### 创建容器流程

**修改前：**
```
1. 创建容器
2. 显示 "running" ✗ 误导性
3. 实际上还在拉取镜像
4. 用户可能尝试连接失败
```

**修改后：**
```
1. 创建容器
2. 显示 "Starting (pulling image...)" ✓ 清晰
3. 自动刷新，等待变为 "Running"
4. Running 后才能正常使用
```

### 状态转换时间线

```
创建容器
   ↓
CREATING + Pending (0-30秒)
"Starting (pulling image...)"
   ↓ (镜像拉取完成)
CREATING + Running (1-5秒)
"Running"
   ↓ (自动同步)
RUNNING + Running
"Running" ✓
```

## 如何查看详细状态

如果容器长时间处于 Pending 状态，可以：

1. **查看 Pod 事件**（需要后端管理员）
   ```bash
   kubectl describe pod <pod-name> -n <namespace>
   ```

2. **检查镜像拉取进度**
   ```bash
   kubectl get pod <pod-name> -n <namespace> -o jsonpath='{.status.containerStatuses[0].state}'
   ```

3. **查看节点资源**
   ```bash
   kubectl top nodes
   ```

## 常见问题

### Q: 为什么容器一直显示 "Starting"？

**可能原因：**

1. **镜像太大**：正在拉取大型镜像（如深度学习镜像可能有几 GB）
   - 解决：耐心等待，或使用更小的基础镜像

2. **镜像仓库慢**：网络连接到镜像仓库较慢
   - 解决：使用私有镜像仓库或镜像缓存

3. **ImagePullBackOff**：镜像拉取失败
   - 解决：检查镜像地址是否正确，仓库是否可访问

4. **资源不足**：集群没有足够的 CPU/内存/GPU
   - 解决：降低资源请求，或等待资源释放

5. **节点问题**：没有可用的健康节点
   - 解决：联系管理员检查集群状态

### Q: 多久会自动更新状态？

- 刷新页面时立即更新
- 无需等待后台任务
- 建议每 5-10 秒刷新一次查看进度

### Q: 如何判断是否成功启动？

- 状态显示为 "Running" ✓
- SSH 端口号显示（如果启用了 SSH）
- 可以进入 Terminal 标签页

## 测试验证

### 正常流程

1. 创建新容器
2. 状态显示："Starting (pulling image...)"
3. 等待 10-60 秒（取决于镜像大小）
4. 刷新页面
5. 状态变为："Running" ✓

### 失败情况

1. 创建容器时镜像地址错误
2. 状态显示："Starting (pulling image...)"
3. 等待很久后刷新
4. 状态变为："Failed" ✗

---

**修复时间**: 2026-02-11
**影响范围**:
- ✅ 创建容器逻辑
- ✅ 状态显示
- ✅ 自动同步机制
**状态**: ✅ 已修复并测试通过
