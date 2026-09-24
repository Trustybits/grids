<template>
  <Teleport to="body">
    <div
      v-if="toolbar.visible.value && state"
      ref="rootRef"
      class="rt-format-toolbar"
      role="toolbar"
      aria-label="Text formatting"
      :style="{
        top: `${toolbar.position.value.top}px`,
        left: `${toolbar.position.value.left}px`,
      }"
      @mousedown="keepEditorFocus"
      @pointerdown.stop
      @click.stop
    >
      <!-- Font family -->
      <div class="rt-ft-group">
        <button
          type="button"
          class="rt-ft-btn rt-ft-dropdown"
          :class="{ open: openMenu === 'font' }"
          title="Font"
          aria-haspopup="listbox"
          :aria-expanded="openMenu === 'font'"
          @click="toggleMenu('font')"
        >
          <span :style="{ fontFamily: state.fontFamily }">{{ state.fontFamily }}</span>
          <span class="rt-ft-caret" aria-hidden="true">▾</span>
        </button>
        <div v-if="openMenu === 'font'" class="rt-ft-menu" role="listbox" aria-label="Font">
          <button
            v-for="family in fontFamilies"
            :key="family"
            type="button"
            role="option"
            class="rt-ft-menu-item"
            :class="{ active: family === state.fontFamily }"
            :aria-selected="family === state.fontFamily"
            :style="{ fontFamily: family }"
            @click="apply(() => setFontFamily(editor!, family))"
          >
            {{ family }}
          </button>
        </div>
      </div>

      <!-- Size: presets, then a custom px input (FigJam-style) -->
      <div class="rt-ft-group">
        <button
          type="button"
          class="rt-ft-btn rt-ft-dropdown"
          :class="{ open: openMenu === 'size' }"
          title="Text size"
          aria-haspopup="listbox"
          :aria-expanded="openMenu === 'size'"
          @click="toggleMenu('size')"
        >
          <span>{{ state.fontSizePreset ?? `${state.fontSizePx}px` }}</span>
          <span class="rt-ft-caret" aria-hidden="true">▾</span>
        </button>
        <div v-if="openMenu === 'size'" class="rt-ft-menu" role="listbox" aria-label="Text size">
          <button
            v-for="preset in fontSizes"
            :key="preset"
            type="button"
            role="option"
            class="rt-ft-menu-item rt-ft-size-item"
            :class="{ active: preset === state.fontSizePreset }"
            :aria-selected="preset === state.fontSizePreset"
            @click="apply(() => setFontSizePx(editor!, presetPx[preset]))"
          >
            <span>{{ preset }}</span>
            <span class="rt-ft-hint">{{ presetPx[preset] }}</span>
          </button>
          <label class="rt-ft-custom-size">
            <span class="rt-ft-hint">Custom</span>
            <input
              v-model="customSize"
              class="rt-ft-input"
              type="text"
              inputmode="numeric"
              aria-label="Custom text size in pixels"
              @keydown.enter.prevent="applyCustomSize"
              @keydown.esc.prevent="closeMenus"
            />
            <span class="rt-ft-hint">px</span>
          </label>
        </div>
      </div>

      <span class="rt-ft-sep" />

      <!-- Marks -->
      <button
        v-for="mark in markButtons"
        :key="mark.id"
        type="button"
        class="rt-ft-btn rt-ft-icon"
        :class="[`rt-ft-mark-${mark.id}`, { active: state.marks[mark.id] }]"
        :title="mark.title"
        :aria-pressed="state.marks[mark.id]"
        @click="apply(() => toggleMark(editor!, mark.id))"
      >
        {{ mark.glyph }}
      </button>

      <span class="rt-ft-sep" />

      <!-- Text color -->
      <div class="rt-ft-group">
        <button
          type="button"
          class="rt-ft-btn rt-ft-icon rt-ft-color"
          :class="{ open: openMenu === 'color' }"
          title="Text color"
          aria-haspopup="true"
          :aria-expanded="openMenu === 'color'"
          @click="toggleMenu('color')"
        >
          <span>A</span>
          <span
            class="rt-ft-color-bar"
            :class="{ auto: !state.color }"
            :style="state.color ? { background: state.color } : {}"
          />
        </button>
        <div v-if="openMenu === 'color'" class="rt-ft-menu rt-ft-color-menu" aria-label="Text color">
          <button
            type="button"
            class="rt-ft-auto-color"
            :class="{ active: !state.color }"
            title="Automatic: contrasts with the tile"
            @click="apply(() => setTextColor(editor!, null))"
          >
            Auto
          </button>
          <div class="rt-ft-swatches">
            <button
              v-for="token in colorTokens"
              :key="token"
              type="button"
              class="rt-ft-swatch"
              :class="{ active: state.color === `var(${token})` }"
              :style="{ background: `var(${token})` }"
              :title="token.replace('--color-', '')"
              @click="apply(() => setTextColor(editor!, `var(${token})`))"
            />
          </div>
          <label class="rt-ft-custom-size">
            <span class="rt-ft-hint">#</span>
            <input
              v-model="customHex"
              class="rt-ft-input"
              type="text"
              maxlength="7"
              placeholder="FFFFFF"
              aria-label="Custom text color hex"
              @keydown.enter.prevent="applyCustomHex"
              @keydown.esc.prevent="closeMenus"
            />
          </label>
        </div>
      </div>

      <span class="rt-ft-sep" />

      <!-- Block alignment -->
      <button
        v-for="align in alignButtons"
        :key="align.id"
        type="button"
        class="rt-ft-btn rt-ft-icon"
        :class="{ active: state.align === align.id }"
        :title="align.title"
        :aria-pressed="state.align === align.id"
        @click="apply(() => setBlockAlign(editor!, align.id))"
      >
        <component :is="align.icon" />
      </button>

      <span class="rt-ft-sep" />

      <!-- Link -->
      <button
        type="button"
        class="rt-ft-btn rt-ft-icon"
        :class="{ active: !!state.link }"
        :title="state.link ? `Edit link (${state.link})` : 'Link'"
        :aria-pressed="!!state.link"
        @click="onLink"
      >
        <LinkIcon />
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, markRaw, ref, watch } from "vue";
import type { Editor } from "@tiptap/vue-3";
import { FONT_FAMILIES, FONT_SIZES } from "@/constants/textStyles";
import {
  FONT_SIZE_PRESET_PX,
  normalizeFontSizeInput,
  setBlockAlign,
  setFontFamily,
  setFontSizePx,
  setTextColor,
  toggleMark,
  type ToggleableMark,
} from "@/utils/richText/formatting";
import { useFloatingToolbar } from "@/composables/useFloatingToolbar";
import AlignLeftIcon from "@/components/icons/toolbar/AlignLeftIcon.vue";
import AlignCenterIcon from "@/components/icons/toolbar/AlignCenterIcon.vue";
import AlignRightIcon from "@/components/icons/toolbar/AlignRightIcon.vue";
import LinkIcon from "@/components/icons/LinkIcon.vue";

