<template>
  <div class="campfire-container">
    <div class="campfire-content" :class="layoutClass">
      <div v-if="showCount" class="flame-count">{{ ownerGameData?.totalClicks || 0 }}</div>
      
      <button 
        class="campfire-button" 
        :class="fireIntensityClass"
        @click="handleClick"
        :title="'Keep the fire burning!'"
      >
        <FireLargeIcon v-if="fireIntensity === 'blazing'" :size="fireIconSize" />
        <FireMediumIcon v-else-if="fireIntensity === 'burning'" :size="fireIconSize" />
        <FireSmallIcon v-else :size="fireIconSize" />
      </button>
      
      <div v-if="showFooter" class="footer">
        <div class="player-info">
          <div class="player-name">{{ ownerGameData?.displayName || 'Loading...' }}</div>
        </div>
        
        <button class="leaderboard-icon-button" @click="toggleLeaderboard" :title="showLeaderboard ? 'Close leaderboard' : 'Show leaderboard'">
          <LeaderboardIcon :size="24" />
        </button>
      </div>
    </div>

    <!-- Leaderboard Drawer -->
    <transition name="drawer">
      <div v-if="showLeaderboard" class="leaderboard-drawer">
        <div class="leaderboard-header">
          <span>🔥 Top Fire Keepers</span>
          <button class="drawer-close" @click="toggleLeaderboard">
            <LeaderboardIcon :size="24" />
          </button>
        </div>
        <div class="leaderboard-list">
          <div 
            v-for="entry in leaderboard" 
            :key="entry.userId"
            class="leaderboard-entry"
            :class="{ 'is-current-owner': entry.userId === ownerId }"
          >
            <span class="rank">#{{ entry.rank }}</span>
            <span class="name">{{ entry.displayName }}</span>
            <span class="score">{{ entry.totalClicks.toLocaleString() }} 🔥</span>
          </div>
          <div v-if="leaderboard.length === 0" class="leaderboard-empty">
            No fires yet. Start the flame!
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, computed, inject, type ComputedRef } from "vue";
import { type CampfireContent } from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";
import FireSmallIcon from "@/components/icons/FireSmallIcon.vue";
import FireMediumIcon from "@/components/icons/FireMediumIcon.vue";
import FireLargeIcon from "@/components/icons/FireLargeIcon.vue";
import LeaderboardIcon from "@/components/icons/LeaderboardIcon.vue";
import type { UserGameData, LeaderboardEntry } from "@/types/GameData";
import {
  getOrCreateUserGameData,
  incrementUserClicks,
  subscribeToUserGameData,
  subscribeToLeaderboard,
} from "@/services/GameDataService";

