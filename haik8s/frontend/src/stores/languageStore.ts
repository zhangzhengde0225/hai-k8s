import { create } from 'zustand';

interface LanguageState {
  language: 'zh' | 'en';
  setLanguage: (language: 'zh' | 'en') => void;
  loadFromStorage: () => void;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: 'zh',

  setLanguage: (language) => {
    localStorage.setItem('language', language);
    document.documentElement.setAttribute('lang', language);
    set({ language });
  },

  loadFromStorage: () => {
    const stored = localStorage.getItem('language') as 'zh' | 'en' | null;
    if (stored) {
      get().setLanguage(stored);
    } else {
      get().setLanguage('zh');
    }
  }
}));
