import { useTranslation } from 'react-i18next';
import { FileText, Book, Code, ExternalLink } from 'lucide-react';

export default function Documentation() {
  const { t } = useTranslation();

  const docSections = [
    {
      title: '快速开始',
      description: '了解如何快速上手使用 HAI-K8S 平台',
      icon: <Book size={24} />,
      color: 'bg-blue-500',
      items: [
        { title: '平台介绍', link: '#intro' },
        { title: '创建第一个容器', link: '#first-container' },
        { title: '管理容器生命周期', link: '#lifecycle' },
      ],
    },
    {
      title: 'API 参考',
      description: 'REST API 接口文档和使用说明',
      icon: <Code size={24} />,
      color: 'bg-green-500',
      items: [
        { title: '认证与授权', link: '#auth' },
        { title: '容器 API', link: '#container-api' },
        { title: '镜像 API', link: '#image-api' },
        { title: '集群 API', link: '#cluster-api' },
      ],
    },
    {
      title: '最佳实践',
      description: '生产环境使用建议和优化技巧',
      icon: <FileText size={24} />,
      color: 'bg-purple-500',
      items: [
        { title: '资源配置指南', link: '#resource-config' },
        { title: '安全最佳实践', link: '#security' },
        { title: '性能优化', link: '#performance' },
        { title: '故障排查', link: '#troubleshooting' },
      ],
    },
  ];

  const apiEndpoints = [
    {
      method: 'GET',
      path: '/api/containers',
      description: '获取容器列表',
    },
    {
      method: 'POST',
      path: '/api/containers',
      description: '创建新容器',
    },
    {
      method: 'GET',
      path: '/api/containers/:id',
      description: '获取容器详情',
    },
    {
      method: 'DELETE',
      path: '/api/containers/:id',
      description: '删除容器',
    },
    {
      method: 'POST',
      path: '/api/containers/:id/start',
      description: '启动容器',
    },
    {
      method: 'POST',
      path: '/api/containers/:id/stop',
      description: '停止容器',
    },
  ];

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'POST':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'PUT':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'DELETE':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('apiDocs')}
        </h1>
        <p className="text-gray-600 dark:text-slate-400">
          完整的 API 文档和使用指南
        </p>
      </div>

      {/* Documentation Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {docSections.map((section) => (
          <div
            key={section.title}
            className="bg-white dark:bg-slate-900 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-lg ${section.color}`}>
                <div className="text-white">{section.icon}</div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {section.title}
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
              {section.description}
            </p>
            <ul className="space-y-2">
              {section.items.map((item) => (
                <li key={item.title}>
                  <a
                    href={item.link}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    {item.title}
                    <ExternalLink size={14} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* API Endpoints */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          API 端点
        </h2>
        <div className="space-y-3">
          {apiEndpoints.map((endpoint, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg"
            >
              <span className={`px-3 py-1 rounded-md text-xs font-semibold ${getMethodColor(endpoint.method)}`}>
                {endpoint.method}
              </span>
              <code className="flex-1 text-sm font-mono text-gray-900 dark:text-white">
                {endpoint.path}
              </code>
              <span className="text-sm text-gray-600 dark:text-slate-400">
                {endpoint.description}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Example Code */}
      <div className="mt-8 bg-white dark:bg-slate-900 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          示例代码
        </h2>
        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <pre className="text-sm text-gray-300">
            <code>{`// 获取容器列表
fetch('/api/containers', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => console.log(data));

// 创建新容器
fetch('/api/containers', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'my-container',
    image: 'nginx:latest',
    cpuLimit: 1,
    memoryLimit: 512
  })
})
.then(response => response.json())
.then(data => console.log(data));`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
