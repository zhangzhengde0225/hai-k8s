/**
 * UserMenu component - Avatar dropdown menu with logout and admin switch-user functionality
 *
 * Author: Zhengde Zhang (zhangzhengde0225@gmail.com)
 */
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, LogOut, UserRoundCog } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../auth/AuthContext';
import { API_BASE } from '../config';

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [targetUsername, setTargetUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [switchLoading, setSwitchLoading] = useState(false);
  const [switchError, setSwitchError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, logout, setAuth } = useAuthStore();
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

  const openSwitchModal = () => {
    setIsOpen(false);
    setTargetUsername('');
    setAdminPassword('');
    setSwitchError('');
    setShowSwitchModal(true);
  };

  const handleSwitchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsername.trim() || !adminPassword) return;

    setSwitchLoading(true);
    setSwitchError('');

    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_BASE}/admin/switch-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          target_username: targetUsername.trim(),
          admin_password: adminPassword,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || t('switchUserFailed'));
      }

      const data = await resp.json();

      // Fetch full user profile with new token
      const userResp = await fetch(`${API_BASE}/users/me`, {
        headers: { 'Authorization': `Bearer ${data.access_token}` },
      });

      if (!userResp.ok) throw new Error(t('switchUserFailed'));
      const userData = await userResp.json();

      setAuth(data.access_token, userData);
      setShowSwitchModal(false);
      navigate('/');
    } catch (err: unknown) {
      setSwitchError(err instanceof Error ? err.message : t('switchUserFailed'));
    } finally {
      setSwitchLoading(false);
    }
  };

  if (!user) return null;

  const getInitial = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  const isAdmin = user.role === 'admin';

  return (
    <>
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
            {isAdmin && (
              <button
                onClick={openSwitchModal}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <UserRoundCog size={16} />
                <span>{t('switchUser')}</span>
              </button>
            )}
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

      {/* Switch User Modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-2 mb-4">
              <UserRoundCog size={20} className="text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t('switchUser')}
              </h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              {t('switchUserDesc')}
            </p>
            <form onSubmit={handleSwitchUser} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  {t('switchTargetUsername')}
                </label>
                <input
                  type="text"
                  value={targetUsername}
                  onChange={e => setTargetUsername(e.target.value)}
                  placeholder={t('enterUsername')}
                  required
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  {t('switchAdminPassword')}
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder={t('enterPassword')}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {switchError && (
                <p className="text-xs text-red-600 dark:text-red-400">{switchError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSwitchModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={switchLoading || !targetUsername.trim() || !adminPassword}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {switchLoading ? t('switchingUser') : t('confirmSwitch')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
