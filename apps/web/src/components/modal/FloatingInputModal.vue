<template>
  <BaseModal :show="show" variant="floating" @close="handleClose">
    <div class="input-row">
      <input
        ref="inputEl"
        v-model="value"
        type="text"
        :inputmode="inputmode"
        :placeholder="placeholder"
        class="floating-input"
        @keyup.enter="handleSubmit"
        @keyup.esc="handleClose"
      />
      <transition name="slide-btn">
        <button
          v-if="showSubmitButton"
          class="submit-btn"
          :class="{ 'is-disabled': !canSubmit }"
          :disabled="!canSubmit"
          @click="handleSubmit"
          :title="canSubmit ? submitTitle : invalidTitle"
        >
          <ReturnIcon :size="20" />
        </button>
      </transition>
    </div>
    <slot name="hint" />
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import BaseModal from "./BaseModal.vue";
import ReturnIcon from "@/components/icons/ReturnIcon.vue";

const props = withDefaults(
  defineProps<{
    show: boolean;
    placeholder?: string;
    /** Custom validator. If omitted, any non-empty trimmed value is valid (or any value if allowEmpty). */
    validate?: (value: string) => boolean;
    /** If true, an empty input is considered valid and the submit button is always visible. */
    allowEmpty?: boolean;
    inputmode?: "url" | "text" | "search" | "email";
    submitTitle?: string;
    invalidTitle?: string;
  }>(),
  {
    placeholder: "",
    validate: undefined,
    allowEmpty: false,
    inputmode: "text",
    submitTitle: "Submit (Enter)",
    invalidTitle: "Enter a valid value",
  },
);

const emit = defineEmits<{
  close: [];
  submit: [value: string];
}>();

const value = ref("");
const inputEl = ref<HTMLInputElement | null>(null);

const canSubmit = computed(() => {
  const trimmed = value.value.trim();
  if (!trimmed) return props.allowEmpty;
  return props.validate ? props.validate(trimmed) : true;
});

const showSubmitButton = computed(() => {
  if (props.allowEmpty) return props.show;
  return value.value.trim().length > 0;
});

watch(
  () => props.show,
  async (open) => {
    if (!open) return;
    value.value = "";
    await nextTick();
    setTimeout(() => inputEl.value?.focus(), 50);
  },
);

const handleClose = () => emit("close");

const handleSubmit = () => {
  if (!canSubmit.value) return;
  emit("submit", value.value.trim());
};
</script>

<style scoped>
.input-row {
  display: flex;
  flex-direction: row;
  align-items: center;
}

:slotted(*) {
  margin-top: var(--spacing-sm);
}

.floating-input {
  width: 100%;
  padding: var(--spacing-sm);
  font-size: var(--font-size-md);
  font-family: var(--font-family-base);
  color: var(--color-text-primary);
  background-color: var(--color-content-background);
  border: var(--border-width) solid var(--color-stroke);
  border-radius: var(--radius-md);
  outline: none;
  transition: all var(--duration-fast) var(--easing-smooth);
}

.floating-input:focus {
  border-color: var(--color-content-default);
  background-color: var(--color-tile-background);
}

.floating-input::placeholder {
  color: var(--color-content-default);
  opacity: 0.6;
}

.slide-btn-enter-active {
  transition:
    transform 0.2s var(--easing-smooth),
    opacity 0.2s var(--easing-smooth);
}
.slide-btn-leave-active {
  transition:
    transform 0.15s var(--easing-smooth),
    opacity 0.15s var(--easing-smooth);
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
  transition:
    color var(--duration-fast) var(--easing-smooth),
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
</style>
