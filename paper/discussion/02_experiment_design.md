# 实验设计讨论

Author: 白小心 & 朵拉
Date: 2026-03-28

## 核心价值主张

HAI-K8S 的价值主张：**容器化让智能体管理更轻量、编排更灵活**

## 对比维度

| 维度 | 可能的对比方案 | 测量指标 |
|------|---------------|---------|
| 部署效率 | Container vs VM vs Bare-metal | Agent cold-start time |
| 资源开销 | Container vs VM | Memory/CPU overhead per agent |
| 多智能体协作 | Orchestrated vs Single monolithic agent | Task completion time, 准确率 |
| 隔离性 | Container vs Process-level | 攻击/干扰鲁棒性 |
| 管理效率 | HAI-K8S vs 手动管理 | Human effort, error rate |

## 三个核心实验

### 实验1：Cold Start 延迟（Deployment Efficiency）

**研究问题**：容器化部署是否比传统 VM/物理机更适合智能体快速启停？

**对比方案**：
- A) Container (HAI-K8S)
- B) VM (每智能体一个 VM)
- C) Bare-metal SSH 到物理机

**测量指标**：
- Agent cold-start time：从"启动命令"到"智能体可响应"的延迟
- 吞吐量：单位时间内能启动多少个智能体
- 资源消耗：启动过程消耗的 CPU/内存

**预期结果**：
- Container < VM < Physical
- 容器的优势在高频启停场景更明显

**意义**：证明容器化是智能体快速启停的最佳选择

---

### 实验2：多智能体协作效率（Orchestration Value）

**研究问题**：层次化编排（Orchestrator + 多个专业 Agent）是否优于单体智能体？

**场景**：复杂任务 —— "调研某个领域并写报告"

**对比方案**：
- A) 单体智能体（一个 agent 做所有事，如单个 OpenClaw）
- B) 赛博士编排（Orchestrator 分配给 OpenClaw + Claude Code 等多个专业智能体）

**测量指标**：
- 完成时间
- 任务质量（人工评估 or 自动评估）
- Token 消耗
- 错误率/重试次数

**预期结果**：
- 编排方案在复杂任务上质量更高、时间更短
- 单体方案在简单任务上 overhead 更大

**意义**：证明层次化编排优于单体智能体

---

### 实验3：资源利用率（System Efficiency）

**研究问题**：容器化 vs VM 在多智能体场景下的资源效率差异？

**场景**：同时跑 10 个智能体任务

**对比方案**：
- A) Container 方案（HAI-K8S）
- B) VM 方案（每个任务一个 VM）

**测量指标**：
- 总内存占用
- 总 CPU 占用
- 任务吞吐量（单位时间完成的任务数）
- 成本效率（每单位资源的任务处理量）

**预期结果**：
- Container 在资源效率上显著优于 VM
- VM overhead 明显

**意义**：证明容器化在资源效率上的优势

---

## 可选实验

### 实验4：Skill 框架有效性

**研究问题**：Skill 框架是否提高了智能体执行初始化任务的成功率？

**对比方案**：
- A) 有 Skill 框架（hai-k8s-container + openclaw-manager）
- B) 无 Skill 框架（纯 API 调用）

**测量指标**：
- 初始化成功率
- 初始化时间
- 错误恢复能力

---

## 待补充信息

需要实际测量：
1. 现有 OpenClaw 容器的 cold-start 时间（从创建到可用的时间）
2. 当前 hai-k8s 环境中的用户数量和使用场景
3. 是否有真实的多智能体协作案例可以拿出来展示

## TODO

- [ ] 调研相关论文（见 03_related_work.md）
- [ ] 测量 cold-start baseline 数据
- [ ] 设计具体的多智能体测试任务
- [ ] 确定评估指标的具体计算方法
- [ ] **新增**：分离测量 K8s Pod 创建时间 vs OpenClaw 初始化时间（验证"容器层只需 1-2 秒"）
- [ ] **新增**：测量 Skill 执行成功率 vs 纯 API 调用成功率
- [ ] **新增**：安全相关测量（见安全实验设计）
