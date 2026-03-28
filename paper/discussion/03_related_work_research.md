# 相关论文调研

Author: 白小心 & 朵拉
Date: 2026-03-28

## 重要参考资料：CNCERT OpenClaw 安全风险提示

来源：
- 央视网：https://news.cctv.cn/2026/03/10/ARTIY2STX6ARYK3N4wCvUbf8260310.shtml
- 国家互联网应急中心 CNCERT：https://www.cert.org.cn/publish/main/11/2026/20260323113411436406469/20260323113411436406469_.html

### 四大安全风险

1. **提示词注入（Prompt Injection）**：攻击者在网页中构造隐藏恶意指令，诱导 OpenClaw 泄露系统密钥
2. **误操作风险**：OpenClaw 可能错误理解指令，删除重要数据
3. **Skills 插件投毒**：恶意或被篡改的 Skills 可窃取密钥、部署木马
4. **安全漏洞**：OpenClaw 已公开多个高中危漏洞

### CERT 建议的核心安全措施

| 对象 | 建议 |
|------|------|
| 普通用户 | 使用专用设备/VM/容器，做好环境隔离；最小权限运行 |
| 企业用户 | 权限管理、监控审计、高危操作二次确认 |
| 云服务商 | 做好认证隔离、每个用户独立 token、Skills 安全检测 |
| 技术开发者 | 启用 Docker/VM 隔离、工具沙箱、文件系统限制 |

### HAI-K8S 的安全价值

HAI-K8S 的容器化设计**直接回应了 CERT 的安全建议**：

- ✅ **容器隔离**（CERT 建议"用 Docker/容器隔离"）→ HAI-K8S 基于 K8s 容器，每个智能体跑在独立 Pod
- ✅ **两层认证**（Admin API Key + User JWT）→ 防止未授权调用
- ✅ **用户隔离**（每个用户独立 namespace）→ CERT 建议"每个用户独立隔离"
- ✅ **Skill 签名验证框架**（设计待实现）→ CERT 建议"Skills 需经过签名验证"
- ⚠️ **待加强**：Skill 来源验证、工具白名单、文件系统只读挂载

---

## 调研方向

### 方向1：Containerized Agents / Serverless Agents

搜索关键词：
- "containerized LLM agent"
- "serverless agent platform"
- "container-based multi-agent system"
- "function calling agent infrastructure"

需要回答：是否已有"把智能体放容器里"的论文？我们的创新点在哪里？

### 方向2：Multi-Agent Orchestration

搜索关键词：
- "multi-agent orchestration architecture"
- "hierarchical multi-agent collaboration"
- "agent coordination framework"
- "orchestrator agent design"

需要回答：Orchestrator-Agent 层次化架构是否有先例？我们的贡献是什么？

### 方向3：Agent Lifecycle Management

搜索关键词：
- "agent lifecycle management"
- "autonomous agent creation and termination"
- "agent migration and recovery"
- "long-running agent state management"

需要回答：智能体生命周期管理有哪些成熟方案？

### 方向4：Container Orchestration for AI

搜索关键词：
- "kubernetes for machine learning"
- "container orchestration for LLM serving"
- "k8s-based AI inference platform"

需要回答：现有的 K8s for AI 方案有哪些？我们的差异化在哪里？

## 候选论文类型

### 系统论文参考（学习格式）
- OSDI/SOSP/NSDI 系统论文（架构 + 实现 + 实验）
- MLSys 论文（ML Systems）
- EuroSys/ATC（Systems）

### AI Agent 论文参考
- AutoGen (Microsoft)
- LangChain
- CrewAI
- MetaGPT
- ChatDev

### 相关系统参考
- Ray (分布式计算)
- Kubernetes 官方论文
- Docker 相关论文

## 调研步骤

1. 使用 Google Scholar / Semantic Scholar / ArXiv 搜索关键词
2. 找到 5-10 篇最相关的论文精读
3. 总结每篇的核心贡献、局限性和我们的差异化
4. 写 Related Work 章节

## 搜索记录（待填充）

| 论文 | 来源 | 核心贡献 | 与我们的关系 | 备注 |
|------|------|---------|------------|------|
| | | | | |
| | | | | |

## 初步判断

（待调研后填写）

### 可能的创新点
1. 把"智能体当进程管"的抽象概念
2. 完整的容器化智能体生命周期管理
3. Skill 框架的标准化设计
4. Orchestrator-Agent 层次化在多智能体场景的应用

### 需要找到的 prior work
- 类似"把 agent 放 container" 的论文或系统
- "hierarchical multi-agent orchestration" 的先例
