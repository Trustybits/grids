<template>
  <Button variant="ghost" icon-only size="lg" href="https://discord.gg/DBscN5NUN6" hover-color="#5865F2">
    <template #icon-left>
      <DiscordIcon />
    </template>
  </Button>
</template>

<script setup lang="ts">
import Button from '@/components/ui-elements/Button.vue';
import DiscordIcon from '@/components/icons/DiscordIcon.vue';
</script>
