# 7. Related Work

Our work sits at the intersection of multi-agent frameworks, container orchestration, and agent security. We discuss each area below.

## 7.1 Multi-Agent Collaboration Frameworks

The development of LLM-based agents has given rise to several multi-agent collaboration frameworks. These systems generally fall into two categories: **Single-Runtime Multi-Agent** (all agents share the same process space) and **Distributed Multi-Agent** (agents run in separate processes or machines).

### 7.1.1 Single-Runtime Multi-Agent Frameworks

**AutoGen** [Microsoft, 2023] is a generic multi-agent conversation framework that enables agents to communicate through natural language messages. AutoGen supports customizable agents with role-based conversations and tool use. However, all agents in AutoGen typically run within the same Python process, sharing memory and execution context.

**LangChain Agents** [LangChain, 2023] provides a tool-augmented LLM agent framework with a modular architecture. It supports multi-agent orchestration through predefined agent types and a shared tool registry. Agents in LangChain are composed through chains and run within the same process by default, though LangGraph (its stateful orchestration extension) allows more flexible workflow definitions.

**CrewAI** [CrewAI, 2024] implements a role-based multi-agent system where agents are assigned specific roles (e.g., researcher, coder, reviewer) and collaborate through task decomposition. CrewAI emphasizes collaborative AI agents with guardrails, memory, and observability, but operates within a single runtime context.

**MetaGPT** [Shanghai AI Lab, 2024] models multi-agent collaboration as a software development workflow. It introduces **Standardized Operating Procedures (SOPs)** encoded as prompt sequences, allowing agents with domain expertise to verify intermediate results and reduce errors. MetaGPT uses an assembly line paradigm to assign diverse roles to agents, breaking down complex tasks into subtasks. While innovative in its workflow modeling, MetaGPT operates within a shared runtime environment.

**ChatDev** [THU, 2024] simulates a virtual software company where multiple agents play roles throughout the software development lifecycle, from requirements analysis to testing. ChatDev demonstrates emergent behaviors in agent communication but similarly runs all agents within a single process.

These frameworks share a common characteristic: they operate in **Single-Runtime** mode where all participating agents share the same process space, memory, and execution context. Notably, none of these frameworks natively support coordinating with **standalone agent runtimes** like OpenClaw or Claude Code that operate as independent processes.

### 7.1.2 OpenClaw as a Standalone Agent Runtime

**OpenClaw** is a standalone autonomous AI agent that controls computers through natural language instructions. Unlike the frameworks above (which run all agents within a single process), an OpenClaw instance runs as an **independent process** with its own memory, tools, and Skills. This makes OpenClaw a distinct **agent runtime** (similar in nature to Claude Code), not merely a framework for building agents.

However, this independence also creates a **coordination problem**: there is no native mechanism for one OpenClaw instance to invoke another, or to be orchestrated by an external orchestrator. OpenClaw's primary mode of operation is standalone—deployed on a user's machine or VPS, accessible via its built-in Gateway web UI.

Our work addresses this gap: by containerizing OpenClaw and providing a Skill-based orchestration interface, we enable OpenClaw to participate in multi-agent collaboration while retaining its standalone runtime nature.

### 7.1.2 Distributed Multi-Agent Approaches

Some systems have explored distributing agents across process boundaries. **Microsoft Semantic Kernel** supports running skills in isolated processes, but coordination remains primarily in-process by default. **Ray** [Berkeley RISE Lab] provides a distributed execution framework for Python that could theoretically host multiple agents, but it is not designed specifically for LLM agent orchestration.

To the best of our knowledge, no prior work has systematically proposed **treating each agent runtime as an independent container** with Kubernetes-level resource management, lifecycle isolation, and orchestration through a standardized Skill interface.

## 7.2 Container Orchestration

**Kubernetes** (K8s) has become the de facto standard for container orchestration since Google open-sourced it in 2014 [Kubernetes, 2014]. Kubernetes provides a rich set of abstractions for managing containerized workloads:

- **Pod**: The smallest deployable unit, representing a group of containers that share network and storage
- **Namespace**: Provides resource isolation and access control between different teams or projects
- **Service**: Load-balances traffic to a set of pods
- **Deployment**: Manages the desired state of replicated pods
- **ConfigMap/Secret**: Manages configuration and sensitive data separately from application code
- **Resource Quotas**: Limits CPU, memory, and GPU allocation per namespace or pod

Kubernetes' proven isolation model (Linux namespaces, cgroups, network policies) makes it an ideal substrate for hosting heterogeneous agent runtimes. However, Kubernetes is a general-purpose container orchestrator and does not provide agent-specific abstractions such as Skills, initialization workflows, or lifecycle management tailored for LLM agents.

## 7.3 Agent Security

Security concerns for LLM-based agents have received increasing attention. In March 2026, the **National Internet Emergency Response Center of China (CNCERT)** and the **China Cyberspace Security Association** issued a joint advisory on security risks associated with OpenClaw-style agent systems [CCTV News, 2026; CERT/CC, 2026]. The advisory identified four major risk categories:

1. **Prompt Injection**: Hidden malicious instructions in web content that induce agents to exfiltrate system secrets
2. **Misoperation Hazards**: Agents misunderstanding user intent and deleting important data
3. **Skills Plugin Poisoning**: Malicious or tampered skills that can steal keys or deploy backdoors
4. **Unpatched Vulnerabilities**: Known medium and high severity vulnerabilities in agent frameworks

The advisory explicitly recommends **container-based isolation** as a primary mitigation: "使用 Docker/VM/容器等技术限制 OpenClaw 权限过高问题" (use Docker/VM/container technologies to restrict OpenClaw's excessive permissions), "每个用户使用独立环境" (each user operates in an independent environment), and "禁止或限制高危工具" (prohibit or restrict high-risk tools).

Our work directly addresses these recommendations by providing container-level isolation for each agent runtime, preventing a compromised or malicious skill from accessing resources outside its container boundary.

## 7.4 Agent Lifecycle and Skill Management

The concept of "Skill" as a reusable, composable unit of agent capability has been explored in several systems:

- **OpenClaw Skills**: File-based plugins that extend agent capabilities through tool definitions and handlers, installed per-agent
- **LangChain Tools**: Decorator-based tool definitions that agents can call at runtime
- **AutoGen Plugins**: Code-based extensions for agent capabilities

These existing Skill systems are **local** to their parent agent—they cannot be transparently invoked from a different process or container. Our Skill abstraction extends this by making Skills **transportable** and **orchestrator-callable** through a standardized API, enabling cross-container, cross-runtime agent coordination.

## 7.5 Gap Analysis

Based on the above review, we identify a clear gap in the literature:

> **There is no systematic approach to running multiple heterogeneous agent runtimes (e.g., OpenClaw, Claude Code) in isolated containers, coordinated by an Orchestrator through a standardized Skill interface, with security isolation directly addressing the threats identified by CERT/CNCERT.**

Existing multi-agent frameworks (AutoGen, LangChain, CrewAI, MetaGPT, ChatDev) assume homogeneous agents in a shared runtime—they cannot natively coordinate with standalone agent runtimes like OpenClaw or Claude Code. Container orchestration systems (Kubernetes) are not designed with agent-specific abstractions (Skills, initialization workflows, lifecycle management). Our work bridges this gap by proposing the **Agent-as-Container** abstraction and the **Multi-Runtime Multi-Agent** architecture, specifically designed for orchestrating heterogeneous standalone agent runtimes.
