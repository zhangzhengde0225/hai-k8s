import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../auth/AuthContext';
import {
  Box,
  PlusCircle,
  Users,
  Image as ImageIcon,
  Server,
} from 'lucide-react';

export default function Sidebar() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const isAdmin = user?.role === 'admin';

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`;

  return (
    <aside className="w-[210px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <NavLink to="/" end className={linkClass}>
          <Box size={18} />
          {t('myContainers')}
        </NavLink>
        <NavLink to="/containers/new" className={linkClass}>
          <PlusCircle size={18} />
          {t('newContainer')}
        </NavLink>

        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              {t('admin')}
            </div>
            <NavLink to="/admin/users" className={linkClass}>
              <Users size={18} />
              {t('users')}
            </NavLink>
            <NavLink to="/admin/images" className={linkClass}>
              <ImageIcon size={18} />
              {t('images')}
            </NavLink>
            <NavLink to="/admin/cluster" className={linkClass}>
              <Server size={18} />
              {t('cluster')}
            </NavLink>
          </>
        )}
      </nav>
    </aside>
  );
}
