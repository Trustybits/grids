<!--
  MobileTileEditSheet.vue

  Mobile 2.0 tile editing. Replaces the desktop `TileToolbar` + `TileActions`
  pair, which are hover-oriented, dense, and land on top of the bottom command
  pill on a phone. Tapping a tile morphs that pill into the `/EDIT` command input
  and raises this sheet from behind it — the same morph-and-rise pattern as
  `/TILE` and `/GRID`.

  Controls come from the shared `getTileToolbarButtons` registry via
  `toMobileEditEntries`, so a control added for either surface shows up on both.
  What this component owns is presentation: sections instead of one long row,
  labelled rows instead of hover tooltips, and inline controls in place of the
  desktop floating panels (alignment, font family, font size).

  It renders in `MobileGridBar` alongside the other sheets. The few things only
  the tile itself can supply — its live content component, the Griddle-routed
  resize, its exit animation — are read from the handle the activated tile
  registers with `useMobileTileEdit`, rather than passed as a prop: the handle is
  a bag of the tile's own refs, and travelling through a prop would have Vue
  unwrap them and break the reactive link.

  The header preview is deliberately passive and geometry-only: it mirrors the
  tile's rendered footprint, fill and border rather than mounting a second copy
  of the content. That makes the SIZE presets legible (a preset is otherwise an
  abstract icon) and shows a tall tile whole, without a second map/video/editor
  instance fighting the real one for the same tile.

  NOT YET HERE: tile fill color, which needs the `/HEX` command input to accept a
  tile as its target the way it already accepts the grid background. It is
  dropped rather than shown inert — see `DEFERRED_IDS` in mobileEditSections.
