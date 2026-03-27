<template>
  <div class="discord-button">
    <a
      href="https://discord.gg/DBscN5NUN6"
      target="_blank"
      rel="noopener noreferrer"
      class="discord-button__btn"
    >
      <div class="discord-icon">
        <DiscordIcon />
      </div>
    </a>
  </div>
</template>

<script setup lang="ts">
import DiscordIcon from './icons/DiscordIcon.vue';
</script>

<style lang="scss" scoped>
.discord-button {
  position: relative;
}

.discord-button__btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: none;
  cursor: pointer;
  color: var(--color-text-primary);
  transition: all var(--duration-fast) var(--easing-smooth);
  padding: 0;
  border: none;
  line-height: 0;
  text-decoration: none;

  &:hover {
    background: var(--color-base-34);

    .discord-icon {
      color: #5865F2; /* Discord brand color */
    }
  }
}

.discord-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: var(--color-content-default);
  transition: color var(--duration-fast) var(--easing-smooth);

  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
}
</style>
