# 查看镜像拉取进度功能

## ✨ 新功能

现在您可以**实时查看**容器启动过程中的镜像拉取进度和所有 Pod 事件！

## 📍 在哪里查看

### 方法：容器详情页的 Overview 标签

1. 创建容器后，点击容器进入详情页
2. 在 **Overview** 标签页中
3. 会自动显示 **"Pod Events"** 部分（如果容器正在启动）
4. 点击刷新图标 🔄 可以手动刷新事件

## 🔍 可以看到什么信息

### 常见事件类型

| 事件原因 | 含义 | 类型 |
|---------|------|------|
| **Pulling** | 正在从镜像仓库拉取镜像 | Normal |
| **Pulled** | 镜像拉取成功 | Normal |
| **Created** | 容器已创建 | Normal |
| **Started** | 容器已启动 | Normal |
| **ErrImagePull** | 镜像拉取失败 | Warning |
| **ImagePullBackOff** | 镜像拉取失败，等待重试 | Warning |
| **FailedScheduling** | 调度失败（资源不足等） | Warning |
| **BackOff** | 容器启动失败，等待重试 | Warning |

### 事件信息包括

- **原因标签**：显示事件类型（如 Pulling、Pulled、Created）
- **详细消息**：具体发生了什么
  - 例如：`pulling image "dockerhub.ihep.ac.cn/hepai/hai-openclaw@sha256:..."`
  - 例如：`Successfully pulled image "..." in 45.2s`
- **发生次数**：如果事件重复发生，显示次数（×3）
- **时间戳**：事件最后发生的时间

### 友好提示

系统会根据事件自动显示帮助提示：

**正在拉取镜像：**
```
🔄 Pulling image... This may take 10-60 seconds depending
   on image size. Refresh events to see progress.
```

**镜像拉取失败：**
```
❌ Image pull failed! Please check if the image address
   is correct and accessible.
```

## 📊 典型的启动流程

### 正常启动

```
1. Scheduled
   → Successfully assigned pod to node aicpu004

2. Pulling
   → Pulling image "dockerhub.ihep.ac.cn/hepai/hai-openclaw@sha256:..."

3. Pulled
   → Successfully pulled image in 32.5s

4. Created
   → Created container main

5. Started
   → Started container main

✅ 容器状态变为 Running
```

**时间线**：约 30-60 秒（取决于镜像大小）

### 失败情况

```
1. Scheduled
   → Successfully assigned pod to node

2. Pulling
   → Pulling image "wrong-image:tag"

3. ErrImagePull  ⚠️
   → Failed to pull image: manifest unknown

4. ImagePullBackOff  ⚠️
   → Back-off pulling image "wrong-image:tag"

❌ 容器状态变为 Failed
```

## 🎯 使用场景

### 1. 监控大型镜像拉取

如果使用大型 AI/ML 镜像（几个 GB）：
- 打开容器详情页
- 查看 "Pulling" 事件
- 每 10 秒点击刷新查看进度
- 等待 "Pulled" 事件出现

### 2. 排查启动失败

容器一直显示 "Starting"：
1. 查看 Pod Events
2. 查找 Warning 类型的事件
3. 根据错误消息定位问题：
   - `ErrImagePull`：镜像地址错误
   - `ImagePullBackOff`：镜像不存在或无权限
   - `FailedScheduling`：集群资源不足
   - `BackOff`：容器启动后立即崩溃

### 3. 估算启动时间

通过查看 Pulled 事件的消息：
```
Successfully pulled image "..." in 45.2s
```
可以知道镜像拉取花费的确切时间。

## 🔄 自动刷新

**事件会自动加载**当：
- 容器状态为 `creating`
- K8s 状态为 `Pending`

**手动刷新**：
- 点击右上角的刷新图标 🔄
- 或者刷新整个页面

## 📱 界面说明

### 事件卡片

每个事件显示为一个卡片：

**Normal 事件**（正常操作）：
- 灰色背景
- 蓝色标签

**Warning 事件**（警告/错误）：
- 黄色背景
- 黄色标签

### 事件列表

- 按时间倒序排列（最新的在上面）
- 最多显示最近的所有事件
- 滚动查看更多历史事件

## 💡 技巧

### 查看详细拉取信息

Pulling 事件的消息会显示完整的镜像地址，包括：
- 镜像仓库
- 镜像名称
- SHA256 摘要（如果使用）

**示例：**
```
pulling image "dockerhub.ihep.ac.cn/almalinux9/almalinux9@sha256:bb921baae..."
```

### 判断是否卡住

如果看到：
- 只有 "Scheduled" 和 "Pulling" 事件
- 长时间（>5分钟）没有新事件
- 多次出现同样的 Warning 事件

**解决方法**：
1. 检查镜像地址是否正确
2. 检查网络连接
3. 联系管理员检查集群状态

### 快速诊断

| 观察到的情况 | 可能原因 | 解决方法 |
|------------|---------|---------|
| 没有事件 | Pod 还未创建 | 刷新页面 |
| 只有 Scheduled | 正在分配节点 | 等待几秒 |
| Pulling 很久 | 镜像很大 | 耐心等待 |
| ErrImagePull | 镜像地址错误 | 检查镜像名称 |
| ImagePullBackOff | 镜像不存在 | 检查镜像是否存在 |
| FailedScheduling | 资源不足 | 降低资源请求 |

## 🚀 API 端点

如果需要通过 API 访问事件：

```bash
# 获取容器的 Pod 事件
GET /api/containers/{container_id}/events

# 返回格式
{
  "events": [
    {
      "type": "Normal",
      "reason": "Pulling",
      "message": "pulling image \"...\""",
      "count": 1,
      "last_timestamp": "2026-02-11T16:45:23Z"
    },
    ...
  ]
}
```

## 📖 相关文档

- `CONTAINER_STATUS_FIX.md` - 容器状态显示优化
- `K8S_NAME_SANITIZATION_FIX.md` - Kubernetes 命名修复

---

**功能版本**: v1.0
**更新时间**: 2026-02-11
**状态**: ✅ 可用
