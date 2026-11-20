<!--
  PopoverSwatches.vue

  The colour controls shared by the text Color and tile Fill popovers, in two
  views:

  - Swatches: one row — an optional leading choice (No fill / Auto), the theme
    swatches, the user's saved custom colours — with the spectrum "Custom"
    button pinned at the end so it never scrolls out of reach.
  - Custom: the row gives way to a hex row (back to swatches, colour dot + hex
    field, eyedropper), the saturation/brightness pad and the hue slider.

  Theme swatches are stored as `var(--token)` so they follow the active theme,
  the same values the desktop pickers write. A custom colour still applied when
  the user goes back to swatches (or closes the popover) is saved to their
  colours, so it comes back as a swatch in every picker.

  The hex field always shows the applied colour (theme tokens resolved to their
  hex), only accepts hex digits, and applies as soon as six are typed. Every
  step of a drag writes the colour: the popover visit is one undo step.

  The eyedropper only shows where the EyeDropper API exists (desktop Chromium,
  i.e. a narrow desktop window running the phone editor).
-->
<template>
  <div ref="rootRef" class="pps">
    <div v-if="!customOpen" class="pps__bar">
      <div class="pps__row" role="listbox" :aria-label="label">
        <button
          v-if="lead"
          type="button"
          class="pps__swatch pps__lead"
          role="option"
          :class="{
            'is-current': modelValue === lead.value,
            'pps__lead--icon': lead.icon === 'no-fill',
          }"
          :aria-selected="modelValue === lead.value"
          :aria-label="lead.label"
          @click="$emit('pick', lead.value)"
        >
          <NoFillIcon v-if="lead.icon === 'no-fill'" :size="24" />
          <template v-else>{{ lead.label }}</template>
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
        <button
          v-for="color in savedColors"
          :key="`saved-${color}`"
          type="button"
          class="pps__swatch"
          role="option"
          :class="{ 'is-current': currentHex === color }"
          :aria-selected="currentHex === color"
          :aria-label="`Saved color ${color}`"
          :style="{ background: color }"
          @click="$emit('pick', color)"
        />
      </div>
      <button
        type="button"
        class="pps__swatch pps__custom"
        :class="{ 'is-current': isCustomCurrent }"
        aria-label="Custom color"
        data-testid="pps-custom"
        @click="openCustom"
      />
    </div>

    <div v-else class="pps__card" role="group" :aria-label="`Custom ${label}`">
      <div class="pps__hex-row">
        <button
          type="button"
          class="pps__icon-btn"
          aria-label="Back to swatches"
          data-testid="pps-back"
          @click="closeCustom"
        >
          <ChevronLeftIcon :size="20" />
        </button>
        <label class="pps__hex">
          <span
            class="pps__dot"
            :style="{ background: previewColor }"
            aria-hidden="true"
          />
          <span class="pps__hash" aria-hidden="true">#</span>
          <input
            ref="hexInputRef"
            :value="hexDraft"
            type="text"
            inputmode="text"
            autocapitalize="characters"
            autocomplete="off"
            spellcheck="false"
            maxlength="6"
            placeholder="FFFFFF"
            :aria-label="`${label} hex value`"
            data-testid="pps-hex"
            @input="onHexInput"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
            @blur="onHexBlur"
          />
        </label>
        <button
          v-if="eyeDropperSupported"
          type="button"
          class="pps__icon-btn"
          aria-label="Pick a color from the page"
          @click="onEyeDropper"
        >
          <EyeDropperIcon :size="20" />
        </button>
      </div>

      <MobileColorPicker
        v-model="pickerHex"
        @preview="pickCustom"
        @commit="pickCustom"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import MobileColorPicker from "@/components/app/MobileColorPicker.vue";
