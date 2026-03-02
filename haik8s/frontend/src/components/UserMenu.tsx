import { useState, useRef, useEffect } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../auth/AuthContext';

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation('auth');

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const getInitial = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
          {getInitial(user.full_name || user.username)}
        </div>
        <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-slate-300">
          {user.full_name || user.username}
        </span>
        <ChevronDown size={16} className="hidden md:block text-gray-500 dark:text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-2 z-50">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {user.full_name || user.username}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-1">
              {user.email || user.username}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut size={16} />
            <span>{t('logout')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
