<template>
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
        @error="emit('image-failed', entry.slug)"
      />
    </div>
    <div class="mkt__og-meta">
      <span class="mkt__og-site">{{ entry.name }}</span>
      <span class="mkt__og-title mkt__showcase-url">
        <span class="mkt__showcase-url-host">grids.so/</span><span class="mkt__showcase-url-slug">{{ entry.slug }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ShowcaseEntry } from '@/data/showcaseGrids';
import { slugOgImageUrl } from '@/utils/OgImageUtils';

const props = defineProps<{
  entry: ShowcaseEntry;
  failedSlugs: Set<string>;
}>();

const emit = defineEmits<{
  'image-failed': [slug: string];
}>();
</script>
