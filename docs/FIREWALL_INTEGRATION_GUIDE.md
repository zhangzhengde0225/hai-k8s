# 防火墙功能前端集成指南

## 概述

OpenClaw 现在支持配置防火墙，默认启用并使用 DROP 策略以提高安全性。

## 后端 API 变更

### 1. 保存配置 API 新增字段

**POST/PUT** `/api/applications/{app_id}/config`

请求体新增字段：

```typescript
interface SaveConfigRequest {
  // ... 其他字段 ...

  // 防火墙配置（新增）
  enable_firewall?: boolean;        // 是否启用防火墙，默认: true
  firewall_rules?: FirewallRule[];  // 防火墙规则列表
  firewall_default_policy?: string; // 默认策略，默认: "DROP"
}

interface FirewallRule {
  port: number | string;     // 端口号或端口范围 (如 "8000:8100")
  protocol?: string;         // 协议: tcp/udp，默认: "tcp"
  source?: string;           // 源IP地址段，默认: "0.0.0.0/0"
  action?: string;           // 动作: allow/deny/reject，默认: "allow"
}
```

### 2. 获取配置 API 返回字段

**GET** `/api/applications/{app_id}/config`

响应体新增字段：

```typescript
interface ApplicationConfig {
  // ... 其他字段 ...

  // 防火墙配置（新增）
  enable_firewall: boolean;
  firewall_rules: FirewallRule[] | null;
  firewall_default_policy: string;
}
```

## 前端实现建议

### 1. 在 AppConfigForm.tsx 中添加状态

```typescript
// 在组件中添加防火墙状态
const [enableFirewall, setEnableFirewall] = useState(true);  // 默认启用
const [firewallRules, setFirewallRules] = useState<FirewallRule[]>([
  { port: 22, protocol: 'tcp', source: '0.0.0.0/0', action: 'allow' } // 默认允许 SSH
]);
const [firewallDefaultPolicy, setFirewallDefaultPolicy] = useState('DROP'); // 默认 DROP
```

### 2. 加载现有配置

```typescript
useEffect(() => {
  // ... 现有代码 ...

  if (application.config) {
    const config = application.config;

    // 加载防火墙配置
    if (config.enable_firewall !== undefined) {
      setEnableFirewall(config.enable_firewall);
    }
    if (config.firewall_rules && config.firewall_rules.length > 0) {
      setFirewallRules(config.firewall_rules);
    }
    if (config.firewall_default_policy) {
      setFirewallDefaultPolicy(config.firewall_default_policy);
    }
  }
}, [application.config]);
```

