import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './auth/AuthContext';
import LoginPage from './auth/LoginPage';
import CallbackPage from './auth/CallbackPage';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import CreateContainer from './pages/CreateContainer';
import ContainerDetail from './pages/ContainerDetail';
import AdminUsers from './pages/AdminUsers';
import AdminImages from './pages/AdminImages';
import AdminCluster from './pages/AdminCluster';

export default function App() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

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
          <Route path="/" element={<Dashboard />} />
          <Route path="/containers/new" element={<CreateContainer />} />
          <Route path="/containers/:id" element={<ContainerDetail />} />
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
