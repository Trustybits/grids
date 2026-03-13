import { defineStore } from 'pinia';
import { themes, getTheme } from '@/themes';
import type { Theme } from '@/types/theme';

function getDefaultThemeId(): string {
  return 'dark';
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    currentThemeId: getDefaultThemeId(),
    availableThemes: themes,
  }),
  
  getters: {
    currentTheme: (state): Theme => getTheme(state.currentThemeId),
    
    themeClass: (state): string => `theme-${state.currentThemeId}`,
    
    isDarkMode: (state): boolean => state.currentThemeId === 'dark',
  },
  
  actions: {
    setTheme(themeId: string) {
      if (!themes[themeId]) {
        console.warn(`Theme "${themeId}" not found, falling back to dark`);
        themeId = 'dark';
      }
      
      this.currentThemeId = themeId;
      this.applyTheme();
    },
    
    toggleDarkMode() {
      const newThemeId = this.currentThemeId === 'dark' ? 'light' : 'dark';
      this.setTheme(newThemeId);
    },
    
    applyGridTheme(themeId?: string) {
      this.setTheme(themeId || 'dark');
    },
    
    resetToAppDefault() {
      this.setTheme('dark');
    },
    
    applyTheme() {
      const root = document.documentElement;
      const body = document.body;

      const rootThemeClassesToRemove = Array.from(root.classList).filter(cls => cls.startsWith('theme-'));
      rootThemeClassesToRemove.forEach(cls => root.classList.remove(cls));
      root.classList.add(this.themeClass);

      if (body) {
        const bodyThemeClassesToRemove = Array.from(body.classList).filter(cls => cls.startsWith('theme-'));
        bodyThemeClassesToRemove.forEach(cls => body.classList.remove(cls));
        body.classList.add(this.themeClass);
      }
    },
    
    initializeTheme() {
      this.applyTheme();
    },
    
  },
});
