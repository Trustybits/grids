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
    • Intentionally does NOT watch currentLayout.themeId or call
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

          <div class="grid-jack__viewport" :style="viewportStyle">
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

      <div class="grid-jack__legend" aria-hidden="true">
        <span
          v-for="bp in breakpointOrder"
          :key="bp.id"
          :class="['grid-jack__chip', { 'is-active': displayBreakpoint === bp.id }]"
        >
          <span class="grid-jack__chip-dot" />
          {{ bp.label }}
        </span>
        <span v-if="!scrollDisabled" class="grid-jack__legend-hint">
          scroll to morph ↓
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Grid from '@/components/Grid.vue';
import { useLayoutStore } from '@/stores/layout';
import {
  DEMO_GRID_DIMENSIONS,
  createDemoLayout,
} from '@/data/demoLayout';
import type { Breakpoint } from '@/types/Tile';

const props = withDefaults(
  defineProps<{
    rowHeight?: number;
  }>(),
  {
    rowHeight: 75,
  },
);

const layoutStore = useLayoutStore();

// ── Pinned scroll-jack state ────────────────────────────────────────────────
const jackRoot = ref<HTMLElement | null>(null);
// The breakpoint actually applied to the grid + frame. Driven by scroll
// progress; defaults to 'sm' so first paint matches the smallest device.
const displayBreakpoint = ref<Breakpoint>('sm');
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
  { id: 'sm' as const, label: 'Phone' },
  { id: 'md' as const, label: 'Tablet' },
  { id: 'lg' as const, label: 'Desktop' },
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
  md: { outerWidth: 720, outerHeight: 600, paddingX: 22, paddingY: 32, borderRadius: 26 },
  lg: { outerWidth: 1040, outerHeight: 600, paddingX: 18, paddingY: 22, borderRadius: 16 },
};

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
const deviceWrapStyle = computed(() => {
  const spec = frameSpec.value;
  const fit = frameFitScale.value;
  return {
    width: `${spec.outerWidth * fit}px`,
    height: `${spec.outerHeight * fit}px`,
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

// Scale the natural-sized grid down to fit the device viewport. We pick
// the smaller of width-fit and height-fit so nothing overflows. A small
// safety margin (0.96) keeps the grid from kissing the bezel on either
// side, which would look cramped.
const SAFE_FILL = 0.96;
const gridScale = computed(() => {
  const spec = frameSpec.value;
  const innerW = spec.outerWidth - spec.paddingX * 2;
  const innerH = spec.outerHeight - spec.paddingY * 2;
  const grid = DEMO_GRID_DIMENSIONS[displayBreakpoint.value];
  const widthFit = innerW / grid.width;
  const heightFit = innerH / grid.height;
  return Math.min(widthFit, heightFit) * SAFE_FILL;
});

const scaleStyle = computed(() => {
  const grid = DEMO_GRID_DIMENSIONS[displayBreakpoint.value];
  return {
    width: `${grid.width}px`,
    height: `${grid.height}px`,
    transform: `scale(${gridScale.value})`,
  };
});

// ── Layout-store wiring ─────────────────────────────────────────────────────
let prevLayout: typeof layoutStore.currentLayout = null;
let prevIsOwner = false;
let prevForcedBreakpoint: Breakpoint | null = null;

const applyForcedBreakpoint = (bp: Breakpoint) => {
  if (layoutStore.forcedBreakpoint === bp) return;
  layoutStore.setForcedBreakpoint(bp);
};

watch(displayBreakpoint, (bp) => applyForcedBreakpoint(bp));

// ── Scroll-progress driver ──────────────────────────────────────────────────
//
// We translate the visitor's scroll position over the wrapper into a 0..1
// progress, then divide that range into thirds — one per breakpoint.
// Discrete switching (rather than a continuous interpolation) is what
// gives us the satisfying "pop" the user asked for.
const breakpointForProgress = (progress: number): Breakpoint => {
  if (progress < 0.34) return 'sm';
  if (progress < 0.67) return 'md';
  return 'lg';
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
  prevLayout = layoutStore.currentLayout;
  prevIsOwner = layoutStore.isOwner;
  prevForcedBreakpoint = layoutStore.forcedBreakpoint;

  layoutStore.loadDemoLayout(createDemoLayout());
  applyForcedBreakpoint(displayBreakpoint.value);

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  onScroll();
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onResize);
  if (rafId) cancelAnimationFrame(rafId);

  layoutStore.setForcedBreakpoint(prevForcedBreakpoint);
  layoutStore.currentLayout = prevLayout;
  layoutStore.isOwner = prevIsOwner;
  layoutStore.isDemoLayout = false;
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
  min-height: 620px;
}

.grid-jack.is-static .grid-jack__pin {
  position: relative;
  top: auto;
  height: auto;
  min-height: 0;
  padding: 8px 0 24px;
}

/*
  Wrap whose footprint matches the visually-scaled device. Lets the legend
  below sit immediately under the (potentially shrunk) frame on narrow
  viewports without a big empty gap.
*/
.grid-jack__device-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: width var(--duration-slow, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    height var(--duration-slow, 420ms) cubic-bezier(0.22, 1, 0.36, 1);
}

/*
  Device frame. Uses CSS transitions to morph width/height/border-radius
  between breakpoints, while a transform: scale() fits it into whatever
  horizontal room the hero offers (computed in <script>).
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
  transform-origin: center center;
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
  overflow: hidden;
  background: #050507;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-radius var(--duration-slow, 420ms) cubic-bezier(0.22, 1, 0.36, 1);
}

/*
  Inner scaling layer. The grid is rendered at its natural pixel size so
  vue3-grid-layout's positioning maths stay valid; we scale the entire
  block with transform so all child sizes follow proportionally.
*/
.grid-jack__scale {
  transform-origin: center center;
  transition: width var(--duration-slow, 420ms) cubic-bezier(0.22, 1, 0.36, 1),
    height var(--duration-slow, 420ms) cubic-bezier(0.22, 1, 0.36, 1);
  /* Keep our own scale separate from the grid's internal mobileScale so
     they don't compound. <Grid :disable-auto-scale="true"> makes sure
     of that on the JS side. */
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
  Legend strip below the frame, showing which breakpoint is active and
  hinting that scrolling does something. Active chip lights up with the
  brand gradient.
*/
.grid-jack__legend {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  font: 500 12px/1 var(--mkt-font-sans);
  color: var(--mkt-fg-3);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.grid-jack__chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);
  color: var(--mkt-fg-3);
  transition: color 200ms ease, border-color 200ms ease, background 200ms ease;
}

.grid-jack__chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  transition: background 200ms ease, box-shadow 200ms ease;
}

.grid-jack__chip.is-active {
  color: var(--mkt-fg-1);
  border-color: transparent;
  background:
    linear-gradient(var(--mkt-bg-0), var(--mkt-bg-0)) padding-box,
    var(--mkt-brand-gradient) border-box;
  border: 1px solid transparent;
}

.grid-jack__chip.is-active .grid-jack__chip-dot {
  background: var(--mkt-brand-cyan, #6cf);
  box-shadow: 0 0 0 4px rgba(131, 139, 251, 0.18);
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
*/
.home-grid-embed {
  position: relative;
  pointer-events: auto;
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
