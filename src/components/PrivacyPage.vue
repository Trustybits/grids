<template>
  <LegalMarkdownPage src-path="/content/privacy.md" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import LegalMarkdownPage from '@/components/LegalMarkdownPage.vue';
import { usePageTitle } from '@/composables/usePageTitle';

// Set page title
const pageTitle = ref('Privacy');
usePageTitle(pageTitle);
</script>
