import { create } from 'zustand';

type Language = 'ar' | 'fr' | 'en';

interface UIState {
  language: Language;
  sidebarOpen: boolean;
  setLanguage: (lang: Language) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  language: 'fr',
  sidebarOpen: true,

  setLanguage: (language) => {
    // Update document direction for RTL
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    set({ language });
  },

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
