# 论文主题与核心贡献

Author: 白小心 & 朵拉
Date: 2026-03-29

## 论文定位

- **目标会议**：AI + Systems 交叉方向（NeurIPS MLSys workshop、IJCAI/AAAI 应用 track）
- **核心贡献角度**：架构设计 + 系统实现（技术论文）
- **特色**：Agent-as-Container + Skill 框架 + 完整系统实现

---

## 核心贡献点（技术导向）

1. **Agent-as-Container 抽象**：把智能体像进程一样管理，支持快速创建/销毁/迁移
2. **Multi-Runtime Multi-Agent 架构**：Orchestrator-Agent 两层分离，每个 Agent 独立容器
3. **Skill 作为标准化接口**：Orchestrator 通过 Skill 调用任何 Agent，无需知道内部 API
4. **完整的智能体生命周期管理**：创建 → 初始化 → 运行 → 监控 → 回收
5. **安全隔离**：直接回应 CNCERT 安全建议

## DORA 的定位

- **不是核心贡献**，是框架的示范应用
- 展示如何用 Agent-as-Container + Skill 实现多智能体协作
- 基于 OpenClaw、Claude Code、drsai 的实际场景

---

## 核心概念：三层架构

```
层次1 - 协调层（Orchestrator）
  负责任务分解、调度、结果聚合

层次2 - 智能体运行时（Agent Runtime）
  OpenClaw / Claude Code 等
  - 每个容器运行一个 Agent
  - 有自己的 memory、skills、tools
  - 接收 Orchestrator 的指令执行任务

层次3 - 容器平台（Container Platform）
  HAI-K8S / Kubernetes
  - 容器编排、计算资源管理
  - 智能体生命周期管理
  - 用户/权限隔离
```

### 类比

| 传统计算 | 智能体计算 |
|---------|-----------|
| 进程 | 智能体 (Agent) |
| 操作系统 (OS) | HAI-K8S (容器平台) |
| 程序员 | Orchestrator |

---

## 论文标题方向

- 主标题：**"Orchestrating Multi-Agent Collaboration through Containerized Agent Runtime"**
- 副标题：**"Agent-as-Container, Hierarchical Orchestration, and Skill-Based Interface"**
