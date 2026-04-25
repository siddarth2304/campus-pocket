import { create } from 'zustand';

export interface User {
  id: string;
  username: string;
  role: 'parent' | 'student';
  school_id: string;
}

interface AppState {
  user: User | null;
  darkMode: boolean;
  setUser: (user: User | null) => void;
  setDarkMode: (val: boolean) => void;
  logout: () => void;
}

import { supabase } from '../lib/supabase';

export const useStore = create<AppState>((set) => ({
  user: null,
  darkMode: false,
  setUser: (user) => set({ user }),
  setDarkMode: (val) => set({ darkMode: val }),
  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },
}));