-->
<template>
  <div class="mte-panel" role="dialog" :aria-label="`Edit ${typeLabel} tile`">
    <div class="mte-header">
      <div class="mte-preview" aria-hidden="true">
        <div class="mte-preview__tile" :style="previewStyle">
          <span v-if="previewText" class="mte-preview__text">
            {{ previewText }}
          </span>
        </div>
      </div>
      <div class="mte-header__meta">
        <span class="mte-header__label">{{ typeLabel.toUpperCase() }} TILE</span>
        <span class="mte-header__value">{{ shownWidth }}×{{ shownHeight }}</span>
      </div>
    </div>

    <Divider class="mte-separator" />

    <div class="mte-body">
      <section
        v-for="section in visibleSections"
        :key="section.id"
        class="mte-section"
      >
        <span class="mte-section__label">{{ section.label }}</span>

        <!-- SIZE — presets only. On a 4-column phone grid these four cover
             every width the grid can express (25/50/75/100%). -->
        <div v-if="section.id === 'size'" class="mte-presets">
          <button
            v-for="entry in section.entries"
            :key="entry.id"
            type="button"
            class="mte-preset"
            :class="{ 'is-selected': isEntryActive(entry) }"
            :aria-pressed="isEntryActive(entry)"
            :aria-label="resolveLabel(entry)"
            @click="runEntry(entry)"
          >
            <component :is="resolveIcon(entry)" v-if="resolveIcon(entry)" />
          </button>
        </div>

        <template v-else>
          <template v-for="entry in section.entries" :key="entry.id">
            <!-- Inline controls: the registry only declares that the tile
                 offers these; the presentation is ours. -->
            <div
              v-if="entry.id === 'text-align'"
              class="mte-control"
              role="group"
              aria-label="Text alignment"
            >
              <span class="mte-control__label">Align</span>
              <div class="mte-segmented">
                <button
                  v-for="option in HORIZONTAL_ALIGNMENTS"
                  :key="option"
                  type="button"
                  class="mte-segment"
                  :class="{ 'is-selected': activeAlign === option }"
                  :aria-pressed="activeAlign === option"
                  :aria-label="`Align ${option}`"
                  @click="setAlign(option)"
                >
                  <component :is="ALIGN_ICONS[option]" />
                </button>
              </div>
            </div>

            <div
              v-else-if="entry.id === 'font-family'"
              class="mte-control"
              role="group"
              aria-label="Font"
            >
              <span class="mte-control__label">Font</span>
              <div class="mte-chips">
                <button
                  v-for="font in FONT_FAMILIES"
                  :key="font"
                  type="button"
                  class="mte-chip"
                  :class="{ 'is-selected': activeFont === font }"
                  :aria-pressed="activeFont === font"
                  :style="{ fontFamily: font }"
                  @click="setFont(font)"
                >
                  {{ font }}
                </button>
              </div>
            </div>

            <div
              v-else-if="entry.id === 'font-size'"
              class="mte-control"
              role="group"
              aria-label="Font size"
            >
              <span class="mte-control__label">Size</span>
              <div class="mte-segmented">
                <button
                  v-for="size in FONT_SIZES"
                  :key="size"
                  type="button"
                  class="mte-segment mte-segment--text"
                  :class="{ 'is-selected': activeFontSize === size }"
                  :aria-pressed="activeFontSize === size"
                  @click="setFontSize(size)"
                >
                  {{ size }}
                </button>
              </div>
            </div>

            <!-- Everything else runs the registry's own action. -->
            <button
              v-else
              type="button"
              class="mte-row mte-row--action"
              :class="{ 'mte-row--danger': isEntryDanger(entry) }"
              :aria-pressed="entry.isActive ? isEntryActive(entry) : undefined"
              @click="runEntry(entry)"
            >
              <span class="mte-row__icon">
                <component :is="resolveIcon(entry)" v-if="resolveIcon(entry)" />
              </span>
              <span class="mte-row__label">{{ resolveLabel(entry) }}</span>
              <span v-if="isEntryActive(entry)" class="mte-row__state">On</span>
            </button>
          </template>
        </template>

        <!-- ACTIONS also carries what a tile can *do*, which lives in
             useTileActions rather than the toolbar registry. -->
        <template v-if="section.id === 'actions'">
          <a
            v-if="showAction('follow link')"
            class="mte-row mte-row--action"
            :href="resolvedTileUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="mte-row__icon"><ArrowUpRightIcon /></span>
            <span class="mte-row__label">Follow link</span>
          </a>

          <button
            v-if="showAction('duplicate tile')"
            type="button"
            class="mte-row mte-row--action"
            @click="duplicate"
          >
            <span class="mte-row__icon"><DuplicateIcon /></span>
            <span class="mte-row__label">Duplicate tile</span>
          </button>

          <button
            v-if="hasCopyable && showAction('copy to clipboard')"
            type="button"
            class="mte-row mte-row--action"
            @click="copyToClipboard"
          >
            <span class="mte-row__icon"><ClipboardIcon /></span>
            <span class="mte-row__label">Copy to clipboard</span>
          </button>

          <button
            v-if="hasDownload && showAction('download')"
            type="button"
            class="mte-row mte-row--action"
            @click="download"
          >
            <span class="mte-row__icon"><DownloadCloudIcon /></span>
            <span class="mte-row__label">Download</span>
          </button>

          <button
            v-if="showAction('delete tile')"
            type="button"
            class="mte-row mte-row--action mte-row--danger"
            @click="onDelete"
          >
            <span class="mte-row__icon"><TrashIcon /></span>
            <span class="mte-row__label">Delete tile</span>
          </button>
        </template>
      </section>

      <p v-if="!visibleSections.length" class="mte-empty">
        No controls match “{{ query }}”
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, proxyRefs, type Component, type PropType } from "vue";
import type { Tile, TextContent } from "@grids/contracts/types";
import type { ToolbarContext } from "@/types/TileToolbar";
import { getTileToolbarButtons } from "@/registries/tileToolbar";
import {
  MOBILE_EDIT_SECTIONS,
  toMobileEditEntries,
  type MobileEditEntry,
} from "@/registries/tileToolbar/mobileEditSections";
import { getTileDefinition } from "@/registries/tileRegistry";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import { useTileActions } from "@/composables/useTileActions";
import { useMobileTileEdit } from "@/composables/useMobileTileEdit";
import {
  FONT_FAMILIES,
  FONT_SIZES,
  HORIZONTAL_ALIGNMENTS,
  normalizeFontSize,
  type HorizontalAlignment,
} from "@/constants/textStyles";
import Divider from "@/components/ui-elements/Divider.vue";
import AlignLeftIcon from "@/components/icons/toolbar/AlignLeftIcon.vue";
import AlignCenterIcon from "@/components/icons/toolbar/AlignCenterIcon.vue";
import AlignRightIcon from "@/components/icons/toolbar/AlignRightIcon.vue";
import TrashIcon from "@/components/icons/toolbar/TrashIcon.vue";
import DuplicateIcon from "@/components/icons/DuplicateIcon.vue";
import ArrowUpRightIcon from "@/components/icons/tile-actionbar/ArrowUpRightIcon.vue";
import ClipboardIcon from "@/components/icons/tile-actionbar/ClipboardIcon.vue";
import DownloadCloudIcon from "@/components/icons/tile-actionbar/DownloadCloudIcon.vue";

