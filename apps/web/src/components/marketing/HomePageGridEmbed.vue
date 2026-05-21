<!--
  HomePageGridEmbed.vue

  Marketing-homepage wrapper around the real <Grid> component. Renders an
  in-memory demo layout so visitors can see (and lightly poke at) actual
  grid tiles instead of CSS mock-ups — without any Firestore round-trip,
  auth state, or navigation chrome.

  Hero "scroll-jack" behaviour
  ────────────────────────────
  As the visitor scrolls the page, the grid is pinned in view and pops
  through three device viewports — phone (sm) → tablet (md) → desktop (lg)
  — to demonstrate that the same grid layout adapts to each breakpoint.

  Implementation:
    1. The component owns a tall outer wrapper (`grid-jack`) that creates
       the extra scroll runway; the visible grid lives inside a sticky
       inner panel that stays put while the visitor scrolls past.
    2. We track the scroll position of the outer wrapper relative to the
       window and map it to one of three discrete breakpoints. The grid
       library + tile transitions handle the visual snap on each switch.
    3. A thin device-frame outline is drawn around the grid; the frame
       morphs (width/height/border-radius) per breakpoint to suggest the
       phone, tablet, and laptop silhouettes the user is moving through.
    4. The inner grid is rendered at its natural pixel size with internal
       auto-scaling disabled (see Grid.vue's `disableAutoScale` prop), and
       we apply our own CSS transform: scale() to fit each device-frame
       viewport. This avoids compounding scales.
    5. On narrow viewports (< 720px) we degrade gracefully: the scroll
       jack is disabled entirely and we just show the static phone view.

  Other design decisions:
    • No <GridPage> / <UserSlugPage> wrapper → no toolbar, no breakpoint
      switcher, no background iframe, no drag/drop overlay.
    • Non-owner by default (layout store sets isOwner=false on load) →
      every owner-only UI element inside <GridTile> is gated off.
    • Clicks into tiles naturally open external links in new tabs
      (LinkContent, MusicContent, YouTubeContent, markdown <a>, and
      useTileLink all hard-code target="_blank"). We add a defensive
      click-interceptor anyway so any future tile type that forgets to
      do this still can't accidentally navigate the visitor away from /.
    • Intentionally does NOT watch currentGrid.themeId or call
      themeStore.applyGridTheme — the demo grid's theme must not leak
      onto the landing page's document root.
-->
<template>
  <div ref="jackRoot" class="grid-jack" :class="{ 'is-static': scrollDisabled }">
    <div class="grid-jack__pin">
      <div class="grid-jack__device-wrap" :style="deviceWrapStyle">
        <div
          class="grid-jack__device"
          :class="`grid-jack__device--${displayBreakpoint}`"
          :style="frameStyle"
        >
          <span class="grid-jack__notch" aria-hidden="true" />
          <span class="grid-jack__home-indicator" aria-hidden="true" />

          <!--
            Monitor stand silhouette. Sits below the device, scaled by the
            same frame transform so it stays in proportion with the screen.
            Only visible at the desktop breakpoint; opacity transitions in.
          -->
          <span class="grid-jack__stand" aria-hidden="true">
            <span class="grid-jack__stand-neck" />
            <span class="grid-jack__stand-base" />
          </span>

          <div ref="viewportEl" class="grid-jack__viewport" :style="viewportStyle">
            <div class="grid-jack__scroll-sizer" :style="scrollSizerStyle">
              <div class="grid-jack__scale" :style="scaleStyle">
                <div
                  class="home-grid-embed"
                  @click.capture="interceptOutboundClick"
                  @auxclick.capture="interceptOutboundClick"
                >
                  <Grid :row-height="rowHeight" :disable-auto-scale="true" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid-jack__legend" aria-hidden="true">
        <div class="grid-jack__chips">
          <span
            v-for="bp in breakpointOrder"
            :key="bp.id"
            :class="['grid-jack__chip', { 'is-active': displayBreakpoint === bp.id }]"
          >
            {{ bp.label }}
          </span>
        </div>
        <span v-if="!scrollDisabled" class="grid-jack__legend-hint">
          scroll to morph ↓
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Grid from '@/components/grid/Grid.vue';
import { useGridStore } from '@/stores/grid';
import {
  DEMO_GRID_DIMENSIONS,
  createDemoGrid,
} from '@/data/DemoGrid';
import type { Breakpoint } from '@/types/Tile';

const _props = withDefaults(
  defineProps<{
    rowHeight?: number;
  }>(),
  {
    rowHeight: 75,
  },
);

const gridStore = useGridStore();

// ── Pinned scroll-jack state ────────────────────────────────────────────────
const jackRoot = ref<HTMLElement | null>(null);
const viewportEl = ref<HTMLElement | null>(null);
// The breakpoint actually applied to the grid + frame. Driven by scroll
// progress; defaults to 'lg' so first paint shows the desktop view.
const displayBreakpoint = ref<Breakpoint>('lg');
// Cached viewport metrics, refreshed on resize. We use innerWidth to decide
// whether to enable scroll-jacking at all (disabled on narrow phones, where
// pinning behaviour fights the system gesture momentum).
const viewportWidth = ref(
  typeof window !== 'undefined' ? window.innerWidth : 1280,
);
const viewportHeight = ref(
  typeof window !== 'undefined' ? window.innerHeight : 800,
);

const scrollDisabled = computed(() => viewportWidth.value < 720);

const breakpointOrder = [
  { id: 'lg' as const, label: 'Desktop' },
  { id: 'md' as const, label: 'Tablet' },
  { id: 'sm' as const, label: 'Phone' },
];

// ── Device frame sizing ─────────────────────────────────────────────────────
//
// Each device frame has a fixed inner viewport (the "screen" portion). The
// grid is rendered at its natural breakpoint size and scaled down with a
// CSS transform so it fills the screen area without overflow.
//
// The frames are intentionally sized so phone < tablet < desktop in apparent
// scale — matching the real-world relative sizes of the devices.
type FrameSpec = {
  outerWidth: number;
  outerHeight: number;
  // padding represents the device "bezel" — the gap between the outer
  // frame edge and the inner screen viewport.
  paddingX: number;
  paddingY: number;
  borderRadius: number;
};

const FRAME_SPECS: Record<Breakpoint, FrameSpec> = {
  sm: { outerWidth: 300, outerHeight: 600, paddingX: 14, paddingY: 30, borderRadius: 36 },
  // Wider/shorter than sm (clearly landscape rectangle, ~1.6:1 — closer
  // to a real iPad in landscape) so it doesn't read as "big phone".
  md: { outerWidth: 800, outerHeight: 500, paddingX: 18, paddingY: 22, borderRadius: 22 },
  // Wide screen + stand silhouette below for the desktop look.
  lg: { outerWidth: 1040, outerHeight: 600, paddingX: 16, paddingY: 18, borderRadius: 12 },
};

// Logical (pre-transform-scale) height of the desktop stand silhouette
// drawn below the device frame. The wrap reserves this much extra
// vertical space at the lg breakpoint so the stand doesn't collide with
// the legend chips below.
const STAND_HEIGHT = 40;

// Cap the device frame to the available width. The hero is centred inside
// .mkt__section (max 1120px), and we want a little breathing room either
// side, so 1040px is the realistic hard ceiling. On narrower windows we
// scale the entire frame down proportionally.
const maxFrameWidth = computed(() => {
  return Math.min(viewportWidth.value - 32, 1040);
});

const frameSpec = computed<FrameSpec>(() => FRAME_SPECS[displayBreakpoint.value]);

// Uniform scale applied to the whole device frame so it fits within the
// available horizontal space. Frame outer dimensions stay logical (the
// numbers in FRAME_SPECS), and we visually shrink via transform.
const frameFitScale = computed(() => {
  const { outerWidth } = frameSpec.value;
  if (maxFrameWidth.value >= outerWidth) return 1;
  return maxFrameWidth.value / outerWidth;
});

// The outer wrap takes the post-scale footprint (so the legend below sits
// at the right vertical position even when we shrink the frame to fit).
// The device itself is rendered at its logical size + transform: scale().
//
// At the lg breakpoint we reserve extra vertical space below the device
// to host the monitor-stand silhouette without overlapping the legend.
const deviceWrapStyle = computed(() => {
  const spec = frameSpec.value;
  const fit = frameFitScale.value;
  const standH =
    displayBreakpoint.value === 'lg' ? STAND_HEIGHT * fit : 0;
  return {
    width: `${spec.outerWidth * fit}px`,
    height: `${spec.outerHeight * fit + standH}px`,
  };
});

const frameStyle = computed(() => {
  const spec = frameSpec.value;
  return {
    width: `${spec.outerWidth}px`,
    height: `${spec.outerHeight}px`,
    borderRadius: `${spec.borderRadius}px`,
    paddingTop: `${spec.paddingY}px`,
    paddingBottom: `${spec.paddingY}px`,
    paddingLeft: `${spec.paddingX}px`,
    paddingRight: `${spec.paddingX}px`,
    transform: `scale(${frameFitScale.value})`,
  };
});

// Inner "screen" — black canvas behind the scaled grid. Rounded slightly
// less than the outer frame to look like an inset display.
const viewportStyle = computed(() => {
  const spec = frameSpec.value;
  const innerRadius = Math.max(8, spec.borderRadius - 10);
  return {
    borderRadius: `${innerRadius}px`,
  };
});

// Scale the natural-sized grid to fill the device viewport width. The
// bezel padding already provides visual breathing room, so the grid
// stretches edge-to-edge inside the screen area. The viewport scrolls
// vertically when the grid is taller than the frame.
const gridScale = computed(() => {
  const spec = frameSpec.value;
  const innerW = spec.outerWidth - spec.paddingX * 2;
  const grid = DEMO_GRID_DIMENSIONS[displayBreakpoint.value];
  return innerW / grid.width;
});

const scaleStyle = computed(() => {
  const grid = DEMO_GRID_DIMENSIONS[displayBreakpoint.value];
  return {
    width: `${grid.width}px`,
    height: `${grid.height}px`,
    transform: `scale(${gridScale.value})`,
  };
});

const scrollSizerStyle = computed(() => {
  const grid = DEMO_GRID_DIMENSIONS[displayBreakpoint.value];
  const scale = gridScale.value;
  return {
    width: `${grid.width * scale}px`,
    height: `${grid.height * scale}px`,
  };
});

// ── Grid-store wiring ─────────────────────────────────────────────────────
let prevGrid: typeof gridStore.currentGrid = null;
let prevIsOwner = false;
let prevForcedBreakpoint: Breakpoint | null = null;

const applyForcedBreakpoint = (bp: Breakpoint) => {
  if (gridStore.forcedBreakpoint === bp) return;
  gridStore.setForcedBreakpoint(bp);
};

watch(displayBreakpoint, (bp) => {
  applyForcedBreakpoint(bp);
  if (viewportEl.value) viewportEl.value.scrollTop = 0;
});

// ── Scroll-progress driver ──────────────────────────────────────────────────
//
// We translate the visitor's scroll position over the wrapper into a 0..1
// progress, then divide that range into thirds — one per breakpoint.
// Discrete switching (rather than a continuous interpolation) is what
// gives us the satisfying "pop" the user asked for.
const breakpointForProgress = (progress: number): Breakpoint => {
  if (progress < 0.34) return 'lg';
  if (progress < 0.67) return 'md';
  return 'sm';
};

// Distance from the top of the viewport to where the pin parks. Must
// match the `top` value on .grid-jack__pin in CSS — kept in JS too so
// the scroll-progress maths line up exactly with when sticky engages.
const PIN_TOP_OFFSET = 88;

let rafId = 0;
const onScroll = () => {
  if (scrollDisabled.value) {
    displayBreakpoint.value = 'sm';
    return;
  }
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    const root = jackRoot.value;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    // The pin sticks when wrapper.top <= PIN_TOP_OFFSET and releases when
    // wrapper.bottom <= viewportHeight. Total runway during the stuck
    // phase = wrapperHeight − viewportHeight + PIN_TOP_OFFSET, and we
    // start counting from the moment sticky kicks in.
    const totalRunway =
      root.offsetHeight - viewportHeight.value + PIN_TOP_OFFSET;
    if (totalRunway <= 0) {
      displayBreakpoint.value = 'sm';
      return;
    }
    const scrolled = Math.min(
      Math.max(0, PIN_TOP_OFFSET - rect.top),
      totalRunway,
    );
    const progress = scrolled / totalRunway;
    displayBreakpoint.value = breakpointForProgress(progress);
  });
};

