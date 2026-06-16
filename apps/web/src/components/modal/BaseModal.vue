<template>
  <teleport to="body">
    <transition :name="transitionName">
      <div
        v-if="show"
        class="modal-overlay"
        :class="{
          'is-floating': variant === 'floating',
          'is-mobile-sheet': mobileSheet,
        }"
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
    /**
     * On small screens (≤600px), dock the (centered) dialog to the bottom of
     * the viewport as a full-width sheet that slides up — a more native mobile
     * pattern. No effect on the floating variant or on larger screens.
     */
    mobileSheet?: boolean;
  }>(),
  {
    variant: "centered",
    closeOnBackdrop: true,
    contentClass: "",
    mobileSheet: false,
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

/* Mobile bottom-sheet (centered dialogs that opt in via `mobileSheet`) */
@media (max-width: 600px) {
  .modal-overlay.is-mobile-sheet {
    align-items: flex-end;
  }

  .modal-overlay.is-mobile-sheet .modal-content {
    width: 100%;
    max-width: 100%;
    margin: 0;
    padding: var(--spacing-lg);
    padding-bottom: calc(var(--spacing-lg) + env(safe-area-inset-bottom, 0px));
    max-height: 92dvh;
    overflow-y: auto;
    border-bottom: none;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border-top-left-radius: var(--radius-lg);
    border-top-right-radius: var(--radius-lg);
  }

  .modal-overlay.is-mobile-sheet.modal-centered-enter-active .modal-content {
    animation: sheetUp 0.35s var(--easing-spring);
  }

  .modal-overlay.is-mobile-sheet.modal-centered-leave-active .modal-content {
    animation: sheetDown 0.25s ease-in;
  }
}

@keyframes sheetUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
@keyframes sheetDown {
  from { transform: translateY(0); }
  to { transform: translateY(100%); }
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
