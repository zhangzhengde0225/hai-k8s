# 3. System Design

## 3.1 Design Goals

Our design addresses five goals derived from the problems identified in Section 1.2:

1. **Strong Isolation**: Each agent runtime must be isolated from others; a failure in one must not affect others.
2. **Independent Scalability**: Agent runtimes should be independently scalable based on demand.
3. **Standardized Orchestration**: An Orchestrator should be able to coordinate heterogeneous agent runtimes without knowing their internal implementation.
4. **Security by Design**: The architecture should mitigate the security risks identified by CNCERT/CERT.
5. **Agent-Native Abstractions**: The platform should provide abstractions (Skills, lifecycle management) tailored for agents, not generic workloads.

## 3.2 Architecture Overview

We design a three-layer hierarchical architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator Layer                        │
│                  (e.g., 赛博士 / drsai)                    │
│    - Task decomposition and planning                        │
│    - Skill-based coordination                                │
│    - Result aggregation                                     │
└─────────────────────────────┬───────────────────────────────┘
                              │ Skill Interface
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Agent Runtime Layer                        │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │   OpenClaw       │    │  Claude Code     │              │
│  │   Container      │    │  Container       │              │
│  │                  │    │                  │              │
│  │  - Memory        │    │  - Memory        │              │
│  │  - Skills        │    │  - Tools         │              │
│  │  - Tools         │    │                  │              │
│  └──────────────────┘    └──────────────────┘              │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │  Custom Agent    │    │  Future Agents   │              │
│  │  Container        │    │  ...             │              │
│  └──────────────────┘    └──────────────────┘              │
└─────────────────────────────┬───────────────────────────────┘
                              │ Container Management
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               Container Platform Layer                       │
│                    (Kubernetes)                             │
│    - Pod lifecycle management                               │
│    - Resource quotas and isolation                         │
│    - Network policies and security                         │
│    - Volume management                                     │
│    - GPU allocation                                        │
└─────────────────────────────────────────────────────────────┘
```

**Orchestrator Layer**: The Orchestrator is itself an agent responsible for task decomposition, planning, and coordinating specialized agent runtimes through a standardized Skill interface.

**Agent Runtime Layer**: Each agent runtime (OpenClaw, Claude Code, etc.) runs in its own container. Agents do not directly invoke each other; instead, they receive instructions from the Orchestrator and execute within their containerized environment.

**Container Platform Layer**: Kubernetes manages the lifecycle, scheduling, networking, and security of each agent container.

## 3.3 Layer Responsibilities

### 3.3.1 Orchestrator Layer

The Orchestrator performs high-level task coordination:

1. **Task Decomposition**: Breaks complex user requests into subtasks assignable to specialized agents.
2. **Skill Discovery**: Identifies which Skills are needed for each subtask.
3. **Execution Scheduling**: Invokes Skills in the appropriate agent containers.
4. **Result Aggregation**: Collects outputs from multiple agents and synthesizes a final response.

Critically, the Orchestrator does **not** execute tasks directly in its own context. Instead, it **dispatches** work to agent containers through Skills.

### 3.3.2 Agent Runtime Layer

Each agent container provides a complete agent runtime environment:

- **OpenClaw Container**: Provides an OpenClaw runtime with memory, built-in tools, and user-installed Skills
- **Claude Code Container**: Provides a Claude Code runtime in a separate container
- **Custom Agent Container**: Supports arbitrary agent runtimes with standardized lifecycle hooks

Agents in this layer are **specialized** and **stateless** regarding orchestration—they receive commands, execute them, and return results.

### 3.3.3 Container Platform Layer

The container platform (Kubernetes) provides:

- **Lifecycle Management**: Create, start, stop, restart, and delete agent containers on demand
- **Resource Isolation**: CPU, memory, GPU limits per container, preventing resource contention
- **Network Isolation**: Each container gets its own network namespace; inter-container traffic goes through defined policies
- **Namespace Isolation**: Each user gets a dedicated Kubernetes namespace, preventing cross-user access
- **Persistent Storage**: Volume mounts for agent memory and configuration persistence

## 3.4 Agent Lifecycle

Each agent instance follows a defined lifecycle:

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ CREATE  │───▶│INITIALIZE│───▶│ RUNNING │───▶│ STOPPED │───▶│ DELETE  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │               │
     ▼              ▼              ▼               ▼
  Allocate      Run startup    Execute       Cleanup
  resources     scripts       tasks         resources
```

1. **CREATE**: Kubernetes creates the Pod and container for the agent runtime. Resources (CPU, memory, GPU) are allocated per the agent's requirements.

2. **INITIALIZE**: Agent-specific initialization runs. For OpenClaw, this includes: non-interactive registration (onboard), security configuration, model configuration, and gateway startup. This phase is orchestrated through the **Skill** interface.

3. **RUNNING**: The agent is ready to receive and execute tasks from the Orchestrator.

4. **STOPPED**: The container is stopped but resources are retained (useful for debugging or state preservation).

5. **DELETE**: Resources are released and the container is destroyed.

## 3.5 Skill Framework

### 3.5.1 What is a Skill?

A **Skill** is a standardized capability unit that exposes an agent's functionality to the Orchestrator. It defines:

- **Name**: A unique identifier (e.g., `openclaw-manager`, `hai-k8s-container`)
- **Description**: Human- and machine-readable description of capabilities
- **Interface**: Input parameters and output format
- **Execution Endpoint**: Where and how the Skill is invoked

