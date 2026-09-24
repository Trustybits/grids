<template>
  <Teleport to="body">
    <form
      v-if="request"
      ref="formRef"
      class="rt-inline-fields"
      :style="{ top: `${position.top}px`, left: `${position.left}px` }"
      :aria-label="request.title"
      @submit.prevent="submit"
      @keydown.esc.stop.prevent="$emit('cancel')"
      @mousedown.stop
      @pointerdown.stop
    >
      <div class="rt-inline-fields-title">{{ request.title }}</div>
      <label
        v-for="(field, index) in request.fields"
        :key="field.key"
        class="rt-inline-field"
      >
        <span class="rt-inline-field-label">{{ field.label }}</span>
        <input
          :ref="(el) => setInputRef(index, el)"
          v-model="values[field.key]"
          type="text"
          class="rt-inline-field-input"
          :class="{ invalid: !!errors[field.key] }"
          :placeholder="field.placeholder"
          :inputmode="field.inputmode ?? 'text'"
          :aria-invalid="!!errors[field.key]"
          autocomplete="off"
          spellcheck="false"
          @input="errors[field.key] = null"
        />
        <span v-if="errors[field.key]" class="rt-inline-field-error">
          {{ errors[field.key] }}
        </span>
      </label>
      <div class="rt-inline-fields-actions">
        <button type="button" class="rt-inline-btn" @click="$emit('cancel')">
          Cancel
        </button>
        <button type="submit" class="rt-inline-btn rt-inline-btn--primary">
          {{ request.submitLabel }}
        </button>
      </div>
    </form>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onUnmounted, reactive, ref, watch } from "vue";
import type { InlineFieldsRequest } from "@/utils/richText/slashCommands";
import type { FloatingPosition } from "@/composables/useSlashMenu";

const props = defineProps<{
  request: InlineFieldsRequest | null;
  position: FloatingPosition;
}>();

const emit = defineEmits<{
  submit: [values: Record<string, string>];
  cancel: [];
}>();

const formRef = ref<HTMLFormElement | null>(null);
const inputs: HTMLInputElement[] = [];
const values = reactive<Record<string, string>>({});
const errors = reactive<Record<string, string | null>>({});

const setInputRef = (index: number, el: unknown) => {
  if (el instanceof HTMLInputElement) inputs[index] = el;
};

const onOutsidePointer = (event: PointerEvent) => {
  if (formRef.value && !formRef.value.contains(event.target as Node)) {
    emit("cancel");
  }
};

watch(
  () => props.request,
  (request) => {
    document.removeEventListener("pointerdown", onOutsidePointer, true);
    for (const key of Object.keys(values)) delete values[key];
    for (const key of Object.keys(errors)) delete errors[key];
    inputs.length = 0;
    if (!request) return;
    for (const field of request.fields) {
      values[field.key] = field.initialValue ?? "";
      errors[field.key] = null;
    }
    void nextTick(() => {
      inputs[0]?.focus();
      document.addEventListener("pointerdown", onOutsidePointer, true);
    });
  },
  { immediate: true },
);

onUnmounted(() => {
  document.removeEventListener("pointerdown", onOutsidePointer, true);
});

const submit = () => {
  const request = props.request;
  if (!request) return;
  let firstInvalid = -1;
  request.fields.forEach((field, index) => {
    const error = field.validate?.(values[field.key] ?? "") ?? null;
    errors[field.key] = error;
    if (error && firstInvalid === -1) firstInvalid = index;
  });
  if (firstInvalid !== -1) {
    inputs[firstInvalid]?.focus();
    return;
  }
  emit("submit", { ...values });
};
</script>

<style scoped>
.rt-inline-fields {
  position: fixed;
  /* Above the other editor overlays (10010). */
  z-index: 10020;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 280px;
  padding: 10px;
  border-radius: var(--radius-md);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  background: var(--color-tile-background);
  color: var(--color-text-primary);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  font-size: 13px;
}

.rt-inline-fields-title {
  font-weight: 600;
}

.rt-inline-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rt-inline-field-label {
  font-size: 11px;
  opacity: 0.7;
}

.rt-inline-field-input {
  width: 100%;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-tile-stroke);
  background: transparent;
  color: inherit;
  font: inherit;
  outline: none;
}

.rt-inline-field-input:focus {
  border-color: var(--color-text-primary);
}

.rt-inline-field-input.invalid {
  border-color: #ff6b6b;
}

.rt-inline-field-error {
  font-size: 11px;
  color: #ff6b6b;
}

.rt-inline-fields-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.rt-inline-btn {
  border: none;
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.rt-inline-btn:hover {
  background: var(--color-base-55);
}

.rt-inline-btn--primary {
  background: var(--color-text-primary);
  color: var(--color-tile-background);
  font-weight: 600;
}

.rt-inline-btn--primary:hover {
  background: var(--color-text-primary);
  opacity: 0.9;
}
</style>
