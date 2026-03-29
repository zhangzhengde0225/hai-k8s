# 论文主题与核心贡献

Author: 白小心 & 朵拉
Date: 2026-03-29

## 论文定位

- **目标会议**：AI + Systems 交叉方向（NeurIPS MLSys workshop、IJCAI/AAAI 应用 track）
- **核心贡献角度**：架构设计 + 系统实现
- **特色**：突出 Agent-as-Container + Hierarchical Orchestration + DORA 示范应用

---

## 核心叙事：用户痛点 → 解决方案

### 用户痛点

我有多个专业的 AI Agent：
- OpenClaw 管日常
- Claude Code 写代码
- drsai 做物理分析

**问题**：我不想分别跟每个 Agent 打交道，我只想跟一个"领导"说话，让它去协调。

### 我们的方案

**核心技术贡献**：
1. **Agent-as-Container**：每个 Agent 跑在独立容器里，实现真正隔离
2. **Skill 编排框架**：Orchestrator 通过标准 Skill 接口调用任何 Agent，无需知道其内部 API

**示范应用**：
- **DORA**：基于我们的框架实现的 Orchestrator
- DORA 协调 OpenClaw、Claude Code、drsai
- 用户只跟 DORA 说话

### 核心卖点（一句话）

> "我不想管几个 Agent 怎么配合——我只想跟 DORA 说一句话"

---

## 核心概念：三层架构

```
层次1 - 协调层（Orchestrator / DORA）
  DORA = AI 团队领导
  - 负责任务分解
  - 调度和组合多个智能体
  - 结果聚合
  - 用户只跟 DORA 打交道

层次2 - 智能体运行时（Agent Runtime）
  OpenClaw / Claude Code / drsai = 专业 Agent
  - 每个容器运行一个 Agent
  - 有自己的 memory、skills、tools
  - 接收 Orchestrator 的指令执行具体任务

层次3 - 容器平台（Container Platform）
  HAI-K8S / Kubernetes = 基础设施
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
| 程序员 | Orchestrator / DORA |

---

## 核心贡献点

1. **Agent-as-Container 抽象**：把智能体像进程一样管理，支持快速创建/销毁/迁移
2. **Multi-Runtime Multi-Agent 架构**：Orchestrator-Agent 两层分离，每个 Agent 独立容器
3. **Skill 作为标准化协调接口**：Orchestrator 通过 Skill 调用任何 Agent，无需知道内部 API
4. **DORA 示范应用**：展示如何用框架协调 OpenClaw、Claude Code、drsai
5. **完整的智能体生命周期管理**：创建 → 初始化 → 运行 → 监控 → 回收
6. **安全隔离**：直接回应 CNCERT 安全建议

---

## 论文标题方向

- 主标题：**"Orchestrating Multi-Agent Collaboration through Containerized Agent Runtime"**
- 副标题：**"Agent-as-Container, Hierarchical Orchestration, and DORA as the User Interface"**
