<!--
  FontPopover.vue — Font (Figma 146:22581): the family (a list that opens in the
  card, each name set in its own font, which a native picker can't do), a size
  preset, and a custom px stepper. Applies to all the text in the tile(s); while
  typing, the format bar handles the selected words instead.
-->
<template>
  <div class="pp-stack">
    <div class="pp-section">
      <p class="pp-label">Font</p>
      <button
        type="button"
        class="pp-select"
        aria-label="Font family"
        aria-haspopup="listbox"
        :aria-expanded="fontListOpen"
        @click="fontListOpen = !fontListOpen"
      >
        <span
          class="pp-select__value"
          :style="typeof family === 'string' ? { fontFamily: family } : undefined"
        >
          {{ typeof family === "string" ? family : "Mixed" }}
        </span>
        <MobileToolIcon
          name="chevron"
          class="pp-select__chevron"
          :class="{ 'is-open': fontListOpen }"
        />
      </button>
      <div
        v-if="fontListOpen"
        class="pp-menu"
        role="listbox"
        aria-label="Font family"
      >
        <button
          v-for="name in FONT_FAMILIES"
          :key="name"
          type="button"
          class="pp-menu__item"
          role="option"
          :class="{ 'is-current': name === family }"
          :aria-selected="name === family"
          :style="{ fontFamily: name }"
          @click="pickFamily(name)"
        >
          {{ name }}
          <CheckIcon v-if="name === family" :size="20" class="pp-menu__check" />
        </button>
      </div>
    </div>

    <div class="pp-section">
      <p class="pp-label">Text size</p>
      <PopoverChoices
        label="Text size"
        :options="sizeOptions"
        :model-value="sizePreset"
        @select="setPreset"
      />

      <div class="pp-stepper" role="group" aria-label="Custom text size">
        <span class="pp-stepper__label">Custom</span>
        <button
          type="button"
          class="pp-stepper__btn"
          aria-label="Smaller"
          :disabled="sizePx !== null && sizePx <= MIN_FONT_SIZE_PX"
          @click="step(-1)"
        >
          −
        </button>
        <span class="pp-stepper__value">
          <input
            v-model="draft"
            class="pp-stepper__input"
            type="text"
            inputmode="numeric"
            aria-label="Text size in pixels"
            @keydown.enter.prevent="applyDraft"
            @blur="applyDraft"
          />
          <span class="pp-stepper__unit">px</span>
        </span>
        <button
          type="button"
          class="pp-stepper__btn"
          aria-label="Larger"
          :disabled="sizePx !== null && sizePx >= MAX_FONT_SIZE_PX"
          @click="step(1)"
        >
          +
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import PopoverChoices, { type PopoverChoice } from "./PopoverChoices.vue";
import MobileToolIcon from "../MobileToolIcon.vue";
import CheckIcon from "@/components/icons/CheckIcon.vue";
import { useToolPopoverVisit } from "@/composables/useToolPopoverVisit";
import { WRITERS } from "@/registries/tileToolbar/mobileTools";
import { FONT_FAMILIES, FONT_SIZES } from "@/constants/textStyles";
import {
  DEFAULT_FONT_SIZE_PX,
  FONT_SIZE_PRESET_PX,
  MAX_FONT_SIZE_PX,
  MIN_FONT_SIZE_PX,
  normalizeFontSizeInput,
  presetForPx,
} from "@/utils/richText/formatting";
import { MIXED } from "@/utils/richText/docTransforms";

const visit = useToolPopoverVisit();

const sizeOptions: PopoverChoice[] = FONT_SIZES.map((preset) => ({
  value: preset,
  label: preset,
  hint: `${FONT_SIZE_PRESET_PX[preset]} px`,
}));

const family = computed(() => visit.read(WRITERS.fontFamily));

/** The shared px size, or null when the tiles disagree. */
const sizePx = computed(() => {
  const value = visit.read(WRITERS.fontSizePx);
  return value === MIXED ? null : value;
});

const sizePreset = computed(() =>
  sizePx.value === null ? null : presetForPx(sizePx.value),
);

const draft = ref("");
watch(
  sizePx,
  (px) => {
    draft.value = px === null ? "" : String(px);
  },
  { immediate: true },
);

const fontListOpen = ref(false);

const pickFamily = (name: string) => {
  visit.write(WRITERS.fontFamily, name);
  fontListOpen.value = false;
};

const setSize = (px: number) => visit.write(WRITERS.fontSizePx, px);

const setPreset = (preset: string) =>
  setSize(FONT_SIZE_PRESET_PX[preset as keyof typeof FONT_SIZE_PRESET_PX]);

const step = (direction: 1 | -1) => {
  const current = sizePx.value ?? DEFAULT_FONT_SIZE_PX;
  const next = Math.min(
    MAX_FONT_SIZE_PX,
    Math.max(MIN_FONT_SIZE_PX, current + direction),
  );
  setSize(next);
};

const applyDraft = () => {
  const px = normalizeFontSizeInput(draft.value);
  if (px === null) {
    draft.value = sizePx.value === null ? "" : String(sizePx.value);
    return;
  }
  if (px !== sizePx.value) setSize(px);
};
</script>
