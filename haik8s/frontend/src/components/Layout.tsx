import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../auth/AuthContext';
import {
  Box,
  PlusCircle,
  Users,
  Image as ImageIcon,
  Server,
  LogOut,
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-100 text-blue-700'
        : 'text-gray-700 hover:bg-gray-100'
    }`;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">HAI-K8S</h1>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <NavLink to="/" end className={linkClass}>
            <Box size={18} />
            My Containers
          </NavLink>
          <NavLink to="/containers/new" className={linkClass}>
            <PlusCircle size={18} />
            New Container
          </NavLink>

          {isAdmin && (
            <>
              <div className="pt-4 pb-1 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Admin
              </div>
              <NavLink to="/admin/users" className={linkClass}>
                <Users size={18} />
                Users
              </NavLink>
              <NavLink to="/admin/images" className={linkClass}>
                <ImageIcon size={18} />
                Images
              </NavLink>
              <NavLink to="/admin/cluster" className={linkClass}>
                <Server size={18} />
                Cluster
              </NavLink>
            </>
          )}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <div className="text-sm text-gray-600 mb-2 truncate">
            {user?.username}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
