<!--
  MobileAllSettings.vue

  "All settings" (plan S3): the tile toolbar grown into a sheet with every
  control for the tile, grouped, all inline — no popovers inside.

    Size     the tile type's presets, plus width × height steppers
    Look     font, style, colour, fill, position, border, shape, map style
    Content  link, caption, image, photo, map search, more
    Actions  edit, crop / pan / interact, arrange, open, copy, download,
             preview, re-center, duplicate, delete

  The Look and Content controls are the popover bodies themselves, so a
  control works the same here as in its card. The sheet is one undo visit,
  like a card: closing it commits. Size changes go through the grid engine
  and are their own steps.

  In multi-edit it shows only the shared, bulk-safe controls (no Size) and
  its actions are the bulk ones; the parent passes the tools and runs the
  actions either way.

  Sizes apply to the phone layout only (the grid's `sm` breakpoint).
-->
<template>
  <div class="mas pp-scope" role="region" aria-label="All settings">
    <section v-if="single" class="mas__section" aria-labelledby="mas-size">
      <h3 id="mas-size" class="mas__heading">Size</h3>
      <PopoverChoices
        v-if="presets.length"
        label="Size presets"
        :options="presetOptions"
        :model-value="`${size.w}x${size.h}`"
        @select="applyPreset"
      />
      <div class="mas__steppers">
        <div class="pp-stepper" role="group" aria-label="Width">
          <span class="pp-stepper__label">Width</span>
          <button
            type="button"
            class="pp-stepper__btn"
            aria-label="Narrower"
            :disabled="size.w <= 1"
            @click="resizeTo(size.w - 1, size.h)"
          >
            −
          </button>
          <span class="pp-stepper__value">{{ size.w }}</span>
          <button
            type="button"
            class="pp-stepper__btn"
            aria-label="Wider"
            :disabled="size.w >= MAX_W"
            @click="resizeTo(size.w + 1, size.h)"
          >
            +
          </button>
        </div>
        <div class="pp-stepper" role="group" aria-label="Height">
          <span class="pp-stepper__label">Height</span>
          <button
            type="button"
            class="pp-stepper__btn"
            aria-label="Shorter"
            :disabled="size.h <= 1"
            @click="resizeTo(size.w, size.h - 1)"
          >
            −
          </button>
          <span class="pp-stepper__value">{{ size.h }}</span>
          <button
            type="button"
            class="pp-stepper__btn"
            aria-label="Taller"
            :disabled="size.h >= MAX_H"
            @click="resizeTo(size.w, size.h + 1)"
          >
            +
          </button>
        </div>
      </div>
    </section>

    <section
      v-for="group in groups"
      :key="group.id"
      class="mas__section"
      :aria-labelledby="`mas-${group.id}`"
    >
      <h3 :id="`mas-${group.id}`" class="mas__heading">{{ group.label }}</h3>
      <div v-for="tool in group.tools" :key="tool.id" class="mas__tool">
        <p v-if="!SELF_LABELLED.has(tool.id)" class="pp-label">
          {{ toolTitle(tool) }}
        </p>
        <component :is="MOBILE_POPOVER_BODIES[tool.id]" />
      </div>
    </section>

    <section
      v-if="actionTools.length"
      class="mas__section"
      aria-labelledby="mas-actions"
    >
      <h3 id="mas-actions" class="mas__heading">Actions</h3>
      <div class="pp-list">
        <component
          :is="tool.id === 'open' ? 'a' : 'button'"
          v-for="tool in actionTools"
          :key="tool.id"
          class="pp-list__item"
          :class="{ 'pp-list__item--danger': tool.danger }"
          :type="tool.id === 'open' ? undefined : 'button'"
          :href="tool.id === 'open' ? openHref : undefined"
          :target="tool.id === 'open' ? '_blank' : undefined"
          :rel="tool.id === 'open' ? 'noopener noreferrer' : undefined"
          :data-tool-id="tool.id"
          @click="runAction(tool)"
        >
          <MobileToolIcon :name="iconFor(tool.id)" />
          <span>{{ actionLabel(tool) }}</span>
        </component>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, proxyRefs } from "vue";
import type { Tile } from "@grids/contracts/types";
import MobileToolIcon from "./MobileToolIcon.vue";
import PopoverChoices, {
  type PopoverChoice,
} from "./popovers/PopoverChoices.vue";
import { MOBILE_POPOVER_BODIES } from "./popovers";
import type {
  MobileTool,
  MobileToolId,
} from "@/registries/tileToolbar/mobileTools";
import { getTileToolbarButtons } from "@/registries/tileToolbar";
import type { ToolbarContext } from "@/types/TileToolbar";
import { useGridController } from "@/controllers/useGridController";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import { useMobileTileEdit } from "@/composables/useMobileTileEdit";
import { mobileToolIcon as iconFor } from "@/composables/useMobileToolActions";
import { useMobileTileCommands } from "@/composables/useMobileTileCommands";
import { provideToolPopoverVisit } from "@/composables/useToolPopoverVisit";

const props = withDefaults(
  defineProps<{
    /** One tile, or the picks in multi-edit. */
    tiles: Tile[];
    /** The tools on offer (the tile's, or the shared ones). */
    tools: MobileTool[];
    /** Where Open goes, for a single tile with a link. */
    openHref?: string;
  }>(),
  { openHref: undefined },
);

const emit = defineEmits<{ action: [tool: MobileTool] }>();

/** Size and live-tile controls only make sense for one tile. */
const single = computed(() => props.tiles.length === 1);
const tile = computed(() => props.tiles[0]);

/** The phone grid is 4 columns wide. */
const MAX_W = 4;
const MAX_H = 8;