export default defineComponent({
  components: {
    FireSmallIcon,
    FireMediumIcon,
    FireLargeIcon,
    LeaderboardIcon,
  },
  props: {
    content: {
      type: Object as () => CampfireContent,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const fireIntensity = ref<'dying' | 'burning' | 'blazing'>('dying');
    const lastClickTime = ref(0);
    const clickStreak = ref(0);
    const showLeaderboard = ref(false);
    const ownerGameData = ref<UserGameData | null>(null);
    const leaderboard = ref<LeaderboardEntry[]>([]);
    
    // Inject tile dimensions from GridTile (these are ComputedRefs)
    const tileWidth = inject<ComputedRef<number>>('gridTileW', computed(() => 2));
    const tileHeight = inject<ComputedRef<number>>('gridTileH', computed(() => 2));
    
    // Determine layout based on tile dimensions
    const layoutClass = computed(() => {
      const w = tileWidth.value;
      const h = tileHeight.value;
      if (w === 1 && h === 1) return 'layout-1x1';
      if (w === 1 && h === 2) return 'layout-1x2';
      if (w === 2 && h === 1) return 'layout-2x1';
      return 'layout-default';
    });
    
    // Show count only for non-1x1 tiles
    const showCount = computed(() => {
      const w = tileWidth.value;
      const h = tileHeight.value;
      return !(w === 1 && h === 1);
    });
    
    // Show footer only for default layout (2x2 or larger)
    const showFooter = computed(() => {
      const w = tileWidth.value;
      const h = tileHeight.value;
      return !(w === 1 || h === 1);
    });
    
    // Dynamic fire icon size based on layout
    const fireIconSize = computed(() => {
      const w = tileWidth.value;
      const h = tileHeight.value;
      if (w === 1 && h === 1) return 40;
      if (w === 1 || h === 1) return 48;
      if (fireIntensity.value === 'blazing') return 64;
      if (fireIntensity.value === 'burning') return 48;
      return 32;
    });
    
    let cooldownTimer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribeOwnerData: (() => void) | null = null;
    let unsubscribeLeaderboard: (() => void) | null = null;

    const ownerId = computed(() => layoutStore.currentLayout?.userId || '');

    const fireIntensityClass = computed(() => {
      return `fire-${fireIntensity.value}`;
    });

    const handleClick = async () => {
      if (!ownerId.value) return;
      
      // Increment the grid owner's score (not the clicker's score)
      await incrementUserClicks(ownerId.value, 1);
      
      // Check click speed to determine fire intensity
      const now = Date.now();
      const timeSinceLastClick = now - lastClickTime.value;
      
      if (timeSinceLastClick < 300) {
        // Very fast clicking - blazing fire
        clickStreak.value++;
        if (clickStreak.value >= 5) {
          fireIntensity.value = 'blazing';
        } else if (clickStreak.value >= 2) {
          fireIntensity.value = 'burning';
        }
      } else if (timeSinceLastClick < 800) {
        // Medium pace - burning fire
        clickStreak.value = Math.max(2, clickStreak.value);
        fireIntensity.value = 'burning';
      } else {
        // Slow clicking - reset to small fire
        clickStreak.value = 0;
        fireIntensity.value = 'dying';
      }
      
      lastClickTime.value = now;
      
      // Clear existing cooldown timer
      if (cooldownTimer) {
        clearTimeout(cooldownTimer);
      }
      
      // Set cooldown to reduce fire intensity after 1 second of no clicks
      cooldownTimer = setTimeout(() => {
        if (fireIntensity.value === 'blazing') {
          fireIntensity.value = 'burning';
          // Set another timer to continue reducing
          cooldownTimer = setTimeout(() => {
            fireIntensity.value = 'dying';
            clickStreak.value = 0;
          }, 1000);
        } else if (fireIntensity.value === 'burning') {
          fireIntensity.value = 'dying';
          clickStreak.value = 0;
        }
      }, 1000);
    };

    const toggleLeaderboard = () => {
      showLeaderboard.value = !showLeaderboard.value;
    };

    onMounted(async () => {
      if (!ownerId.value) {
        console.error('No owner ID found for campfire tile');
        return;
      }

      // Initialize owner's game data if it doesn't exist
      await getOrCreateUserGameData(ownerId.value);

      // Subscribe to real-time updates for owner's game data
      unsubscribeOwnerData = subscribeToUserGameData(ownerId.value, (data) => {
        ownerGameData.value = data;
      });

      // Subscribe to leaderboard updates
      unsubscribeLeaderboard = subscribeToLeaderboard(20, (data) => {
        leaderboard.value = data;
      });
    });

    onUnmounted(() => {
      if (cooldownTimer) {
        clearTimeout(cooldownTimer);
      }
      if (unsubscribeOwnerData) {
        unsubscribeOwnerData();
      }
      if (unsubscribeLeaderboard) {
        unsubscribeLeaderboard();
      }
    });

    return {
      handleClick,
      toggleLeaderboard,
      fireIntensity,
      fireIntensityClass,
      showLeaderboard,
      ownerGameData,
      leaderboard,
      ownerId,
      layoutClass,
      showCount,
      showFooter,
      fireIconSize,
    };
  },
});
</script>

<style scoped lang="scss">
.campfire-container {
  position: relative;
  width: 100%;
  height: 100%;
  padding: var(--spacing-md);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.campfire-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding-left: var(--spacing-xs);
  padding-right: var(--spacing-xs);
  gap: var(--spacing-xs);
  width: 100%;
  height: 100%;
  
  // 1x1 layout - only fire button, centered
  &.layout-1x1 {
    justify-content: center;
    padding: 0;
    
    .campfire-button {
      width: 56px;
      height: 56px;
    }
  }
  
  // 1x2 layout - vertical: count top, button bottom
  &.layout-1x2 {
    flex-direction: column;
    justify-content: space-evenly;
    padding: var(--spacing-xs) 0;
    
    .flame-count {
      font-size: 32px;
    }
    
    .campfire-button {
      width: 64px;
      height: 64px;
    }
  }
  
  // 2x1 layout - horizontal: count left, button right
  &.layout-2x1 {
    flex-direction: row;
    justify-content: space-evenly;
    padding: 0 var(--spacing-xs);
    
    .flame-count {
      font-size: 32px;
    }
    
    .campfire-button {
      width: 64px;
      height: 64px;
    }
  }
}

.flame-count {
  font-size: 48px;
  font-weight: 700;
  color: #ff6b35;
  font-family: var(--font-family-base);
  line-height: 1;
  user-select: none;
  text-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
}

.campfire-button {
  width: 72px;
  height: 72px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: transform 0.1s ease, filter 0.3s ease;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8b8b8b;
  
  &:hover {
    filter: brightness(1.1);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &.fire-dying {
    color: #8b8b8b;
    animation: flickerDying 2s ease-in-out infinite;
  }
  
  &.fire-burning {
    color: #ff6b35;
    animation: flickerBurning 1.2s ease-in-out infinite;
    filter: drop-shadow(0 0 8px rgba(255, 107, 53, 0.6));
  }
  
  &.fire-blazing {
    color: #ff4500;
    animation: flickerBlazing 0.8s ease-in-out infinite;
    filter: drop-shadow(0 0 16px rgba(255, 107, 53, 0.95)) drop-shadow(0 0 24px rgba(247, 147, 30, 0.75));
  }
}

@keyframes flickerDying {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.8;
  }
}

@keyframes flickerBurning {
  0%, 100% {
    opacity: 0.9;
    transform: scale(1);
  }
  25% {
    opacity: 1;
    transform: scale(1.02);
  }
  75% {
    opacity: 0.95;
    transform: scale(0.98);
  }
}

@keyframes flickerBlazing {
  0%, 100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  25% {
    opacity: 0.95;
    transform: scale(1.05) translateY(-2px);
  }
  50% {
    opacity: 1;
    transform: scale(1.02) translateY(0);
  }
  75% {
    opacity: 0.98;
    transform: scale(1.03) translateY(-1px);
  }
}

.footer {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  width: 100%;
}

.player-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.player-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
  user-select: none;
}