const props = defineProps({
  tile: { type: Object as PropType<Tile>, required: true },
});

const ALIGN_ICONS = {
  left: AlignLeftIcon,
  center: AlignCenterIcon,
  right: AlignRightIcon,
} as const;

const gridView = proxyRefs(useGridViewContext());
const { query, handle } = useMobileTileEdit();
const {
  resolvedTileUrl,
  hasLink,
  hasCopyable,
  hasDownload,
  duplicate,
  copyToClipboard,
  download,
} = useTileActions(() => props.tile);

const typeLabel = computed(
  () => getTileDefinition(props.tile.content.type)?.label ?? "Tile",
);

// ── Registry-derived rows ────────────────────────────────────────────────────
// Null only in the instant between the tile deregistering and this sheet
// unmounting; every consumer below treats that as "no controls".
const ctx = computed<ToolbarContext | null>(() => {
  const tileHandle = handle.value;
  if (!tileHandle) return null;
  return {
    tile: props.tile,
    childComponent: tileHandle.childComponent,
    gridView,
    resizeTile: tileHandle.resizeTile,
    isEditing: tileHandle.isEditing,
    isExitingCropMode: tileHandle.isExitingCropMode,
  };
});

const entries = computed(() => {
  const context = ctx.value;
  if (!context) return [];
  return toMobileEditEntries(
    getTileToolbarButtons(props.tile.content.type, context),
  ).filter((entry) => entry.visible?.(context) ?? true);
});

const resolveLabel = (entry: MobileEditEntry): string => {
  if (typeof entry.label !== "function") return entry.label;
  return ctx.value ? entry.label(ctx.value) : entry.id;
};

// An icon is either a component (an object) or a factory taking the context —
// the same test the desktop toolbar uses.
const resolveIcon = (entry: MobileEditEntry): Component | null => {
  if (!entry.icon) return null;
  if (typeof entry.icon !== "function") return entry.icon;
  return ctx.value
    ? (entry.icon as (c: ToolbarContext) => Component)(ctx.value)
    : null;
};

const isEntryActive = (entry: MobileEditEntry): boolean =>
  (ctx.value && entry.isActive?.(ctx.value)) ?? false;

const isEntryDanger = (entry: MobileEditEntry): boolean => {
  if (typeof entry.danger !== "function") return !!entry.danger;
  return ctx.value ? entry.danger(ctx.value) : false;
};

const runEntry = (entry: MobileEditEntry) => {
  if (!gridView.canEdit || !ctx.value) return;
  entry.action(ctx.value);
};

