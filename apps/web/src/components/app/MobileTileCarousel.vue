<!--
  MobileTileCarousel.vue

  The Add-a-Tile "coverflow": a 3D fan of tile-type cards that floats above the
  command pill while adding. The centered card faces the user; cards either side
  rotate away, recede and fade, and the perspective updates continuously as the
  user drags — the tilt is a function of each card's distance from center, not a
  transition, so it tracks the finger exactly rather than easing after it.

  Interaction (standard coverflow):
    drag / swipe   — spins the fan; flick velocity carries into a snap
    tap a side card — brings it to the center
    tap the center  — commits it (`select`)
    ← / →           — steps the center one card

  The centered card is the active tile type, so the carousel emits `focus`
  whenever the *user* moves it (never on a programmatic re-sync). The parent
  turns that into the command chip's `/TEXT` · `/MAP` prefix, which keeps the
  chip honest about what ENTER will act on — and is also why no card carries a
  visible name: the chip already names the centered type. The name stays on
  each card as its accessible label.

  Card artwork lives in MobileTileThumbnail; this component owns only motion,
  geometry and selection. Filtering happens in the parent — the already-filtered
  list arrives via `types`.
-->
<template>
  <div
    class="tile-carousel"
    :style="{ '--tc-card': `${CARD}px` }"
    role="listbox"
    aria-label="Tile types"
  >
    <div
      class="tile-carousel__track"
      :class="{ 'is-dragging': dragging }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @keydown="onKeydown"
    >
      <button
        v-for="(type, index) in cards"
        :key="type.id"
        type="button"
        role="option"
        class="tile-carousel__card"
        :class="{
          'tile-carousel__card--selected': type.id === selectedId,
          'tile-carousel__card--center': index === centerIndex,
        }"
        :style="cardStyle(index)"
        :aria-selected="type.id === selectedId"
        :aria-current="index === centerIndex"
        :aria-label="type.label"
        @click="onCardClick(index)"
      >
        <span class="tile-carousel__art">
          <span class="tile-carousel__ink" :style="inkStyle(index)">
            <MobileTileThumbnail :type-id="type.id" :icon="type.icon" />
          </span>
        </span>
      </button>
    </div>

    <p v-if="!cards.length" class="tile-carousel__empty">No matching tiles</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import MobileTileThumbnail from "@/components/app/MobileTileThumbnail.vue";
import type { TileTypeDescriptor } from "@/composables/useTileCreation";

const props = withDefaults(
  defineProps<{
    types: TileTypeDescriptor[];
    selectedId?: string | null;
  }>(),
  {
    selectedId: null,
  },
);

const emit = defineEmits<{
  /** The centered card was committed (tap on center, or ENTER on it). */
  select: [id: string];
  /** The user moved a different card to the center. */
  "focus-type": [id: string];
}>();

// ── Geometry ─────────────────────────────────────────────────────────────────
// Kept in JS (not CSS) because the per-card transform is computed from a
// continuous scroll position; a CSS-only version could not follow the drag. The
// card size is published to CSS as --tc-card so the two cannot drift.
/** Edge length of the centered card, in px. */
const CARD = 120;
/** Distance between adjacent card centers. Well under CARD, so the fan overlaps. */
const SPACING = 78;
/** rotateY applied to a card one full step from center. */
const ANGLE = 45;
/** translateZ pushback per step from center; the perspective turns it into scale. */
const DEPTH = 140;
/** Opacity of the cards either side of the centered one. */
const NEIGHBOUR_OPACITY = 0.89;
/** Opacity two cards out; the fall-off then continues at this same rate. */
const SECOND_OPACITY = 0.76;
/** Cards never fade past this — far ones leave by being clipped, not by vanishing. */
const MIN_OPACITY = 0.55;
/** Cards past this distance stop receding and stop taking pointer events. */
const REACH = 2.4;