Unlike traditional tools (which are local extensions of an agent), Skills are **transportable**—they can be invoked from anywhere, as long as the Orchestrator can reach the agent container.

### 3.5.2 Skill Interface

Skills are invoked through a standardized API endpoint:

```
POST /api/skills/containers/{container_id}/exec
Headers:
  X-Admin-API-Key: <admin_key>
  Authorization: Bearer <user_jwt>
Body:
  {
    "command": "<skill-specific-command>",
    "timeout": <seconds>
  }
```

The Orchestrator uses two authentication factors:
1. **Admin API Key**: Validates that the caller is an authorized Orchestrator
2. **User JWT Token**: Validates that the caller has permission to operate on the target container (container ownership check)

This two-layer authentication ensures that Skills can only be invoked by authorized callers on containers owned by the authenticated user.

### 3.5.3 hai-k8s-container Skill

The `hai-k8s-container` Skill provides low-level container management:

| Function | Description |
|----------|-------------|
| `list_containers()` | List user's containers and their status |
| `get_container()` | Get detailed container information |
| `exec_in_container()` | Execute a command inside a running container |
| `delete_container()` | Stop and delete a container |

### 3.5.4 openclaw-manager Skill

The `openclaw-manager` Skill provides OpenClaw-specific operations:

| Function | Description |
|----------|-------------|
| `init_openclaw()` | Execute the full 4-step initialization (onboard, insecure-http, config-models, start-gateway) |
| `config_models()` | Configure model providers with API key replacement |
| `get_status()` | Check OpenClaw status (onboard, gateway, config) |

## 3.6 Dynamic Initialization

The initialization of an agent container is parameterized by **startup scripts** and **configuration templates** stored in the platform's database. This allows:

- **Administrators** to define standard initialization procedures for each agent type
- **Users** to customize initialization without modifying the container image
- **Orchestrators** to trigger initialization through the Skill interface

For OpenClaw, the initialization pipeline is:

1. **onboard**: Non-interactive registration with `openclaw onboard --non-interactive`
2. **enable_insecure_http**: Configure gateway to allow insecure authentication
3. **config_models**: Load model configuration template, replace `${HEPAI_API_KEY}` with user's key
4. **start_gateway**: Launch gateway on port 18789

## 3.7 Network Architecture

### 3.7.1 Intra-Container Communication

Each agent container has its own network namespace. External access to the container is provided through:

- **NodePort**: Exposes SSH (port 22) for direct container access
- **Gateway Port**: OpenClaw's gateway listens on port 18789, accessible through Kubernetes service or direct pod IP

### 3.7.2 Macvlan CNI for Direct IP Assignment

For agent containers requiring direct network access (bypassing Kubernetes' overlay network), we use **macvlan CNI**:

- Each container gets a dedicated IP address from the host network
- The container can be accessed directly at its assigned IP
- Routing policies ensure the container's traffic uses the dedicated IP as source

This is particularly useful for OpenClaw's gateway access, where the container needs a stable, predictable IP address.

### 3.7.3 Inter-Agent Communication

Agents do not communicate directly with each other. Instead:

- The Orchestrator dispatches work to each agent through the Skill interface
- Results are returned to the Orchestrator via the same interface
- The Orchestrator aggregates results and returns the final response to the user

This indirect communication pattern ensures clean separation of concerns and simplifies debugging and monitoring.

## 3.8 Security Model

Our security architecture addresses the threats identified by CNCERT/CERT:

### 3.8.1 Container Isolation

Each agent runs in an isolated Kubernetes Pod. A compromise of one agent's container does not automatically grant access to other agents' containers or the host system. This directly addresses the "Skills plugin poisoning" threat identified in the CNCERT advisory.

### 3.8.2 Two-Layer Authentication

Every Skill invocation requires:
1. **Admin API Key**: Proves the caller is an authorized Orchestrator
2. **User JWT**: Proves the caller has permission to operate on the target container

Without both factors, Skill invocation is rejected.

### 3.8.3 User Namespace Isolation

Each user operates within a dedicated Kubernetes namespace. Cross-namespace access is denied by default Kubernetes RBAC policies.

### 3.8.4 Capability Restrictions

Containers are configured with:
- Non-root user by default (overridable per configuration)
- Linux capabilities limited to the minimum required (e.g., `NET_ADMIN` only for containers needing network configuration)
- Read-only root filesystem where possible

### 3.8.5 Audit Logging

All Skill invocations and container exec operations are logged with user identity, timestamp, command, and result, enabling security auditing and forensics.

## 3.9 Comparison with Single-Runtime Architecture

Table 1 summarizes the key architectural differences between our Multi-Runtime approach and the Single-Runtime approach used by existing frameworks.

| Dimension | Single-Runtime (AutoGen/LangChain) | Multi-Runtime (Ours) |
|-----------|-----------------------------------|---------------------|
| Agent Isolation | Shared memory, one crash affects all | Separate containers, fault isolated |
| Concurrency | Pseudo-parallel (GIL), dependent on language runtime | True parallel (separate processes) |
| Scalability | Add agent = modify process code | Add container = register new Skill |
| Resource Control | Process-level limits only | Kubernetes-level resource quotas |
| Security Boundary | Process boundary | Container/K8s namespace boundary |
| Agent Heterogeneity | Limited (must share same runtime) | Unlimited (any container-based runtime) |
| Cold Start | Process fork (~100ms) | Pod creation + init (~5-15s) |
| Memory Leaks | Affects all agents in process | Contained within one container |
| Orchestration | Direct function calls or shared message queue | Standardized Skill API |
