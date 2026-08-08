<!--
  LandingFeatureAssembly.vue

  The three feature cards start laid out as a full-width vertical list. While
  the section is pinned, scrolling collapses that list into a bento grid: each
  card shrinks and glides from its list row into its grid slot, one after
  another, until the grid is assembled.

  Mechanics:
    • A tall runway (`fa`) gives scroll distance; an inner sticky panel
      (`fa__pin`) holds the stage while the visitor scrolls through it.
    • Each card is absolutely positioned inside the stage. We compute two
      pixel rects per card — its "list" row and its "grid" slot — and per
      frame interpolate left/top/width/height between them, staggered so the
      cards dock in sequence.
    • Card content scales with the card via CSS container-query units (so it
      resizes smoothly instead of reflowing), and the inner layout flips from
      row → column via a container aspect-ratio query.
    • Narrow screens / reduced-motion fall back to a plain stacked list.
-->
<template>
  <div ref="root" class="fa" :class="{ 'fa--static': disabled }">
    <div class="fa__pin">
      <div ref="stage" class="fa__stage">
        <article
          :ref="(el) => setCardRef(el as HTMLElement | null, 0)"
          class="fa__card fa__card--1"
        >
          <div class="fa__card-inner">
            <div class="fa__card-body">
              <h2>A canvas that snaps.</h2>
              <p>Tiles snap to a flexible grid. Drag one, and everything else finds its place. No layout headaches.</p>
            </div>
            <div class="fa__card-demo">
              <div class="fa__snap">
                <span class="fa__snap-tile fa__snap-tile--a"></span>
                <span class="fa__snap-tile fa__snap-tile--b"></span>
                <span class="fa__snap-tile fa__snap-tile--c"></span>
                <span class="fa__snap-tile fa__snap-tile--d"></span>
              </div>
            </div>
          </div>
        </article>

        <article
          :ref="(el) => setCardRef(el as HTMLElement | null, 1)"
          class="fa__card fa__card--2"
        >
          <div class="fa__card-inner">
            <div class="fa__card-body">
              <h2>Every tile, a statement.</h2>
              <p>Pick a color. Set a vibe. Tiles fill themselves with the theme and shape of your work.</p>
            </div>
            <div class="fa__card-demo">
              <div class="mkt__palette-row">
                <span class="dot dot--cyan"></span>
                <span class="dot dot--blue"></span>
                <span class="dot dot--indigo"></span>
                <span class="dot dot--violet"></span>
                <span class="dot dot--magenta"></span>
                <span class="dot dot--yellow"></span>
              </div>
              <div class="mkt__theme-card">
                <div class="mkt__theme-card-plasma"></div>
              </div>
            </div>
          </div>
        </article>

        <article
          :ref="(el) => setCardRef(el as HTMLElement | null, 2)"
          class="fa__card fa__card--3"
        >
          <div class="fa__card-inner">
            <div class="fa__card-body">
              <h2>Share one url.</h2>
              <p>Your grids.so url is the only link you'll need. Send it once — it stays in sync forever.</p>
            </div>
            <div class="fa__card-demo">
              <div class="mkt__og-card">
                <div class="mkt__og-image">
                  <img src="/og-preview-placeholder.png" alt="Grid preview" />
                </div>
                <div class="mkt__og-meta">
                  <span class="mkt__og-site">matt's grid</span>
                  <span class="mkt__og-title">https://grids.so/matt</span>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const PIN_TOP = 88; // must match .fa__pin top offset in CSS
const GAP = 16; // gap between rows / grid cells, in px
const DISABLE_BELOW = 820; // below this width, fall back to a static stack

// Per-card window over scroll progress p ∈ [0,1]. Within each window the card
// rises up from below to a full-width "peak" (like the old stack), then morphs
// down into its grid slot. Staggered so they arrive one after another.
const WINDOWS: Array<[number, number]> = [
  [0.0, 0.32],
  [0.33, 0.63],
  [0.63, 0.95],
];
const RISE_PORTION = 0.46; // fraction of a card's window spent rising up

type Rect = { x: number; y: number; w: number; h: number };

const root = ref<HTMLElement | null>(null);
const stage = ref<HTMLElement | null>(null);
const cardEls: (HTMLElement | null)[] = [null, null, null];

const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280);
const viewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 800);
const disabled = computed(() => viewportWidth.value < DISABLE_BELOW);

let gridRects: Rect[] = [];
let peakRects: Rect[] = [];
let belowRects: Rect[] = [];

function setCardRef(el: HTMLElement | null, i: number) {
  cardEls[i] = el;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    w: lerp(a.w, b.w, t),
    h: lerp(a.h, b.h, t),
  };
}

