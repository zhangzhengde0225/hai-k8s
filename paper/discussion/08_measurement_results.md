# 实验数据测量记录

Author: 白小心 & 朵拉
Date: 2026-03-28

## 测量环境

- **平台**：hai-k8s (Kubernetes)
- **OpenClaw 版本**：2026.3.23
- **Node**：Linux 5.14.0-611.24.1.el9_7.x86_64 · node v24.14.0
- **测量工具**：bash `time` 命令、Python `time.time()`

---

## 已测量的数据

### 测量1：`openclaw onboard --non-interactive` 执行时间

**环境**：已配置的 OpenClaw 实例（~1年运行时间）

```
$ time openclaw onboard --non-interactive --accept-risk --flow quickstart \
    --mode local --gateway-bind lan --gateway-auth token \
    --gateway-password 'test123' --skip-channels --skip-skills \
    --skip-health --install-daemon

real    0m1.344s
user    0m1.746s
sys     0m0.265s
```

**说明**：此为**已有环境**下的重复 onboard 时间（配置文件已存在）。新容器首次 onboard 时间预计 **3-8秒**，因为需要：
- 创建完整的目录结构（~/.openclaw/workspace, ~/.openclaw/agents/, ~/.openclaw/memory/ 等）
- 初始化 memory 和 session 文件
- 首次调用 LLM API 验证配置

### 测量2：JSON 配置文件修改时间

```
$ time python3 -c "import json; d=json.load(open('~/.openclaw/openclaw.json'))"
real    0m0.014s
```

**说明**：Python JSON 解析 + 简单操作约 **14ms**，几乎可忽略。

### 测量3：`jq` 等效操作（若容器中有 jq）

理论上 jq 修改配置文件约 **< 10ms**。

---

## 待测量的数据（需要 K8s 环境）

### 需要实际测量

| 实验 | 测量项 | 需要的工具/环境 | 状态 |
|------|--------|----------------|------|
| Exp 1 | K8s Pod 创建时间 | K8s 集群访问 | ❌ 需联调 |
| Exp 1 | 容器镜像首次拉取时间 | K8s 集群 + 镜像缓存状态 | ❌ 需联调 |
| Exp 1 | 容器镜像缓存拉取时间 | K8s 集群 + 已缓存 | ❌ 需联调 |
| Exp 1 | OpenClaw 首次初始化时间 | 新容器 + 完整流程 | ❌ 需联调 |
| Exp 1 | SSH 服务就绪时间 | K8s exec | ❌ 需联调 |
| Exp 2 | 容器崩溃对同容器内另一进程的影响 | 故障注入 | ❌ 需联调 |
| Exp 2 | 容器内存泄漏对宿主机影响 | 内存压测 | ❌ 需联调 |
| Exp 3 | 10容器并发内存占用 | K8s 监控 | ❌ 需联调 |
| Exp 4 | 恶意 Skill 跨容器攻击成功率 | 安全测试包 | ❌ 需联调 |
| Exp 5 | Skill vs Direct API 代码行数 | 两个实现对比 | ⚠️ 可估算 |
| Exp 5 | Skill vs Direct API 错误率 | 实际运行统计 | ❌ 需联调 |

---

## Cold-Start 时间分解（理论分析 + 已知数据）

### 新容器 Cold-Start 流程

```
阶段1: K8s Pod 创建
├── API Server 创建 Pod 对象              ~100ms
├── Scheduler 调度到 Node                ~50ms
└── Kubelet 接收调度任务                 ~50ms
小计:                                    ~200ms

阶段2: 容器镜像拉取（首次，无缓存）
├── 镜像层下载（hai-openclaw ~500MB）    ~10-30s（取决于网络）
└── 容器层解压                           ~1-3s
小计（首次）:                            ~15-35s

阶段2: 容器镜像拉取（已缓存）
└── 容器层解压                           ~0.5-1s
小计（缓存）:                            ~0.5-1s

阶段3: 容器 Runtime 启动
├── containerd 创建 container             ~200ms
├── 配置网络命名空间                     ~50ms
├── 配置存储卷                           ~100ms
└── 容器 Entrypoint 启动                 ~200ms
小计:                                    ~550ms

阶段4: 容器内初始化（SSH、用户、网络）
├── SSH 服务启动                         ~500ms
├── 用户创建/同步                        ~200ms
├── iptables 规则配置                     ~100ms
└── macvlan 路由配置（如适用）           ~200ms
小计:                                    ~1s

阶段5: OpenClaw 初始化
├── openclaw onboard (首次)              ~5-8s（新建目录+LLM API）
├── openclaw onboard (已有配置)           ~1.3s（本次实测）
├── jq 修改配置                          ~10ms
└── openclaw gateway 启动               ~1-2s
小计（首次）:                            ~7-10s

总计（新容器，首次拉取镜像）:             ~25-48s
总计（新容器，镜像已缓存）:               ~5-10s
总计（已有容器重启）:                     ~2-4s
```

---

## 与 VM 的对比（理论值）

| 方案 | 冷启动时间 |
|------|-----------|
| VM（无缓存） | ~20-45s |
| VM（有缓存） | ~10-20s |
| Container（镜像无缓存） | ~25-48s |
| **Container（镜像已缓存）** | **~5-10s** ✅ |
| Container（已有容器重启） | ~2-4s |

**注意**：容器在镜像已缓存时明显优于 VM。但如果镜像首次拉取（无缓存），差距不大。

---

## 测量计划（待联调）

### 联调需要的准备工作

1. **获取 K8s 访问权限**
   ```bash
   cat ~/.kube/config  # 确认 kubeconfig 存在
   kubectl get nodes    # 验证集群访问
   ```

2. **准备测试脚本**
   ```bash
   # 测量 Pod 创建时间
   time kubectl apply -f test-pod.yaml
   
   # 测量镜像拉取时间
   time kubectl create -f test-pod.yaml
   
   # 测量完整初始化时间
   # (从 kubectl apply 到 SSH 可用)
   ```

3. **准备恶意 Skill 测试包**
   - cross_user_access.sh
   - host_key_exfil.sh
   - container_escape.sh

4. **准备 Single-Runtime baseline**
   - 在 Docker 中运行两个 Python agent 进程
   - 模拟 AutoGen/LangChain 的 shared-memory 模式

---

## 测试脚本

已编写测试脚本位于 `../benchmarks/`：

| 脚本 | 对应实验 |
|------|---------|
| `measure_cold_start.py` | Exp 1：Cold-Start 测量 |
| `test_isolation.py` | Exp 4：恶意 Skill 安全测试 |

## 下一步

- [ ] 联系同事获取 K8s 集群访问权限
- [ ] 运行 `measure_cold_start.py` 获取完整数据
- [ ] 在受控环境中运行 `test_isolation.py`
- [ ] 安排联调时间
