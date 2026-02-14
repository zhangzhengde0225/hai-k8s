import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from './auth/AuthContext';
import { useThemeStore } from './stores/themeStore';
import { useLanguageStore } from './stores/languageStore';
import LoginPage from './auth/LoginPage';
import CallbackPage from './auth/CallbackPage';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Overview from './pages/Overview';
import AppService from './pages/AppService';
import Documentation from './pages/Documentation';
import CreateContainer from './pages/CreateContainer';
import ContainerDetail from './pages/ContainerDetail';
import AdminUsers from './pages/AdminUsers';
import AdminImages from './pages/AdminImages';
import AdminCluster from './pages/AdminCluster';
import AdminPods from './pages/AdminPods';

export default function App() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  const loadTheme = useThemeStore((s) => s.loadFromStorage);
  const loadLanguage = useLanguageStore((s) => s.loadFromStorage);
  const { i18n } = useTranslation();

  useEffect(() => {
    loadFromStorage();
    loadTheme();
    loadLanguage();

    const currentLanguage = useLanguageStore.getState().language;
    i18n.changeLanguage(currentLanguage);
  }, [loadFromStorage, loadTheme, loadLanguage, i18n]);

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<CallbackPage />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* 资源总览 */}
          <Route path="/overview" element={<Overview />} />

          {/* 产品中心 - 容器服务 */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/containers/new" element={<CreateContainer />} />
          <Route path="/containers/:id" element={<ContainerDetail />} />

          {/* 产品中心 - 应用服务 */}
          <Route path="/apps" element={<AppService />} />

          {/* 参考文档 */}
          <Route path="/docs" element={<Documentation />} />

          {/* 管理员 */}
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/images"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminImages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/cluster"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminCluster />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/pods"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPods />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
