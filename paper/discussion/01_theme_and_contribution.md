# 论文主题与核心贡献

Author: 白小心 & 朵拉
Date: 2026-03-28

## 论文定位

- **目标会议**：AI + Systems 交叉方向（NeurIPS MLSys workshop、IJCAI/AAAI 应用 track）
- **核心贡献角度**：架构设计 + 系统实现
- **特色**：突出 hai-k8s 系统实现 + 两个 Agent Skill（hai-k8s-container、openclaw-manager）

## 核心概念：容器化智能体

### 三层架构

```
层次1 - 基础设施层（Orchestrator / Orchestration Layer）
  赛博士 (drsai) = Orchestrator
  - 负责任务分解
  - 调度和组合多个智能体
  - 结果聚合

层次2 - 智能体运行时（Agent Runtime）
  OpenClaw / Claude Code = 具身智能体 (Embodied Agent)
  - 每个容器运行一个具身智能体
  - 有自己的 memory、skills、tools
  - 接收 Orchestrator 的指令执行具体任务

层次3 - 容器平台（Container Platform）
  HAI-K8S = 智能体的"身体"
  - 容器编排、计算资源管理
  - 网络、存储、GPU 分配
  - 智能体生命周期管理
  - 用户/权限隔离
```

### 类比

| 传统计算 | 智能体计算 |
|---------|-----------|
| 进程 | 智能体 (Agent) |
| 操作系统 (OS) | HAI-K8S (容器平台) |
| 程序员 | 赛博士 (Orchestrator) |

## 核心贡献点

1. **容器化智能体的概念**：把智能体像进程一样管理，支持快速创建/销毁/迁移
2. **层次化编排架构**：Orchestrator-Agent 两层分离
3. **完整的智能体生命周期管理**：创建 → 初始化 → 运行 → 监控 → 回收
4. **Skill 框架**：标准化智能体能力扩展机制
5. **系统实现**：HAI-K8S 完整实现 + 两个生产可用的 Skill

## 论文标题方向

- 主标题：**"HAI-K8S: A Containerized Agent Platform with Hierarchical Orchestration"**
- 副标题：**"An Agent-Native Infrastructure for Multi-Agent Collaboration"**

或更强调 AI：
- **"Orchestrating Multi-Agent Collaboration through Containerized Agent Runtime"**