.leaderboard-icon-button {
  padding: var(--spacing-xs);
  background: transparent;
  color: var(--color-content-low);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    color: var(--color-text-primary);
    border-color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.05);
  }
  
  &:active {
    transform: scale(0.95);
  }
}

// Drawer styles
.leaderboard-drawer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-tile-background);
  backdrop-filter: blur(10px);
  z-index: 10;
  display: flex;
  flex-direction: column;
  padding: var(--spacing-md);
}

.leaderboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--color-content-low);
}

.drawer-close {
  padding: var(--spacing-xs);
  background: transparent;
  color: var(--color-content-low);
  border: 1px solid var(--color-content-low);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    color: var(--color-text-primary);
    border-color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.05);
  }
}

.leaderboard-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: var(--color-content-low);
    border-radius: 3px;
  }
}

.leaderboard-entry {
  display: flex;
  grid-template-columns: 40px 1fr auto;
  gap: var(--spacing-sm);
  justify-content: space-between;
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 13px;
  transition: background 0.2s ease;
  background: rgba(0, 0, 0, 0.2);
  
  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
  
  &.is-current-owner {
    background: rgba(255, 107, 53, 0.15);
    font-weight: 600;
    border: 1px solid rgba(255, 107, 53, 0.3);
  }
}

.leaderboard-entry .rank {
  color: var(--color-content-default);
  font-weight: 700;
  text-align: left;
  font-size: 14px;
  width: fit-content;
}

.leaderboard-entry .name {
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leaderboard-entry .score {
  color: #ff6b35;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  width: fit-content;
  white-space: nowrap;
}

.leaderboard-empty {
  text-align: center;
  color: var(--color-content-low);
  font-size: 13px;
  padding: var(--spacing-xl);
}

// Drawer slide-up animation
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
}

.drawer-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.drawer-enter-to {
  transform: translateY(0);
  opacity: 1;
}

.drawer-leave-from {
  transform: translateY(0);
  opacity: 1;
}

.drawer-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
