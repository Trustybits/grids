<template>
  <div class="mkt">
    <MarketingNavBar :is-authenticated="isAuthenticated" />

    <main class="mkt__body">
      <slot />
    </main>

    <MarketingFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { getAuthProvider } from '@/auth/AuthProviderSingleton';
import type { AuthUser } from '@grids/contracts/auth';
import MarketingNavBar from '@/components/marketing/MarketingNavBar.vue';
import MarketingFooter from '@/components/marketing/MarketingFooter.vue';
import '@/styles/marketing-page.scss';

const user = ref<AuthUser | null>(null);
const isAuthenticated = computed(() => !!user.value);
let unsubscribeAuthState: (() => void) | null = null;

onMounted(() => {
  unsubscribeAuthState = getAuthProvider().onAuthStateChanged((currentUser) => {
    user.value = currentUser;
  });
});

onBeforeUnmount(() => {
  if (unsubscribeAuthState) unsubscribeAuthState();
});
</script>
