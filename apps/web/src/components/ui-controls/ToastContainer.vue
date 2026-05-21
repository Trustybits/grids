<template>
  <div class="toast-container">
    <div
      v-for="toast in toastStore.toasts"
      :key="toast.id"
      class="toast"
      :class="`toast--${toast.type}`"
      @click="toastStore.removeToast(toast.id)"
      style="display: block !important; visibility: visible !important; opacity: 1 !important;"
    >
      <div class="toast-content" style="display: flex !important;">
        <CheckIcon v-if="toast.type === 'success'" :size="20" />
        <ErrorCircleIcon v-else-if="toast.type === 'error'" :size="20" />
        <InfoCircleIcon v-else :size="20" />
        <span style="display: inline !important;">{{ toast.message }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { useToastStore } from '@/stores/toast';
import CheckIcon from '@/components/icons/CheckIcon.vue';
import ErrorCircleIcon from '@/components/icons/ErrorCircleIcon.vue';
import InfoCircleIcon from '@/components/icons/InfoCircleIcon.vue';

export default defineComponent({
  name: 'ToastContainer',
  components: { CheckIcon, ErrorCircleIcon, InfoCircleIcon },
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
  z-index: 99999;
  display: flex;
  flex-direction: column-reverse;
  gap: var(--spacing-sm);
  pointer-events: none;
}

.toast {
  background: var(--color-tile-background);
  border: 2px solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  box-shadow: var(--shadow-xl);
  min-width: 250px;
  max-width: 400px;
  pointer-events: auto;
  cursor: pointer;
  animation: slideInUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  transition: opacity 0.2s ease;
  
  &:hover {
    opacity: 0.9;
  }

  &--success {
    border-color: var(--color-tile-stroke);
    background: var(--color-tile-background);
    
    svg {
      color: var(--color-figma-green);
    }
  }

  &--error {
    border-color: var(--color-figma-red);
    background: var(--color-tile-background);
    
    svg {
      color: var(--color-figma-red);
    }
  }

  &--info {
    border-color: var(--color-figma-purple);
    background: var(--color-tile-background);
    
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
  line-height: 1.5;
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