import NoFillIcon from "@/components/icons/NoFillIcon.vue";
import EyeDropperIcon from "@/components/icons/EyeDropperIcon.vue";
import ChevronLeftIcon from "@/components/icons/ChevronLeftIcon.vue";
import { useSavedColors } from "@/composables/useSavedColors";
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
    /** A leading non-colour choice; `icon: "no-fill"` draws it as an icon. */
    lead?: { value: string; label: string; icon?: "no-fill" } | null;
  }>(),
  { lead: null },
);

const emit = defineEmits<{ pick: [value: string] }>();

const rootRef = ref<HTMLElement | null>(null);
const hexInputRef = ref<HTMLInputElement | null>(null);

const {
  savedColors,
  load: loadSavedColors,
  addColor: saveColor,
} = useSavedColors();

/** The current colour when it is a literal hex (a custom pick), else "". */
const currentHex = computed(() =>
  typeof props.modelValue === "string" ? normalizeHex(props.modelValue) : "",
);

const rgbToHex = (rgb: string): string => {
  const match = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?/.exec(
    rgb,
  );
  if (!match) return "";
  if (match[4] !== undefined && parseFloat(match[4]) === 0) return "";
  return normalizeHex(
    [match[1], match[2], match[3]]
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join(""),
  );
};

/**
 * The current colour as a hex, with a `var(--token)` swatch resolved against
 * the live theme. The lead choice (Auto / No fill) and "mixed" have no single
 * colour, so they resolve to "".
 */
const resolvedHex = (): string => {
  const value = props.modelValue;
  if (typeof value !== "string" || value === props.lead?.value) return "";
  if (currentHex.value) return currentHex.value;
  if (!value.startsWith("var(")) return "";
  // Let the browser resolve the token (and anything it references) to rgb().
  const host = rootRef.value ?? document.body;
  const probe = document.createElement("span");
  probe.style.display = "none";
  probe.style.color = value;
  host.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  probe.remove();
  return probe.style.color ? rgbToHex(rgb) : "";
};

const hexDraft = ref("");

// The pad and hue start from the current colour, swatches included; "No fill"
// and "Auto" have no colour to show, so they leave it where it was.
const pickerHex = ref("#FFFFFF");

const syncFromValue = () => {
  const hex = resolvedHex();
  // Never rewrite the field under the user's fingers.
  if (document.activeElement !== hexInputRef.value) {
    hexDraft.value = hex.slice(1);
  }
  if (hex) pickerHex.value = hex;
};

watch(() => props.modelValue, syncFromValue);

const isPreset = (value: string) =>
  props.swatches.some((swatch) => swatch.value === value);

/** A custom hex is applied that isn't one of the saved swatches yet. */
const isCustomCurrent = computed(
  () =>
    !!currentHex.value &&
    !isPreset(props.modelValue as string) &&
    !savedColors.value.includes(currentHex.value),
);

// A finished hex previews itself; while typing, the applied colour stays shown.
const previewColor = computed(() => {
  if (hexDraft.value.length === 6) return `#${hexDraft.value}`;
  const hex = resolvedHex();
  return hex || "transparent";
});

// --- Custom colours -------------------------------------------------------

const customOpen = ref(false);

/** The last custom hex this visit applied, saved once the user settles on it. */
const pendingCustom = ref("");

const pickCustom = (hex: string) => {
  const normalized = normalizeHex(hex);
  if (!normalized) return;
  pendingCustom.value = normalized;
  if (normalized !== currentHex.value) emit("pick", normalized);
};

/** Save the custom colour if it's still the one applied. */
const savePendingCustom = () => {
  const hex = pendingCustom.value;
  pendingCustom.value = "";
  if (!hex || hex !== currentHex.value) return;
  if (savedColors.value.includes(hex)) return;
  void saveColor(hex);
};

const openCustom = () => {
  syncFromValue();
  customOpen.value = true;
};

const closeCustom = () => {
  savePendingCustom();
  customOpen.value = false;
};

// --- Eyedropper -------------------------------------------------------------

