# Skill 编排与多运行时架构讨论

Author: 白小心 & 朵拉
Date: 2026-03-28

## 核心问题：OpenClaw 能否调用 Claude Code？

### 答案：不能直接调用

**原因**：OpenClaw 的 Skills 是用来扩展自己的能力的，不是用来调用另一个 Agent Runtime 的。

```
OpenClaw Skills：
├── shell tool
├── file tool
├── browser tool
└── 用户安装的 Skills：xxx, yyy...
    └── 这些都是 OpenClaw 自己的工具，不是另一个 Agent Runtime
```

OpenClaw 和 Claude Code 是**对等体（Peers）**，不是主从关系：
- 各自独立运行
- 各自有自己的 memory、skills、tools
- 没有原生互操作机制

### 传统方案：Single-Runtime Multi-Agent

术语：
- **Monolithic Agent** — 单体智能体，一个 runtime 做所有事
- **Single-Runtime Multi-Agent** — 多 Agent 但共享同一 runtime（AutoGen/LangChain 方案）
- **In-Process Agent Coordination** — 进程内协调，Agent 之间通过函数调用通信
- **Shared-Memory Multi-Agent** — 共享内存/工具，多个 Agent 共享同一份工具注册表

```
┌─────────────────────────────┐
│  Python Process / Container │
│  Agent A ←→ Agent B         │
│  [共享 memory, 共享 tools]   │
└─────────────────────────────┘
特点：
- Agent A 和 Agent B 在同一进程/容器内
- 通过函数调用或消息传递通信
- 共享内存：一个崩溃可能影响另一个
- 共享工具注册表
```

### 我们的方案：Multi-Runtime Multi-Agent (HAI-K8S)

```
┌──────────────┐  ┌──────────────┐
│ Container A  │  │ Container B  │
│ OpenClaw     │  │ Claude Code  │
│ (Research)   │  │ (Coder)      │
└──────┬───────┘  └──────┬───────┘
       │                  │
       └────────┬─────────┘
                ▼
        ┌─────────────────┐
        │  Orchestrator   │
        │    (赛博士)     │
        └─────────────────┘
```

特点：
- 每个 Agent Runtime 在独立容器中
- 通过 Orchestrator 协调，不是直接互调
- 完全隔离：一个 Agent 崩溃不影响另一个
- 可以真正并行执行

---

## 术语定义（供论文使用）

| 术语 | 定义 |
|------|------|
| **Single-Runtime Multi-Agent** | 多个 Agent 共享同一个运行时（进程/容器），通过函数调用或消息传递通信 |
| **Multi-Runtime Multi-Agent** | 每个 Agent 运行在独立的运行时（独立容器）中，通过 Orchestrator 协调调度 |
| **Containerized Multi-Agent Orchestration** | 使用容器技术实现 Multi-Runtime 架构，每个容器运行一个 Agent Runtime |
| **Hierarchical Orchestration** | 两层架构：Orchestrator 负责任务分解和调度，Agent Runtime 负责具体执行 |

---

## 亮点：Skill 编排架构

### 核心创新

**Skill 不仅是工具扩展，更是"被调度的能力单元"**

传统方式：智能体通过 API 直接调用
```
Orchestrator → HTTP API → Agent B
问题：需要知道 Agent B 的所有 API 细节
```

我们的方式：Skill 作为标准化接口
```
Orchestrator → Skill("openclaw-manager") → 调度到 OpenClaw 容器执行
Orchestrator → Skill("claude-code") → 调度到 Claude Code 容器执行
优点：无需知道 Agent 的具体 API，只需知道 Skill 的接口
```

### Skill 的三个层次

1. **Tool Level**：OpenClaw 内置的 shell、file 等工具（现有 Skill 概念）
2. **Agent Level**：openclaw-manager、hai-k8s-container 等跨容器的 Skill
3. **Orchestrator Level**：赛博士通过 Skill 调用其他 Agent Runtime

### Orchestrator 调用 Skill 的流程

```
1. 赛博士解析用户任务
2. 分解为子任务 T1, T2, T3...
3. 对每个子任务，找到对应的 Skill
4. 赛博士通过 hai-k8s API 在目标容器中执行 Skill
5. 结果返回赛博士，聚合后返回用户
```

关键点：**调用 Skill 的智能体不需要和执行 Skill 的智能体在同一台机器上**。

---

## 实验设计：Single-Runtime vs Multi-Runtime

### 实验9：隔离性测试

**研究问题**：Single-Runtime vs Multi-Runtime 在隔离性上有何差异？

**场景**：
```
子任务A（Research）：调研量子计算最新进展
子任务B（Coding）：根据调研结果写一段 Python 代码
```

