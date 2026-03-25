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
import Overview from './pages/Overview';
import AppService from './pages/product/01-app-service';
import Documentation from './pages/Documentation';
import AdminUsers from './pages/admin/01-users';
import AdminImages from './pages/admin/02-images';
import AddImage from './pages/admin/02-images/add_image';
import AdminCluster from './pages/admin/04-cluster';
import AdminPods from './pages/admin/05-pods';
import AdminApplications from './pages/admin/03-applications';
import AdminApplicationDetail from './pages/admin/03-applications/edit_app';
import Profile from './pages/settings/01-profile';
import ContactUs from './pages/settings/02-contact';
import AppDetails from './pages/product/01-app-service/instance_detail';

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

          {/* 产品中心 - 应用服务 */}
          <Route path="/" element={<AppService />} />
          <Route path="/apps" element={<AppService />} />
          <Route path="/apps/:appId/details" element={<AppDetails />} />

          {/* 参考文档 */}
          <Route path="/docs" element={<Documentation />} />

          {/* 设置 */}
          <Route path="/settings/profile" element={<Profile />} />
          <Route path="/settings/contact" element={<ContactUs />} />

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
            path="/admin/images/add"
            element={
              <ProtectedRoute requiredRole="admin">
                <AddImage />
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
          <Route
            path="/admin/applications"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminApplications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/applications/:appId/edit"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminApplicationDetail isEditing={true} />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
