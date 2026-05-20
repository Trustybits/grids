<template>
  <div class="markdown-page">
    <MarkdownSection src-path="/content/privacy.md" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import MarkdownSection from '@/components/MarkdownSection.vue';
import { usePageTitle } from '@/composables/usePageTitle';

const pageTitle = ref('Privacy');
usePageTitle(pageTitle);
</script>

<style scoped>
.markdown-page {
  min-height: 100vh;
  background: var(--color-content-background);
  padding: 24px 16px;
}
</style>
