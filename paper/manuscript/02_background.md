# 2. Background and Related Work

## 2.1 Multi-Agent Collaboration Systems

Multi-agent collaboration has emerged as a key paradigm for handling complex tasks that require diverse capabilities. Several frameworks have been proposed to facilitate coordination among multiple agents.

### 2.1.1 Single-Runtime Multi-Agent Frameworks

**AutoGen** [Microsoft, 2023] provides a generic multi-agent conversation framework where agents communicate through messages. It supports role-based conversations but typically runs all agents within the same Python process.

**LangChain Agents** [LangChain, 2023] offers a tool-augmented LLM agent framework with support for multi-agent orchestration through predefined agent types. Agents share a common tool registry within the same process.

**CrewAI** [CrewAI, 2024] implements a role-based multi-agent system where agents are assigned specific roles (e.g., researcher, coder) and collaborate through task decomposition. All agents operate within the same runtime context.

**MetaGPT** [Shanghai AI Lab, 2024] models multi-agent collaboration as a software development workflow, with agents playing roles like architect, engineer, and reviewer, communicating through a shared message pool.

**ChatDev** [THU, 2024] simulates a virtual software company with multiple agents playing roles in a software development process, from requirements analysis to testing.

These frameworks share a common characteristic: they operate in a **Single-Runtime** mode, where all participating agents share the same process space, memory, and execution context. While this simplifies implementation, it introduces the limitations discussed in Section 1.2.

### 2.1.2 OpenClaw as an Agent Runtime

**OpenClaw** is an open-source autonomous AI agent framework capable of executing tasks by controlling computers through natural language instructions. An OpenClaw instance is itself a complete agent runtime, providing:

- **Memory**: Persistent conversation history and context management
- **Built-in Tools**: Shell command execution, file operations, web browsing, and more
- **Skills System**: A plugin mechanism that extends agent capabilities through custom tool definitions
- **Gateway**: A Web UI and API server for agent interaction

OpenClaw runs as a standalone process, typically on a user's local machine, VPS, or container. However, in its standard deployment, OpenClaw instances are **standalone and isolated**—there is no native mechanism for one OpenClaw instance to coordinate with another, or with other agent runtimes (e.g., Claude Code).

### 2.1.3 Multi-Runtime Approaches

Some systems have explored running agents in separate processes or environments:

**Microsoft Semantic Kernel** supports running skills in isolated processes, but coordination remains primarily in-process.

**LangGraph** (LangChain's stateful orchestration) allows defining agent graphs with conditional edges, but agents still share the same runtime by default.

To the best of our knowledge, no prior work has systematically proposed **treating each agent runtime as an independent container** with Kubernetes-level resource management, lifecycle isolation, and orchestration through a standardized Skill interface.

## 2.2 Container Orchestration

### 2.2.1 Kubernetes

Kubernetes has become the de facto standard for container orchestration in cloud-native applications. Its core abstractions include:

- **Pod**: The smallest deployable unit, representing a group of containers that share network and storage
- **Namespace**: Provides resource isolation and access control between different teams or projects
- **Service**: Load-balances traffic to a set of pods
- **Deployment**: Manages the desired state of replicated pods
- **ConfigMap/Secret**: Manages configuration and sensitive data separately from application code

These primitives are well-suited for managing agent runtimes as infrastructure.

### 2.2.2 Container Security

Container security is a well-studied topic. Key mechanisms include:

- **Linux namespaces**: Provide process-level isolation (PID, network, mount, IPC, UTS, user)
- **cgroups**: Limit resource usage (CPU, memory, I/O)
- **seccomp**: Restrict system calls
- **AppArmor/SELinux**: Mandatory access control for processes
- **Network policies**: Restrict traffic between pods

CNCERT's 2026 advisory explicitly recommends container isolation as a mitigation for agent security risks, validating our architectural choice.

## 2.3 Agent Lifecycle Management

### 2.3.1 Agent Initialization

Agent initialization typically involves: loading configuration, setting up tools, establishing memory, and connecting to external services. In existing frameworks, this happens once when the process starts. Our containerized approach allows per-agent, on-demand initialization, enabling rapid provisioning and teardown.

### 2.3.2 Skill and Tool Management

The concept of "Skill" as a reusable, composable unit of agent capability has been explored in several systems:

- **OpenClaw Skills**: File-based plugins that extend the OpenClaw agent runtime's capabilities through tool definitions and handlers. OpenClaw's Skills are installed within an individual OpenClaw instance and are not designed for cross-runtime invocation.
- **LangChain Tools**: Decorator-based tool definitions that agents can call within the LangChain runtime
- **AutoGen Plugins**: Code-based extensions for agent capabilities within AutoGen

Our Skill abstraction extends this concept by making Skills **transportable** across containers and **orchestrator-callable** through a standardized API, enabling an external Orchestrator to invoke Skills inside any agent container.

## 2.4 Gap Analysis

Based on the above review, we identify a clear gap in the literature:

> **There is no systematic approach to running multiple heterogeneous agent runtimes (e.g., OpenClaw, Claude Code) in isolated containers, coordinated by an Orchestrator through a standardized Skill interface.**

Existing multi-agent frameworks (AutoGen, LangChain, CrewAI, MetaGPT, ChatDev) assume homogeneous agents in a shared runtime—they cannot natively coordinate with standalone agent runtimes like OpenClaw or Claude Code. Container orchestration systems (Kubernetes) are not designed with agent-specific abstractions (Skills, initialization, lifecycle) in mind. Our work bridges this gap by proposing the **Agent-as-Container** abstraction and the **Multi-Runtime Multi-Agent** architecture.
