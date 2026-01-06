<template>
  <div>
    <label class="switch">
      <input 
        @click="toggleTheme" 
        type="checkbox" 
        :checked="isDarkMode"
      >
      <span class="slider round"></span>
    </label>
  </div>
</template>

<script>
import { useThemeStore } from '@/stores/theme';
import { computed } from 'vue';

export default {
  setup() {
    const themeStore = useThemeStore();

    const isDarkMode = computed(() => themeStore.isDarkMode);

    const toggleTheme = () => {
      themeStore.toggleDarkMode();
    };

    return {
      isDarkMode,
      toggleTheme,
    };
  },
}

</script>

<style>
  .switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 28px;
}

/* Hide default HTML checkbox */
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

/* The slider */
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #5b488f;
  transition: var(--transition-normal);
}

.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: var(--transition-normal);
}

input:checked + .slider {
  background-color: #757c15;
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.slider.round {
  border-radius: var(--radius-full);
}

.slider.round:before {
  border-radius: 50%;
}
</style>