const props = defineProps<{
  editor: Editor | undefined;
  /** Edit mode, owner, and a device that gets the floating toolbar. */
  active: boolean;
  /** Another floating surface (slash menu, inline form) is open. */
  suppressed: boolean;
}>();

const emit = defineEmits<{
  /** Open the link editor for the selection; null href when none. */
  "edit-link": [href: string | null];
}>();

type MenuId = "font" | "size" | "color";

const fontFamilies = FONT_FAMILIES;
const fontSizes = FONT_SIZES;
const presetPx = FONT_SIZE_PRESET_PX;

// The same theme tokens the tile color picker offers, stored as var(...) so
// text colors follow the active theme.
const colorTokens = [
  "--color-red",
  "--color-orange",
  "--color-yellow",
  "--color-green",
  "--color-cyan",
  "--color-blue",
  "--color-purple",
  "--color-pink",
  "--color-light-100",
  "--color-dark-0",
] as const;

const markButtons: { id: ToggleableMark; title: string; glyph: string }[] = [
  { id: "bold", title: "Bold", glyph: "B" },
  { id: "italic", title: "Italic", glyph: "I" },
  { id: "underline", title: "Underline", glyph: "U" },
  { id: "strike", title: "Strikethrough", glyph: "S" },
  { id: "code", title: "Inline code", glyph: "</>" },
];

const alignButtons = [
  { id: "left", title: "Align left", icon: markRaw(AlignLeftIcon) },
  { id: "center", title: "Align center", icon: markRaw(AlignCenterIcon) },
  { id: "right", title: "Align right", icon: markRaw(AlignRightIcon) },
] as const;

const rootRef = ref<HTMLElement | null>(null);
const openMenu = ref<MenuId | null>(null);
const customSize = ref("");
const customHex = ref("");

const toolbar = useFloatingToolbar({
  editor: computed(() => props.editor),
  isActive: () => props.active,
  isSuppressed: () => props.suppressed,
  element: rootRef,
});

const state = computed(() => toolbar.formatting.value);

const closeMenus = () => {
  openMenu.value = null;
  props.editor?.commands.focus(undefined, { scrollIntoView: false });
};

const toggleMenu = (menu: MenuId) => {
  openMenu.value = openMenu.value === menu ? null : menu;
  if (openMenu.value === "size") customSize.value = String(state.value?.fontSizePx ?? "");
  if (openMenu.value === "color") customHex.value = "";
};

/** Run a formatting command, then close any open menu. */
const apply = (command: () => void) => {
  if (!props.editor) return;
  command();
  openMenu.value = null;
  toolbar.refresh();
};

const applyCustomSize = () => {
  const editor = props.editor;
  const px = normalizeFontSizeInput(customSize.value);
  if (px === null || !editor) return;
  apply(() => setFontSizePx(editor, px));
};