// ── Filtering ────────────────────────────────────────────────────────────────
// The `/EDIT` input narrows the sheet live. Inline controls match on the word
// the row shows ("Align", "Font", "Size") rather than the registry id.
const INLINE_SEARCH_TERMS: Record<string, string> = {
  "text-align": "align text alignment",
  "font-family": "font family typeface",
  "font-size": "font size text",
};

const needle = computed(() => query.value.trim().toLowerCase());

const matches = (haystack: string) =>
  !needle.value || haystack.toLowerCase().includes(needle.value);

const entryMatches = (entry: MobileEditEntry) =>
  matches(`${resolveLabel(entry)} ${INLINE_SEARCH_TERMS[entry.id] ?? ""}`);

/** Built-in ACTIONS rows are filtered by their visible label. */
const showAction = (label: string) => {
  if (label === "follow link" && !hasLink.value) return false;
  return matches(label);
};

const BUILT_IN_ACTION_LABELS = [
  "follow link",
  "duplicate tile",
  "copy to clipboard",
  "download",
  "delete tile",
];

const visibleSections = computed(() =>
  MOBILE_EDIT_SECTIONS.map((section) => ({
    ...section,
    entries: entries.value.filter(
      (entry) => entry.section === section.id && entryMatches(entry),
    ),
  })).filter((section) => {
    if (section.entries.length) return true;
    // ACTIONS survives on its built-in rows even with nothing from the registry.
    return (
      section.id === "actions" &&
      BUILT_IN_ACTION_LABELS.some((label) => showAction(label))
    );
  }),
);

// ── Text styling (inline controls) ───────────────────────────────────────────
const child = computed(() => handle.value?.childComponent.value ?? null);

const activeAlign = computed<HorizontalAlignment>(
  () => (props.tile.content as TextContent)?.textAlign ?? "left",
);

const setAlign = (align: HorizontalAlignment) => {
  child.value?.handleTextAlignChange?.(align);
};

const activeFont = computed(() => child.value?.getCurrentFont?.());

const setFont = (font: string) => {
  child.value?.handleFontChange?.(font);
};

const activeFontSize = computed(() =>
  normalizeFontSize(child.value?.getCurrentFontSize?.()),
);

const setFontSize = (size: string) => {
  child.value?.handleFontSizeChange?.(size);
};

// ── Passive preview ──────────────────────────────────────────────────────────
// Footprint as rendered at the active breakpoint, not the tile's base (lg)
// size — `resizeTile` writes per-breakpoint overrides without touching
// `tile.w/h`, so reading those would describe the desktop layout.
const shown = computed(() =>
  gridView.displayPositions.find((position) => position.i === props.tile.i),
);
const shownWidth = computed(() => shown.value?.w ?? props.tile.w);
const shownHeight = computed(() => shown.value?.h ?? props.tile.h);

const previewStyle = computed(() => {
  const content = props.tile.content as { backgroundColor?: string };
  return {
    aspectRatio: `${shownWidth.value} / ${shownHeight.value}`,
    background: content.backgroundColor || "var(--color-base-8)",
    borderStyle: props.tile.borderEnabled === false ? "none" : "solid",
  };
});

// Reuses the tile type's own plain-text extraction (the same one behind Copy to
// Clipboard) rather than re-parsing content here.
const previewText = computed(() => {
  const extract = getTileDefinition(props.tile.content.type)?.actions
    ?.copyContent;
  const text = extract?.(props.tile.content as never) ?? "";
  return text.trim().slice(0, 60);
});

// Goes through the tile's own removal path so the exit animation still plays.
const onDelete = () => {
  handle.value?.remove();
};
</script>

<style lang="scss" scoped>
.mte-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  // Matches the grid settings sheet's budget: ~190px on a 568px-tall phone,
  // growing with the screen. The row list scrolls when it overflows.
  height: 33.5vh;
  max-height: 33.5vh;
  padding: var(--spacing-sm) var(--spacing-xs) var(--spacing-xs);
  background-color: var(--color-toolbar-background);
  border: var(--border-width) solid var(--color-stroke);
  /* Square bottom corners so the panel lines up flush with the (top-squared)
     `/EDIT` command input resting directly beneath it. */
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  box-shadow: var(--shadow-xl);
}

