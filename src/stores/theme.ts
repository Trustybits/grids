import { defineStore } from 'pinia';

export const useThemeStore = defineStore('theme', {
  state: () => ({
    isDarkMode: localStorage.getItem('darkMode') === 'true',
  }),
  getters: {
    themeClass: (state) => (state.isDarkMode ? 'theme-dark' : 'theme-light'),
  },
  actions: {
    toggleDarkMode() {
      this.isDarkMode = !this.isDarkMode;
      localStorage.setItem('darkMode', String(this.isDarkMode));
      this.applyTheme();
    },
    applyTheme() {
      const themeClass = this.isDarkMode ? 'theme-dark' : 'theme-light';
      document.body.classList.remove('theme-dark', 'theme-light');
      document.body.classList.add(themeClass);
    },
    initializeTheme() {
      this.applyTheme();
    },
  },
});
