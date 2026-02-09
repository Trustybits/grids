<template>
  <div class="bottom-left-buttons">
    <DiscordButton />
    <ShareButton v-if="showShareButton" />
    <GridMenu
      v-if="showGridMenu"
      @select-image="$emit('select-image')"
      @embed-background="$emit('embed-background')"
      @confirm-delete="$emit('confirm-delete')"
    />
    <UserMenu v-if="showUserMenu" />
  </div>
</template>

<script setup lang="ts">
import DiscordButton from './DiscordButton.vue';
import GridMenu from './GridMenu.vue';
import ShareButton from './ShareButton.vue';
import UserMenu from './UserMenu.vue';

defineProps<{
  showGridMenu?: boolean;
  showShareButton?: boolean;
  showUserMenu?: boolean;
}>();

defineEmits<{
  'select-image': [];
  'embed-background': [];
  'confirm-delete': [];
}>();
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