/** Pointer travel (px) that turns a tap into a drag. */
const DRAG_SLOP = 6;
/** How far a flick's velocity is projected when picking the snap target. */
const PROJECT_MS = 110;
/** Cards a single flick can carry past where the finger let go. */
const MAX_FLING = 2;
/** Snap-back duration. */
const SETTLE_MS = 420;

// A local copy of `types` so a parent-driven list change (pinning a type stops
// the query filtering) can never reshuffle the fan mid-gesture.
const cards = ref<TileTypeDescriptor[]>([...props.types]);
/** Continuous position of the fan, in card indices. 1.5 = between cards 1 and 2. */
const scroll = ref(0);
/**
 * Which card is logically centered. Deliberately separate from `scroll`: it
 * lands the moment the user commits to a card, while `scroll` is still easing
 * there, so selection never waits on the animation.
 */
const centerIndex = ref(0);
const dragging = ref(false);

const maxIndex = computed(() => Math.max(0, cards.value.length - 1));
const clampIndex = (index: number): number =>
  Math.min(maxIndex.value, Math.max(0, index));

let reducedMotion = false;

// ── Per-card transform ───────────────────────────────────────────────────────
// How faint a card's artwork is, by distance from center. Runs off the
// *unclamped* distance so the floor is reachable, unlike the depth and z-order
// which saturate at REACH.
const opacityAt = (distance: number): number => {
  const perCard = NEIGHBOUR_OPACITY - SECOND_OPACITY;
  const value =
    distance <= 1
      ? 1 - (1 - NEIGHBOUR_OPACITY) * distance
      : Math.max(MIN_OPACITY, NEIGHBOUR_OPACITY - perCard * (distance - 1));
  // Rounded so the inline style stays legible, and stable frame to frame.
  return Number(value.toFixed(3));
};

const cardStyle = (index: number) => {
  const delta = index - scroll.value;
  const distance = Math.min(Math.abs(delta), REACH);
  // Tilt saturates at one full step so the far cards stay parallel instead of
  // over-rotating into edge-on slivers.
  const tilt = Math.max(-1, Math.min(1, delta));
  return {
    transform: [
      `translateX(${delta * SPACING}px)`,
      `translateZ(${-distance * DEPTH}px)`,
      `rotateY(${-tilt * ANGLE}deg)`,
    ].join(" "),
    // Stacked by the *unclamped* distance so both sides of the fan order the
    // same way. Off the REACH-clamped value every card past the limit landed on
    // one layer, and DOM order then broke the tie in the right-hand cards'
    // favour — so on that side the outermost card sat in front of its inner
    // neighbour, mirroring the left instead of matching it.
    zIndex: String(100 - Math.round(Math.abs(delta) * 10)),
    pointerEvents: distance >= REACH ? ("none" as const) : ("auto" as const),
  };
};

// Only the artwork fades — never the card itself. Fading the whole card would
// make the grid behind it show straight through, which reads as muddy rather
// than distant (and gets worse over a busy or light background).
const inkStyle = (index: number) => ({
  opacity: String(opacityAt(Math.abs(index - scroll.value))),
});

// ── Settle animation ─────────────────────────────────────────────────────────
let raf = 0;

const stopAnimation = () => {
  if (!raf) return;
  cancelAnimationFrame(raf);
  raf = 0;
};

const animateTo = (target: number) => {
  stopAnimation();
  const from = scroll.value;
  const distance = target - from;
  if (
    reducedMotion ||
    Math.abs(distance) < 0.001 ||
    typeof requestAnimationFrame !== "function"
  ) {
    scroll.value = target;
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const progress = Math.min(1, (now - start) / SETTLE_MS);
    // Ease-out cubic: the no-overshoot settle that matches --easing-gentle.
    scroll.value = from + distance * (1 - Math.pow(1 - progress, 3));
    if (progress < 1) {
      raf = requestAnimationFrame(step);
      return;
    }
    raf = 0;
    scroll.value = target;
  };
  raf = requestAnimationFrame(step);
};

/**
 * Move the logical center, and tell the parent about it. `selectedId` is the
 * parent's view of the centered type, so comparing against it both de-dupes
 * repeat emits and self-corrects after the parent un-pins.
 */
