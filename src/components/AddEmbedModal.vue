<template>
  <teleport to="body">
    <transition name="modal">
      <div v-if="show" class="modal-overlay" @click="handleClose">
        <div class="modal-content" @click.stop>
          <input
            ref="embedInput"
            v-model="embedUrl"
            type="text"
            placeholder="Paste a URL or embed code (YouTube, Spotify, Apple Music...)"
            class="embed-input"
            @keyup.enter="handleAdd"
            @keyup.esc="handleClose"
          />
          <!-- Submit button — slides in once the user types, disabled until valid URL -->
          <transition name="slide-btn">
            <button
              v-if="embedUrl.trim()"
              class="submit-btn"
              :class="{ 'is-disabled': !isValidUrl }"
              :disabled="!isValidUrl"
              @click="handleAdd"
              :title="isValidUrl ? 'Add embed (Enter)' : 'Enter a valid URL'"
            >
              <!-- Corner-down-left icon (return/enter symbol) -->
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 10 4 15 9 20"></polyline>
                <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
              </svg>
            </button>
          </transition>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  }
});

const emit = defineEmits(['close', 'add']);

const embedUrl = ref('');
const embedInput = ref(null);

watch(() => props.show, async (newValue) => {
  if (newValue) {
    embedUrl.value = '';
    await nextTick();
    embedInput.value?.focus();
  }
});

const handleClose = () => {
  emit('close');
};

function extractIframeSrc(text) {
  const m = text.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

const isValidUrl = computed(() => {
  const text = embedUrl.value.trim();
  if (!text) return false;

  if (text.startsWith('<iframe') || text.startsWith('<IFRAME')) {
    return !!extractIframeSrc(text);
  }

  try {
    if (text.startsWith('http://') || text.startsWith('https://')) {
      new URL(text);
      return true;
    }
    if (text.includes('.')) {
      new URL(`https://${text}`);
      return true;
    }
    return false;
  } catch {
    return false;
  }
});

const handleAdd = () => {
  if (!isValidUrl.value) return;
  emit('add', embedUrl.value.trim());
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  display: flex;
  flex-direction: row;
  position: absolute;
  bottom: 100px;
  z-index: 1001;
  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xs);
  width: fit-content;
  min-width: 360px;
  max-width: 750px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-enter-active {
  animation: fadeIn 0.3s ease-out;
}

.modal-leave-active {
  animation: fadeOut 0.2s ease-in;
}

.modal-enter-active .modal-content {
  animation: slideUpSpring 0.3s var(--easing-spring);
}

.modal-leave-active .modal-content {
  animation: slideDownFade 0.2s ease-in;
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

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
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

.modal-content h3 {
  margin: 0 0 var(--spacing-lg) 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.embed-input {
  width: 100%;
  padding: var(--spacing-sm);
  font-size: var(--font-size-md);
  font-family: var(--font-family-base);
  color: var(--color-text-primary);
  background-color: var(--color-content-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  outline: none;
  transition: all var(--duration-fast) var(--easing-smooth);
}

.embed-input:focus {
  border-color: var(--color-content-default);
  background-color: var(--color-tile-background);
}

.embed-input::placeholder {
  color: var(--color-content-default);
  opacity: 0.6;
}

/* Slide-in animation for the submit button */
.slide-btn-enter-active {
  transition: transform 0.2s var(--easing-smooth), opacity 0.2s var(--easing-smooth);
}
.slide-btn-leave-active {
  transition: transform 0.15s var(--easing-smooth), opacity 0.15s var(--easing-smooth);
}
.slide-btn-enter-from {
  opacity: 0;
  transform: translateX(8px);
}
.slide-btn-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: color var(--duration-fast) var(--easing-smooth),
              background-color var(--duration-fast) var(--easing-smooth);
  flex-shrink: 0;
}

.submit-btn:hover:not(:disabled) {
  background-color: var(--color-content-background);
}

.submit-btn.is-disabled {
  color: var(--color-content-default);
  opacity: 0.35;
  cursor: not-allowed;
}

.modal-actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: flex-end;
}

.cancel-button,
.add-button {
  padding: var(--spacing-sm) var(--spacing-lg);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-smooth);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
}

.cancel-button {
  background-color: transparent;
  color: var(--color-content-default);
}

.cancel-button:hover {
  background-color: var(--color-content-background);
  color: var(--color-text-primary);
}

.add-button {
  background-color: var(--color-content-high);
  color: var(--color-text-primary);
}

.add-button:hover:not(:disabled) {
  background-color: var(--color-content-low);
  transform: translateY(-1px);
}

.add-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>