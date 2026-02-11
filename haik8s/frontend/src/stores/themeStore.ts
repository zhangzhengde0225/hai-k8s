import { create } from 'zustand';

interface ThemeState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  loadFromStorage: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);

    // Remove both classes first, then add the correct one
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);

    set({ theme });
  },

  toggleTheme: () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(newTheme);
  },

  loadFromStorage: () => {
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (stored) {
      get().setTheme(stored);
    } else {
      // Set default to light
      get().setTheme('light');
    }
  }
}));