const focusIndex = (index: number) => {
  centerIndex.value = clampIndex(index);
  const type = cards.value[centerIndex.value];
  if (!type || type.id === props.selectedId) return;
  emit("focus-type", type.id);
};

// ── Keeping the local list in step with the filtered one ─────────────────────
const typeKey = computed(() => props.types.map((type) => type.id).join("|"));
let pendingSync = false;

const syncCards = () => {
  pendingSync = false;
  const fromIndex = centerIndex.value;
  const focusedId = cards.value[fromIndex]?.id ?? null;
  cards.value = [...props.types];

  const kept = focusedId
    ? cards.value.findIndex((type) => type.id === focusedId)
    : -1;
  // The focused card survived the change and did not move — leave the fan (and
  // any in-flight settle) alone. Otherwise jump, without animating or emitting:
  // the list changed underneath the user, this is not them choosing a card.
  if (kept === fromIndex) return;
  stopAnimation();
  centerIndex.value = clampIndex(kept >= 0 ? kept : 0);
  scroll.value = centerIndex.value;
};

watch(typeKey, () => {
  if (dragging.value) {
    pendingSync = true;
    return;
  }
  syncCards();
});

// ── Drag ─────────────────────────────────────────────────────────────────────
let startX = 0;
let startScroll = 0;
let travelled = 0;
let lastX = 0;
let lastTime = 0;
/** Card indices per ms, positive when the fan is moving forwards. */
let velocity = 0;
let suppressClick = false;

// Past the ends the fan still follows the finger, but at a third of the rate,
// so it reads as resistance rather than a dead stop.
const rubberBand = (value: number): number => {
  if (value < 0) return value * 0.35;
  if (value > maxIndex.value) {
    return maxIndex.value + (value - maxIndex.value) * 0.35;
  }
  return value;
};

const onPointerDown = (event: PointerEvent) => {
  if (event.button > 0 || !cards.value.length) return;
  stopAnimation();
  dragging.value = true;
  suppressClick = false;
  travelled = 0;
  velocity = 0;
  startX = event.clientX;
  lastX = event.clientX;
  lastTime = event.timeStamp;
  startScroll = scroll.value;
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
};

const onPointerMove = (event: PointerEvent) => {
  if (!dragging.value) return;
  const shift = event.clientX - startX;
  travelled = Math.max(travelled, Math.abs(shift));
  if (travelled > DRAG_SLOP) suppressClick = true;

  scroll.value = rubberBand(startScroll - shift / SPACING);

  const elapsed = event.timeStamp - lastTime;
  if (elapsed > 0) {
    velocity = (lastX - event.clientX) / SPACING / elapsed;
    lastX = event.clientX;
    lastTime = event.timeStamp;
  }

  focusIndex(Math.round(scroll.value));
};

const onPointerUp = (event: PointerEvent) => {
  if (!dragging.value) return;
  dragging.value = false;
  (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);

  // Capping the carry keeps a hard flick from spinning to the far end of the
  // fan — it advances a couple of cards and settles, like a physical dial.
  const carry = Math.max(
    -MAX_FLING,
    Math.min(MAX_FLING, velocity * PROJECT_MS),
  );
  const target = clampIndex(Math.round(scroll.value + carry));
  animateTo(target);
  focusIndex(target);
  if (pendingSync) syncCards();
};

// ── Selection ────────────────────────────────────────────────────────────────
const onCardClick = (index: number) => {
  // A drag ends with a click on whatever card is under the finger; ignore it —
  // the drag guard (suppressClick) is what still separates browsing from
  // picking now that a genuine tap commits directly.
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  // A deliberate tap on any card picks that tile type. Off-center taps still
  // slide the card to the middle (keeping the fan geometry and the command
  // chip's /TYPE prefix in step) but no longer require a second tap to commit —
  // users read a single tap as "add this tile", and the old tap-to-center /
  // tap-again-to-select coverflow read as broken.
  if (index !== centerIndex.value) {
    animateTo(index);
    focusIndex(index);
  }
  const type = cards.value[index];
  if (type) emit("select", type.id);
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const next = clampIndex(centerIndex.value + (event.key === "ArrowRight" ? 1 : -1));
  if (next === centerIndex.value) return;
  animateTo(next);
  focusIndex(next);
};

