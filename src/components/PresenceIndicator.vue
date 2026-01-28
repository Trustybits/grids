<template>
  <div v-if="activeUsers.size > 1" class="presence-indicator">
    <div class="presence-header">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/>
        <path d="M6 21C6 17.134 8.686 14 12 14C15.314 14 18 17.134 18 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span class="viewer-count">{{ activeUsers.size - 1 }}</span>
    </div>
    
    <div class="presence-list">
      <div
        v-for="user in otherUsers"
        :key="user.userId"
        class="presence-user"
        :style="{ '--user-color': user.userColor }"
      >
        <div class="user-avatar">
          {{ getUserInitials(user.userName) }}
        </div>
        <span class="user-name">{{ user.userName }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type UserPresence } from '@/types/Presence';

export interface PresenceIndicatorProps {
  activeUsers: Map<string, UserPresence>;
  otherUsers: UserPresence[];
}

defineProps<PresenceIndicatorProps>();

const getUserInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};
</script>

<style scoped lang="scss">
.presence-indicator {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 100;
  background: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  padding: 8px;
  min-width: 48px;
  box-shadow: var(--shadow-tile-hover);
  backdrop-filter: blur(20px);
  
  &:hover .presence-list {
    display: flex;
  }
}

.presence-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 4px 8px;
  cursor: pointer;
  color: var(--color-text-primary);
  
  svg {
    opacity: 0.7;
  }
}

.viewer-count {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.presence-list {
  display: none;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--color-tile-stroke);
  min-width: 180px;
}

.presence-user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: background-color var(--duration-fast) var(--easing-ease-in-out);
  
  &:hover {
    background: var(--color-content-low);
  }
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--user-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.user-name {
  font-size: 13px;
  color: var(--color-text-primary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
