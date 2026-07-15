<!--
  MobileCommandInput.vue

  The right-hand half of the morphing Mobile 2.0 command pill: a static filter
  chip (e.g. `/TILE`), a text field with an animated typewriter placeholder, a
  carousel/list view toggle, and a close button on the far right.

  Reusable across command modes: `/TILE` (Add a Tile, Phase 5) reuses this, and
  `/GRID` (Grid Settings, Phase 6) will too — only `filterLabel` + `placeholders`
  differ. The morph orchestration (growing the pill) lives in the parent.

  Note: the chip is intentionally not removable yet. A removable filter (→ a
  general "omni" search) is deferred until that search experience is designed.
-->
<template>
  <div class="mci">
    <span v-if="filterLabel" class="mci-chip">{{ filterLabel }}</span>

    <input
      ref="inputRef"
      class="mci-input"
      type="text"
      :value="modelValue"
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      @input="onInput"
      @keydown="onKeydown"
    />

    <button
      type="button"
      class="mci-btn"
      :class="{ 'mci-btn--active': viewMode === 'list' }"
      :aria-pressed="viewMode === 'list'"
      aria-label="Toggle list view"
      @click="emit('toggle-view')"
    >
      <ListIcon :size="24" />
    </button>

    <button
      type="button"
      class="mci-btn mci-close"
      :aria-label="closeLabel"
      @click="emit('close')"
    >
      <CloseIcon :size="24" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import CloseIcon from "@/components/icons/CloseIcon.vue";
import ListIcon from "@/components/icons/ListIcon.vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    /** Static filter chip label (e.g. "/TILE"); null renders a plain input. */
    filterLabel?: string | null;
    /** Phrases cycled through the typewriter placeholder while empty. */
    placeholders?: string[];
    /**
     * A fixed placeholder that overrides the rotating one (no animation). Used
     * once a specific tile type is selected to prompt for exactly what it needs.
     */
    staticPlaceholder?: string | null;
    viewMode?: "carousel" | "list";
    ariaLabel?: string;
    closeLabel?: string;
  }>(),
  {
    filterLabel: null,
    placeholders: () => [],
    staticPlaceholder: null,
    viewMode: "carousel",
    ariaLabel: "Add a tile",
    closeLabel: "Close",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  submit: [value: string];
  "toggle-view": [];
  close: [];
  /** Two backspaces on an empty field — the parent clears any pinned type. */
  unpin: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);

// ── Typewriter placeholder ───────────────────────────────────────────────────
const TYPE_MS = 55;
const DELETE_MS = 28;
const PAUSE_MS = 1500;
const typed = ref("");
let typeTimer: ReturnType<typeof setTimeout> | null = null;
let phraseIndex = 0;
let charIndex = 0;
let deleting = false;
let reducedMotion = false;

const placeholder = ref("");

const stopTypewriter = () => {
  if (typeTimer) {
    clearTimeout(typeTimer);
    typeTimer = null;
  }
};

const syncPlaceholder = () => {
  if (props.modelValue) {
    placeholder.value = "";
    return;
  }
  placeholder.value = props.staticPlaceholder ?? typed.value;
};

const tick = () => {
  const phrases = props.placeholders;
  if (!phrases.length) return;
  const current = phrases[phraseIndex % phrases.length];

  if (!deleting) {
    charIndex += 1;
    typed.value = current.slice(0, charIndex);
    syncPlaceholder();
    if (charIndex >= current.length) {
      deleting = true;
      typeTimer = setTimeout(tick, PAUSE_MS);
      return;
    }
    typeTimer = setTimeout(tick, TYPE_MS);
    return;
  }

  charIndex -= 1;
  typed.value = current.slice(0, Math.max(0, charIndex));
  syncPlaceholder();
  if (charIndex <= 0) {
    deleting = false;
    phraseIndex += 1;
    typeTimer = setTimeout(tick, TYPE_MS);
    return;
  }
  typeTimer = setTimeout(tick, DELETE_MS);
};

const startTypewriter = () => {
  stopTypewriter();
  // A fixed prompt takes over once a tile type is chosen — no rotation.
  if (props.staticPlaceholder) {
    syncPlaceholder();
    return;
  }
  if (!props.placeholders.length) return;
  if (reducedMotion) {
    typed.value = props.placeholders[0];
    syncPlaceholder();
    return;
  }
  phraseIndex = 0;
  charIndex = 0;
  deleting = false;
  tick();
};

// Counts consecutive Backspace presses while the field is empty; two in a row
// clear the active type filter (chip → the generic `/TILE`). Any other key or
// input resets it.
const emptyBackspaces = ref(0);

const onInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  emptyBackspaces.value = 0;
  emit("update:modelValue", value);
  syncPlaceholder();
};

const onSubmit = () => emit("submit", props.modelValue);

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    event.preventDefault();
    onSubmit();
    return;
  }
  if (event.key === "Backspace" && !props.modelValue) {
    emptyBackspaces.value += 1;
    if (emptyBackspaces.value >= 2) {
      emptyBackspaces.value = 0;
      emit("unpin");
    }
    return;
  }
  emptyBackspaces.value = 0;
};

// Selecting a tile type swaps in its fixed prompt; clearing it resumes rotation.
watch(
  () => props.staticPlaceholder,
  () => startTypewriter(),
);

const focus = () => inputRef.value?.focus();
defineExpose({ focus });

onMounted(() => {
  reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  startTypewriter();
});

onBeforeUnmount(stopTypewriter);
</script>

<style lang="scss" scoped>
.mci {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
}

.mci-chip {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  height: 40px;
  padding: 0 var(--spacing-sm);
  border-radius: var(--radius-full);
  background: var(--color-base-8);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.mci-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 40px;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  outline: none;

  &::placeholder {
    color: var(--color-content-default);
    opacity: 0.8;
  }
}

.mci-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  padding: 0;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-content-default);
  cursor: pointer;
  line-height: 0;
  transition:
    background-color var(--duration-fast) var(--easing-smooth),
    color var(--duration-fast) var(--easing-smooth);

  &:hover,
  &--active {
    background: var(--color-base-8);
    color: var(--color-text-primary);
  }
}
</style>