onMounted(() => {
  reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
});

onBeforeUnmount(stopAnimation);
</script>

<style lang="scss" scoped>
// --tc-card (the centered card's edge length) is set inline from the geometry
// constants in the script, so the transform math and the layout stay in step.
.tile-carousel {
  position: relative;
  width: 100%;
  // A little headroom above the centered card, so it does not sit hard against
  // the clip below.
  padding-top: var(--spacing-xs);
  // The fan runs the full width of the screen and its outer cards are cut off
  // by the screen edge. Clipping here rather than letting them truly overflow
  // keeps a stray horizontal scrollbar off the document; the parent sizes this
  // to the viewport, so the two are the same edge.
  overflow: hidden;
}

.tile-carousel__track {
  position: relative;
  height: var(--tc-card);
  // Applies to the cards, which are its direct children — this is what turns
  // their translateZ into depth. The vanishing point sits on the bottom edge
  // rather than the middle, so cards shrink towards that line as they recede
  // and the whole fan stays bottom-aligned instead of center-aligned.
  perspective: 700px;
  perspective-origin: 50% 100%;
  touch-action: pan-y;
  cursor: grab;

  &.is-dragging {
    cursor: grabbing;
  }
}

.tile-carousel__card {
  position: absolute;
  bottom: 0;
  left: 50%;
  display: block;
  width: var(--tc-card);
  height: var(--tc-card);
  // Centers the card on the track before its own transform is applied; the
  // per-card translateX then measures from the middle of the fan.
  margin-left: calc(var(--tc-card) / -2);
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
  // No transform transition: the tilt is driven frame-by-frame from the drag
  // position, so a transition here would lag the finger.
  will-change: transform;

  &:focus-visible {
    outline: none;

    .tile-carousel__art {
      box-shadow:
        inset 0 0 0 var(--border-width-lg) var(--color-content-default),
        var(--shadow-xl);
    }
  }
}

// Always fully opaque, at every distance — this is the surface that stops the
// grid showing through. Depth is carried by the transform, the static shadow,
// and the artwork inside fading.
.tile-carousel__art {
  position: relative;
  display: block;
  width: var(--tc-card);
  height: var(--tc-card);
  // Figma uses a 30px radius on a 150px tile; the same ratio at our card size.
  border-radius: var(--radius-lg);
  background: var(--color-tile-background);
  // The 1px stroke is an inset shadow, not a border. A border on a card that is
  // rotated in 3D is rasterized as its own pass and gets no antialiasing along
  // the edges the rotation has put on a slant, so it steps like a staircase —
  // worst on the far cards, where the slant is steepest. Drawn as an inset
  // shadow it is part of the card's own surface and antialiases with it. Same
  // reason .mcp-pad in MobileColorPicker draws its stroke this way.
  //
  // Both shadows are static so they never repaint mid-drag; box-shadow is
  // expensive to animate, which is also why there is no transition here — the
  // selected card changes on every focus change while the fan is being dragged.
  box-shadow:
    inset 0 0 0 var(--border-width) var(--color-stroke),
    var(--shadow-xl);
  overflow: hidden;
}

.tile-carousel__ink {
  position: absolute;
  inset: 0;
}

// The active tile type — the one whose `/command` the input is showing. Inset
// like the resting stroke, so it can neither step nor be clipped by the panel
// edge the way an outer ring was.
.tile-carousel__card--selected .tile-carousel__art {
  box-shadow:
    inset 0 0 0 var(--border-width-lg) var(--color-content-default),
    var(--shadow-xl);
}

.tile-carousel__empty {
  margin: 0;
  padding: var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-content-default);
  text-align: center;
}
</style>
