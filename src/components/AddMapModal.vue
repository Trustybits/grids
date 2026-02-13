<template>
  <teleport to="body">
    <transition name="modal">
      <div v-if="show" class="modal-overlay" @click="handleClose">
        <div class="modal-content" @click.stop>
          <div class="input-row">
            <input
              ref="mapInput"
              v-model="query"
              type="text"
              placeholder="Enter a location (optional)"
              class="map-input"
              @keyup.enter="handleAdd"
              @keyup.esc="handleClose"
            />
            <!-- Submit button — always visible since blank is valid (uses current location) -->
            <transition name="slide-btn">
              <button
                v-if="show"
                class="submit-btn"
                @click="handleAdd"
                title="Add map (Enter)"
              >
                <!-- Corner-down-left icon (return/enter symbol) -->
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 10 4 15 9 20"></polyline>
                  <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
                </svg>
              </button>
            </transition>
          </div>
          <p class="map-hint">Leave blank to use your current location.</p>
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

.input-row {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.map-input:focus {
  border-color: var(--color-content-default);
  background-color: var(--color-tile-background);
}

.map-input::placeholder {
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

.submit-btn:hover {
  background-color: var(--color-content-background);
}

.map-hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-content-default);
  width: 100%;
  text-align: center;
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
