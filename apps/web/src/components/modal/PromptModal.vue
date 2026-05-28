<template>
  <BaseModal :show="show" variant="centered" @close="handleClose">
    <h3>{{ title }}</h3>
    <p v-if="description" class="modal-description">{{ description }}</p>
    <input
      ref="inputEl"
      v-model="value"
      type="text"
      :placeholder="placeholder"
      class="prompt-input"
      @keyup.enter="handleConfirm"
      @keyup.esc="handleClose"
    />
    <div class="modal-actions">
      <Button variant="secondary" @click="handleClose">Cancel</Button>
      <Button
        :variant="variant"
        :disabled="!canConfirm"
        @click="handleConfirm"
      >
        {{ confirmLabel }}
      </Button>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import BaseModal from "./BaseModal.vue";
import Button from "@/components/ui-elements/Button.vue";

const props = withDefaults(
  defineProps<{
    show: boolean;
    title: string;
    description?: string;
    placeholder?: string;
    initialValue?: string;
    selectOnOpen?: boolean;
    /** When set, confirm is only enabled if the input exactly equals this string. */
    requireMatch?: string;
    confirmLabel: string;
    variant?: "primary" | "danger";
  }>(),
  {
    description: "",
    placeholder: "",
    initialValue: "",
    selectOnOpen: false,
    requireMatch: undefined,
    variant: "primary",
  },
);

const emit = defineEmits<{
  close: [];
  confirm: [value: string];
}>();

const value = ref("");
const inputEl = ref<HTMLInputElement | null>(null);

const canConfirm = computed(() => {
  if (props.requireMatch !== undefined) {
    return value.value === props.requireMatch;
  }
  return value.value.trim().length > 0;
});

watch(
  () => props.show,
  async (open) => {
    if (!open) return;
    value.value = props.initialValue ?? "";
    await nextTick();
    setTimeout(() => {
      inputEl.value?.focus();
      if (props.selectOnOpen) inputEl.value?.select();
    }, 50);
  },
);

const handleClose = () => emit("close");

const handleConfirm = () => {
  if (!canConfirm.value) return;
  const payload = props.requireMatch !== undefined ? value.value : value.value.trim();
  emit("confirm", payload);
};
</script>

<style scoped>
h3 {
  margin: 0 0 var(--spacing-lg) 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

h3:has(+ .modal-description) {
  margin-bottom: var(--spacing-sm);
}

.modal-description {
  margin: 0 0 var(--spacing-lg) 0;
  color: var(--color-content-default);
  font-size: var(--font-size-md);
  line-height: 1.5;
}

.prompt-input {
  width: 100%;
  padding: var(--spacing-md);
  font-size: var(--font-size-md);
  font-family: var(--font-family-base);
  color: var(--color-text-primary);
  background-color: var(--color-content-background);
  border: var(--ui-border-width) solid var(--color-ui-stroke);
  border-radius: var(--radius-md);
  outline: none;
  transition: all var(--duration-fast) var(--easing-smooth);
  margin-bottom: var(--spacing-lg);
}

.prompt-input:focus {
  border-color: var(--color-content-default);
  background-color: var(--color-tile-background);
}

.prompt-input::placeholder {
  color: var(--color-content-default);
  opacity: 0.6;
}

.modal-actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: flex-end;
}
</style>
