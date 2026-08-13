<template>
  <div class="md-section">
    <div v-if="isLoading" class="md-section__status">Loading…</div>
    <div v-else-if="error" class="md-section__status md-section__status--error">
      {{ error }}
    </div>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-else class="md-section__content" v-html="html"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { markdownToHtml } from "@/utils/MarkdownToHtml";

const props = defineProps<{
  srcPath: string;
}>();

const isLoading = ref(true);
const error = ref<string | null>(null);
const html = ref("");

onMounted(async () => {
  try {
    const res = await fetch(props.srcPath, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Could not load ${props.srcPath} (${res.status})`);
    }

    const md = await res.text();
    html.value = markdownToHtml(md);
  } catch (e: unknown) {
    console.error("Failed to load markdown content:", e);
    error.value = e instanceof Error ? e.message : "Could not load content.";
  } finally {
    isLoading.value = false;
  }
});
</script>

<style scoped>
/* Styled to match the marketing/landing design (dark, brand typography).
   Only used by the Privacy and Terms pages, which render inside MarketingLayout. */
.md-section {
  margin-top: 28px;
}

.md-section__status {
  color: var(--mkt-fg-3);
  font: 400 15px/1.4 var(--mkt-font-sans);
}

.md-section__status--error {
  color: #ff8a94;
}

.md-section__content {
  color: var(--mkt-fg-2);
  font: 400 16px/1.75 var(--mkt-font-sans);
}

/* Table-of-contents anchors jump to a heading id; offset the landing so the
   heading clears the sticky nav instead of hiding under it. */
.md-section__content :deep(h1),
.md-section__content :deep(h2),
.md-section__content :deep(h3),
.md-section__content :deep(h4),
.md-section__content :deep(h5),
.md-section__content :deep(h6) {
  scroll-margin-top: 96px;
}

.md-section__content :deep(h1),
.md-section__content :deep(h2) {
  font: 700 clamp(1.35rem, 3vw, 1.9rem) / 1.2 var(--mkt-font-sans);
  letter-spacing: -0.02em;
  color: var(--mkt-fg-1);
  margin: 44px 0 14px;
}

.md-section__content :deep(h3) {
  font: 700 1.2rem/1.25 var(--mkt-font-sans);
  color: var(--mkt-fg-1);
  margin: 32px 0 10px;
}

.md-section__content :deep(h4),
.md-section__content :deep(h5),
.md-section__content :deep(h6) {
  font: 600 1rem/1.3 var(--mkt-font-sans);
  color: var(--mkt-fg-1);
  margin: 24px 0 8px;
}

.md-section__content :deep(p) {
  margin: 14px 0;
  line-height: 1.75;
}

.md-section__content :deep(strong) {
  color: var(--mkt-fg-1);
  font-weight: 600;
}

.md-section__content :deep(ul),
.md-section__content :deep(ol) {
  margin: 14px 0;
  padding-left: 22px;
}

.md-section__content :deep(li) {
  margin: 8px 0;
}

.md-section__content :deep(li::marker) {
  color: var(--mkt-fg-4);
}

.md-section__content :deep(hr) {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin: 36px 0;
}

.md-section__content :deep(blockquote) {
  margin: 18px 0;
  padding: 4px 0 4px 16px;
  border-left: 3px solid var(--mkt-brand-500);
  color: var(--mkt-fg-3);
}

.md-section__content :deep(code) {
  font-family: var(--mkt-font-mono, ui-monospace, Menlo, Consolas, monospace);
  font-size: 0.9em;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: var(--mkt-fg-1);
}

.md-section__content :deep(a) {
  color: var(--mkt-brand-300);
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.15s ease;
}
.md-section__content :deep(a:hover) {
  color: var(--mkt-brand-200);
}
</style>
