import { create } from 'zustand';
import type { User } from '../types';
import { jwtDecode } from './jwt';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  token: null,

  setAuth: (token: string, user: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ isAuthenticated: true, token, user });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ isAuthenticated: false, token: null, user: null });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const decoded = jwtDecode(token);
        // Check expiration
        if (decoded.exp && decoded.exp * 1000 > Date.now()) {
          const user = JSON.parse(userStr) as User;
          set({ isAuthenticated: true, token, user });
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  },
}));