interface EyeDropperConstructor {
  new (): { open: () => Promise<{ sRGBHex: string }> };
}

const EyeDropperCtor = (
  window as unknown as { EyeDropper?: EyeDropperConstructor }
).EyeDropper;
const eyeDropperSupported = !!EyeDropperCtor;

const onEyeDropper = async () => {
  if (!EyeDropperCtor) return;
  try {
    const { sRGBHex } = await new EyeDropperCtor().open();
    pickCustom(sRGBHex);
  } catch {
    // Dismissed (Escape) — nothing to do.
  }
};

// --- Hex field --------------------------------------------------------------

/** Strip a pasted `#` / `0x` and anything that isn't a hex digit. */
const sanitizeHex = (raw: string): string =>
  raw
    .trim()
    .replace(/^(#|0x)/i, "")
    .replace(/[^0-9a-f]/gi, "")
    .slice(0, 6)
    .toUpperCase();

const onHexInput = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const clean = sanitizeHex(input.value);
  // Rewrite the field in place so a rejected character never shows.
  if (input.value !== clean) {
    const caret = Math.min(input.selectionStart ?? clean.length, clean.length);
    input.value = clean;
    input.setSelectionRange(caret, caret);
  }
  hexDraft.value = clean;
  // Six digits is a whole colour: apply it live.
  if (clean.length === 6) pickCustom(clean);
};

const onHexBlur = () => {
  // Three digits is shorthand — expand and apply it on leaving the field.
  if (hexDraft.value.length === 3) pickCustom(hexDraft.value);
  // Anything incomplete snaps back to the applied colour.
  hexDraft.value = resolvedHex().slice(1);
};

onMounted(() => {
  syncFromValue();
  void loadSavedColors();
});

// Closing the popover counts as settling on the colour.
onBeforeUnmount(savePendingCustom);
</script>

<style scoped>
.pps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* --- Swatches view --- */

.pps__bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pps__row {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  gap: 8px;
  /* Room for the current swatch's ring, which the scrolling would clip. */
  margin: -4px;
  padding: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.pps__row::-webkit-scrollbar {
  display: none;
}

.pps__swatch {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--color-stroke);
  border-radius: 10px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--duration-instant) var(--easing-smooth);
}

.pps__lead {
  width: auto;
  min-width: 36px;
  padding: 0 8px;
  background: var(--color-tool-selected-bg);
  color: var(--color-content-high);
  font-family: "Inter", sans-serif;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.1;
}

.pps__lead--icon {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--color-text-primary);
}

/* The same spectrum the grid settings sheet uses for "pick a colour". */
.pps__custom {
  background: conic-gradient(
    from 90deg,
    var(--color-red),
    var(--color-yellow),
    var(--color-green),
    var(--color-cyan),
    var(--color-blue),
    var(--color-purple),
    var(--color-red)
  );
}

.pps__swatch:active {
  transform: scale(0.92);
}

.pps__swatch.is-current {
  box-shadow:
    0 0 0 2px var(--color-toolbar-background, #000),
    0 0 0 4px var(--color-tool-active);
}

/* --- Custom view --- */

.pps__card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* MobileColorPicker brings its own sheet chrome; the popover is the surface here. */
.pps__card :deep(.mcp-panel) {
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
}

/* Shorter than the Grid settings page: the tile stays in view above the card. */
.pps__card :deep(.mcp-pad) {
  height: 120px;
}

.pps__hex-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
  height: 44px;
}

.pps__icon-btn {
  flex: 0 0 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--color-stroke);
  border-radius: 12px;
  background: var(--color-tool-selected-bg);
  color: var(--color-text-primary);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.pps__icon-btn:active {
  transform: scale(0.94);
}

.pps__hex {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid var(--color-stroke);
  border-radius: 12px;
  background: var(--color-tool-selected-bg);
}

.pps__dot {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-stroke);
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
</style>
