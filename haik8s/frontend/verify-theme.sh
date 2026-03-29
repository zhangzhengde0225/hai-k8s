#!/bin/bash

echo "🔍 HAI-K8S 主题切换功能验证"
echo "================================"
echo ""

# Check if running in frontend directory
if [ ! -f "package.json" ]; then
  echo "❌ 错误: 请在 haik8s/frontend 目录下运行此脚本"
  exit 1
fi

echo "1️⃣ 检查关键文件..."

# Check themeStore
if [ -f "src/stores/themeStore.ts" ]; then
  echo "✅ themeStore.ts 存在"
else
  echo "❌ themeStore.ts 不存在"
fi

# Check index.css
if [ -f "src/index.css" ]; then
  if grep -q "@variant dark" src/index.css; then
    echo "✅ index.css 包含 dark mode 配置"
  else
    echo "⚠️  index.css 缺少 @variant dark 声明"
  fi
else
  echo "❌ index.css 不存在"
fi

# Check index.html
if [ -f "index.html" ]; then
  if grep -q "classList.add(theme)" index.html; then
    echo "✅ index.html 包含主题初始化脚本"
  else
    echo "⚠️  index.html 缺少主题初始化脚本"
  fi
else
  echo "❌ index.html 不存在"
fi

echo ""
echo "2️⃣ 检查依赖..."

if npm list react-i18next >/dev/null 2>&1; then
  echo "✅ react-i18next 已安装"
else
  echo "❌ react-i18next 未安装"
fi

if npm list i18next >/dev/null 2>&1; then
  echo "✅ i18next 已安装"
else
  echo "❌ i18next 未安装"
fi

echo ""
echo "3️⃣ 构建测试..."

# Try to build
if npm run build >/dev/null 2>&1; then
  echo "✅ 构建成功"
else
  echo "❌ 构建失败，请运行 npm run build 查看详情"
fi

echo ""
echo "================================"
echo "✨ 验证完成！"
echo ""
echo "📋 下一步操作："
echo "  1. 运行 npm run dev 启动开发服务器"
echo "  2. 打开浏览器访问显示的地址"
echo "  3. 登录后点击右上角的月亮/太阳图标切换主题"
echo "  4. 验证页面颜色立即变化"
echo "  5. 刷新页面，确认主题保持不变"
echo ""
echo "📖 详细测试指南: docs/theme-toggle-test-guide.md"
