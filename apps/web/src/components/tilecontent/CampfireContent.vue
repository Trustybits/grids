<template>
  <div class="campfire-container">
    <div class="campfire-content" :class="layoutClass">
      <div v-if="showCount" class="flame-count">
        {{ displayedTotalClicks }}
      </div>

      <button
        class="campfire-button"
        :class="[fireIntensityClass, { disabled: dailyCapReached }]"
        @click="handleClick"
        :title="buttonTitle"
        :aria-disabled="dailyCapReached"
      >
        <FireLargeIcon
          v-if="fireIntensity === 'blazing'"
          :size="fireIconSize"
        />
        <FireMediumIcon
          v-else-if="fireIntensity === 'burning'"
          :size="fireIconSize"
        />
        <FireSmallIcon v-else :size="fireIconSize" />
      </button>

      <!-- Daily click progress indicator -->
      <div v-if="showDailyProgress" class="daily-progress">
        <span class="progress-text"
          >{{ dailyClicksRemaining }}/{{ dailyClickCap }} today</span
        >
      </div>

      <!-- Boost tier indicator -->
      <div v-if="showBoostInfo && currentBoostTier" class="boost-info">
        <span class="boost-tier">{{ currentBoostTier.name }}</span>
        <span class="boost-rate" v-if="currentBoostTier.dailyPassiveClicks > 0">
          +{{ currentBoostTier.dailyPassiveClicks }}/day
        </span>
      </div>

      <!-- Cap reached message -->
      <transition name="fade">
        <div v-if="showCapMessage" class="cap-message">
          Daily limit reached! Come back tomorrow 🔥
        </div>
      </transition>

      <!-- Passive clicks claimed message -->
      <transition name="fade">
        <div v-if="showPassiveMessage" class="passive-message">
          +{{ passiveClicksClaimed }} passive clicks earned! 🌟
        </div>
      </transition>

      <div v-if="showFooter" class="footer">
        <div class="player-info">
          <div class="player-name">
            {{ ownerGameData?.displayName || "Loading..." }}
          </div>
        </div>

        <button
          class="leaderboard-icon-button"
          @click="toggleLeaderboard"
          :title="showLeaderboard ? 'Close leaderboard' : 'Show leaderboard'"
        >
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
            <span class="score"
              >{{ entry.totalClicks.toLocaleString() }} 🔥</span
            >
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
import {
  proxyRefs,
  defineComponent,
  ref,
  onMounted,
  onUnmounted,
  computed,
  inject,
  type ComputedRef,
} from "vue";
import { type CampfireContent } from "@grids/contracts/types";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import FireSmallIcon from "@/components/icons/FireSmallIcon.vue";
import FireMediumIcon from "@/components/icons/FireMediumIcon.vue";
import FireLargeIcon from "@/components/icons/FireLargeIcon.vue";
import LeaderboardIcon from "@/components/icons/LeaderboardIcon.vue";
import type { UserGameData, LeaderboardEntry } from "@grids/contracts/types";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { getCurrentBoostTier, getNextBoostTier, type BoostMilestone } from "@/utils/PassiveBoostCalculator";

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
  setup(_props) {
    const gridView = proxyRefs(useGridViewContext());
    const gameDataService = getServiceFactory().getGameDataService();
    const fireIntensity = ref<'dying' | 'burning' | 'blazing'>('dying');
    const lastClickTime = ref(0);
    const clickStreak = ref(0);
    const showLeaderboard = ref(false);
    const ownerGameData = ref<UserGameData | null>(null);
    const leaderboard = ref<LeaderboardEntry[]>([]);
    const showCapMessage = ref(false);
    const dailyClickCap = gameDataService.getDailyClickCap();

    // Click batching: clicks are accepted instantly into pendingClicks, then
    // debounced into Firestore writes of at most CHUNK_SIZE each. inFlightClicks
    // tracks chunks sent but not yet acknowledged by the subscription, so the
    // displayed remaining count stays stable across the round trip.
    const CHUNK_SIZE = 25;
    const FLUSH_DEBOUNCE_MS = 600;
    const serverDailyClicks = ref(0);
    const inFlightClicks = ref(0);
    const pendingClicks = ref(0);

    const projectedDailyClicks = computed(
      () => serverDailyClicks.value + inFlightClicks.value + pendingClicks.value,
    );
    const dailyClicksRemaining = computed(() =>
      Math.max(0, dailyClickCap - projectedDailyClicks.value),
    );
    const dailyCapReached = computed(() => dailyClicksRemaining.value === 0);
    const displayedTotalClicks = computed(
      () =>
        (ownerGameData.value?.totalClicks ?? 0) +
        inFlightClicks.value +
        pendingClicks.value,
    );
    const currentBoostTier = ref<BoostMilestone | null>(null);
    const nextBoostTier = ref<BoostMilestone | null>(null);
    const passiveClicksClaimed = ref(0);
    const showPassiveMessage = ref(false);

    // Inject tile dimensions from GridTile (these are ComputedRefs)
    const tileWidth = inject<ComputedRef<number>>(
      "gridTileW",
      computed(() => 2),
    );
    const tileHeight = inject<ComputedRef<number>>(
      "gridTileH",
      computed(() => 2),
    );

    // Determine layout based on tile dimensions
    const layoutClass = computed(() => {
      const w = tileWidth.value;
      const h = tileHeight.value;
      if (w === 1 && h === 1) return "layout-1x1";
      if (w === 1 && h === 2) return "layout-1x2";
      if (w === 2 && h === 1) return "layout-2x1";
      return "layout-default";
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

    // Show daily progress for larger tiles
    const showDailyProgress = computed(() => {
      const w = tileWidth.value;
      const h = tileHeight.value;
      return !(w === 1 && h === 1);
    });

    // Show boost info for larger tiles
    const showBoostInfo = computed(() => {
      const w = tileWidth.value;
      const h = tileHeight.value;
      return !(w === 1 && h === 1) && currentBoostTier.value !== null;
    });

    // Dynamic button title based on cap status
    const buttonTitle = computed(() => {
      if (dailyCapReached.value) {
        return "Daily limit reached! Come back tomorrow";
      }
      return `Keep the fire burning! (${dailyClicksRemaining.value} clicks left today)`;
    });

    // Dynamic fire icon size based on layout
    const fireIconSize = computed(() => {
      const w = tileWidth.value;
      const h = tileHeight.value;
      if (w === 1 && h === 1) return 40;
      if (w === 1 || h === 1) return 48;
      if (fireIntensity.value === "blazing") return 64;
      if (fireIntensity.value === "burning") return 48;
      return 32;
    });

    let cooldownTimer: ReturnType<typeof setTimeout> | null = null;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let isFlushing = false;
    let unsubscribeOwnerData: (() => void) | null = null;
    let unsubscribeLeaderboard: (() => void) | null = null;

    const flushPending = async () => {
      if (isFlushing || pendingClicks.value === 0 || !ownerId.value) return;
      isFlushing = true;
      try {
        while (pendingClicks.value > 0) {
          const chunk = Math.min(pendingClicks.value, CHUNK_SIZE);
          pendingClicks.value -= chunk;
          inFlightClicks.value += chunk;
          const success = await gameDataService.incrementUserClicks(
            ownerId.value,
            chunk,
          );
          if (!success) {
            // Server cap reached (or write rejected). Drop everything we
            // optimistically counted; the subscription is the source of truth.
            inFlightClicks.value = 0;
            pendingClicks.value = 0;
            showCapMessage.value = true;
            setTimeout(() => {
              showCapMessage.value = false;
            }, 3000);
            break;
          }
        }
      } finally {
        isFlushing = false;
      }
    };

    const scheduleFlush = () => {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(() => {
        flushTimer = null;
        void flushPending();
      }, FLUSH_DEBOUNCE_MS);
    };

    const handleFlushOnLeave = () => {
      void flushPending();
    };

    const ownerId = computed(() => gridView.grid?.userId || "");

    const fireIntensityClass = computed(() => {
      return `fire-${fireIntensity.value}`;
    });

    const handleClick = () => {
      if (!ownerId.value) return;
      if (dailyCapReached.value) {
        showCapMessage.value = true;
        setTimeout(() => {
          showCapMessage.value = false;
        }, 3000);
        return;
      }

      // Optimistic accept: increment the local pending counter (UI updates
      // immediately) and debounce the Firestore write. The cap check above
      // uses projectedDailyClicks, so pendingClicks can never push past 100.
      pendingClicks.value++;
      scheduleFlush();

      // Check click speed to determine fire intensity
      const now = Date.now();
      const timeSinceLastClick = now - lastClickTime.value;

      if (timeSinceLastClick < 300) {
        // Very fast clicking - blazing fire
        clickStreak.value++;
        if (clickStreak.value >= 5) {
          fireIntensity.value = "blazing";
        } else if (clickStreak.value >= 2) {
          fireIntensity.value = "burning";
        }
      } else if (timeSinceLastClick < 800) {
        // Medium pace - burning fire
        clickStreak.value = Math.max(2, clickStreak.value);
        fireIntensity.value = "burning";
      } else {
        // Slow clicking - reset to small fire
        clickStreak.value = 0;
        fireIntensity.value = "dying";
      }

      lastClickTime.value = now;

      // Clear existing cooldown timer
      if (cooldownTimer) {
        clearTimeout(cooldownTimer);
      }

      // Set cooldown to reduce fire intensity after 1 second of no clicks
      cooldownTimer = setTimeout(() => {
        if (fireIntensity.value === "blazing") {
          fireIntensity.value = "burning";
          // Set another timer to continue reducing
          cooldownTimer = setTimeout(() => {
            fireIntensity.value = "dying";
            clickStreak.value = 0;
          }, 1000);
        } else if (fireIntensity.value === "burning") {
          fireIntensity.value = "dying";
          clickStreak.value = 0;
        }
      }, 1000);
    };

    const toggleLeaderboard = () => {
      showLeaderboard.value = !showLeaderboard.value;
    };

    onMounted(async () => {
      if (!ownerId.value) {
        console.error("No owner ID found for campfire tile");
        return;
      }

      try {
        // `ownerId` is the grid owner, never the viewer. Creating
        // `userGameData/{userId}` is gated on `request.auth.uid == userId`, so
        // only the owner may take the create path — a visitor landing on a grid
        // whose owner had never opened their own campfire used to attempt it,
        // get permission-denied, and (this hook being async and previously
        // unguarded) abort every step below, leaving the tile half-initialised.
        // Reads are public, so a visitor still sees the real campfire state.
        const gameData = gridView.isOwner
          ? await gameDataService.getOrCreateUserGameData(ownerId.value)
          : await gameDataService.getUserGameData(ownerId.value);

        // No record yet and we are not allowed to make one: show a cold
        // campfire rather than nothing.
        const totalClicks = gameData?.totalClicks ?? 0;

        // Claim any passive clicks earned since last visit. Owner-only: the
        // rules gate this update behind `isValidPassive()`, which requires
        // `request.auth.uid == userId`, so a visitor's claim is rejected. It is
        // also owner-facing by nature — the "you earned N while away" message
        // is meaningless to someone else's visitor.
        if (gridView.isOwner) {
          const passiveClaimed = await gameDataService.claimPassiveClicks(
            ownerId.value,
          );
          if (passiveClaimed > 0) {
            passiveClicksClaimed.value = passiveClaimed;
            showPassiveMessage.value = true;
            setTimeout(() => {
              showPassiveMessage.value = false;
            }, 4000);
          }
        }

        // Update boost tier based on current total clicks
        currentBoostTier.value = getCurrentBoostTier(totalClicks);
        nextBoostTier.value = getNextBoostTier(totalClicks);

        // Seed serverDailyClicks with today's authoritative count. checkDailyClickLimit
        // already handles the day-rollover case (returns dailyClicks: 0 when
        // lastClickDate is stale), so we can use its value directly.
        const limitCheck = await gameDataService.checkDailyClickLimit(ownerId.value);
        serverDailyClicks.value = limitCheck.dailyClicks;

        // Subscribe to real-time updates for owner's game data
        unsubscribeOwnerData = gameDataService.subscribeToUserGameData(ownerId.value, (data) => {
          ownerGameData.value = data;
          // The stored dailyClicks counter is only meaningful when lastClickDate
          // matches today; otherwise it's stale from a previous day and will be
          // reset on the next successful click.
          const today = new Date().toISOString().split("T")[0];
          const nextServerClicks =
            data.lastClickDate === today ? data.dailyClicks ?? 0 : 0;
          const delta = nextServerClicks - serverDailyClicks.value;
          serverDailyClicks.value = nextServerClicks;
          // Drain inFlightClicks by the delta — our chunks (and any concurrent
          // writes from other viewers) just landed on the server.
          if (delta > 0) {
            inFlightClicks.value = Math.max(0, inFlightClicks.value - delta);
          }
          // Update boost tier when total clicks change
          currentBoostTier.value = getCurrentBoostTier(data.totalClicks);
          nextBoostTier.value = getNextBoostTier(data.totalClicks);
        });

        // Flush any queued clicks before the user navigates away or hides the tab.
        window.addEventListener("beforeunload", handleFlushOnLeave);
        document.addEventListener("visibilitychange", handleFlushOnLeave);

        // Subscribe to leaderboard updates
        unsubscribeLeaderboard = gameDataService.subscribeToLeaderboard(20, (data) => {
          leaderboard.value = data;
        });
      } catch (error) {
        // A campfire that fails to reach its data should sit cold, not take the
        // whole tile down. Unhandled, this rejected out of the async hook and
        // Vue reported it as an app-level error.
        console.error("Campfire tile failed to initialise:", error);
      }
    });

    onUnmounted(() => {
      if (cooldownTimer) {
        clearTimeout(cooldownTimer);
      }
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      // Fire-and-forget: send any queued clicks before the component goes away.
      // Firestore's write queue will retry if the network drops mid-call.
      void flushPending();
      window.removeEventListener("beforeunload", handleFlushOnLeave);
      document.removeEventListener("visibilitychange", handleFlushOnLeave);
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
      dailyClicksRemaining,
      dailyCapReached,
      displayedTotalClicks,
      showCapMessage,
      showDailyProgress,
      buttonTitle,
      dailyClickCap,
      currentBoostTier,
      nextBoostTier,
      showBoostInfo,
      passiveClicksClaimed,
      showPassiveMessage,
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
  transition:
    transform 0.1s ease,
    filter 0.3s ease;
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
    filter: drop-shadow(0 0 16px rgba(255, 107, 53, 0.95))
      drop-shadow(0 0 24px rgba(247, 147, 30, 0.75));
  }

  &.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    filter: grayscale(0.8);

    &:hover {
      filter: grayscale(0.8);
    }

    &:active {
      transform: none;
    }
  }
}

@keyframes flickerDying {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.8;
  }
}

@keyframes flickerBurning {
  0%,
  100% {
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
  0%,
  100% {
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
  transition:
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s ease;
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

// Daily progress indicator
.daily-progress {
  font-size: 11px;
  color: var(--color-content-default);
  user-select: none;
  text-align: center;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-sm);

  .progress-text {
    font-variant-numeric: tabular-nums;
  }
}

// Boost tier indicator
.boost-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  user-select: none;
  padding: 4px 8px;
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: var(--radius-sm);

  .boost-tier {
    font-weight: 700;
    color: #ffd700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .boost-rate {
    font-size: 9px;
    color: var(--color-content-default);
    font-variant-numeric: tabular-nums;
  }
}

// Cap reached message
.cap-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 107, 53, 0.95);
  color: white;
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 20;
  pointer-events: none;
}

// Passive clicks claimed message
.passive-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 215, 0, 0.95);
  color: #1a1a1a;
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 20;
  pointer-events: none;
}

// Fade animation for cap message
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
