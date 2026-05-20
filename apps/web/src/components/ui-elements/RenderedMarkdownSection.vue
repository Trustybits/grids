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
.md-section {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
  border-radius: var(--radius-lg);
  background: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
}

.md-section__status {
  color: var(--color-content-default);
  font-size: 14px;
}

.md-section__status--error {
  color: var(--destructive-color, #ff4d4d);
}

.md-section__content :deep(h1),
.md-section__content :deep(h2),
.md-section__content :deep(h3),
.md-section__content :deep(h4),
.md-section__content :deep(h5),
.md-section__content :deep(h6) {
  margin: 18px 0 10px;
  color: var(--color-text-primary);
}

.md-section__content :deep(p) {
  margin: 10px 0;
  color: var(--color-text-primary);
  line-height: 1.55;
}

.md-section__content :deep(ul),
.md-section__content :deep(ol) {
  margin: 10px 0;
  padding-left: 22px;
  color: var(--color-text-primary);
}

.md-section__content :deep(li) {
  margin: 6px 0;
}

.md-section__content :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-tile-stroke);
  margin: 18px 0;
}

.md-section__content :deep(blockquote) {
  margin: 12px 0;
  padding: 10px 12px;
  border-left: 3px solid var(--color-content-high);
  background: color-mix(
    in srgb,
    var(--color-content-background) 85%,
    transparent
  );
  border-radius: var(--radius-md);
}

.md-section__content :deep(code) {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.95em;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid var(--color-tile-stroke);
  background: var(--color-content-background);
}

.md-section__content :deep(a) {
  color: var(--color-content-high);
  text-decoration: underline;
}
</style>
