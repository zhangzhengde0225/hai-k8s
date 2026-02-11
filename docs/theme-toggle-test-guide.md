# 主题切换功能测试指南

## 问题修复

已修复深浅模式切换问题：

### 修改内容

1. **themeStore.ts** - 修复了类名切换逻辑
   - 从 `classList.toggle('dark')` 改为显式的 `remove + add`
   - 确保同时只有一个主题类（`light` 或 `dark`）

2. **index.css** - 添加 Tailwind v4 dark mode 配置
   - 添加 `@variant dark (&:where(.dark, .dark *));` 声明
   - 启用基于 class 的 dark mode

3. **index.html** - 修复初始化脚本
   - 确保正确设置默认主题（light）
   - 显式移除旧类名再添加新类名

## 如何测试

### 1. 启动开发服务器

```bash
npm run dev
```

### 2. 打开浏览器

访问 `http://localhost:42902/`（或显示的端口）

### 3. 测试主题切换

#### 方法一：使用 UI 按钮
1. 登录后，查看右上角的主题切换按钮
2. 默认是浅色模式，显示月亮图标 🌙
3. 点击按钮切换到深色模式，图标变为太阳 ☀️
4. 再次点击切换回浅色模式

#### 方法二：使用浏览器控制台
打开浏览器开发者工具（F12），在 Console 中执行：

```javascript
// 查看当前主题
document.documentElement.classList.contains('dark')

// 查看 HTML 元素的所有类名
document.documentElement.className

// 查看 localStorage 中的主题设置
localStorage.getItem('theme')

// 手动切换到深色模式
document.documentElement.classList.remove('light', 'dark')
document.documentElement.classList.add('dark')

// 手动切换到浅色模式
document.documentElement.classList.remove('light', 'dark')
document.documentElement.classList.add('light')
```

### 4. 验证效果

#### 浅色模式特征：
- ✅ 背景：白色/浅灰色
- ✅ 文字：深灰色/黑色
- ✅ 卡片：白色背景
- ✅ Header：白色背景
- ✅ Sidebar：白色背景
- ✅ 主题按钮：月亮图标 🌙

#### 深色模式特征：
- ✅ 背景：深灰色/黑色
- ✅ 文字：白色/浅灰色
- ✅ 卡片：深灰色背景
- ✅ Header：深灰色背景
- ✅ Sidebar：深灰色背景
- ✅ 主题按钮：太阳图标 ☀️

### 5. 测试持久化

1. 切换到深色模式
2. 刷新页面（F5）
3. 验证页面仍然是深色模式
4. 切换回浅色模式
5. 刷新页面
6. 验证页面是浅色模式

### 6. 测试所有页面

访问以下页面，验证主题在所有页面都正常工作：

- [ ] 登录页 (`/login`)
- [ ] 仪表盘 (`/`)
- [ ] 我的容器列表
- [ ] 新建容器 (`/containers/new`)
- [ ] 容器详情 (`/containers/:id`)
- [ ] 用户管理 (`/admin/users`) - 需要管理员权限
- [ ] 镜像管理 (`/admin/images`) - 需要管理员权限
- [ ] 集群管理 (`/admin/cluster`) - 需要管理员权限

## 调试技巧

### 如果主题切换不工作：

1. **检查 HTML 元素类名**
   ```javascript
   console.log(document.documentElement.className)
   // 应该显示 "dark" 或 "light"
   ```

2. **检查 localStorage**
   ```javascript
   console.log(localStorage.getItem('theme'))
   // 应该是 "dark" 或 "light"
   ```

3. **强制清除并重新设置**
   ```javascript
   localStorage.removeItem('theme')
   location.reload()
   ```

4. **检查 Tailwind CSS 是否加载**
   - 打开开发者工具 → Elements
   - 查看 `<head>` 中是否有 Tailwind 样式表
   - 查看任意元素，确认 Tailwind 类生效

5. **检查控制台错误**
   - 打开 Console 标签
   - 查看是否有 JavaScript 错误

## 技术细节

### Tailwind v4 Dark Mode 配置

```css
/* src/index.css */
@import "tailwindcss";

@variant dark (&:where(.dark, .dark *));
```

这行代码告诉 Tailwind v4：
- 当 HTML 元素有 `dark` 类时
- 应用所有 `dark:` 前缀的样式

### 类名策略

- **浅色模式**：`<html class="light">`
- **深色模式**：`<html class="dark">`

### 样式应用示例

```jsx
<div className="bg-white dark:bg-gray-800">
  {/* 浅色模式：白色背景 */}
  {/* 深色模式：深灰色背景 */}
</div>
```

## 常见问题

### Q: 为什么需要同时设置 `light` 和 `dark` 类？
A: 为了明确当前主题状态，避免依赖浏览器默认行为。

### Q: 为什么使用 `remove + add` 而不是 `toggle`？
A: `toggle` 只能处理一个类名，而我们需要确保 `light` 和 `dark` 互斥。

### Q: 刷新页面后主题丢失？
A: 检查 `index.html` 中的初始化脚本是否正确执行。

### Q: 某些元素没有应用深色样式？
A: 检查该元素是否添加了 `dark:` 前缀的 Tailwind 类。

## 预期结果

✅ 主题切换立即生效
✅ 刷新页面后主题保持
✅ 所有页面都支持深浅模式
✅ 图标随主题变化
✅ 无闪烁（页面加载时）

---

**最后更新**: 2026-02-11
**状态**: ✅ 已修复
