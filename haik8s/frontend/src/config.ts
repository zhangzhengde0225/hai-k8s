// API Base URL
// 开发环境：使用相对路径 /api，通过 Vite proxy 代理到 http://localhost:42900
// 生产环境：使用环境变量 VITE_API_BASE 或默认值 https://k8s-ai.ihep.ac.cn/api
export const API_BASE = import.meta.env.VITE_API_BASE ||
  (import.meta.env.DEV ? '/api' : 'https://k8s-ai.ihep.ac.cn/api');