### 3. 提交配置时包含防火墙设置

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  await onSaveConfig({
    // ... 其他字段 ...

    // 防火墙配置
    enableFirewall,
    firewallRules: enableFirewall ? firewallRules : null,
    firewallDefaultPolicy,
  });
};
```

### 4. 添加防火墙配置 UI (可选)

在 AppConfigForm 中添加一个新的配置区块：

```tsx
{/* Section: Firewall Config */}
<div className="bg-white dark:bg-slate-900 rounded-lg p-4 md:p-5 shadow-sm border border-gray-200 dark:border-slate-700">
  {/* 防火墙开关 */}
  <div className="flex items-center justify-between mb-3">
    <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
      防火墙配置
    </label>
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id="enableFirewall"
        checked={enableFirewall}
        onChange={(e) => setEnableFirewall(e.target.checked)}
        className="rounded border-gray-300 dark:border-slate-600"
      />
      <label htmlFor="enableFirewall" className="text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
        启用防火墙
      </label>
    </div>
  </div>

  {enableFirewall && (
    <>
      {/* 默认策略选择 */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-2">
          默认策略
        </label>
        <select
          value={firewallDefaultPolicy}
          onChange={(e) => setFirewallDefaultPolicy(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
        >
          <option value="DROP">DROP - 拒绝所有未明确允许的连接（推荐）</option>
          <option value="ACCEPT">ACCEPT - 允许所有未明确拒绝的连接</option>
        </select>
      </div>

      {/* 防火墙规则表格 */}
      <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[80px_80px_120px_80px_2rem] bg-gray-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-gray-600 dark:text-slate-400 gap-2">
          <span>端口</span>
          <span>协议</span>
          <span>源IP</span>
          <span>动作</span>
          <span />
        </div>

        {firewallRules.map((rule, index) => (
          <div key={index} className="grid grid-cols-[80px_80px_120px_80px_2rem] gap-2 px-3 py-2 border-t border-gray-200 dark:border-slate-700 items-center">
            <input
              type="text"
              value={rule.port}
              onChange={(e) => {
                const updated = [...firewallRules];
                updated[index] = { ...updated[index], port: e.target.value };
                setFirewallRules(updated);
              }}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded"
            />
            <select
              value={rule.protocol}
              onChange={(e) => {
                const updated = [...firewallRules];
                updated[index] = { ...updated[index], protocol: e.target.value };
                setFirewallRules(updated);
              }}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded"
            >
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
            </select>
            <input
              type="text"
              value={rule.source}
              onChange={(e) => {
                const updated = [...firewallRules];
                updated[index] = { ...updated[index], source: e.target.value };
                setFirewallRules(updated);
              }}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded"
            />
            <select
              value={rule.action}
              onChange={(e) => {
                const updated = [...firewallRules];
                updated[index] = { ...updated[index], action: e.target.value };
                setFirewallRules(updated);
              }}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded"
            >
              <option value="allow">允许</option>
              <option value="deny">拒绝</option>
            </select>
            <button
              type="button"
              onClick={() => setFirewallRules(firewallRules.filter((_, i) => i !== index))}
              className="flex items-center justify-center text-gray-400 hover:text-red-500"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* 添加规则按钮 */}
      <button
        type="button"
        onClick={() => setFirewallRules([...firewallRules, { port: 80, protocol: 'tcp', source: '0.0.0.0/0', action: 'allow' }])}
        className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        + 添加规则
      </button>
    </>
  )}
</div>
```

## 默认行为

1. **防火墙默认启用** - `enable_firewall: true`
2. **默认策略为 DROP** - 只有明确允许的端口才能访问
3. **默认规则** - 如果用户启用防火墙但未提供规则，系统自动添加 SSH (端口 22) 规则

## 常用防火墙规则模板

### Web 服务器
```typescript
const webServerRules = [
  { port: 22, protocol: 'tcp', action: 'allow' },   // SSH
  { port: 80, protocol: 'tcp', action: 'allow' },   // HTTP
  { port: 443, protocol: 'tcp', action: 'allow' },  // HTTPS
];
```

### 数据库服务器
```typescript
const dbServerRules = [
  { port: 22, protocol: 'tcp', action: 'allow' },                           // SSH
  { port: 3306, protocol: 'tcp', source: '10.5.8.0/24', action: 'allow' }, // MySQL (仅内网)
];
```

### 开发环境
```typescript
const devRules = [
  { port: 22, protocol: 'tcp', action: 'allow' },            // SSH
  { port: '8000:8100', protocol: 'tcp', action: 'allow' },   // 开发端口范围
];
```

## 类型定义文件

在 `frontend/src/types.ts` 中添加：

```typescript
export interface FirewallRule {
  port: number | string;
  protocol: string;
  source: string;
  action: string;
}

export interface SaveConfigData {
  // ... 现有字段 ...

  // 防火墙配置
  enableFirewall?: boolean;
  firewallRules?: FirewallRule[];
  firewallDefaultPolicy?: string;
}
```

## 数据库迁移

运行迁移脚本：

```bash
# 如果使用 PostgreSQL
psql -U your_user -d your_database -f haik8s/backend/db/migrations/add_firewall_fields.sql

# 或者使用 SQLite
sqlite3 your_database.db < haik8s/backend/db/migrations/add_firewall_fields.sql
```

## 测试示例

### 创建带防火墙的配置

```bash
curl -X POST http://localhost:8000/api/applications/openclaw/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "image_id": 1,
    "cpu_request": 2.0,
    "memory_request": 4.0,
    "gpu_request": 0,
    "ssh_enabled": true,
    "enable_firewall": true,
    "firewall_rules": [
      {
        "port": 22,
        "protocol": "tcp",
        "source": "0.0.0.0/0",
        "action": "allow"
      },
      {
        "port": 80,
        "protocol": "tcp",
        "source": "0.0.0.0/0",
        "action": "allow"
      }
    ],
    "firewall_default_policy": "DROP"
  }'
```

## 注意事项

⚠️ **重要提醒**：

1. **确保 SSH 端口开放** - 启用防火墙时，务必允许 SSH (22) 端口，否则无法远程连接
2. **测试环境验证** - 建议先在测试环境验证防火墙规则
3. **默认规则** - 如果不提供 firewall_rules，系统会自动添加 SSH 规则
4. **策略选择** - DROP 策略更安全，但需要明确允许所有需要的端口

## 故障排查

### 无法 SSH 连接
- 检查防火墙规则是否包含端口 22
- 验证防火墙是否误配置

### 应用无法访问
- 检查应用端口是否在防火墙规则中
- 验证协议类型（TCP/UDP）是否正确

---

更新时间: 2026-03-10