**对比方案**：
- A) Single-Runtime（AutoGen/LangChain 风格）
- B) Multi-Runtime（HAI-K8S 风格）

**测试项**：

| 测试 | 操作 | Single-Runtime 预期 | Multi-Runtime 预期 |
|------|------|--------------------|-------------------|
| T1 | Agent A 崩溃 | Agent B 也崩溃 ❌ | Agent B 继续运行 ✅ |
| T2 | Agent A 消耗大量内存 | Agent B 性能下降 ❌ | Agent B 不受影响 ✅ |
| T3 | Agent A 内存泄漏（长时间运行） | Agent B 受影响 ❌ | Agent B 不受影响 ✅ |

**测量指标**：
- Agent B 可用率（崩溃率）
- Agent B 响应延迟（内存压力下）
- 任务成功率

---

### 实验10：并发执行效率

**研究问题**：两个子任务能否真正并行执行？

**对比方案**：同实验9

**测试项**：

| 测试 | 操作 | 测量 |
|------|------|------|
| C1 | 两个子任务同时提交 | 实际完成时间 vs 串行完成时间 |
| C2 | 一个任务卡住/死循环 | 另一个任务是否受影响 |

**测量指标**：
- 并行效率 = 串行时间 / 并行时间（理想值 = 2x）
- 任务隔离率 = 未受影响任务数 / 总任务数

---

### 实验11：可扩展性测试

**研究问题**：加入新的 Agent 类型时，需要多少改动？

**操作**：加入第三个 Agent 类型（例如：一个专门做数据可视化的 Agent）

**测量**：
- 代码改动行数
- 需要的时间
- 测试用例改动量

**预期**：
- Single-Runtime：需要修改主进程的 Agent 注册逻辑，改动大
- Multi-Runtime：只需注册新容器的 Skill 接口，改动小

---

### 实验12：Skill 调用 vs 直接 API 调用

**研究问题**：使用 Skill 抽象 vs 直接调 API，调用方开发效率差异？

| 对比维度 | Skill 调用 | 直接 API 调用 |
|---------|-----------|--------------|
| 调用方代码量 | 少（引用 Skill 即可） | 多（需要知道所有 API 细节） |
| 错误率 | 低（Skill 封装了错误处理） | 高（每个调用方自己处理） |
| 可发现性 | 高（Skill 有描述） | 低（需要文档或代码） |
| 跨智能体协作成功率 | ? | ? |

**测量方式**：
- 让两个测试智能体（一个有 Skill，一个直接调 API）完成相同的跨智能体任务
- 测量：完成时间、成功率、代码行数、错误率

---

## 完整任务 Trace 案例

用户任务："帮我调研量子计算并写一段代码"

```
[用户] → "调研量子计算并写代码"

[赛博士] 任务分解：
  ├── 子任务1：Research - 调研量子计算
  └── 子任务2：Coding - 写代码

[赛博士] 调用 Skill：
  ├── Skill("openclaw-manager").init_openclaw(container_id=123)
  │     → 在 OpenClaw 容器中执行调研
  │     → 返回：量子计算调研报告
  │
  └── Skill("claude-code").write_code(report)
        → 在 Claude Code 容器中执行
        → 返回：Python 代码

[赛博士] 结果聚合：
  → 返回：调研报告 + Python 代码 给用户
```

---

## 总结：论文核心亮点

基于上述讨论，提取以下核心亮点：

### 亮点1：Agent-as-Container 抽象
> "我们提出了 Agent-as-Container 的概念：每个 Agent Runtime 运行在独立的 K8s 容器中，实现了真正的隔离。"

### 亮点2：Multi-Runtime 架构
> "与 Single-Runtime Multi-Agent（AutoGen/LangChain）方案相比，Multi-Runtime 架构提供了更好的隔离性、真正的并行执行和更容易的可扩展性。"

### 亮点3：Hierarchical Orchestration
> "Orchestrator（赛博士）通过 Skill 接口调度 Agent，而不是 Agent 直接互调。这解决了不同 Agent Runtime 如何协作的问题。"

### 亮点4：Skill 作为标准化能力单元
> "Skill 不仅是工具扩展，更是跨容器调度的能力单元。Orchestrator 通过 Skill 调用其他 Agent，无需知道其内部 API 细节。"

### 亮点5：容器化安全隔离（回应 CNCERT）
> "容器化设计直接回应了 CNCERT 的安全建议：每个智能体在独立 Pod 中运行，恶意 Skill 无法横向扩散到其他用户的容器。"

---

## 下一步

- [ ] 完善各实验的具体实施细节
- [ ] 确定 Single-Runtime 实验的 baseline 实现（AutoGen 或 LangChain）
- [ ] 设计具体的测量工具和日志格式
- [ ] 开始写作（建议从亮点1-3的架构设计开始）
