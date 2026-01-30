<template>
  <div class="clicker-container">
    <div class="clicker-content">
      <div class="count-display">{{ ownerGameData?.totalClicks || 0 }}</div>
      
      <button 
        class="click-button" 
        :class="{ 'on-fire': isOnFire }"
        @click="handleClick"
      >
        <FireIcon v-if="isOnFire" :size="24" />
        <ClickerIcon v-else :size="24" />
      </button>
      
      <div class="footer">
        <div class="player-info">
          <div class="player-name">{{ ownerGameData?.displayName || 'Loading...' }}</div>
        </div>
        
        <button class="leaderboard-icon-button" @click="toggleLeaderboard" :title="showLeaderboard ? 'Close leaderboard' : 'Show leaderboard'">
          <LeaderboardIcon :size="18" />
        </button>
      </div>
    </div>

    <!-- Leaderboard Drawer -->
    <transition name="drawer">
      <div v-if="showLeaderboard" class="leaderboard-drawer">
        <div class="leaderboard-header">
          <span>Top Players</span>
          <button class="drawer-close" @click="toggleLeaderboard">
            <LeaderboardIcon :size="18" />
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
            <span class="score">{{ entry.totalClicks.toLocaleString() }}</span>
          </div>
          <div v-if="leaderboard.length === 0" class="leaderboard-empty">
            No scores yet. Start clicking!
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, computed } from "vue";
import { type ClickerContent } from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";
import ClickerIcon from "@/components/icons/ClickerIcon.vue";
import FireIcon from "@/components/icons/FireIcon.vue";
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
    ClickerIcon,
    FireIcon,
    LeaderboardIcon,
  },
  props: {
    content: {
      type: Object as () => ClickerContent,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const isOnFire = ref(false);
    const lastClickTime = ref(0);
    const clickStreak = ref(0);
    const showLeaderboard = ref(false);
    const ownerGameData = ref<UserGameData | null>(null);
    const leaderboard = ref<LeaderboardEntry[]>([]);
    
    let cooldownTimer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribeOwnerData: (() => void) | null = null;
    let unsubscribeLeaderboard: (() => void) | null = null;

    const ownerId = computed(() => layoutStore.currentLayout?.userId || '');

    const handleClick = async () => {
      if (!ownerId.value) return;
      
      // Increment the grid owner's score (not the clicker's score)
      await incrementUserClicks(ownerId.value, 1);
      
      // Check click speed (clicks within 500ms = fast clicking)
      const now = Date.now();
      const timeSinceLastClick = now - lastClickTime.value;
      
      if (timeSinceLastClick < 500) {
        clickStreak.value++;
        
        // Activate fire mode after 3 fast clicks
        if (clickStreak.value >= 3) {
          isOnFire.value = true;
        }
      } else {
        clickStreak.value = 0;
        isOnFire.value = false;
      }
      
      lastClickTime.value = now;
      
      // Clear existing cooldown timer
      if (cooldownTimer) {
        clearTimeout(cooldownTimer);
      }
      
      // Set cooldown to turn off fire mode after 800ms of no clicks
      cooldownTimer = setTimeout(() => {
        isOnFire.value = false;
        clickStreak.value = 0;
      }, 800);
    };

    const toggleLeaderboard = () => {
      showLeaderboard.value = !showLeaderboard.value;
    };

    onMounted(async () => {
      if (!ownerId.value) {
        console.error('No owner ID found for clicker tile');
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
      isOnFire,
      showLeaderboard,
      ownerGameData,
      leaderboard,
      ownerId,
    };
  },
});
</script>

<style scoped lang="scss">
.clicker-container {
  position: relative;
  width: 100%;
  height: 100%;
  padding: var(--spacing-md);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.clicker-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  width: 100%;
}

.count-display {
  font-size: 48px;
  font-weight: 700;
  color: var(--color-text-primary);
  font-family: var(--font-family-base);
  line-height: 1;
  user-select: none;
}

.click-button {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-text-primary);
  color: var(--color-tile-background);
  border: none;
  border-radius: var(--radius-md);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.1s ease, background 0.3s ease, opacity 0.2s ease;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &.on-fire {
    background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
    animation: fireGlow 1.5s ease-in-out infinite;
  }
}

@keyframes fireGlow {
  0%, 100% {
    box-shadow: 0 0 10px rgba(255, 107, 53, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(255, 107, 53, 0.8), 0 0 30px rgba(247, 147, 30, 0.4);
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
  border: 1px solid var(--color-content-low);
  border-radius: var(--radius-sm);
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
  display: grid;
  grid-template-columns: 40px 1fr auto;
  gap: var(--spacing-sm);
  align-items: center;
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 13px;
  transition: background 0.2s ease;
  background: rgba(0, 0, 0, 0.2);
  
  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
  
  &.is-current-owner {
    background: rgba(255, 255, 255, 0.1);
    font-weight: 600;
    border: 1px solid var(--color-content-low);
  }
}

.leaderboard-entry .rank {
  color: var(--color-content-default);
  font-weight: 700;
  text-align: right;
  font-size: 14px;
}

.leaderboard-entry .name {
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leaderboard-entry .score {
  color: var(--color-text-primary);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
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
