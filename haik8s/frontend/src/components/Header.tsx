import { useTranslation } from 'react-i18next';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import UserMenu from './UserMenu';

export default function Header() {
  const { t } = useTranslation();

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
      {/* Left: Logo and Title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">K8S</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {t('appName')}
        </h1>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
