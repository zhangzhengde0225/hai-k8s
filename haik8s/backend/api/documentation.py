"""
Documentation API endpoints
提供文档章节列表和内容的API端点，支持中英双语
"""
from fastapi import APIRouter, HTTPException, Query
from pathlib import Path
from typing import List, Literal
from pydantic import BaseModel
import markdown

router = APIRouter(prefix="/api/docs", tags=["Documentation"])

# 文档目录路径
DOCS_DIR = Path(__file__).parent.parent / "docs" / "api"


class DocSection(BaseModel):
    """文档章节元数据"""
    id: str
    title: str
    order: int


class DocContent(BaseModel):
    """文档内容（包含Markdown和HTML）"""
    id: str
    title: str
    content: str  # Markdown原始内容
    html: str  # 渲染后的HTML
    language: str


@router.get("/sections", response_model=List[DocSection])
async def list_doc_sections(
    lang: Literal["zh", "en"] = Query(default="zh", description="文档语言（zh或en）")
):
    """
    列出所有文档章节

    返回指定语言的所有可用文档章节列表，按order排序。

    ## 查询参数

    - **lang**: 文档语言，zh（中文）或en（英文），默认zh

    ## 返回内容

    章节列表，每个章节包含：
    - **id**: 章节ID（如"getting-started"）
    - **title**: 章节标题
    - **order**: 显示顺序

    ## 使用示例

    ```bash
    curl http://localhost:42900/api/docs/sections?lang=zh
    ```
    """
    lang_dir = DOCS_DIR / lang
    if not lang_dir.exists():
        raise HTTPException(status_code=404, detail=f"Language '{lang}' not supported")

    sections = []
    for md_file in sorted(lang_dir.glob("*.md")):
        # 解析文件名格式："01-getting-started.md" -> order=1, id="getting-started"
        filename = md_file.stem
        try:
            order_str, id_part = filename.split("-", 1)
            order = int(order_str)
            # 从文件读取第一行作为标题（假设第一行是 # Title）
            first_line = md_file.read_text(encoding='utf-8').split("\n")[0]
            title = first_line.replace("# ", "").strip() if first_line.startswith("# ") else id_part.replace("-", " ").title()

            sections.append(DocSection(
                id=id_part,
                title=title,
                order=order
            ))
        except (ValueError, IndexError):
            # 跳过格式不正确的文件
            continue

    return sorted(sections, key=lambda x: x.order)


@router.get("/sections/{section_id}", response_model=DocContent)
async def get_doc_section(
    section_id: str,
    lang: Literal["zh", "en"] = Query(default="zh", description="文档语言（zh或en）")
):
    """
    获取文档章节内容

    返回指定章节的Markdown原始内容和渲染后的HTML。

    ## 路径参数

    - **section_id**: 章节ID（如"getting-started"）

    ## 查询参数

    - **lang**: 文档语言，zh（中文）或en（英文），默认zh

    ## 返回内容

    - **id**: 章节ID
    - **title**: 章节标题（从第一行解析）
    - **content**: Markdown原始内容
    - **html**: 渲染后的HTML内容
    - **language**: 文档语言

    ## 错误处理

    - **404**: 章节不存在或语言不支持

    ## 使用示例

    ```bash
    curl http://localhost:42900/api/docs/sections/getting-started?lang=zh
    ```
    """
    lang_dir = DOCS_DIR / lang

    # 查找匹配 "*-{section_id}.md" 的文件
    matches = list(lang_dir.glob(f"*-{section_id}.md"))
    if not matches:
        raise HTTPException(status_code=404, detail="Section not found")

    md_file = matches[0]
    md_content = md_file.read_text(encoding='utf-8')

    # 从第一行解析标题
    first_line = md_content.split("\n")[0]
    title = first_line.replace("# ", "").strip() if first_line.startswith("# ") else section_id

    # 渲染为HTML
    html_content = markdown.markdown(
        md_content,
        extensions=['fenced_code', 'codehilite', 'tables', 'toc']
    )

    return DocContent(
        id=section_id,
        title=title,
        content=md_content,
        html=html_content,
        language=lang
    )