function smoothstep(a: number, b: number, x: number): number {
  if (a === b) return x < a ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Build the list rows and the grid slots (bento: tall card left, two stacked
// right), in pixels relative to the stage box.
function computeLayouts() {
  const st = stage.value;
  if (!st) return;
  const W = st.clientWidth;
  const H = st.clientHeight;

  const leftW = Math.round(W * 0.56) - GAP / 2;
  const rightX = leftW + GAP;
  const rightW = W - rightX;
  const halfH = (H - GAP) / 2;
  gridRects = [
    { x: 0, y: 0, w: leftW, h: H },
    { x: rightX, y: 0, w: rightW, h: halfH },
    { x: rightX, y: halfH + GAP, w: rightW, h: halfH },
  ];

  // Per-card "peak" pose — the prominent size a card reaches as it rises,
  // BEFORE morphing into its slot. Each peak is confined to that card's own
  // region so a rising card never covers an already-docked one:
  //   • card 0 (docks left) is the intro → full width (nothing behind it yet)
  //   • card 1 (docks top-right) rises tall inside the right column
  //   • card 2 (docks bottom-right) rises inside the bottom-right area only,
  //     so it never climbs over card 1.
  const ph0 = Math.min(H * 0.62, H - 32);
  const ph1 = Math.min(H * 0.78, H);
  const bottomY = halfH + GAP;
  peakRects = [
    { x: 0, y: (H - ph0) / 2, w: W, h: ph0 },
    { x: rightX, y: (H - ph1) / 2, w: rightW, h: ph1 },
    { x: rightX, y: bottomY, w: rightW, h: H - bottomY + H * 0.14 },
  ];
  belowRects = peakRects.map((r) => ({ ...r, y: H + 56 }));
}

function clearInlineStyles() {
  cardEls.forEach((el) => {
    if (!el) return;
    el.style.left = '';
    el.style.top = '';
    el.style.width = '';
    el.style.height = '';
    el.style.zIndex = '';
  });
}

function render(p: number) {
  cardEls.forEach((el, i) => {
    if (!el || !gridRects[i]) return;
    const [s, e] = WINDOWS[i];
    const local = e > s ? (p - s) / (e - s) : 0;
    // Card 0 is already at its peak when the section opens (so the stage is
    // never empty); the others rise up from below.
    const startRect = i === 0 ? peakRects[0] : belowRects[i];
    let rect: Rect;
    let active = false;
    if (local <= 0) {
      rect = startRect;
    } else if (local >= 1) {
      rect = gridRects[i]; // docked in the grid
    } else {
      active = true;
      if (local <= RISE_PORTION) {
        rect = lerpRect(startRect, peakRects[i], smoothstep(0, RISE_PORTION, local));
      } else {
        rect = lerpRect(peakRects[i], gridRects[i], smoothstep(RISE_PORTION, 1, local));
      }
    }
    el.style.left = `${rect.x}px`;
    el.style.top = `${rect.y}px`;
    el.style.width = `${rect.w}px`;
    el.style.height = `${rect.h}px`;
    // The rising / docking card rides above those already parked.
    el.style.zIndex = String(active ? 30 + i : 2 + i);
  });
}

let rafId = 0;
function progress(): number {
  const el = root.value;
  if (!el) return 0;
  const rect = el.getBoundingClientRect();
  const totalRunway = el.offsetHeight - viewportHeight.value + PIN_TOP;
  if (totalRunway <= 0) return 0;
  const scrolled = Math.min(Math.max(0, PIN_TOP - rect.top), totalRunway);
  return scrolled / totalRunway;
}

function onScroll() {
  if (disabled.value) return;
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    render(progress());
  });
}

function onResize() {
  viewportWidth.value = window.innerWidth;
  viewportHeight.value = window.innerHeight;
  if (disabled.value) {
    clearInlineStyles();
    return;
  }
  computeLayouts();
  render(progress());
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  requestAnimationFrame(() => {
    if (disabled.value) return;
    computeLayouts();
    render(progress());
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onResize);
  if (rafId) cancelAnimationFrame(rafId);
});
</script>

<style scoped>
.fa {
  --fa-runway: 250vh;
  position: relative;
  width: 100%;
  height: var(--fa-runway);
  z-index: 1;
}

.fa__pin {
  position: sticky;
  top: 88px;
  height: calc(100vh - 88px);
  min-height: 640px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--mkt-section-x);
}

.fa__stage {
  position: relative;
  width: min(1160px, 100%);
  height: min(86vh, 780px);
}

.fa__card {
  position: absolute;
  left: 0;
  top: 0;
  container-type: size;
  overflow: hidden;
  border-radius: var(--mkt-radius-lg);
  border: 1px solid rgba(255, 255, 255, 0.09);
  background: linear-gradient(180deg, var(--mkt-bg-2), var(--mkt-bg-1));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 24px 60px -34px rgba(0, 0, 0, 0.9);
  will-change: left, top, width, height;
}

