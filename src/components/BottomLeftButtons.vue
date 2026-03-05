<template>
  <!-- 
    Global bottom-left button bar. Always visible, pinned to viewport corner.
    Visibility rules:
      - Share + Discord: always shown for everyone
      - UserMenu: shown for any authenticated user
      - GridMenu: shown only when viewing a grid the current user owns
  -->
  <div class="bottom-left-buttons">
    <DiscordButton />
    <ShareButton />
    <GridMenu v-if="isOwner" />
    <UserMenu v-if="isAuthenticated" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebase';
import { useLayoutStore } from '@/stores/layout';
import DiscordButton from './DiscordButton.vue';
import GridMenu from './GridMenu.vue';
import ShareButton from './ShareButton.vue';
import UserMenu from './UserMenu.vue';

const layoutStore = useLayoutStore();
const isAuthenticated = ref(false);

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    isAuthenticated.value = !!user;
  });
});

// GridMenu shows when the logged-in user owns the currently loaded grid
const isOwner = computed(() => layoutStore.isOwner);
</script>

<style lang="scss" scoped>
.bottom-left-buttons {
  position: fixed;
  bottom: var(--spacing-md);
  left: var(--spacing-md);
  z-index: var(--z-fixed);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
</style>
