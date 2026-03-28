# Orchestrating Multi-Agent Collaboration through Containerized Agent Runtime

**Authors**: 白小心, 朵拉

**Abstract**

Large Language Model (LLM) based agents are evolving from single-task systems to multi-agent collaborative frameworks. However, existing multi-agent systems typically operate within a single runtime (Single-Runtime Multi-Agent), where all agents share memory, tools, and process space. This architecture suffers from poor isolation, limited scalability, and security vulnerabilities.

We present a containerized agent platform that introduces two key innovations. First, we propose **Agent-as-Container**: each agent runtime runs in an isolated Kubernetes pod, enabling true isolation, parallel execution, and independent scaling. Second, we design **Hierarchical Orchestration**: an orchestrator agent coordinates specialized agent runtimes through a standardized **Skill** interface, without requiring agents to directly invoke each other.

Our implementation demonstrates that the containerized approach provides **significantly faster cold-start** compared to VM-based solutions, **complete fault isolation** (one agent's crash does not affect others), and **natural security boundaries** aligned with CERT/CNCERT recommendations for agent safety. Experiments show that the Multi-Runtime architecture achieves higher task success rates compared to Single-Runtime approaches, while the Skill-based orchestration substantially reduces cross-agent integration complexity.

---

## 1. Introduction

### 1.1 Background

Recent advances in Large Language Models (LLMs) have enabled a new generation of autonomous agents capable of reasoning, planning, and executing tasks with minimal human intervention. As these agents become more capable, the research community and industry have moved from single-agent systems to multi-agent collaborative frameworks, where multiple specialized agents work together to solve complex tasks.

Multi-agent collaboration typically follows one of two patterns. In the first pattern, a **monolithic agent** handles all tasks internally using tools and memory. In the second pattern, a **multi-agent system** decomposes a complex task into subtasks, assigning each to a specialized agent that focuses on a narrow domain.

However, a critical architectural question arises: how should multiple agent runtimes be organized and coordinated? Current frameworks, including AutoGen [Microsoft], LangChain Agents, CrewAI, MetaGPT, and ChatDev, predominantly adopt a **Single-Runtime Multi-Agent** architecture, where all agents share the same process space, memory, and tool registry.

### 1.2 Problem Statement

The Single-Runtime Multi-Agent architecture, while simple to implement, introduces fundamental limitations:

**Isolation Problem**: Since all agents share memory and process space, a bug or crash in one agent can cascade to others. Memory leaks in one agent gradually degrade the performance of all agents in the same runtime.

**Scalability Problem**: Adding a new agent type requires modifying the main process code, as all agents must be registered in the same tool registry and share the same execution context.

**Security Problem**: In March 2026, CNCERT (National Internet Emergency Response Center of China) and the China Cyberspace Security Association issued a joint security advisory on OpenClaw [CCTV News, 2026-03-10; CERT/CC, 2026-03-23]. The advisory identified four major security risks: prompt injection attacks, misoperation hazards, malicious skills (plugins) that can exfiltrate keys or deploy backdoors, and unpatched vulnerabilities. The advisory explicitly recommended **container-based isolation** as a primary mitigation strategy: "使用容器等技术限制OpenClaw权限过高问题" (use containers and other technologies to restrict OpenClaw's excessive permissions).

**Interoperability Problem**: Different agent runtimes (e.g., OpenClaw, Claude Code) have no native mechanism to coordinate with each other, as each defines its own tool and skill interfaces.

### 1.3 Contributions

This paper makes the following contributions:

1. **Agent-as-Container Abstraction**: We propose treating each agent runtime as an isolated container, with the container platform managing the lifecycle of each agent independently.

2. **Multi-Runtime Multi-Agent Architecture**: We design and implement a hierarchical architecture where an Orchestrator agent coordinates multiple specialized agent runtimes, each running in its own container.

3. **Skill as a First-Class Abstraction**: We introduce Skill as a standardized capability unit that allows an Orchestrator to invoke any agent runtime without knowledge of its internal APIs.

4. **Production-Grade Implementation**: We implement and deploy a containerized agent platform serving researchers, with two production-ready Skills (hai-k8s-container and openclaw-manager).

5. **Security by Design**: The containerized architecture directly addresses the security concerns raised by CNCERT/CERT, providing hardware-level isolation between agent runtimes.

### 1.4 Paper Organization

The rest of this paper is organized as follows. Section 2 provides background and discusses related work. Section 3 presents the system design. Section 4 describes the implementation. Section 5 evaluates the system through experiments. Section 6 concludes with future directions.
