<template>
  <MarketingLayout>
    <section class="mkt__section mkt__page mkt__showcase-page">
      <div class="mkt__kicker">Showcase</div>
      <h1>See what people are <span>building.</span></h1>
      <p>Real grids from real creators — one link, fully theirs.</p>

      <div class="mkt__cards mkt__cards--showcase">
        <router-link
          v-for="entry in showcaseGrids"
          :key="entry.slug"
          :to="`/${entry.slug}`"
          class="mkt__card mkt__card--showcase"
        >
          <div class="mkt__og-card">
            <div class="mkt__og-image">
              <div
                v-if="failedSlugs.has(entry.slug)"
                class="mkt__mini-grid"
                aria-hidden="true"
              />
              <img
                v-else
                :src="slugOgImageUrl(entry.slug)"
                :alt="`${entry.name}'s grid preview`"
                loading="lazy"
                @error="markImageFailed(entry.slug)"
              />
            </div>
            <div class="mkt__og-meta">
              <span class="mkt__og-site">{{ entry.name }}</span>
              <span class="mkt__og-title">grids.so/{{ entry.slug }}</span>
              <small v-if="entry.tagline" class="mkt__showcase-tagline">
                {{ entry.tagline }}
              </small>
            </div>
          </div>
        </router-link>
      </div>
    </section>

    <section class="mkt__section mkt__cta">
      <h2>Ready to <span>show off?</span></h2>
      <p>Free to start. Your first grid takes about four minutes.</p>
      <Button variant="brand" to="/login" size="lg">Make your grid →</Button>
    </section>
  </MarketingLayout>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { usePageTitle } from '@/composables/usePageTitle';
import { SHOWCASE_GRIDS } from '@/data/showcaseGrids';
import MarketingLayout from '@/components/marketing/MarketingLayout.vue';
import Button from '@/components/ui-elements/Button.vue';
import { slugOgImageUrl } from '@/utils/OgImageUtils';

const pageTitle = ref('Showcase');
usePageTitle(pageTitle);

const showcaseGrids = SHOWCASE_GRIDS;
const failedSlugs = reactive(new Set<string>());

function markImageFailed(slug: string) {
  failedSlugs.add(slug);
}
</script>
