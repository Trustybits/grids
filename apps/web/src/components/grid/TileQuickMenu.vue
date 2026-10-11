<!--
  TileQuickMenu.vue

  The small menu that pops up beside a tile in Arrange (hold or the Arrange
  tool): Done · Duplicate · Delete. Done finishes arranging, back where it
  began. Floats above the tile like a phone home screen's widget menu — below
  it when there's no room, over its top edge when the tile is taller than the
  free space — and keeps clear of the floating top pieces and the bottom bar.

  Teleported to <body>: Griddle tiles are transformed layers, which would trap
  a fixed element inside the tile.
-->
<template>
  <teleport to="body">
    <div
      ref="menuRef"
      class="tqm"
      :class="`tqm--${placement}`"
      :style="menuStyle"
      role="menu"
      :aria-label="`${label} quick actions`"
      data-arrange-menu
      data-tile-edit-surface
      @touchstart.stop
      @pointerdown.stop
    >
      <button
        type="button"
        class="tqm__action"
        role="menuitem"
        @click="$emit('done')"
      >
        <CheckIcon :size="21" />
        <span>Done</span>
      </button>
      <button
        v-if="canDuplicate"
        type="button"
        class="tqm__action"
        role="menuitem"
        @click="$emit('duplicate')"
      >
        <MobileToolIcon name="duplicate" />
        <span>Duplicate</span>
      </button>
      <button
        type="button"
        class="tqm__action tqm__action--danger"
        role="menuitem"
        @click="$emit('remove')"
      >
        <MobileToolIcon name="delete" />
        <span>Delete</span>
      </button>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import MobileToolIcon from "@/components/app/mobile-editor/MobileToolIcon.vue";
import CheckIcon from "@/components/icons/CheckIcon.vue";

const props = defineProps<{
  /** The tile's Griddle element the menu floats against. */
  anchor: HTMLElement | null;
  label: string;
  /** One-per-grid tiles (Campfire) can't be duplicated. */
  canDuplicate: boolean;
  /** Bumps whenever tile geometry may have moved. */
  geometryVersion: number;
}>();

defineEmits<{
  done: [];
  duplicate: [];
  remove: [];
}>();

const GAP_PX = 12;
const GUTTER_PX = 12;

const menuRef = ref<HTMLElement | null>(null);
const placement = ref<"above" | "below">("above");
const position = ref({ left: 0, top: 0 });

const menuStyle = computed(() => ({
  left: `${position.value.left}px`,
  top: `${position.value.top}px`,
}));

// Floating chrome the menu must not tuck under.
const TOP_CHROME =
  ".app-status-banners, .mobile-top-chrome--shown .mtc-pill, .mobile-top-chrome--shown .mtc-circle";
const BOTTOM_CHROME = ".mobile-grid-bar .mgb-pill";

const visibleRects = (selector: string): DOMRect[] =>
  Array.from(document.querySelectorAll<HTMLElement>(selector))
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);

const safeArea = (): { top: number; bottom: number } => {
  const viewport = window.innerHeight;
  const top = Math.max(
    0,
    ...visibleRects(TOP_CHROME)
      .filter((rect) => rect.top < viewport / 2)
      .map((rect) => rect.bottom),
  );
  const bottom = Math.min(
    viewport,
    ...visibleRects(BOTTOM_CHROME)
      .filter((rect) => rect.bottom > viewport / 2)
      .map((rect) => rect.top),
  );
  return { top: top + GUTTER_PX, bottom: bottom - GUTTER_PX };
};

const reposition = (): void => {
  const anchor = props.anchor;
  const menu = menuRef.value;
  if (!anchor || !menu) return;
  const tile = anchor.getBoundingClientRect();
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  const safe = safeArea();
  const aboveTop = tile.top - GAP_PX - height;
  const belowTop = tile.bottom + GAP_PX;
  let top: number;
  if (aboveTop >= safe.top) {
    placement.value = "above";
    top = aboveTop;
  } else if (belowTop + height <= safe.bottom) {
    placement.value = "below";
    top = belowTop;
  } else {
    placement.value = "below";
    top = Math.min(Math.max(tile.top + GAP_PX, safe.top), safe.bottom - height);
  }
  const centered = tile.left + tile.width / 2 - width / 2;
  const left = Math.min(
    Math.max(centered, GUTTER_PX),
    window.innerWidth - width - GUTTER_PX,
  );
  position.value = { left, top };
};

let frame = 0;
const scheduleReposition = (): void => {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    reposition();
  });
};

watch(
  () => [props.anchor, props.geometryVersion],
  () => scheduleReposition(),
);

onMounted(() => {
  reposition();
  window.addEventListener("scroll", scheduleReposition, {
    passive: true,
    capture: true,
  });
  window.addEventListener("resize", scheduleReposition);
});

onUnmounted(() => {
  if (frame) cancelAnimationFrame(frame);
  window.removeEventListener("scroll", scheduleReposition, { capture: true });
  window.removeEventListener("resize", scheduleReposition);
});
</script>

<style scoped>
.tqm {
  position: fixed;
  /* Above the tiles, under the bars (they sit at --z-fixed / --z-topbar). */
  z-index: calc(var(--z-fixed) - 1);
  display: flex;
  gap: 2px;
  padding: 6px;
  border-radius: var(--radius-lg);
  border: var(--border-width) solid var(--color-stroke);
  background: var(--color-glass-bar);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  color: var(--color-text-primary);
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  animation: tqm-in var(--duration-morph) var(--easing-snap);
}

/* Less transparency (asked for, or a low-end phone): solid, no blur. */
:global(.no-focus-blur) .tqm {
  background: var(--color-toolbar-background);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.tqm--above {
  transform-origin: 50% 100%;
}

.tqm--below {
  transform-origin: 50% 0%;
}

/* Same 58×64 tile as the toolbar's tools. */
.tqm__action {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 64px;
  height: 64px;
  padding: 0;
  border: none;
  border-radius: 14px;
  background: transparent;
  color: inherit;
  font-family: "Inter", sans-serif;
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.tqm__action:active {
  background: var(--color-tool-selected-bg);
}

.tqm__action--danger {
  color: var(--color-tool-danger);
}

@keyframes tqm-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tqm {
    animation: none;
  }
}
</style>
