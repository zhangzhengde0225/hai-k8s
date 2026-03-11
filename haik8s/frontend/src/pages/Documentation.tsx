import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Book, ExternalLink } from 'lucide-react';
import apiClient from '../api/client';

interface DocSection {
  id: string;
  title: string;
  order: number;
}

interface DocContent {
  id: string;
  title: string;
  content: string;
  html: string;
  language: string;
}

export default function Documentation() {
  const { t, i18n } = useTranslation();
  const [sections, setSections] = useState<DocSection[]>([]);
  const [activeSection, setActiveSection] = useState<string>('getting-started');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取文档语言（根据i18n语言）
  const docLanguage = i18n.language.startsWith('zh') ? 'zh' : 'en';

  // 加载章节列表
  useEffect(() => {
    fetchSections();
  }, [docLanguage]);

  // 加载选中章节内容
  useEffect(() => {
    if (activeSection) {
      fetchContent(activeSection);
    }
  }, [activeSection, docLanguage]);

  const fetchSections = async () => {
    try {
      const response = await apiClient.get('/docs/sections', {
        params: { lang: docLanguage }
      });
      setSections(response.data);
    } catch (error) {
      console.error('Failed to load sections:', error);
      setError('加载章节列表失败');
    }
  };

  const fetchContent = async (sectionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/docs/sections/${sectionId}`, {
        params: { lang: docLanguage }
      });
      const data: DocContent = response.data;
      setContent(data.html);
    } catch (error) {
      console.error('Failed to load content:', error);
      setContent('<p class="text-red-500">加载文档失败</p>');
      setError('加载文档内容失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* 左侧导航 */}
      <div className="w-64 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Book size={20} className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('apiDocs')}
            </h2>
          </div>

          {error && (
            <div className="mb-4 p-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-sm rounded">
              {error}
            </div>
          )}

          <nav className="space-y-1">
            {sections.length === 0 && !error ? (
              <div className="text-sm text-gray-500 dark:text-slate-400">
                加载中...
              </div>
            ) : (
              sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {section.title}
                </button>
              ))
            )}
          </nav>
        </div>

        {/* 快速链接 */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            快速链接
          </h3>
          <ul className="space-y-2">
            <li>
              <a
                href="/docs"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                Swagger UI
                <ExternalLink size={14} />
              </a>
            </li>
            <li>
              <a
                href="/openapi.json"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                OpenAPI Spec
                <ExternalLink size={14} />
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-800">
        <div className="max-w-4xl mx-auto p-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-slate-400">加载中...</p>
            </div>
          ) : (
            <div
              className="prose prose-slate dark:prose-invert max-w-none
                prose-headings:text-gray-900 dark:prose-headings:text-white
                prose-p:text-gray-700 dark:prose-p:text-slate-300
                prose-a:text-blue-600 dark:prose-a:text-blue-400
                prose-code:text-pink-600 dark:prose-code:text-pink-400
                prose-code:bg-gray-100 dark:prose-code:bg-slate-900
                prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                prose-pre:bg-gray-900 dark:prose-pre:bg-slate-950
                prose-pre:text-gray-100
                prose-strong:text-gray-900 dark:prose-strong:text-white
                prose-table:text-gray-700 dark:prose-table:text-slate-300
                prose-th:bg-gray-100 dark:prose-th:bg-slate-900
                prose-td:border-gray-300 dark:prose-td:border-slate-700"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
