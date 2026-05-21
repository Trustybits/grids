<template>
  <nav
    class="left-nav-bar"
    :class="{ 'is-expanded': isExpanded }"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div class="nav-bar-container">
      <!-- Dashboard Button -->
      <router-link
        v-if="user"
        to="/dashboard"
        class="nav-button"
        :class="{ 'is-active': isActiveRoute('/dashboard') }"
      >
        <div class="nav-button-icon">
          <HomeIcon />
        </div>
        <span class="nav-button-label" v-show="isExpanded">Dashboard</span>
        <div class="active-dot" v-if="isActiveRoute('/dashboard')"></div>
      </router-link>

      <!-- Divider -->
      <div v-if="user" class="nav-divider"></div>

      <!-- Recent Grids -->
      <template v-if="user">
        <router-link
          v-for="g in recentGrids"
          :key="g.id"
          :to="`/grid/${g.id}`"
          class="nav-button"
          :class="{ 'is-active': isActiveGrid(g.id) }"
        >
          <div class="nav-button-icon">
            <GridSquaresIcon />
          </div>
          <span class="nav-button-label" v-show="isExpanded">{{
            g.name || "Grid"
          }}</span>
          <div class="active-dot" v-if="isActiveGrid(g.id)"></div>
        </router-link>
      </template>
    </div>
  </nav>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted } from "vue";
import HomeIcon from "@/components/icons/HomeIcon.vue";
import GridSquaresIcon from "@/components/icons/GridSquaresIcon.vue";
import { useRoute } from "vue-router";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import type { AuthUser } from "@/auth/AuthProvider";
import { useGridStore } from "@/stores/grid";
import type { Grid } from "@/types/Grid";
import { valueToMillis } from "@/utils/TimeConversion";

export default defineComponent({
  name: "LeftNavBar",
  components: { HomeIcon, GridSquaresIcon },
  setup() {
    const route = useRoute();
    const gridStore = useGridStore();
    const user = ref<AuthUser | null>(null);
    const isExpanded = ref(false);
    let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

    onMounted(() => {
      getAuthProvider().onAuthStateChanged((currentUser) => {
        user.value = currentUser;
        if (currentUser) {
          gridStore.fetchGrids();
        }
      });
    });

    const isActiveRoute = (path: string) => {
      if (path === "/grid") {
        return route.path.startsWith("/grid");
      }
      return route.path.startsWith(path);
    };

    const isActiveGrid = (id: string) => {
      return route.path.startsWith(`/grid/${id}`);
    };

    const recentGrids = computed<Grid[]>(() => {
      const scored = (gridStore.grids || []).map((l) => ({
        l,
        s:
          valueToMillis(l.lastOpenedAt) ||
          valueToMillis(l.updatedAt) ||
          valueToMillis(l.createdAt) ||
          0,
      }));

      const sorted = scored
        .sort((a, b) => b.s - a.s)
        .map((x) => x.l)
        .filter((x, idx, arr) => arr.findIndex((y) => y.id === x.id) === idx)
        .slice(0, 3);

      if (sorted.length === 0) {
        if (gridStore.currentGrid) return [gridStore.currentGrid];
        if (gridStore.grids.length > 0) return [gridStore.grids[0]];
      }
      return sorted;
    });

    const handleMouseEnter = () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
      isExpanded.value = true;
    };

    const handleMouseLeave = () => {
      hoverTimeout = setTimeout(() => {
        isExpanded.value = false;
      }, 200);
    };

    onUnmounted(() => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    });

    return {
      user,
      isExpanded,
      isActiveRoute,
      isActiveGrid,
      recentGrids,
      handleMouseEnter,
      handleMouseLeave,
      gridStore,
    };
  },
});
</script>

<style lang="scss" scoped>
.left-nav-bar {
  position: fixed;
  display: flex;
  justify-content: end;
  top: 50%;
  padding: 16px 0;
  transform: translateY(-50%);
  z-index: var(--z-fixed);
  /* Slightly wider to increase hover hitbox; inner bar stays narrow */
  width: 20px;
  transition:
    width var(--duration-normal) var(--easing-ease-in-out),
    opacity var(--duration-normal) var(--easing-ease-in-out);

  &.is-expanded {
    width: 40px;
    left: 8px;
  }

  .nav-bar-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    background: var(--color-base-34);
    border: 1.4px solid var(--color-tile-stroke);
    border-radius: var(--radius-md);
    padding: var(--spacing-sm);
    width: 6px; /* visible bar width in collapsed state */
    min-height: fit-content;
    transition: all var(--duration-normal) var(--easing-ease-in-out);
  }

  &.is-expanded .nav-bar-container {
    width: 100%;
  }

  .nav-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-full);
    background: transparent;
    border: none;
    cursor: pointer;
    text-decoration: none;
    color: var(--color-text-primary);
    transition:
      opacity var(--duration-normal) var(--easing-ease-in-out),
      transform var(--duration-normal) var(--easing-ease-in-out),
      color var(--duration-fast) var(--easing-ease-in-out),
      height var(--duration-normal) var(--easing-ease-in-out),
      margin var(--duration-normal) var(--easing-ease-in-out);
    padding: 0;
    overflow: visible;
    opacity: 1;
    transform: translateX(0);

    .nav-button-icon {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      color: var(--color-content-default);
      transition: color var(--duration-fast) var(--easing-ease-in-out);

      svg {
        width: 100%;
        height: 100%;
      }
    }

    .active-dot {
      position: absolute;
      left: -4px;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 6px;
      background: var(--color-text-primary);
      border-radius: 0 var(--radius-full) var(--radius-full) 0;
      z-index: 2;
    }

    &:hover:not(.is-active) {
      .nav-button-icon {
        color: var(--color-figma-purple);
      }
    }

    &.is-active {
      .nav-button-icon {
        color: var(--color-text-primary);
      }
    }

    .nav-button-label {
      position: absolute;
      left: 44px;
      white-space: nowrap;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
      opacity: 0;
      transform: translateX(-8px);
      transition: all var(--duration-normal) var(--easing-ease-in-out);
      pointer-events: none;
    }

    &:hover .nav-button-label {
      opacity: 1;
      transform: translateX(0);
    }
  }
}

// Collapsed state - solid bar with no visible contents
.left-nav-bar:not(.is-expanded) {
  .nav-bar-container {
    background: var(--color-content-high);
    border: 1px solid var(--color-tile-stroke);
    padding: var(--spacing-xs) 0;
    gap: 0;
    min-height: 24px; /* Reduced min-height */
  }

  .nav-button {
    opacity: 0;
    height: 0;
    margin: 0;
    overflow: hidden;
    transform: translateX(-8px);
    pointer-events: none;

    .active-dot {
      opacity: 0;
    }
  }
}

.nav-divider {
  width: 100%;
  height: 1px;
  background: var(--color-tile-stroke);
}

.left-nav-bar:not(.is-expanded) .nav-divider {
  opacity: 0;
  height: 0;
  margin: 0;
}
</style>
