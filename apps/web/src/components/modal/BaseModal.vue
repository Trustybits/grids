<template>
  <teleport to="body">
    <transition :name="transitionName">
      <div
        v-if="show"
        class="modal-overlay"
        :class="{ 'is-floating': variant === 'floating' }"
        @click.self="handleOverlayClick"
      >
        <div
          class="modal-content"
          :class="contentClass"
          @click.stop
        >
          <slot />
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { computed } from "vue";

type Variant = "centered" | "floating";

const props = withDefaults(
  defineProps<{
    show: boolean;
    variant?: Variant;
    closeOnBackdrop?: boolean;
    contentClass?: string;
  }>(),
  {
    variant: "centered",
    closeOnBackdrop: true,
    contentClass: "",
  },
);

const emit = defineEmits<{ close: [] }>();

const transitionName = computed(() =>
  props.variant === "floating" ? "modal-floating" : "modal-centered",
);

const handleOverlayClick = () => {
  if (props.closeOnBackdrop) emit("close");
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal-backdrop);
}

.modal-content {
  position: relative;
  z-index: var(--z-modal);
  background-color: var(--color-tile-background);
  border: var(--border-width) solid var(--color-stroke);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

/* Centered variant (dialog-style) */
.modal-overlay:not(.is-floating) .modal-content {
  padding: var(--spacing-xl);
  width: 90%;
  max-width: 500px;
}

/* Floating variant (anchored to the bottom of the viewport) */
.modal-overlay.is-floating .modal-content {
  position: absolute;
  bottom: 100px;
  padding: var(--spacing-xs);
  width: fit-content;
  min-width: 360px;
  max-width: 750px;
}

/* Centered transition */
.modal-centered-enter-active {
  animation: fadeIn 0.2s ease-out;
}
.modal-centered-leave-active {
  animation: fadeOut 0.2s ease-in;
}
.modal-centered-enter-active .modal-content {
  animation: slideUpSpring 0.4s var(--easing-spring);
}
.modal-centered-leave-active .modal-content {
  animation: slideDownFade 0.2s ease-in;
}

/* Floating transition */
.modal-floating-enter-active {
  animation: fadeIn 0.3s ease-out;
}
.modal-floating-leave-active {
  animation: fadeOut 0.2s ease-in;
}
.modal-floating-enter-active .modal-content {
  animation: slideUpSpring 0.3s var(--easing-spring);
}
.modal-floating-leave-active .modal-content {
  animation: slideDownFade 0.2s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes slideUpSpring {
  from {
    opacity: 0;
    transform: translateY(40px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes slideDownFade {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
}
</style>
