<template>
  <button
    type="button"
    class="theme-toggle"
    :class="themeClass"
    :title="`Current theme: ${currentThemeName}. Click to change theme.`"
    @click="cycleTheme"
  >
    <span class="theme-toggle-icon" aria-hidden="true">
      <!-- Sun icon for Light theme -->
      <svg
        class="icon-sun"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5" />
        <path d="M12 2V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <path d="M12 20V22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <path d="M2 12H4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <path d="M20 12H22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <path d="M4.9 4.9L6.3 6.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <path d="M17.7 17.7L19.1 19.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <path d="M19.1 4.9L17.7 6.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <path d="M6.3 17.7L4.9 19.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>

      <!-- Moon icon for Dark theme -->
      <svg
        class="icon-moon"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M21 14.5C19.9 15.2 18.6 15.6 17.2 15.6C13.2 15.6 10 12.4 10 8.4C10 7 10.4 5.7 11.1 4.6C7.6 5.5 5 8.7 5 12.5C5 17 8.6 20.6 13.1 20.6C16.9 20.6 20.1 18 21 14.5Z"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
      </svg>

      <!-- Bento icon for Bento theme - minimalist grid layout -->
      <svg
        class="icon-bento"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="4" y="4" width="7" height="7" rx="2" stroke="currentColor" stroke-width="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="2" stroke="currentColor" stroke-width="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="2" stroke="currentColor" stroke-width="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="2" stroke="currentColor" stroke-width="1.5" />
      </svg>
    </span>
  </button>
</template>

<script>
import { useThemeStore } from '@/stores/theme';
import { computed } from 'vue';

export default {
  setup() {
    const themeStore = useThemeStore();

    const currentThemeId = computed(() => themeStore.currentThemeId);
    const currentThemeName = computed(() => themeStore.currentTheme.name);
    
    const themeClass = computed(() => {
      return `is-${currentThemeId.value}`;
    });

    const cycleTheme = () => {
      // Cycle through: light -> bento -> dark -> light
      const themeOrder = ['light', 'bento', 'dark'];
      const currentIndex = themeOrder.indexOf(currentThemeId.value);
      const nextIndex = (currentIndex + 1) % themeOrder.length;
      themeStore.setTheme(themeOrder[nextIndex]);
    };

    return {
      currentThemeId,
      currentThemeName,
      themeClass,
      cycleTheme,
    };
  },
}

</script>

<style>
  .theme-toggle {
    width: 40px;
    height: 40px;
    padding: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-content-default);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background-color var(--duration-normal) var(--easing-smooth),
      color var(--duration-normal) var(--easing-smooth),
      transform var(--duration-normal) var(--easing-ease-out);
  }

  .theme-toggle:hover {
    background: var(--color-text-primary);
    color: var(--color-content-background);
  }

  .theme-toggle:active {
    transform: scale(0.95);
  }

  .theme-toggle-icon {
    position: relative;
    width: 20px;
    height: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .theme-toggle-icon svg {
    position: absolute;
    inset: 0;
    width: 20px;
    height: 20px;
    transition: opacity var(--duration-normal) var(--easing-smooth),
      transform var(--duration-slow) var(--easing-spring);
    transform-origin: 50% 50%;
  }

  /* Light theme - show sun */
  .theme-toggle.is-light .icon-sun {
    opacity: 1;
    transform: rotate(0deg) scale(1);
  }

  .theme-toggle.is-light .icon-moon,
  .theme-toggle.is-light .icon-bento {
    opacity: 0;
    transform: rotate(-90deg) scale(0.75);
  }

  /* Dark theme - show moon */
  .theme-toggle.is-dark .icon-moon {
    opacity: 1;
    transform: rotate(0deg) scale(1);
  }

  .theme-toggle.is-dark .icon-sun,
  .theme-toggle.is-dark .icon-bento {
    opacity: 0;
    transform: rotate(90deg) scale(0.75);
  }

  /* Bento theme - show bento grid icon */
  .theme-toggle.is-bento .icon-bento {
    opacity: 1;
    transform: rotate(0deg) scale(1);
  }

  .theme-toggle.is-bento .icon-sun {
    opacity: 0;
    transform: rotate(90deg) scale(0.75);
  }

  .theme-toggle.is-bento .icon-moon {
    opacity: 0;
    transform: rotate(-90deg) scale(0.75);
  }
</style>