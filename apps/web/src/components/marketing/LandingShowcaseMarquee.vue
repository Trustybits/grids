<template>
  <section id="showcase" class="mkt__landing-showcase" aria-labelledby="showcase-heading">
    <div class="mkt__landing-showcase-head">
      <div class="mkt__kicker">Built on grids</div>
      <h2 id="showcase-heading">Real pages from <span>real creators.</span></h2>
      <p>Tap any card to visit their grid — then claim your own handle above.</p>
    </div>

    <div
      class="mkt__showcase-marquee"
      @mouseenter="slowed = true"
      @mouseleave="slowed = false"
      @focusin="slowed = true"
      @focusout="onFocusOut"
    >
      <div
        v-for="(row, rowIndex) in marqueeRows"
        :key="rowIndex"
        class="mkt__showcase-marquee-row"
      >
        <div
          :ref="(el) => setTrackRef(el as HTMLElement | null, rowIndex)"
          class="mkt__showcase-marquee-track"
          :style="trackStyles[rowIndex]"
        >
          <div
            v-for="groupIndex in 2"
            :key="groupIndex"
            class="mkt__showcase-marquee-group"
            :aria-hidden="groupIndex === 2 ? 'true' : undefined"
          >
            <router-link
              v-for="entry in row"
              :key="`${groupIndex}-${entry.slug}`"
              :to="`/${entry.slug}`"
              class="mkt__card mkt__card--showcase mkt__showcase-marquee-card"
              :tabindex="groupIndex === 2 ? -1 : undefined"
            >
              <ShowcaseGridCard
                :entry="entry"
                :failed-slugs="failedSlugs"
                @image-failed="markImageFailed"
              />
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <div class="mkt__showcase-static" aria-label="Featured grids">
      <router-link
        v-for="entry in showcaseGrids"
        :key="entry.slug"
        :to="`/${entry.slug}`"
        class="mkt__card mkt__card--showcase"
      >
        <ShowcaseGridCard
          :entry="entry"
          :failed-slugs="failedSlugs"
          @image-failed="markImageFailed"
        />
      </router-link>
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from 'vue';
import { SHOWCASE_GRIDS, type ShowcaseEntry } from '@/data/showcaseGrids';
import ShowcaseGridCard from '@/components/marketing/ShowcaseGridCard.vue';

const FWD_LOOP_SECONDS = 72;
const REV_LOOP_SECONDS = 84;
/** Higher = snappier speed changes; lower = softer ease in/out. */
const SPEED_LERP = 0.06;

type RowMotion = {
  offset: number;
  velocity: number;
  loopWidth: number;
  periodSeconds: number;
  reverse: boolean;
};

const showcaseGrids = SHOWCASE_GRIDS;
const failedSlugs = reactive(new Set<string>());
const slowed = ref(false);
const trackStyles = ref<Array<{ transform: string }>>([
  { transform: 'translateX(0px)' },
  { transform: 'translateX(0px)' },
]);

const trackRefs: (HTMLElement | null)[] = [];
const rowMotion: RowMotion[] = [
  {
    offset: 0,
    velocity: 0,
    loopWidth: 0,
    periodSeconds: FWD_LOOP_SECONDS,
    reverse: false,
  },
  {
    offset: 0,
    velocity: 0,
    loopWidth: 0,
    periodSeconds: REV_LOOP_SECONDS,
    reverse: true,
  },
];

let rafId = 0;
let lastFrameTime = 0;
let motionEnabled = false;

const marqueeRows = computed(() => {
  const midpoint = Math.ceil(showcaseGrids.length / 2);
  return [
    showcaseGrids.slice(0, midpoint),
    showcaseGrids.slice(midpoint),
  ] as [ShowcaseEntry[], ShowcaseEntry[]];
});

function setTrackRef(el: HTMLElement | null, rowIndex: number) {
  trackRefs[rowIndex] = el;
}

function measureLoopWidth(el: HTMLElement): number {
  return el.scrollWidth / 2;
}

function syncTrackStyles() {
  trackStyles.value = rowMotion.map((row) => ({
    transform: `translateX(${row.offset}px)`,
  }));
}

function wrapOffset(row: RowMotion) {
  if (row.loopWidth <= 0) return;

  if (row.reverse) {
    while (row.offset >= 0) row.offset -= row.loopWidth;
    while (row.offset < -row.loopWidth) row.offset += row.loopWidth;
    return;
  }

  while (row.offset <= -row.loopWidth) row.offset += row.loopWidth;
  while (row.offset > 0) row.offset -= row.loopWidth;
}

function targetVelocity(row: RowMotion): number {
  if (row.loopWidth <= 0) return 0;
  const magnitude = row.loopWidth / row.periodSeconds;
  if (slowed.value) return 0;
  return row.reverse ? magnitude : -magnitude;
}

function tick(now: number) {
  const deltaSeconds = lastFrameTime
    ? Math.min((now - lastFrameTime) / 1000, 0.05)
    : 0;
  lastFrameTime = now;

  rowMotion.forEach((row, index) => {
    const el = trackRefs[index];
    if (el) {
      const measured = measureLoopWidth(el);
      if (measured > 0) row.loopWidth = measured;
    }

    const target = targetVelocity(row);
    row.velocity += (target - row.velocity) * SPEED_LERP;
    row.offset += row.velocity * deltaSeconds;
    wrapOffset(row);
  });

  syncTrackStyles();
  rafId = requestAnimationFrame(tick);
}

function initMotion() {
  rowMotion.forEach((row, index) => {
    const el = trackRefs[index];
    if (!el) return;
    row.loopWidth = measureLoopWidth(el);
    if (row.reverse && row.loopWidth > 0) {
      row.offset = -row.loopWidth;
    }
    row.velocity = targetVelocity(row);
  });
  syncTrackStyles();
}

function startMotion() {
  if (motionEnabled) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  motionEnabled = true;
  initMotion();
  lastFrameTime = 0;
  rafId = requestAnimationFrame(tick);
}

function stopMotion() {
  motionEnabled = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

function markImageFailed(slug: string) {
  failedSlugs.add(slug);
}

function onFocusOut(event: FocusEvent) {
  const root = event.currentTarget as HTMLElement | null;
  if (root?.contains(event.relatedTarget as Node | null)) return;
  slowed.value = false;
}

onMounted(async () => {
  await nextTick();
  startMotion();
});

onBeforeUnmount(() => {
  stopMotion();
});
</script>