/* Faint dot texture inside each tile. */
.fa__card::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.05) 1px,
    transparent 1.4px
  );
  background-size: 22px 22px;
  -webkit-mask-image: radial-gradient(ellipse 85% 85% at 78% 25%, #000, transparent 74%);
  mask-image: radial-gradient(ellipse 85% 85% at 78% 25%, #000, transparent 74%);
}

.fa__card-inner {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: clamp(10px, 4cqmin, 26px);
  padding: clamp(16px, 5cqmin, 40px);
  text-align: left;
}

.fa__card-body {
  min-width: 0;
  flex: 0 0 auto;
}
.fa__card-body h2 {
  margin: 0;
  font-family: var(--mkt-font-brand);
  font-weight: 700;
  letter-spacing: -0.005em;
  line-height: 1.05;
  font-size: clamp(1.05rem, 8.5cqmin, 2.4rem);
  color: var(--mkt-fg-1);
}
.fa__card-body p {
  margin: clamp(6px, 2.4cqmin, 16px) 0 0;
  font-family: var(--mkt-font-sans);
  font-weight: 400;
  line-height: 1.45;
  font-size: clamp(0.78rem, 4cqmin, 1.05rem);
  color: color-mix(in srgb, var(--mkt-fg-2) 82%, transparent);
  max-width: 46ch;
}

.fa__card-demo {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 3cqmin, 16px);
}
.fa__card-demo > * {
  max-width: 100%;
}

/* Clean, connected "snapped" bento for the first card (replaces the old
   scattered mini-tiles that stretched). Fixed aspect-ratio so it never
   distorts as the card morphs. */
.fa__snap {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: clamp(7px, 2.4cqmin, 15px);
  width: min(100%, clamp(220px, 84cqmin, 460px));
  aspect-ratio: 3 / 2;
}
.fa__snap-tile {
  position: relative;
  overflow: hidden;
  border-radius: clamp(7px, 2.2cqmin, 15px);
  background: var(--mkt-glass-tile-bg);
  border: 1px solid var(--mkt-glass-tile-border);
  box-shadow: var(--mkt-glass-tile-shadow);
}
.fa__snap-tile::before {
  content: "";
  position: absolute;
  inset: 0;
  filter: blur(10px);
  opacity: 0.85;
  background:
    radial-gradient(circle at 30% 74%, var(--mkt-brand-400), transparent 60%),
    radial-gradient(circle at 78% 24%, var(--mkt-brand-200), transparent 58%);
}
.fa__snap-tile--a { grid-column: 1 / span 2; grid-row: 1; }
.fa__snap-tile--b { grid-column: 3; grid-row: 1 / span 2; }
.fa__snap-tile--c { grid-column: 1; grid-row: 2; }
.fa__snap-tile--d { grid-column: 2; grid-row: 2; }
.fa__snap-tile--b::before {
  background: radial-gradient(circle at 50% 110%, var(--mkt-brand-500), transparent 62%);
}
.fa__snap-tile--c::before {
  background: radial-gradient(circle at 40% 40%, var(--mkt-brand-300), transparent 62%);
}

/* Demos scale with the card via container units so they track the morph. */
.fa__card :deep(.dot) {
  width: clamp(16px, 6cqmin, 30px);
  height: clamp(16px, 6cqmin, 30px);
  border-radius: clamp(5px, 2cqmin, 10px);
}
.fa__card :deep(.mkt__palette-row) {
  gap: clamp(6px, 2.4cqmin, 12px);
}
.fa__card :deep(.mkt__theme-card) {
  width: clamp(150px, 58cqmin, 236px);
  height: clamp(70px, 30cqmin, 132px);
}
.fa__card :deep(.mkt__og-card) {
  width: clamp(180px, 82cqmin, 300px);
  box-shadow: none;
}

/* ── Static fallback (narrow / reduced motion): plain stacked list ──────── */
.fa--static {
  height: auto;
}
.fa--static .fa__pin {
  position: static;
  height: auto;
  min-height: 0;
  padding: 0 var(--mkt-section-x);
}
.fa--static .fa__stage {
  width: 100%;
  max-width: var(--mkt-section-max);
  height: auto;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.fa--static .fa__card {
  position: relative;
  left: auto !important;
  top: auto !important;
  width: 100% !important;
  height: auto !important;
  min-height: 280px;
  container-type: normal;
}

@media (prefers-reduced-motion: reduce) {
  .fa {
    height: auto;
  }
  .fa__pin {
    position: static;
    height: auto;
    min-height: 0;
  }
  .fa__stage {
    height: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .fa__card {
    position: relative;
    left: auto !important;
    top: auto !important;
    width: 100% !important;
    height: auto !important;
    min-height: 280px;
    container-type: normal;
  }
}
</style>
