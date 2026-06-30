<template>
  <section id="showcase" class="mkt__landing-showcase" aria-labelledby="showcase-heading">
    <div class="mkt__landing-showcase-head">
      <div class="mkt__kicker">Built on grids</div>
      <h2 id="showcase-heading">Real pages from <span>real creators.</span></h2>
      <p>Tap any card to visit their grid — then claim your own handle above.</p>
    </div>

    <div
      class="mkt__showcase-marquee"
      :class="{ 'is-paused': paused }"
      @mouseenter="paused = true"
      @mouseleave="paused = false"
      @focusin="paused = true"
      @focusout="onFocusOut"
    >
      <div
        v-for="(row, rowIndex) in marqueeRows"
        :key="rowIndex"
        class="mkt__showcase-marquee-row"
        :class="rowIndex === 0 ? 'mkt__showcase-marquee-row--fwd' : 'mkt__showcase-marquee-row--rev'"
      >
        <div class="mkt__showcase-marquee-track">
          <div
            v-for="(groupIndex) in 2"
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
import { computed, reactive, ref } from 'vue';
import { SHOWCASE_GRIDS, type ShowcaseEntry } from '@/data/showcaseGrids';
import ShowcaseGridCard from '@/components/marketing/ShowcaseGridCard.vue';

const showcaseGrids = SHOWCASE_GRIDS;
const failedSlugs = reactive(new Set<string>());
const paused = ref(false);

const marqueeRows = computed(() => {
  const midpoint = Math.ceil(showcaseGrids.length / 2);
  return [
    showcaseGrids.slice(0, midpoint),
    showcaseGrids.slice(midpoint),
  ] as [ShowcaseEntry[], ShowcaseEntry[]];
});

function markImageFailed(slug: string) {
  failedSlugs.add(slug);
}

function onFocusOut(event: FocusEvent) {
  const root = event.currentTarget as HTMLElement | null;
  if (root?.contains(event.relatedTarget as Node | null)) return;
  paused.value = false;
}
</script>
