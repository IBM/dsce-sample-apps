import { create } from 'zustand';
import type { User } from '../types/api';
import { setCsrfToken } from '../services/api';

interface SessionState {
  user: User | null;
  ready: boolean;
  setSession: (user: User | null, csrf: string | null) => void;
  markReady: () => void;
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  ready: false,
  setSession: (user, csrf) => {
    setCsrfToken(csrf);
    set({ user });
  },
  markReady: () => set({ ready: true })
}));
