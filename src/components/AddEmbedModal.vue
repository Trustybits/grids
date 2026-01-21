<template>
  <teleport to="body" v-if="show">
    <div class="modal-overlay" @click="handleClose">
      <div class="modal-content" @click.stop>
        <input
          ref="embedInput"
          v-model="embedUrl"
          type="url"
          placeholder="Enter embed URL (e.g., YouTube, Spotify, etc.)..."
          class="embed-input"
          @keyup.enter="handleAdd"
          @keyup.esc="handleClose"
        />
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

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

const handleAdd = () => {
  const url = embedUrl.value.trim();
  if (!url) return;
  emit('add', url);
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
  animation: fadeIn 0.3s ease-out;
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
  position: relative;
  top: 540px;
  z-index: 1001;
  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xs);
  width: fit-content;
  min-width: 360px;
  max-width: 750px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUpSpring 0.4s var(--easing-spring);
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