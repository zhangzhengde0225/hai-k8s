import { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../stores/languageStore';

export default function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();
  const { i18n } = useTranslation();

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

  const handleLanguageChange = (lang: 'zh' | 'en') => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <Globe size={18} />
        <span className="hidden sm:inline">{language === 'zh' ? '中文' : 'EN'}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
          <button
            onClick={() => handleLanguageChange('zh')}
            className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <span>{t('chinese')}</span>
            {language === 'zh' && <Check size={16} className="text-blue-600" />}
          </button>
          <button
            onClick={() => handleLanguageChange('en')}
            className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <span>{t('english')}</span>
            {language === 'en' && <Check size={16} className="text-blue-600" />}
          </button>
        </div>
      )}
    </div>
  );
}
