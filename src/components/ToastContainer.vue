<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toastStore.toasts"
        :key="toast.id"
        class="toast"
        :class="`toast--${toast.type}`"
        @click="toastStore.removeToast(toast.id)"
      >
        <div class="toast-content">
          <svg v-if="toast.type === 'success'" width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg v-else-if="toast.type === 'error'" width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M15 9L9 15M9 9L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M12 16V12M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>{{ toast.message }}</span>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { useToastStore } from '@/stores/toast';

export default defineComponent({
  name: 'ToastContainer',
  setup() {
    const toastStore = useToastStore();

    return {
      toastStore,
    };
  },
});
</script>

<style lang="scss" scoped>
.toast-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  pointer-events: none;
}

.toast {
  background: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  box-shadow: var(--shadow-lg);
  min-width: 250px;
  max-width: 400px;
  pointer-events: auto;
  cursor: pointer;

  &--success {
    border-color: var(--color-figma-green, #4ade80);
    
    svg {
      color: var(--color-figma-green, #4ade80);
    }
  }

  &--error {
    border-color: var(--color-figma-red);
    
    svg {
      color: var(--color-figma-red);
    }
  }

  &--info {
    border-color: var(--color-figma-purple);
    
    svg {
      color: var(--color-figma-purple);
    }
  }
}

.toast-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-family: var(--font-family-base);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100px);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>
