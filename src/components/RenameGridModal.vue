<template>
  <div v-if="show" class="modal-overlay" @click="handleClose">
    <div class="modal-content" @click.stop>
      <h3>Rename Grid</h3>
      <input
        ref="gridNameInput"
        v-model="gridName"
        type="text"
        placeholder="Enter new grid name..."
        class="grid-name-input"
        @keyup.enter="handleRename"
        @keyup.esc="handleClose"
      />
      <div class="modal-actions">
        <button @click="handleClose" class="cancel-button">Cancel</button>
        <button @click="handleRename" class="rename-button" :disabled="!gridName.trim()">Rename</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  currentName: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close', 'rename']);

const gridName = ref('');
const gridNameInput = ref(null);

// When modal opens, populate with current name and focus input
watch(() => props.show, async (newValue) => {
  if (newValue) {
    gridName.value = props.currentName;
    await nextTick();
    gridNameInput.value?.focus();
    // Select all text for easy replacement
    gridNameInput.value?.select();
  }
});

const handleClose = () => {
  emit('close');
};

const handleRename = () => {
  const name = gridName.value.trim();
  if (!name) return;
  emit('rename', name);
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
.rename-button {
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

.rename-button {
  background-color: var(--color-content-high);
  color: var(--color-text-primary);
}

.rename-button:hover:not(:disabled) {
  background-color: var(--color-content-low);
  transform: translateY(-1px);
}

.rename-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
