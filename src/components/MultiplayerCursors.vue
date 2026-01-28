<template>
  <div class="multiplayer-cursors">
    <div
      v-for="user in otherUsers"
      :key="user.userId"
      class="user-cursor"
      :style="{
        left: `${user.cursor.x}px`,
        top: `${user.cursor.y}px`,
        '--user-color': user.userColor,
      }"
    >
      <!-- Cursor SVG -->
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M5.65376 12.3673L13.1526 18.2426C13.4655 18.4906 13.9287 18.3072 13.9971 17.9031L15.2452 10.5824C15.3148 10.1726 14.9867 9.82475 14.5755 9.87684L7.19426 10.894C6.78306 10.9461 6.58467 11.4348 6.84606 11.7368L9.87808 15.0674"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="currentColor"
        />
      </svg>

      <!-- User name label -->
      <div class="user-label">
        {{ user.userName }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type UserPresence } from '@/types/Presence';

export interface MultiplayerCursorsProps {
  otherUsers: UserPresence[];
}

defineProps<MultiplayerCursorsProps>();
</script>

<style scoped lang="scss">
.multiplayer-cursors {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
}

.user-cursor {
  position: absolute;
  pointer-events: none;
  transition: left 0.05s linear, top 0.05s linear;
  color: var(--user-color);
  z-index: 9999;

  svg {
    display: block;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  }
}

.user-label {
  position: absolute;
  top: 20px;
  left: 12px;
  background: var(--user-color);
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
