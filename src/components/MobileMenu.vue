<template>
  <transition name="mkt-mobile-menu">
    <div v-if="open" class="mkt__mobile-menu" @click.self="$emit('close')">
      <nav class="mkt__mobile-nav">
        <button
          v-for="item in navItems"
          :key="item.id"
          :class="['mkt__mobile-nav-item', { 'is-active': currentPage === item.id }]"
          @click="$emit('navigate', item.id)"
        >
          {{ item.label }}
        </button>
      </nav>
      <div class="mkt__mobile-divider"></div>
      <div class="mkt__mobile-actions">
        <template v-if="isAuthenticated">
          <router-link to="/dashboard" class="mkt__cta-btn mkt__mobile-cta" @click="$emit('close')">
            Go to Dashboard →
          </router-link>
        </template>
        <template v-else>
          <router-link to="/login" class="mkt__cta-btn mkt__mobile-cta" @click="$emit('close')">
            Start your grid
          </router-link>
          <router-link to="/login" class="mkt__mobile-link" @click="$emit('close')">
            Sign in
          </router-link>
        </template>
        <a
          href="https://discord.gg/DBscN5NUN6"
          target="_blank"
          rel="noopener noreferrer"
          class="mkt__mobile-link"
        >
          <DiscordIcon /> Discord
        </a>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import DiscordIcon from '@/components/icons/DiscordIcon.vue';

defineProps<{
  open: boolean;
  navItems: ReadonlyArray<{ id: string; label: string }>;
  currentPage: string;
  isAuthenticated: boolean;
}>();

defineEmits<{
  navigate: [page: string];
  close: [];
}>();
</script>

<style scoped>
.mkt__mobile-menu {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 19;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(24px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 80px var(--mkt-section-x) 40px;
}
.mkt__mobile-nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.mkt__mobile-nav-item {
  border: none;
  background: none;
  color: var(--mkt-fg-3);
  font: 500 22px/1 var(--mkt-font-sans);
  padding: 12px 24px;
  border-radius: 12px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.mkt__mobile-nav-item:hover,
.mkt__mobile-nav-item.is-active {
  color: var(--mkt-fg-1);
  background: rgba(255, 255, 255, 0.06);
}
.mkt__mobile-divider {
  width: 60px;
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
}
.mkt__mobile-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.mkt__cta-btn {
  font: 600 13px/1 var(--mkt-font-sans);
  letter-spacing: -0.01em;
  padding: 9px 14px;
  border: 0;
  border-radius: var(--mkt-radius-md);
  background: var(--mkt-brand-gradient);
  color: #000;
  text-decoration: none;
}
.mkt__mobile-cta {
  font-size: 15px;
  padding: 12px 28px;
}
.mkt__mobile-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--mkt-fg-3);
  font: 500 15px/1 var(--mkt-font-sans);
  text-decoration: none;
  transition: color 0.15s;
}
.mkt__mobile-link:hover {
  color: var(--mkt-fg-1);
}
.mkt__mobile-link :deep(svg) {
  width: 16px;
  height: 16px;
}

.mkt-mobile-menu-enter-active,
.mkt-mobile-menu-leave-active {
  transition: opacity 0.25s ease;
}
.mkt-mobile-menu-enter-from,
.mkt-mobile-menu-leave-to {
  opacity: 0;
}
</style>
