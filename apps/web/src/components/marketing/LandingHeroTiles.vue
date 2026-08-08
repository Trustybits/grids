<!--
  LandingHeroTiles.vue

  Decorative, interactive backdrop for the hero. Renders a faint grid confined
  to the left/right gutters (masked clear through the centre so it never sits
  behind the headline) and a set of real-looking product tiles — profile,
  Spotify music, and link tiles — that:
    • fly in and snap into place on load (assemble), and
    • can be dragged; on release they snap to the 48px grid.

  Layout is anchored to the full viewport width so the tiles sit in the gutters
  either side of the centred hero copy. Below ~1200px there isn't gutter room,
  so the tiles hide and only the faint grid glow remains. Respects
  prefers-reduced-motion (tiles still show, they just skip the fly-in).

  Purely presentational: aria-hidden, and the tiles are not links (the real
  interactive grid lives just below in <LandingPageGridEmbed>).
-->
<template>
  <div ref="root" class="hero-tiles" :class="{ 'is-hidden': hideTiles }" aria-hidden="true">
    <div class="hero-tiles__grid"></div>
    <div class="hero-tiles__glow"></div>

    <div
      v-for="(t, i) in TILES"
      :key="t.id"
      :ref="(el) => setTileRef(el as HTMLElement | null, i)"
      class="hero-tile"
      :class="[`hero-tile--${t.type}`, { 'is-in': entered[i], 'is-dragging': dragging === i }]"
      :style="tileStyle(i)"
      @pointerdown="onDown($event, i)"
    >
      <template v-if="t.type === 'profile'">
        <span class="hero-tile__avatar"></span>
        <div class="hero-tile__body">
          <div class="hero-tile__title">{{ t.title }}</div>
          <div class="hero-tile__sub">{{ t.sub }}</div>
        </div>
      </template>

      <template v-else-if="t.type === 'music'">
        <div class="hero-tile__cover">
          <img :src="t.art" alt="" loading="lazy" />
        </div>
        <div class="hero-tile__body">
          <div class="hero-tile__title">{{ t.title }}</div>
          <div class="hero-tile__sub">{{ t.sub }}</div>
        </div>
        <span class="hero-tile__spotify"></span>
      </template>

      <template v-else>
        <div class="hero-tile__head">
          <span class="hero-tile__logo"><img :src="favicon(t.domain!)" alt="" loading="lazy" /></span>
          <svg class="hero-tile__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7" /><path d="M8 7h9v9" /></svg>
        </div>
        <div class="hero-tile__body">
          <div class="hero-tile__title">{{ t.title }}</div>
          <div class="hero-tile__sub">{{ t.sub }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';

type TileType = 'profile' | 'music' | 'link';
interface HeroTile {
  id: string;
  side: 'L' | 'R';
  row: number;
  w: number;
  h: number;
  type: TileType;
  title: string;
  sub: string;
  domain?: string;
  art?: string;
}

// Mirrors the demo grid's content (profile / music / links) so the hero shows
// the same tile types the product renders below.
const TILES: HeroTile[] = [
  { id: 'profile', side: 'L', row: 0, w: 140, h: 116, type: 'profile', title: 'Link', sub: 'Hero of Time' },
  { id: 'github', side: 'L', row: 1, w: 132, h: 100, type: 'link', title: 'GitHub', sub: '@github.com', domain: 'github.com' },
  { id: 'music', side: 'R', row: 0, w: 140, h: 140, type: 'music', title: 'Ode to Joy', sub: 'Ludwig van Beethoven', art: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e028dd8211c6f6e49c9185e0c7d' },
  { id: 'instagram', side: 'R', row: 1, w: 100, h: 100, type: 'link', title: 'Instagram', sub: '@instagram.com', domain: 'instagram.com' },
  { id: 'x', side: 'R', row: 2, w: 132, h: 100, type: 'link', title: 'X', sub: '@x.com', domain: 'x.com' },
];

const CELL = 48; // matches the grid background cell + the product grid feel
const CENTER_HALF = 360; // half-width of the protected centre column (matches the headline)
const GAP = 48; // gap between the headline edge and the nearest tile edge
const ROW_STAGGER = 14; // extra outward offset per stacked row, for an organic feel
const MIN_WIDTH = 1000; // hard floor; the geometric overflow check below is the real gate
const EDGE_MIN = 24; // keep tiles at least this far from the viewport edge

const favicon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

const root = ref<HTMLElement | null>(null);
const tileEls: (HTMLElement | null)[] = new Array(TILES.length).fill(null);
const setTileRef = (el: HTMLElement | null, i: number) => { tileEls[i] = el; };

// Per-tile position + one-time scatter offset for the fly-in.
const pos = reactive(
  TILES.map(() => ({ x: 0, y: 0, dragged: false })),
);
const scatter = TILES.map(() => ({
  dx: (Math.random() - 0.5) * 220,
  dy: (Math.random() - 0.5) * 160,
  rot: (Math.random() - 0.5) * 18,
}));
const entered = reactive(TILES.map(() => false));

const hideTiles = ref(false);
const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const rowFracs: Record<'L' | 'R', number[]> = {
  L: [0.14, 0.58],
  R: [0.1, 0.5, 0.74],
};

// Measured from the real headline each layout so the gap stays constant as the
// font scales with the viewport. Fall back to the fixed box half-width.
let centerX = 0;
let centerHalf = CENTER_HALF;

function computeHome(i: number, H: number) {
  const t = TILES[i];
  // Anchor tiles a fixed GAP outside the actual headline text so they stay
  // beside the copy (not the viewport edges) and keep the same gap however the
  // text spreads.
  const inner = centerHalf + GAP;
  const x =
    t.side === 'L'
      ? centerX - inner - t.w - t.row * ROW_STAGGER
      : centerX + inner + t.row * ROW_STAGGER;
  const y = Math.round((rowFracs[t.side][t.row] ?? 0.3) * H);
  return { x, y };
}

function layout() {
  const el = root.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const title = document.querySelector('.mkt__hero-title');
  if (title) {
    const tr = title.getBoundingClientRect();
    centerHalf = tr.width / 2;
    centerX = tr.left - rect.left + tr.width / 2;
  } else {
    centerHalf = CENTER_HALF;
    centerX = rect.width / 2;
  }
  // Hide when a tile beside the headline would run off-screen (no gutter room).
  const maxTileW = Math.max(...TILES.map((t) => t.w));
  const inner = centerHalf + GAP;
  const overflowsLeft = centerX - inner - maxTileW < EDGE_MIN;
  const overflowsRight = rect.width - (centerX + inner + maxTileW) < EDGE_MIN;
  hideTiles.value = rect.width < MIN_WIDTH || overflowsLeft || overflowsRight;
  TILES.forEach((_, i) => {
    if (pos[i].dragged) return;
    const { x, y } = computeHome(i, rect.height);
    pos[i].x = x;
    pos[i].y = y;
  });
}

function tileStyle(i: number) {
  const t = TILES[i];
  const p = pos[i];
  const base = {
    width: `${t.w}px`,
    height: `${t.h}px`,
    left: `${p.x}px`,
    top: `${p.y}px`,
  } as Record<string, string>;
  if (!entered[i] && !reduceMotion) {
    const s = scatter[i];
    base.transform = `translate(${s.dx}px, ${s.dy}px) scale(.7) rotate(${s.rot}deg)`;
    base.opacity = '0';
  }
  return base;
}

// ── Drag + snap ─────────────────────────────────────────────────────────────
const dragging = ref<number | null>(null);
let offX = 0;
let offY = 0;

function onDown(e: PointerEvent, i: number) {
  if (hideTiles.value) return;
  e.preventDefault(); // stop the native text-selection drag on the copy behind
  const el = tileEls[i];
  if (!el) return;
  dragging.value = i;
  try {
    el.setPointerCapture(e.pointerId);
  } catch {
    // Pointer capture can reject (e.g. synthetic events); drag still works via
    // the document-level move/up listeners below.
  }
  const r = el.getBoundingClientRect();
  offX = e.clientX - r.left;
  offY = e.clientY - r.top;
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp, { once: true });
}

function onMove(e: PointerEvent) {
  const i = dragging.value;
  if (i === null) return;
  const rect = root.value?.getBoundingClientRect();
  if (!rect) return;
  pos[i].x = e.clientX - rect.left - offX;
  pos[i].y = e.clientY - rect.top - offY;
}

function onUp() {
  const i = dragging.value;
  if (i === null) return;
  const snap = (v: number) => Math.round(v / CELL) * CELL;
  pos[i].x = snap(pos[i].x);
  pos[i].y = snap(pos[i].y);
  pos[i].dragged = true;
  dragging.value = null;
  document.removeEventListener('pointermove', onMove);
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  layout();
  window.addEventListener('resize', layout);
  if (reduceMotion) {
    TILES.forEach((_, i) => { entered[i] = true; });
  } else {
    TILES.forEach((_, i) => {
      setTimeout(() => { entered[i] = true; }, 180 + i * 130);
    });
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', layout);
  document.removeEventListener('pointermove', onMove);
});
</script>

<style scoped>
.hero-tiles {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 100vw;
  top: 0;
  bottom: 0;
  z-index: 1;
  pointer-events: none;
}
.hero-tiles.is-hidden .hero-tile {
  display: none;
}

/* Faint grid, confined to the gutters and dissolving toward the centre. */
.hero-tiles__grid {
  position: absolute;
  inset: -40px 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.09) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.09) 1px, transparent 1px);
  background-size: 48px 48px;
  -webkit-mask-image:
    linear-gradient(to right, #000 0%, #000 6%, rgba(0, 0, 0, 0) 22%, rgba(0, 0, 0, 0) 78%, #000 94%, #000 100%),
    linear-gradient(to bottom, transparent 0%, #000 20%, #000 80%, transparent 100%);
  -webkit-mask-composite: source-in;
  mask-image:
    linear-gradient(to right, #000 0%, #000 6%, rgba(0, 0, 0, 0) 22%, rgba(0, 0, 0, 0) 78%, #000 94%, #000 100%),
    linear-gradient(to bottom, transparent 0%, #000 20%, #000 80%, transparent 100%);
  mask-composite: intersect;
}
.hero-tiles__glow {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(360px 300px at 8% 42%, rgba(108, 77, 254, 0.13), transparent 70%),
    radial-gradient(360px 300px at 92% 52%, rgba(108, 77, 254, 0.13), transparent 70%);
}

/* ── Tile: dark rounded card matching the product's link/profile/music tiles ── */
.hero-tile {
  position: absolute;
  z-index: 3;
  pointer-events: auto;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px;
  border-radius: 22px;
  color: #fff;
  background: #0e0e12;
  border: 2px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 18px 44px -12px rgba(0, 0, 0, 0.7);
  opacity: 1;
  transition:
    transform 0.8s cubic-bezier(0.2, 0.85, 0.2, 1),
    opacity 0.6s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}
.hero-tile.is-dragging {
  cursor: grabbing;
  transition: none;
  z-index: 4;
  border-color: rgba(168, 151, 255, 0.6);
  box-shadow: 0 26px 60px -12px rgba(108, 77, 254, 0.5);
}

.hero-tile__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.hero-tile__logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.hero-tile__logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.hero-tile__arrow {
  width: 20px;
  height: 20px;
  color: #fff;
  opacity: 0.25;
  flex: none;
  transition: opacity 0.2s ease;
}
.hero-tile:hover .hero-tile__arrow {
  opacity: 0.85;
}
.hero-tile__body {
  margin-top: auto;
  min-width: 0;
  text-align: left;
}
.hero-tile__title {
  font: 600 15px/1.22 var(--mkt-font-sans);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hero-tile__sub {
  font: 400 12px/1.3 var(--mkt-font-sans);
  color: rgba(255, 255, 255, 0.55);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* profile */
.hero-tile__avatar {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  flex: none;
  background: linear-gradient(135deg, var(--mkt-brand-300), var(--mkt-brand-600));
}

/* music */
.hero-tile--music {
  padding: 12px;
}
.hero-tile--music .hero-tile__cover {
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  border-radius: 12px;
  overflow: hidden;
  background: #1b1b1f;
  margin-bottom: 9px;
}
.hero-tile--music .hero-tile__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.hero-tile--music .hero-tile__body {
  margin-top: 0;
}
.hero-tile__spotify {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #1db954;
  flex: none;
}
</style>
