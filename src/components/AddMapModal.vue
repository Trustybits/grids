<template>
  <teleport to="body">
    <transition name="modal">
      <div v-if="show" class="modal-overlay" @click="handleClose">
        <div class="modal-content" @click.stop>
          <input
            ref="mapInput"
            v-model="query"
            type="text"
            placeholder="Search for a location (optional)"
            class="map-input"
            @keyup.enter="handleAdd"
            @keyup.esc="handleClose"
          />
          <p class="map-hint">Leave blank to use your current location.</p>
          <div class="modal-actions">
            <button type="button" class="cancel-button" @click="handleClose">Cancel</button>
            <button type="button" class="add-button" @click="handleAdd">Add map</button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, watch, nextTick } from "vue";

const props = defineProps({
  show: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(["close", "add"]);

const query = ref("");
const mapInput = ref(null);

watch(
  () => props.show,
  async (newValue) => {
    if (newValue) {
      query.value = "";
      await nextTick();
      mapInput.value?.focus();
    }
  }
);

const handleClose = () => {
  emit("close");
};

const handleAdd = () => {
  emit("add", query.value.trim());
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
  flex-direction: column;
  gap: var(--spacing-sm);
  position: relative;
  top: 540px;
  z-index: 1001;
  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-lg);
  padding: var(--spacing-sm);
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

.map-input {
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

.map-input:focus {
  border-color: var(--color-content-default);
  background-color: var(--color-tile-background);
}

.map-input::placeholder {
  color: var(--color-content-default);
  opacity: 0.6;
}

.map-hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-content-default);
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

.add-button:hover {
  background-color: var(--color-content-low);
  transform: translateY(-1px);
}
</style>
