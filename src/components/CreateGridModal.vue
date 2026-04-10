<template>
  <div v-if="show" class="modal-overlay" @click="handleClose">
    <div class="modal-content" @click.stop>
      <h3>Create New Grid</h3>

      <!-- Mode toggle (only shown when URL-to-Grid feature is enabled) -->
      <div v-if="urlToGridEnabled" class="mode-toggle">
        <button
          :class="['mode-btn', { active: mode === 'blank' }]"
          @click="mode = 'blank'"
        >
          Blank Grid
        </button>
        <button
          :class="['mode-btn', { active: mode === 'url' }]"
          @click="mode = 'url'"
        >
          From URL
        </button>
      </div>

      <!-- URL input (only in URL mode) -->
      <input
        v-if="mode === 'url'"
        ref="urlInput"
        v-model="gridUrl"
        type="url"
        placeholder="Paste a URL to generate from..."
        class="grid-name-input"
        @keyup.enter="handleCreate"
        @keyup.esc="handleClose"
      />

      <input
        ref="gridNameInput"
        v-model="gridName"
        type="text"
        :placeholder="mode === 'url' ? 'Grid name (optional, auto-detected)' : 'Enter grid name...'"
        class="grid-name-input"
        @keyup.enter="handleCreate"
        @keyup.esc="handleClose"
      />

      <div class="modal-actions">
        <button @click="handleClose" class="cancel-button">Cancel</button>
        <button @click="handleCreate" class="create-button" :disabled="!canCreate">
          {{ mode === 'url' ? 'Generate Grid' : 'Create Grid' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useFeatureFlags, FEATURE_FLAGS } from '@/composables/useFeatureFlags';

const { isEnabled } = useFeatureFlags();
const urlToGridEnabled = computed(() => isEnabled(FEATURE_FLAGS.BETA_URL_TO_GRID));

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  }
});

const emit = defineEmits(['close', 'create', 'create-from-url']);

const mode = ref('blank');
const gridName = ref('');
const gridUrl = ref('');
const gridNameInput = ref(null);
const urlInput = ref(null);

const canCreate = computed(() => {
  if (mode.value === 'url') {
    return gridUrl.value.trim().length > 0;
  }
  return gridName.value.trim().length > 0;
});

watch(() => props.show, async (newValue) => {
  if (newValue) {
    gridName.value = '';
    gridUrl.value = '';
    mode.value = urlToGridEnabled.value ? 'url' : 'blank';
    await nextTick();
    if (mode.value === 'url' && urlInput.value) {
      urlInput.value.focus();
    } else if (gridNameInput.value) {
      gridNameInput.value.focus();
    }
  }
});

watch(mode, async () => {
  await nextTick();
  if (mode.value === 'url' && urlInput.value) {
    urlInput.value.focus();
  } else if (gridNameInput.value) {
    gridNameInput.value.focus();
  }
});

const handleClose = () => {
  emit('close');
};

const handleCreate = () => {
  if (mode.value === 'url') {
    const url = gridUrl.value.trim();
    if (!url) return;
    emit('create-from-url', { url, name: gridName.value.trim() });
  } else {
    const name = gridName.value.trim();
    if (!name) return;
    emit('create', name);
  }
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
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
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
  position: relative;
  z-index: 1001;
  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  width: 90%;
  max-width: 500px;
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

.mode-toggle {
  display: flex;
  gap: 0;
  margin-bottom: var(--spacing-lg);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.mode-btn {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-family-base);
  color: var(--color-content-default);
  background-color: transparent;
  border: none;
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-smooth);
}

.mode-btn.active {
  background-color: var(--color-content-high);
  color: var(--color-text-primary);
}

.mode-btn:not(.active):hover {
  background-color: var(--color-content-background);
}

.grid-name-input {
  width: 100%;
  padding: var(--spacing-md);
  font-size: var(--font-size-md);
  font-family: var(--font-family-base);
  color: var(--color-text-primary);
  background-color: var(--color-content-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  outline: none;
  transition: all var(--duration-fast) var(--easing-smooth);
  margin-bottom: var(--spacing-lg);
}

.grid-name-input:focus {
  border-color: var(--color-content-default);
  background-color: var(--color-tile-background);
}

.grid-name-input::placeholder {
  color: var(--color-content-default);
  opacity: 0.6;
}

.modal-actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: flex-end;
}

.cancel-button,
.create-button {
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

.create-button {
  background-color: var(--color-content-high);
  color: var(--color-text-primary);
}

.create-button:hover:not(:disabled) {
  background-color: var(--color-content-low);
  transform: translateY(-1px);
}

.create-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
