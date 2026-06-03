<template>
  <MarketingLayout>
    <section class="mkt__section mkt__placeholder">
      <div class="mkt__kicker">blog</div>
      <h1>Coming soon.</h1>
      <p>We haven't built this page yet.</p>
    </section>
  </MarketingLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { usePageTitle } from '@/composables/usePageTitle';
import MarketingLayout from '@/components/marketing/MarketingLayout.vue';

const pageTitle = ref('Blog');
usePageTitle(pageTitle);
</script>
