import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../auth/AuthContext';
import { useSidebarStore } from '../stores/sidebarStore';
import {
  LayoutDashboard,
  Box,
  AppWindow,
  FileText,
  Users,
  Image as ImageIcon,
  Server,
  ChevronRight,
  X,
} from 'lucide-react';

type MenuItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
};

type MenuGroup = {
  label: string;
  icon: React.ReactNode;
  items: MenuItem[];
  adminOnly?: boolean;
};

export default function Sidebar() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const { isOpen, close } = useSidebarStore();

  // State to track which groups are expanded (all expanded by default)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    overview: true,
    products: true,
    docs: true,
    admin: true,
  });

  // Close sidebar on route change (mobile)
  useEffect(() => {
    close();
  }, [location.pathname, close]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  // Define menu structure
  const menuGroups: MenuGroup[] = [
    {
      label: t('overview'),
      icon: <LayoutDashboard size={16} />,
      items: [
        {
          label: t('resourceOverview'),
          path: '/overview',
          icon: <LayoutDashboard size={16} />,
        },
      ],
    },
    {
      label: t('productCenter'),
      icon: <Box size={16} />,
      items: [
        {
          label: t('containerService'),
          path: '/',
          icon: <Box size={16} />,
        },
        {
          label: t('appService'),
          path: '/apps',
          icon: <AppWindow size={16} />,
        },
      ],
    },
    {
      label: t('documentation'),
      icon: <FileText size={16} />,
      items: [
        {
          label: t('apiDocs'),
          path: '/docs',
          icon: <FileText size={16} />,
        },
      ],
    },
    {
      label: t('admin'),
      icon: <Server size={16} />,
      items: [
        {
          label: t('users'),
          path: '/admin/users',
          icon: <Users size={16} />,
        },
        {
          label: t('images'),
          path: '/admin/images',
          icon: <ImageIcon size={16} />,
        },
        {
          label: t('cluster'),
          path: '/admin/cluster',
          icon: <Server size={16} />,
        },
      ],
      adminOnly: true,
    },
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 ${
      isActive
        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-l-3 border-l-blue-600 dark:border-l-blue-400'
        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border-l-3 border-l-transparent'
    }`;

  const groupHeaderClass = (expanded: boolean) =>
    `flex items-center justify-between w-full px-3 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer select-none
    bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600`;

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={close}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-[280px] lg:w-[210px]
          bg-white dark:bg-gray-800
          border-r border-gray-200 dark:border-gray-700
          flex flex-col h-full
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Mobile Close Button */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('menu', 'Menu')}
          </span>
          <button
            onClick={close}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close menu"
          >
            <X size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
          {menuGroups.map((group, groupIndex) => {
          // Skip admin group if user is not admin
          if (group.adminOnly && !isAdmin) {
            return null;
          }

          const groupKey = ['overview', 'products', 'docs', 'admin'][groupIndex];
          const isExpanded = expandedGroups[groupKey];

          return (
            <div key={group.label} className="space-y-1">
              <button
                onClick={() => toggleGroup(groupKey)}
                className={groupHeaderClass(isExpanded)}
              >
                <span className="flex items-center gap-2">
                  {group.icon}
                  <span>{group.label}</span>
                </span>
                <ChevronRight
                  size={14}
                  className={`transition-transform duration-200 ${
                    isExpanded ? 'rotate-90' : 'rotate-0'
                  }`}
                />
              </button>

              {isExpanded && (
                <div className="ml-2 space-y-1">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/'}
                      className={linkClass}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      </aside>
    </>
  );
}
