# 论文讨论区

本目录用于记录论文写作过程中的讨论和思考。

## 文件说明

| 文件 | 内容 |
|------|------|
| `01_theme_and_contribution.md` | 论文主题、核心贡献点、论文标题方向 |
| `02_experiment_design.md` | 实验设计、对比方案、测量指标 |
| `03_related_work_research.md` | 相关论文调研方向和步骤（含 CNCERT 安全参考资料） |
| `04_paper_outline.md` | 论文大纲（章节结构，含安全章节） |
| `05_security_design.md` | 安全设计讨论（基于 CNCERT OpenClaw 风险提示） |
| `06_skill_orchestration.md` | Skill 编排与多运行时架构讨论（核心亮点） |
| `07_abstract_and_introduction.md` | 摘要与引言草稿 |
| `08_measurement_results.md` | 实验数据测量记录（含已测量和待测量数据） |

## 论文基本信息

- **第一作者**：白小心
- **目标会议**：AI + Systems 交叉方向
- **核心贡献**：HAI-K8S 系统实现 + 两个 Agent Skill
- **创新点**：容器化智能体 + 层次化编排架构

## 下一步

- [x] 完成相关论文调研
- [x] 测量 OpenClaw onboard 时间（~1.3s 已有环境）
- [x] 分析 cold-start 分解（理论 + 已知数据）
- [ ] **待联调**：获取 K8s 访问权限测量 Pod 创建、镜像拉取等
- [ ] **待联调**：容器隔离实验（恶意 Skill 攻击模拟）
- [ ] **待联调**：资源效率实验
- [ ] **待联调**：Skill vs Direct API 实验
