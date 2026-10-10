<!--
  PopoverSwatches.vue

  The colour grid shared by the text Color and tile Fill popovers: an optional
  leading choice (Auto / No fill), the theme swatches, and a hex field. Theme
  swatches are stored as `var(--token)` so they follow the active theme, the
  same values the desktop pickers write.

  No eyedropper: the EyeDropper API only exists in desktop Chromium.
-->
<template>
  <div class="pps">
    <div class="pps__grid" role="listbox" :aria-label="label">
      <button
        v-if="lead"
        type="button"
        class="pps__lead"
        role="option"
        :class="{ 'is-current': modelValue === lead.value }"
        :aria-selected="modelValue === lead.value"
        @click="$emit('pick', lead.value)"
      >
        {{ lead.label }}
      </button>
      <button
        v-for="swatch in swatches"
        :key="swatch.value"
        type="button"
        class="pps__swatch"
        role="option"
        :class="{ 'is-current': modelValue === swatch.value }"
        :aria-selected="modelValue === swatch.value"
        :aria-label="swatch.label"
        :style="{ background: swatch.value }"
        @click="$emit('pick', swatch.value)"
      />
    </div>

    <label class="pps__hex">
      <span class="pps__hash" aria-hidden="true">#</span>
      <input
        v-model="hexDraft"
        type="text"
        inputmode="text"
        autocapitalize="characters"
        autocomplete="off"
        spellcheck="false"
        maxlength="7"
        placeholder="FFFFFF"
        :aria-label="`${label} hex value`"
        @keydown.enter.prevent="applyHex"
        @blur="applyHex"
      />
      <span
        class="pps__preview"
        :style="{ background: previewColor }"
        aria-hidden="true"
      />
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { normalizeHex } from "@/utils/color";

export interface Swatch {
  value: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    swatches: Swatch[];
    /** The current colour; "mixed" or anything unknown highlights none. */
    modelValue: unknown;
    label: string;
    lead?: { value: string; label: string } | null;
  }>(),
  { lead: null },
);

const emit = defineEmits<{ pick: [value: string] }>();

const currentHex = () =>
  typeof props.modelValue === "string" ? normalizeHex(props.modelValue) : "";

const hexDraft = ref(currentHex().slice(1));

// Show a picked custom hex; swatch tokens leave the field for typing.
watch(
  () => props.modelValue,
  () => {
    const hex = currentHex();
    if (hex) hexDraft.value = hex.slice(1);
  },
);

const previewColor = computed(() => {
  const hex = normalizeHex(hexDraft.value);
  if (hex) return hex;
  return typeof props.modelValue === "string" ? props.modelValue : "transparent";
});

const applyHex = () => {
  const hex = normalizeHex(hexDraft.value);
  if (!hex || hex === currentHex()) return;
  emit("pick", hex);
};
</script>

<style scoped>
.pps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pps__grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}

.pps__swatch,
.pps__lead {
  aspect-ratio: 1;
  min-width: 36px;
  min-height: 36px;
  padding: 0;
  border: 1px solid var(--color-stroke);
  border-radius: 10px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--duration-instant) var(--easing-smooth);
}

.pps__lead {
  background: var(--color-tool-selected-bg);
  color: var(--color-content-high);
  font-family: "Inter", sans-serif;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.1;
}

.pps__swatch:active,
.pps__lead:active {
  transform: scale(0.92);
}

.pps__swatch.is-current,
.pps__lead.is-current {
  box-shadow:
    0 0 0 2px var(--color-toolbar-background, #000),
    0 0 0 4px var(--color-tool-active);
}

.pps__hex {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 0 6px 0 12px;
  border: 1px solid var(--color-stroke);
  border-radius: 12px;
  background: var(--color-tool-selected-bg);
}

.pps__hash {
  color: var(--color-content-low);
  font-family: "Roboto Mono", ui-monospace, monospace;
}

.pps__hex input {
  flex: 1 1 auto;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font-family: "Roboto Mono", ui-monospace, monospace;
  /* 16px keeps iOS from zooming into the field. */
  font-size: 16px;
  text-transform: uppercase;
  outline: none;
}

.pps__preview {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border: 1px solid var(--color-stroke);
  border-radius: 8px;
}
</style>
