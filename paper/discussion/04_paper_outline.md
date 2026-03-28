# 论文大纲

Author: 白小心 & 朵拉
Date: 2026-03-28

## 标题

**"HAI-K8S: A Containerized Agent Platform with Hierarchical Orchestration"**

副标题: "An Agent-Native Infrastructure for Multi-Agent Collaboration"

---

## 1. Introduction

### 1.1 Background
- 智能体(Agent)发展背景：单体 → 多智能体协作
- 现有方案的局限：缺乏标准化的智能体生命周期管理

### 1.2 Problem Statement
- 问题：如何高效管理多个智能体的生命周期？
- 问题：如何让多个智能体协作完成复杂任务？
- 问题：如何标准化智能体的初始化和配置？

### 1.3 Contributions
- 提出 Containerized Agent 概念
- 设计并实现 HAI-K8S 系统
- 提出 Skill 框架标准化智能体能力扩展
- 实现 hai-k8s-container 和 openclaw-manager 两个生产可用的 Skill

---

## 2. Background & Motivation

### 2.1 Multi-Agent Collaboration
- 多智能体协作的现状
- 典型场景：复杂任务分解、专业智能体协作

### 2.2 Container Technology Maturity
- 容器技术的成熟度
- 为什么容器适合做智能体基础设施

### 2.3 Gap Analysis
- 现有方案（LangChain、AutoGen 等）的不足
- 缺乏"智能体-native"的容器管理平台

---

## 3. System Design

### 3.1 层次化架构
- 整体架构图
- 三层设计：Orchestrator / Agent Runtime / Container Platform
- 各层职责划分

### 3.2 容器管理设计
- Pod 模板和资源配额
- 网络隔离（macvlan CNI）
- 存储卷管理
- 安全模型

### 3.3 智能体生命周期管理
- 创建 → 初始化 → 运行 → 监控 → 回收
- 状态机转换
- 故障恢复机制

### 3.4 Skill 框架
- Skill 的定义和作用
- hai-k8s-container Skill 详解
- openclaw-manager Skill 详解
- Skill 生命周期

### 3.5 动态初始化机制
- 启动脚本注入
- 配置模板系统
- 模型配置管理

### 3.6 安全模型
- 威胁模型（基于 CNCERT OpenClaw 安全风险提示）
- 两层认证机制（Admin API Key + User JWT）
- 用户/租户隔离（per-user K8s namespace）
- 容器隔离 vs 非隔离对比
- 操作审计日志

### 3.7 Skill 框架安全
- Skill 来源验证（待实现）
- Skill 执行权限控制
- 容器内权限最小化

---

## 4. Implementation

### 4.1 技术栈
- FastAPI + Python
- Kubernetes Python Client
- SQLite + SQLModel
- React + TypeScript (前端)

### 4.2 系统架构
- 后端 API 设计
- 数据库模型
- K8s 集成细节

### 4.3 关键实现
- Pod 创建流程
- Skill 执行流程
- 两层认证实现

### 4.4 部署情况
- 当前运行规模
- 用户使用情况

---

## 5. Evaluation

### 5.1 实验1：Cold Start 延迟（Pod 创建 vs OpenClaw 初始化分解）
- 实验设置
- 结果分析

### 5.2 实验2：多智能体协作效率
- 实验设置
- 结果分析

### 5.3 实验3：资源利用率
- 实验设置
- 结果分析

### 5.4 实验4：容器隔离安全性（恶意 Skill 横向扩散）

### 5.5 实验5：Skill 调用 vs 直接 API 调用

### 5.6 实验6：Single-Runtime vs Multi-Runtime 隔离性

### 5.7 实验7：Single-Runtime vs Multi-Runtime 并发效率

### 5.8 实验8：Single-Runtime vs Multi-Runtime 可扩展性

### 5.9 实验9：Complete Task Trace（赛博士编排案例）
- 实验设置（攻击模拟）
- 结果分析

### 5.5 Case Study：赛博士编排场景
- 真实使用场景
- 效果展示

---

## 6. Related Work

### 6.1 Multi-Agent Frameworks
- LangChain, AutoGen, CrewAI 等对比

### 6.2 Container Orchestration
- Kubernetes, Docker Swarm 等

### 6.3 Serverless Computing
- FaaS 平台

---

## 7. Conclusion & Future Work

### 7.1 总结
- 主要贡献回顾

### 7.2 Future Work
- 智能体迁移
- 跨集群编排
- 更多 Skill 生态

---

## 附录（待定）

- A. API Reference
- B. 系统架构图
- C. 实验详细数据
