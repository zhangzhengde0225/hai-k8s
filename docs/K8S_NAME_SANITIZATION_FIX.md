# Kubernetes 命名规范修复

## 问题描述

创建容器时报错：
```
Namespace "haik8s-zdzhang@ihep.ac.cn" is invalid
```

**原因：** 用户名包含 `@` 和 `.` 等特殊字符，不符合 Kubernetes RFC 1123 标签规范。

## 修复内容

### 修改文件
`haik8s/backend/api/containers.py`

### 核心修复

添加了 `_sanitize_k8s_name()` 函数，用于清理用户名中的特殊字符：

```python
def _sanitize_k8s_name(name: str) -> str:
    """
    将字符串转换为 Kubernetes 兼容格式 (RFC 1123 label)

    规则:
    - 只能包含小写字母、数字和连字符 '-'
    - 必须以字母或数字开始和结束
    - 最大 63 字符
    """
```

### 处理逻辑

1. **提取邮箱用户名**：如果包含 `@`，只取前面部分
   - `zdzhang@ihep.ac.cn` → `zdzhang`

2. **转换为小写**
   - `User-Name` → `user-name`

3. **替换特殊字符为连字符**
   - `user.name` → `user-name`
   - `user_123` → `user-123`

4. **清理多余连字符**
   - `user--name` → `user-name`

5. **确保格式正确**
   - 以字母或数字开始和结束
   - 空字符串使用默认值 `user`

6. **长度限制**
   - 截断到 63 字符（包含前缀）

## 应用位置

1. **命名空间名称**
   ```python
   namespace = _make_namespace(current_user.username)
   # haik8s-zdzhang
   ```

2. **Pod 名称**
   ```python
   sanitized_username = _sanitize_k8s_name(current_user.username)
   pod_name = f"{sanitized_username}-{req.name}"
   # zdzhang-hai-openclaw
   ```

## 测试结果

| 输入 | 输出 | 命名空间 |
|------|------|----------|
| `zdzhang@ihep.ac.cn` | `zdzhang` | `haik8s-zdzhang` |
| `user.name@domain.com` | `user-name` | `haik8s-user-name` |
| `user_123` | `user-123` | `haik8s-user-123` |
| `User-Name` | `user-name` | `haik8s-user-name` |
| `@invalid` | `user` | `haik8s-user` |
| 空字符串 | `user` | `haik8s-user` |

## 验证

所有生成的名称都符合 Kubernetes RFC 1123 规范：
- ✅ 只包含小写字母、数字和连字符
- ✅ 以字母或数字开始和结束
- ✅ 长度在 63 字符以内

## 影响范围

- ✅ 已修复命名空间创建
- ✅ 已修复 Pod 名称生成
- ✅ Service 名称自动继承 Pod 名称，无需额外修复
- ✅ 向后兼容：原本符合规范的用户名不受影响

## 使用说明

用户无需任何操作，系统会自动处理：
1. 登录系统（用户名可以是邮箱）
2. 创建容器
3. 系统自动清理用户名，生成合法的 Kubernetes 资源名称

---

**修复时间**: 2026-02-11
**状态**: ✅ 已修复并测试通过
