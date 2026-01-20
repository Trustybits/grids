<template>
  <div class="legal-page">
    <div class="legal-container">
      <div v-if="isLoading" class="legal-status">Loading…</div>
      <div v-else-if="error" class="legal-status legal-status--error">{{ error }}</div>
      <div v-else class="legal-content" v-html="html"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { markdownToHtml } from '@/utils/markdownToHtml';

const props = defineProps<{
  srcPath: string;
}>();

const isLoading = ref(true);
const error = ref<string | null>(null);
const html = ref('');

onMounted(async () => {
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    const res = await fetch(props.srcPath, {
      // Avoid surprising caching issues when iterating on content in dev.
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Could not load ${props.srcPath} (${res.status})`);
    }

    const md = await res.text();
    html.value = markdownToHtml(md);
  } catch (e: any) {
    console.error('Failed to load legal content:', e);
    error.value = e?.message ?? 'Could not load content.';
  } finally {
    isLoading.value = false;
  }
});
</script>

<style scoped>
.legal-page {
  min-height: 100vh;
  background: var(--color-content-background);
  padding: 24px 16px;
}

.legal-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
  border-radius: var(--radius-lg);
  background: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
}

.legal-status {
  color: var(--color-content-default);
  font-size: 14px;
}

.legal-status--error {
  color: var(--destructive-color, #ff4d4d);
}

.legal-content :deep(h1),
.legal-content :deep(h2),
.legal-content :deep(h3),
.legal-content :deep(h4),
.legal-content :deep(h5),
.legal-content :deep(h6) {
  margin: 18px 0 10px;
  color: var(--color-text-primary);
}

.legal-content :deep(p) {
  margin: 10px 0;
  color: var(--color-text-primary);
  line-height: 1.55;
}

.legal-content :deep(ul),
.legal-content :deep(ol) {
  margin: 10px 0;
  padding-left: 22px;
  color: var(--color-text-primary);
}

.legal-content :deep(li) {
  margin: 6px 0;
}

.legal-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-tile-stroke);
  margin: 18px 0;
}

.legal-content :deep(blockquote) {
  margin: 12px 0;
  padding: 10px 12px;
  border-left: 3px solid var(--color-content-high);
  background: color-mix(in srgb, var(--color-content-background) 85%, transparent);
  border-radius: var(--radius-md);
}

.legal-content :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.95em;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid var(--color-tile-stroke);
  background: var(--color-content-background);
}

.legal-content :deep(a) {
  color: var(--color-content-high);
  text-decoration: underline;
}
</style>
