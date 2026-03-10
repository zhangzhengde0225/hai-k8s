# 命令执行弹窗组件使用说明

## 📦 已创建的文件

```
haik8s/frontend/src/pages/AppDetails/components/
└── CommandExecutor.tsx  ✨ 新增：命令执行弹窗组件
```

## ✨ 功能特性

### 1. **命令执行弹窗 (CommandExecutor)**

**位置**: `haik8s/frontend/src/pages/AppDetails/components/CommandExecutor.tsx`

**主要功能**:
- ✅ 命令输入框（支持多行）
- ✅ 快捷命令按钮（pwd, ls, env, ps, df, free）
- ✅ 执行按钮（带加载状态）
- ✅ 实时显示执行结果
- ✅ 成功/失败状态指示
- ✅ 退出码显示
- ✅ 输出复制按钮
- ✅ 快捷键 Ctrl+Enter 执行
- ✅ 错误信息显示
- ✅ 深色模式支持

**Props**:
```typescript
interface Props {
  containerId: number;        // 容器 ID
  containerName: string;       // 容器名称（显示用）
  onClose: () => void;         // 关闭回调
}
```

## 🎯 集成到 AppDetails

**已修改的文件**: `haik8s/frontend/src/pages/AppDetails/index.tsx`

**修改内容**:

1. **导入组件和图标**
```typescript
import { Terminal } from 'lucide-react';
import { CommandExecutor } from './components/CommandExecutor';
```

2. **添加状态管理**
```typescript
const [showCommandExecutor, setShowCommandExecutor] = useState(false);
const [executorContainerId, setExecutorContainerId] = useState<number | null>(null);
const [executorContainerName, setExecutorContainerName] = useState<string>('');
```

3. **添加打开弹窗的处理函数**
```typescript
const handleOpenCommandExecutor = (instance: AppInstance) => {
  setExecutorContainerId(instance.id);
  setExecutorContainerName(instance.name);
  setShowCommandExecutor(true);
};
```

4. **在实例卡片添加执行命令按钮**
   - 位置：SSH 复制按钮和删除按钮之间
   - 颜色：紫色（purple）
   - 图标：Terminal
   - 仅在容器 Running 状态时显示

5. **渲染弹窗**
```typescript
{showCommandExecutor && executorContainerId !== null && (
  <CommandExecutor
    containerId={executorContainerId}
    containerName={executorContainerName}
    onClose={() => setShowCommandExecutor(false)}
  />
)}
```

## 🎨 UI 设计

### 弹窗布局

```
┌─────────────────────────────────────────────┐
│ 🖥️ 命令执行            container-name    ✕ │
├─────────────────────────────────────────────┤
│                                             │
│ 命令 (Ctrl+Enter 执行)                      │
│ ┌─────────────────────────────────────────┐ │
│ │ ls -la                                  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ 快捷命令                                    │
│ [pwd] [ls] [环境变量] [进程] [磁盘] [内存]  │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │          🎯 执行命令                    │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ✅ 执行成功  退出码: 0         [📋 复制]   │
│                                             │
│ 输出                                        │
│ ┌─────────────────────────────────────────┐ │
│ │ total 48                                │ │
│ │ drwxr-xr-x  6 root root 4096 ...       │ │
│ │ ...                                     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
├─────────────────────────────────────────────┤
│ 💡 提示: 支持管道、重定向等 Bash 语法  [关闭]│
└─────────────────────────────────────────────┘
```

### 颜色方案

- **紫色** - 执行命令按钮（区别于其他操作）
- **绿色** - 成功状态
- **红色** - 失败状态
- **蓝色** - 主要操作按钮

## 📝 使用示例

### 用户操作流程

1. **打开弹窗**
   - 在实例卡片上找到紫色的终端图标按钮
   - 点击按钮打开命令执行弹窗

2. **输入命令**
   - 方式一：直接在输入框输入命令
   - 方式二：点击快捷命令按钮

3. **执行命令**
   - 方式一：点击"执行命令"按钮
   - 方式二：按 Ctrl+Enter 快捷键

4. **查看结果**
   - 成功：绿色标记 + 输出内容
   - 失败：红色标记 + 错误信息
   - 可点击"复制"按钮复制输出

5. **关闭弹窗**
   - 点击右上角 ✕ 按钮
   - 或点击底部"关闭"按钮

### 快捷命令列表

| 按钮 | 命令 | 说明 |
|------|------|------|
| pwd | `pwd` | 显示当前目录 |
| ls | `ls -la` | 列出文件详情 |
| 环境变量 | `env` | 显示环境变量 |
| 进程 | `ps aux` | 显示进程列表 |
| 磁盘 | `df -h` | 显示磁盘使用情况 |
| 内存 | `free -h` | 显示内存使用情况 |

## 🔌 API 调用

弹窗组件调用后端 API：

```typescript
POST /api/containers/{containerId}/exec

// 请求
{
  "command": "ls -la",
  "timeout": 30
}

// 响应
{
  "success": true,
  "output": "total 48\ndrwxr-xr-x...",
  "error": null,
  "exit_code": 0,
  "message": "命令执行成功"
}
```

## ⚠️ 注意事项

### 安全性

1. **仅 Running 状态可用** - 按钮仅在容器运行时显示
2. **用户权限** - 后端会验证容器所有权
3. **命令超时** - 默认 30 秒超时保护
4. **命令审计** - 建议在后端记录执行的命令（待实现）

### 用户体验

1. **快捷键** - 支持 Ctrl+Enter 快速执行
2. **加载状态** - 执行时显示加载动画
3. **错误提示** - Toast 通知 + 详细错误信息
4. **输出复制** - 一键复制执行结果
5. **深色模式** - 完美支持暗黑主题

## 🚀 未来增强

- [ ] 命令历史记录（上下箭头切换）
- [ ] 命令自动补全
- [ ] 多行命令编辑器
- [ ] 实时流式输出（WebSocket）
- [ ] 命令模板保存
- [ ] 执行进度显示
- [ ] 命令收藏功能

## 🎉 完成状态

✅ **前端实现完成**
- CommandExecutor 组件
- AppDetails 集成
- UI/UX 设计
- 快捷命令
- 错误处理

✅ **后端实现完成**
- `/containers/{id}/exec` API 端点
- K8s 命令执行接口
- 权限验证
- 超时保护

✅ **测试工具**
- `test_pod_exec.py` 测试脚本
- API 测试通过
- 功能验证通过