const applyCustomHex = () => {
  const editor = props.editor;
  const hex = customHex.value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex) || !editor) return;
  apply(() => setTextColor(editor, `#${hex.toLowerCase()}`));
};

const onLink = () => {
  openMenu.value = null;
  emit("edit-link", state.value?.link ?? null);
};

/**
 * Buttons must not take focus from the editor, or the selection (and any
 * stored marks at the caret) would be lost. Inputs are the exception.
 */
const keepEditorFocus = (event: MouseEvent) => {
  if (!(event.target as HTMLElement).closest("input")) event.preventDefault();
};

// Menus belong to one toolbar appearance.
watch(
  () => toolbar.visible.value,
  (visible) => {
    if (!visible) openMenu.value = null;
  },
);

defineExpose({ refresh: toolbar.refresh, visible: toolbar.visible });
</script>

<style scoped>
.rt-format-toolbar {
  position: fixed;
  /* Above the tile toolbar and action bar (10000): editing UI wins. */
  z-index: 10010;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: var(--radius-md, 8px);
  border: var(--tile-border-width, 1px) solid var(--color-tile-stroke);
  background: var(--color-tile-background);
  color: var(--color-text-primary);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  font-family: "Inter", sans-serif;
  font-size: 13px;
  user-select: none;
  white-space: nowrap;
}

.rt-ft-group {
  position: relative;
}

.rt-ft-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 30px;
  min-width: 30px;
  padding: 0 6px;
  border: none;
  border-radius: var(--radius-sm, 6px);
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.rt-ft-btn:hover,
.rt-ft-btn.open {
  background: var(--color-base-55);
}

.rt-ft-btn.active {
  background: var(--color-base-55);
  box-shadow: inset 0 0 0 1px var(--color-tile-stroke);
}

.rt-ft-dropdown {
  max-width: 140px;
}

.rt-ft-dropdown > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
}

.rt-ft-caret {
  font-size: 9px;
  opacity: 0.6;
}

.rt-ft-mark-bold {
  font-weight: 700;
}

.rt-ft-mark-italic {
  font-style: italic;
  font-family: Georgia, serif;
}

.rt-ft-mark-underline {
  text-decoration: underline;
}

.rt-ft-mark-strike {
  text-decoration: line-through;
}

.rt-ft-mark-code {
  font-family: "Geist Mono", monospace;
  font-size: 11px;
}

.rt-ft-icon :deep(svg) {
  width: 16px;
  height: 16px;
}

.rt-ft-color {
  flex-direction: column;
  gap: 1px;
  font-weight: 600;
  line-height: 1;
}

.rt-ft-color-bar {
  width: 14px;
  height: 3px;
  border-radius: 2px;
}

.rt-ft-color-bar.auto {
  background: linear-gradient(90deg, #000 50%, #fff 50%);
  box-shadow: 0 0 0 1px var(--color-tile-stroke);
}

.rt-ft-sep {
  width: 1px;
  height: 20px;
  margin: 0 3px;
  background: var(--color-tile-stroke);
}

.rt-ft-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  display: flex;
  flex-direction: column;
  min-width: 160px;
  padding: 4px;
  border-radius: var(--radius-md, 8px);
  border: var(--tile-border-width, 1px) solid var(--color-tile-stroke);
  background: var(--color-tile-background);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
}

.rt-ft-menu-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 8px;
  border: none;
  border-radius: var(--radius-sm, 6px);
  background: transparent;
  color: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.rt-ft-menu-item:hover,
.rt-ft-menu-item.active {
  background: var(--color-base-55);
}

.rt-ft-hint {
  font-size: 11px;
  opacity: 0.6;
}

.rt-ft-custom-size {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 6px 8px 4px;
  border-top: 1px solid var(--color-tile-stroke);
}

.rt-ft-input {
  width: 64px;
  padding: 4px 6px;
  border-radius: var(--radius-sm, 6px);
  border: 1px solid var(--color-tile-stroke);
  background: transparent;
  color: inherit;
  font: inherit;
  outline: none;
  user-select: text;
}

.rt-ft-input:focus {
  border-color: var(--color-text-primary);
}

.rt-ft-color-menu {
  min-width: 188px;
}

.rt-ft-auto-color {
  padding: 6px 8px;
  border: 1px solid var(--color-tile-stroke);
  border-radius: var(--radius-sm, 6px);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.rt-ft-auto-color.active,
.rt-ft-auto-color:hover {
  background: var(--color-base-55);
}

.rt-ft-swatches {
  display: grid;
  grid-template-columns: repeat(5, 28px);
  gap: 6px;
  padding: 8px 2px 2px;
}

.rt-ft-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--color-tile-stroke);
  cursor: pointer;
}

.rt-ft-swatch.active {
  box-shadow:
    0 0 0 2px var(--color-tile-background),
    0 0 0 4px var(--color-text-primary);
}
</style>