.mte-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 0 0 auto;
  padding: var(--spacing-sm);
}

.mte-header__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.mte-header__label {
  color: var(--color-content-low);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.04em;
}

.mte-header__value {
  color: var(--color-content-low);
  font-family: var(--font-family-mono, monospace);
  font-size: var(--font-size-sm);
}

/* Fixed box the mini tile is fitted inside, so a 1×4 and a 4×1 both land in the
   same header slot and the row height never moves as presets are tapped. */
.mte-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 64px;
  height: 44px;
}

.mte-preview__tile {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  max-height: 100%;
  overflow: hidden;
  padding: 2px;
  border: var(--border-width) solid var(--color-stroke);
  border-radius: 4px;
}

.mte-preview__text {
  color: var(--color-text-primary);
  font-size: 6px;
  line-height: 1.2;
  text-align: center;
  overflow: hidden;
}

.mte-panel > .mte-separator {
  margin-top: 0;
}

.mte-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0 var(--spacing-xs);
}

.mte-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-md);
}

.mte-section__label {
  color: var(--color-content-low);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.04em;
}

/* ── SIZE presets ─────────────────────────────────────────────────────────── */
.mte-presets {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.mte-preset {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  // No stroke border: the only ring is the purple selection outline, whose
  // offset gap shows the sheet background through it rather than a white edge.
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-base-8);
  color: var(--color-content-default);
  cursor: pointer;
  transition: outline-color var(--duration-fast) var(--easing-smooth);

  &.is-selected {
    outline: var(--border-width-lg) solid var(--grids-brand-purple);
    outline-offset: var(--border-width-lg);
    color: var(--color-text-primary);
  }
}

/* ── Inline controls ──────────────────────────────────────────────────────── */
.mte-control {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) 0;
}

.mte-control__label {
  color: var(--color-content-low);
  font-size: var(--font-size-sm);
}

.mte-segmented {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: var(--radius-sm);
  background: var(--color-base-8);
}

.mte-segment {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 0;
  min-width: 0;
  min-height: 32px;
  padding: 0 var(--spacing-xs);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-content-low);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--easing-smooth);

  &.is-selected {
    background: var(--color-toolbar-background);
    color: var(--color-text-primary);
  }
}

.mte-segment--text {
  font-family: var(--font-family-base);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

/* Fonts are shown in their own face, so the row scrolls rather than wraps —
   a wrapped grid of mixed-width faces reads as ragged. */
.mte-chips {
  display: flex;
  gap: var(--spacing-xs);
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.mte-chip {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 0 var(--spacing-sm);
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-base-8);
  color: var(--color-content-low);
  font-size: var(--font-size-sm);
  white-space: nowrap;
  cursor: pointer;

  &.is-selected {
    outline: var(--border-width-lg) solid var(--grids-brand-purple);
    outline-offset: var(--border-width-lg);
    color: var(--color-text-primary);
  }
}

/* ── Rows ─────────────────────────────────────────────────────────────────── */
.mte-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  min-height: 40px;
  padding: var(--spacing-sm);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-primary);
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  text-align: left;
  text-decoration: none;
}

.mte-row--action {
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--easing-smooth);

  &:hover {
    background: var(--color-base-8);
  }
}

.mte-row--danger {
  color: var(--grids-brand-error-default);
}

.mte-row__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: var(--color-content-low);

  :deep(svg) {
    width: 20px;
    height: 20px;
    display: block;
  }
}

.mte-row__label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mte-row__state {
  flex: 0 0 auto;
  color: var(--color-content-low);
  font-size: var(--font-size-sm);
}

.mte-empty {
  padding: var(--spacing-md) var(--spacing-sm);
  color: var(--color-content-low);
  font-size: var(--font-size-sm);
  text-align: center;
}
</style>
