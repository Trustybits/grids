<template>
  <header class="mkt__nav">
    <button class="mkt__brand" @click="$emit('navigate', 'home')">
      <span class="mkt__brand-mark" aria-hidden="true">
        <img src="/grids_logo.png" alt="" />
      </span>
      <span class="mkt__brand-word">grids</span>
    </button>
    <nav class="mkt__menu">
      <button
        v-for="item in navItems"
        :key="item.id"
        :class="['mkt__menu-item', { 'is-active': currentPage === item.id }]"
        @click="$emit('navigate', item.id)"
      >
        {{ item.label }}
      </button>
    </nav>
    <div class="mkt__actions">
      <a
        href="https://discord.gg/DBscN5NUN6"
        target="_blank"
        rel="noopener noreferrer"
        class="mkt__text-btn mkt__discord-link"
        aria-label="Join our Discord"
        title="Join our Discord"
      >
        <DiscordIcon />
      </a>
      <template v-if="isAuthenticated">
        <Button variant="outline" to="/dashboard" size="sm">
          <span>Go to Dashboard</span>
          <span aria-hidden="true">→</span>
        </Button>
      </template>
      <template v-else>
        <router-link to="/login" class="mkt__text-btn">Sign in</router-link>
        <Button variant="brand" to="/login" size="sm">Start your grid</Button>
      </template>
    </div>

    <button
      class="mkt__hamburger"
      :class="{ 'is-open': menuOpen }"
      aria-label="Toggle menu"
      @click="menuOpen = !menuOpen"
    >
      <span class="mkt__hamburger-line"></span>
      <span class="mkt__hamburger-line"></span>
      <span class="mkt__hamburger-line"></span>
    </button>
  </header>

  <MobileMenu
    :open="menuOpen"
    :nav-items="navItems"
    :current-page="currentPage"
    :is-authenticated="isAuthenticated"
    @navigate="(page: string) => { $emit('navigate', page); menuOpen = false }"
    @close="menuOpen = false"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import DiscordIcon from '@/components/icons/DiscordIcon.vue';
import MobileMenu from '@/components/ui-collections/MobileMenu.vue';
import Button from '@/components/ui-elements/Button.vue';

defineProps<{
  navItems: ReadonlyArray<{ id: string; label: string }>;
  currentPage: string;
  isAuthenticated: boolean;
}>();

defineEmits<{
  navigate: [page: string];
}>();

const menuOpen = ref(false);
</script>

<style scoped>
.mkt__nav {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  padding: 18px var(--mkt-section-x);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  width: 100%;
  max-width: var(--mkt-chrome-max);
  margin: 0 auto;
}
.mkt__brand {
  border: 0;
  background: transparent;
  color: var(--mkt-fg-1);
  font: 800 20px/1 var(--mkt-font-sans);
  letter-spacing: -0.04em;
  cursor: pointer;
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.mkt__brand-word {
  font-family: var(--mkt-font-brand);
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: lowercase;
}
.mkt__brand-mark {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.mkt__brand-mark img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
  display: block;
}
.mkt__menu {
  display: flex;
  gap: 2px;
  justify-self: center;
}
.mkt__menu-item {
  border: 0;
  background: transparent;
  color: var(--mkt-fg-3);
  font: 500 14px/1 var(--mkt-font-sans);
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 10px;
}
.mkt__menu-item.is-active {
  color: var(--mkt-fg-1);
}
.mkt__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-self: end;
}
.mkt__text-btn {
  color: var(--mkt-fg-2);
  text-decoration: none;
  font: 500 14px/1 var(--mkt-font-sans);
}
.mkt__discord-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  padding: 0;
}
.mkt__discord-link :deep(svg) {
  width: 16px;
  height: 16px;
}

/* Hamburger — hidden on desktop */
.mkt__hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 36px;
  height: 36px;
  padding: 8px;
  background: none;
  border: none;
  cursor: pointer;
  justify-self: end;
}
.mkt__hamburger-line {
  display: block;
  width: 100%;
  height: 2px;
  background: var(--mkt-fg-1);
  border-radius: 1px;
  transition: transform 0.25s ease, opacity 0.2s ease;
}
.mkt__hamburger.is-open .mkt__hamburger-line:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}
.mkt__hamburger.is-open .mkt__hamburger-line:nth-child(2) {
  opacity: 0;
}
.mkt__hamburger.is-open .mkt__hamburger-line:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

@media (max-width: 800px) {
  .mkt__nav {
    grid-template-columns: 1fr auto;
    padding: 14px;
  }
  .mkt__menu,
  .mkt__actions {
    display: none;
  }
  .mkt__hamburger {
    display: flex;
  }
}
</style>
