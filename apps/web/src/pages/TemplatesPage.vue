<template>
  <MarketingLayout>
    <section class="mkt__section mkt__page">
      <div class="mkt__kicker">Templates</div>
      <h1>Start with a grid that already works.</h1>
      <p>Handmade by people whose pages you'd actually click on.</p>
      <div class="mkt__cards">
        <article v-for="template in templates" :key="template.name" class="mkt__card">
          <div class="mkt__mini-grid"></div>
          <h3>{{ template.name }}</h3>
          <small>by {{ template.by }}</small>
        </article>
      </div>
    </section>
  </MarketingLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { usePageTitle } from '@/composables/usePageTitle';
import MarketingLayout from '@/components/marketing/MarketingLayout.vue';

const pageTitle = ref('Templates');
usePageTitle(pageTitle);

const templates = [
  { name: 'Photographer', by: 'Mira Okafor' },
  { name: 'Writer', by: 'Sam Haines' },
  { name: 'Musician', by: 'June' },
  { name: 'Designer', by: 'Paulo S.' },
  { name: 'Developer', by: 'kei.dev' },
  { name: 'Link in bio', by: 'grids team' },
];
</script>
