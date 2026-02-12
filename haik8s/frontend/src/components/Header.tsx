import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import UserMenu from './UserMenu';
import { useSidebarStore } from '../stores/sidebarStore';

export default function Header() {
  const { t } = useTranslation();
  const { toggle } = useSidebarStore();

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 md:px-6">
      {/* Left: Menu Button (mobile) + Logo and Title */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Mobile Menu Button */}
        <button
          onClick={toggle}
          className="lg:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Toggle menu"
        >
          <Menu size={20} className="text-gray-700 dark:text-gray-300" />
        </button>

        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">K8S</span>
        </div>
        <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
          {t('appName')}
        </h1>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-1 md:gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