const onResize = () => {
  viewportWidth.value = window.innerWidth;
  viewportHeight.value = window.innerHeight;
  onScroll();
};

// ── Lifecycle ───────────────────────────────────────────────────────────────
onMounted(() => {
  prevGrid = gridStore.currentGrid;
  prevIsOwner = gridStore.isOwner;
  prevForcedBreakpoint = gridStore.forcedBreakpoint;

  gridStore.loadDemoGrid(createDemoGrid());
  applyForcedBreakpoint(displayBreakpoint.value);

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  onScroll();
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onResize);
  if (rafId) cancelAnimationFrame(rafId);

  gridStore.setForcedBreakpoint(prevForcedBreakpoint);
  gridStore.currentGrid = prevGrid;
  gridStore.isOwner = prevIsOwner;
  gridStore.isDemoGrid = false;
});

// Defense in depth: if anything inside the embed tries to navigate via a
// plain <a href> without target="_blank", rewrite it on the fly so the
// visitor never loses the landing page.
const interceptOutboundClick = (event: MouseEvent) => {
  const anchor = (event.target as HTMLElement | null)?.closest?.('a');
  if (!anchor) return;
  const href = anchor.getAttribute('href');
  if (!href) return;
  if (href.startsWith('#')) return;
  if (anchor.target !== '_blank') {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
};
</script>

<style scoped>
/*
  Outer scroll-jack wrapper. Tall enough to give us a multi-breakpoint
  scroll runway: roughly two viewport heights of "extra" scroll on top of
  one viewport for the pinned panel itself.

  Tweak --jack-runway to lengthen or shorten the morph distance.
*/
.grid-jack {
  --jack-runway: 240vh;
  position: relative;
  width: 100%;
  height: var(--jack-runway);
  margin: 0 auto 64px;
  pointer-events: auto;
}

.grid-jack.is-static {
  --jack-runway: auto;
  height: auto;
  margin-bottom: 44px;
}

/*
  Pinned panel: stays in view while the user scrolls through the runway.
  We pin slightly below the sticky nav bar so the device frame doesn't
  collide with it. The panel itself is centered both axes.
*/
.grid-jack__pin {
  /* Top offset must match PIN_TOP_OFFSET in <script> — keeps the scroll
     progress math aligned with the moment sticky actually engages. */
  position: sticky;
  top: 88px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  height: calc(100vh - 88px);
  min-height: 720px;
}

.grid-jack.is-static .grid-jack__pin {
  position: relative;
  top: auto;
  height: auto;
  min-height: 0;
  padding: 8px 0 24px;
}

/*
  Wrap whose footprint matches the visually-scaled device (plus the lg
  monitor stand). Aligns the device to the top so the stand silhouette
  has guaranteed real estate below the frame at the desktop breakpoint.
*/
.grid-jack__device-wrap {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  transition: width var(--duration-slow, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    height var(--duration-slow, 420ms) cubic-bezier(0.22, 1, 0.36, 1);
}

/*
  Device frame. Uses CSS transitions to morph width/height/border-radius
  between breakpoints, while a transform: scale() fits it into whatever
  horizontal room the hero offers (computed in <script>).

  transform-origin is `top center` (rather than `center center`) so the
  device's visual top stays anchored to its layout box top — important
  because the monitor stand below it is positioned via `top: 100%` and
  needs predictable alignment after scaling.
*/
.grid-jack__device {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1.5px solid rgba(255, 255, 255, 0.2);
  background: linear-gradient(180deg, rgba(20, 20, 28, 0.55), rgba(8, 8, 14, 0.85));
  box-shadow:
    0 30px 80px -20px rgba(0, 0, 0, 0.65),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  transform-origin: top center;
  transition:
    width var(--duration-slow, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    height var(--duration-slow, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    border-radius var(--duration-slow, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    padding var(--duration-slow, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    transform var(--duration-slow, 420ms) cubic-bezier(0.22, 1, 0.36, 1);
}

.grid-jack__viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  background: #050507;
  transition: border-radius var(--duration-slow, 420ms) cubic-bezier(0.22, 1, 0.36, 1);
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

.grid-jack__viewport::-webkit-scrollbar {
  width: 4px;
}

.grid-jack__viewport::-webkit-scrollbar-track {
  background: transparent;
}

.grid-jack__viewport::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

/*
  Scroll-sizer: a flow-layout wrapper whose dimensions match the visual
  (post-transform) size of the grid. Because CSS transforms don't affect
  layout, this div is what the viewport actually scrolls against.
*/
.grid-jack__scroll-sizer {
  position: relative;
  margin: 0 auto;
  flex-shrink: 0;
  transition: width var(--duration-slow, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    height var(--duration-slow, 420ms) cubic-bezier(0.22, 1, 0.36, 1);
}

/*
  Inner scaling layer. The grid is rendered at its natural pixel size so
  vue3-grid-layout's positioning maths stay valid; we scale the entire
  block with transform so all child sizes follow proportionally.
  Positioned absolutely inside the scroll-sizer so its un-transformed
  layout dimensions don't create unwanted overflow.
*/
.grid-jack__scale {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  transition: width var(--duration-slow, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    height var(--duration-slow, 420ms) cubic-bezier(0.22, 1, 0.36, 1);
}

/*
  Phone-specific chrome: little speaker notch at the top, home indicator
  at the bottom. Hidden on tablet/desktop. Subtle — just enough to read
  as "this is a phone".
*/
.grid-jack__notch,
.grid-jack__home-indicator {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.18);
  pointer-events: none;
  opacity: 0;
  transition: opacity 220ms ease;
}

.grid-jack__notch {
  top: 10px;
  width: 60px;
  height: 4px;
  border-radius: 4px;
}

.grid-jack__home-indicator {
  bottom: 10px;
  width: 90px;
  height: 4px;
  border-radius: 4px;
}

.grid-jack__device--sm .grid-jack__notch,
.grid-jack__device--sm .grid-jack__home-indicator {
  opacity: 1;
}

/*
  Tablet: reveal a small camera dot up top, no home indicator.
*/
.grid-jack__device--md .grid-jack__notch {
  opacity: 1;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/*
  Desktop: hide the phone-only chrome entirely; the wide aspect-ratio
  on its own reads as a laptop screen.
*/
.grid-jack__device--lg .grid-jack__notch,
.grid-jack__device--lg .grid-jack__home-indicator {
  opacity: 0;
}

/*
  Monitor stand silhouette — only visible at the lg breakpoint.

  Built from two thin lines (an upside-down T): a short vertical "neck"
  hanging from the centre of the screen, then a wider horizontal "base"
  beneath it. Lives inside the device frame so it inherits the same
  transform: scale() and stays in proportion when the frame shrinks to
  fit a narrow viewport.
*/
.grid-jack__stand {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity 220ms ease;
}

.grid-jack__device--lg .grid-jack__stand {
  opacity: 1;
}

.grid-jack__stand-neck {
  width: 2px;
  height: 22px;
  background: rgba(255, 255, 255, 0.22);
}

.grid-jack__stand-base {
  width: 220px;
  height: 2px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.22);
}

/*
  Legend strip below the frame, showing which breakpoint is active and
  hinting that scrolling does something. Active chip lights up with the
  brand gradient.
*/
.grid-jack__legend {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  font: 500 14px/1 var(--mkt-font-sans);
  color: var(--mkt-fg-3);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.grid-jack__chips {
  display: flex;
  align-items: center;
  gap: 16px;
}

.grid-jack__chip {
  display: inline-flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);
  color: var(--mkt-fg-3);
  transition: color 200ms ease, border-color 200ms ease, background 200ms ease;
}

.grid-jack__chip.is-active {
  color: var(--mkt-fg-1);
  border-color: transparent;
  background:
    linear-gradient(var(--mkt-bg-0), var(--mkt-bg-0)) padding-box,
    var(--mkt-brand-gradient) border-box;
  border: 1px solid transparent;
}

.grid-jack__legend-hint {
  font-size: 11px;
  color: var(--mkt-fg-4);
  letter-spacing: 0.06em;
}

/*
  vue3-grid-layout inserts its own container; make sure it doesn't pick up
  any external margins, and that the grid wrapper's internal "p: No tiles
  yet." fallback doesn't render with weird default margins.

  text-align is force-reset to `left` here because the grid is embedded
  inside .mkt__hero which sets `text-align: center`, and that cascades
  into tile content (notably link tiles, whose titles look subtly off
  when centred — they're left-aligned everywhere else in the app).
*/
.home-grid-embed {
  position: relative;
  pointer-events: auto;
  text-align: left;
}

.home-grid-embed :deep(.grid-scale-wrapper),
.home-grid-embed :deep(.grid-container) {
  margin: 0;
}

/*
  Compact mobile fallback: drop the runway and just show the phone view
  inline. The pin section becomes a normal flow block.
*/
@media (max-width: 720px) {
  .grid-jack__pin {
    gap: 16px;
  }
  .grid-jack__legend {
    font-size: 11px;
  }
}
</style>
