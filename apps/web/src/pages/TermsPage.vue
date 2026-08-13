<template>
  <MarketingLayout>
    <section class="mkt__section mkt__page mkt__legal">
      <div class="mkt__kicker">Legal</div>
      <h1>Terms of Use</h1>
      <MarkdownSection src-path="/content/terms.md" />
    </section>
  </MarketingLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import MarketingLayout from '@/components/marketing/MarketingLayout.vue';
import MarkdownSection from '@/components/ui-elements/RenderedMarkdownSection.vue';
import { usePageTitle } from '@/composables/usePageTitle';

const pageTitle = ref('Terms');
usePageTitle(pageTitle);
</script>