const LOOK: MobileToolId[] = [
  "font", "style", "color", "fill", "position", "border", "shape", "mapStyle",
];
const CONTENT: MobileToolId[] = [
  "link", "caption", "image", "photo", "search", "more",
];
/** Bodies that already label their own parts ("Font", "Size", …). */
const SELF_LABELLED: ReadonlySet<MobileToolId> = new Set(["font", "style"]);

const controller = useGridController();
const gridView = proxyRefs(useGridViewContext());
const { handle } = useMobileTileEdit();
const commands = useMobileTileCommands();

const visit = provideToolPopoverVisit(
  () => props.tiles,
  () => (single.value ? "Edit tile settings" : "Edit tiles"),
);

// ── Groups ──────────────────────────────────────────────────────────────────
const pick = (ids: MobileToolId[]) =>
  props.tools.filter(
    (tool) => ids.includes(tool.id) && MOBILE_POPOVER_BODIES[tool.id],
  );

const groups = computed(() =>
  [
    { id: "look", label: "Look", tools: pick(LOOK) },
    { id: "content", label: "Content", tools: pick(CONTENT) },
  ].filter((group) => group.tools.length > 0),
);

/** Everything that acts rather than sets a value. */
const actionTools = computed(() =>
  props.tools.filter((tool) => tool.kind !== "popover"),
);

const toolTitle = (tool: MobileTool) =>
  tool.id === "mapStyle" ? "Map style" : tool.label;

const ACTION_LABELS: Partial<Record<MobileToolId, string>> = {
  edit: "Edit text",
  crop: "Crop",
  pan: "Pan the map",
  interact: "Interact with the embed",
  arrange: "Move and resize",
  open: "Open link",
  copy: "Copy",
  download: "Download",
  preview: "Preview",
  recenter: "Re-center the map",
  duplicate: "Duplicate",
  delete: "Delete tile",
};
const actionLabel = (tool: MobileTool) => {
  if (!single.value && tool.id === "duplicate") return "Duplicate all";
  if (!single.value && tool.id === "delete") return "Delete all";
  return ACTION_LABELS[tool.id] ?? tool.label;
};

/** Modes, typing and arrange take over the bar: close the sheet first. */
const TAKES_OVER: ReadonlySet<MobileToolId> = new Set([
  "edit", "crop", "pan", "interact", "arrange",
]);

const runAction = (tool: MobileTool) => {
  if (TAKES_OVER.has(tool.id)) {
    visit.commit();
    controller.setMobileSheetExpanded(false);
  }
  emit("action", tool);
};

// ── Size ────────────────────────────────────────────────────────────────────
/** The size on screen now (the phone layout), not the desktop one. */
const size = computed(() => {
  const placed = gridView.displayPositions.find(
    (item) => item.i === tile.value.i,
  );
  return { w: placed?.w ?? tile.value.w, h: placed?.h ?? tile.value.h };
});

/** The tile type's own presets that fit a phone row. */
const presets = computed(() =>
  getTileToolbarButtons(tile.value.content.type, toolbarContext())
    .filter((button) => button.group === "resize")
    .map((button) => {
      const title =
        typeof button.title === "string" ? button.title : button.id;
      const match = /(\d+)\s*x\s*(\d+)/i.exec(title);
      return match ? { w: Number(match[1]), h: Number(match[2]) } : null;
    })
    .filter(
      (preset): preset is { w: number; h: number } =>
        !!preset && preset.w <= MAX_W,
    ),
);

/** The live tile's context, for types whose toolbar depends on it. */
const toolbarContext = (): ToolbarContext | undefined => {
  const tileHandle = handle.value;
  if (!tileHandle) return undefined;
  return {
    tile: tile.value,
    childComponent: tileHandle.childComponent,
    gridView,
    resizeTile: tileHandle.resizeTile,
    isEditing: tileHandle.isEditing,
    isExitingCropMode: tileHandle.isExitingCropMode,
  };
};

const presetOptions = computed<PopoverChoice[]>(() =>
  presets.value.map((preset) => ({
    value: `${preset.w}x${preset.h}`,
    label: `${preset.w}×${preset.h}`,
  })),
);

const resizeTo = (w: number, h: number) => {
  const width = Math.min(MAX_W, Math.max(1, w));
  const height = Math.min(MAX_H, Math.max(1, h));
  if (width === size.value.w && height === size.value.h) return;
  // A resize is its own undo step, not part of the sheet's look edits.
  visit.commit();
  const resize = handle.value?.resizeTile ?? gridView.resizeTile;
  resize(tile.value.i, width, height);
  handle.value?.childComponent.value?.onResize?.();
};

const applyPreset = (value: string) => {
  const [w, h] = value.split("x").map(Number);
  resizeTo(w, h);
};

// Keep the tile in view above the grown sheet once it has settled.
onMounted(async () => {
  await nextTick();
  const first = tile.value;
  if (first) {
    window.setTimeout(() => commands.scrollTileIntoView(first.i), 280);
  }
});
</script>

<style scoped>
.mas {
  display: flex;
  flex-direction: column;
  gap: 22px;
  max-height: min(56vh, 520px);
  padding: 14px 14px 18px;
  overflow-y: auto;
  overscroll-behavior: contain;
  animation: mas-in var(--duration-morph) var(--easing-snap) both;
}

.mas__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mas__heading {
  margin: 0;
  font-family: "Inter", sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-content-low);
}

.mas__tool {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* One per row: side by side they don't fit a phone. */
.mas__steppers {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mas__steppers .pp-stepper__value {
  width: 36px;
  margin: 0 8px;
}

@keyframes mas-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mas {
    animation: none;
  }
}
</style>
