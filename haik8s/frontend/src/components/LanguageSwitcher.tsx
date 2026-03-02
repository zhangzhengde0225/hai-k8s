import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../stores/languageStore';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguageStore();
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = language === 'zh' ? 'en' : 'zh';
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-sm font-medium text-gray-700 dark:text-slate-300"
    >
      <Globe size={18} />
      <span className="hidden sm:inline">{language === 'zh' ? '中文/En' : 'EN/中'}</span>
    </button>
  );
}
