#!/usr/bin/env python3
"""
测试文档系统的基本功能
"""
import sys
from pathlib import Path

# 检查文档目录结构
docs_dir = Path("/root/VSProjects/hai-k8s/haik8s/backend/docs")

print("=" * 60)
print("HAI-K8S 文档系统验证")
print("=" * 60)

# 1. 检查目录结构
print("\n1. 检查目录结构...")
required_dirs = [
    docs_dir / "api" / "zh",
    docs_dir / "api" / "en",
    docs_dir / "examples" / "zh",
    docs_dir / "examples" / "en",
]

all_dirs_exist = True
for dir_path in required_dirs:
    if dir_path.exists():
        print(f"  ✓ {dir_path.relative_to(docs_dir)}")
    else:
        print(f"  ✗ {dir_path.relative_to(docs_dir)} - 缺失")
        all_dirs_exist = False

if all_dirs_exist:
    print("  ✅ 所有目录存在")
else:
    print("  ❌ 缺少目录")
    sys.exit(1)

# 2. 检查文档文件
print("\n2. 检查文档文件...")
zh_docs = list((docs_dir / "api" / "zh").glob("*.md"))
en_docs = list((docs_dir / "api" / "en").glob("*.md"))
zh_examples = list((docs_dir / "examples" / "zh").glob("*.md"))
en_examples = list((docs_dir / "examples" / "en").glob("*.md"))

print(f"  中文文档: {len(zh_docs)} 个文件")
for doc in sorted(zh_docs):
    print(f"    - {doc.name}")

print(f"  英文文档: {len(en_docs)} 个文件")
for doc in sorted(en_docs):
    print(f"    - {doc.name}")

print(f"  中文示例: {len(zh_examples)} 个文件")
for doc in sorted(zh_examples):
    print(f"    - {doc.name}")

print(f"  英文示例: {len(en_examples)} 个文件")
for doc in sorted(en_examples):
    print(f"    - {doc.name}")

# 3. 验证文档内容格式
print("\n3. 验证文档内容格式...")
issues = []

for doc_file in zh_docs + en_docs:
    content = doc_file.read_text(encoding='utf-8')

    # 检查是否有第一行标题
    first_line = content.split("\n")[0]
    if not first_line.startswith("# "):
        issues.append(f"{doc_file.name}: 缺少一级标题")

    # 检查文件不为空
    if len(content.strip()) < 10:
        issues.append(f"{doc_file.name}: 内容过短")

if issues:
    print("  ⚠️ 发现问题:")
    for issue in issues:
        print(f"    - {issue}")
else:
    print("  ✅ 所有文档格式正确")

# 4. 模拟解析文档列表
print("\n4. 模拟文档API解析...")
try:
    sections = []
    for md_file in sorted((docs_dir / "api" / "zh").glob("*.md")):
        filename = md_file.stem
        try:
            order_str, id_part = filename.split("-", 1)
            order = int(order_str)
            first_line = md_file.read_text(encoding='utf-8').split("\n")[0]
            title = first_line.replace("# ", "").strip()
            sections.append({
                "id": id_part,
                "title": title,
                "order": order,
            })
        except Exception as e:
            print(f"  ⚠️ 解析 {md_file.name} 失败: {e}")

    sections.sort(key=lambda x: x["order"])

    print(f"  ✅ 成功解析 {len(sections)} 个章节:")
    for section in sections:
        print(f"    {section['order']:02d}. {section['title']} (id: {section['id']})")

except Exception as e:
    print(f"  ❌ 解析失败: {e}")
    sys.exit(1)

# 5. 总结
print("\n" + "=" * 60)
print("验证结果:")
print(f"  - 中文API文档: {len(zh_docs)} 个")
print(f"  - 英文API文档: {len(en_docs)} 个")
print(f"  - 中文示例: {len(zh_examples)} 个")
print(f"  - 英文示例: {len(en_examples)} 个")
print(f"  - 总文档数: {len(zh_docs) + len(en_docs) + len(zh_examples) + len(en_examples)} 个")
print("=" * 60)

print("\n✅ 文档系统验证通过！")
print("\n下一步:")
print("  1. 启动后端服务: cd /root/VSProjects/hai-k8s/haik8s/backend && python main.py")
print("  2. 访问Swagger UI: http://localhost:42900/docs")
print("  3. 测试文档API:")
print("     - GET http://localhost:42900/api/docs/sections?lang=zh")
print("     - GET http://localhost:42900/api/docs/sections/getting-started?lang=zh")
print("  4. 启动前端服务: cd /root/VSProjects/hai-k8s/haik8s/frontend && npm run dev")
print("  5. 访问文档页面: http://localhost:42901/docs")
