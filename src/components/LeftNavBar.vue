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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 10.5L12 4L20 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M6.5 9.5V19.5C6.5 20.0523 6.94772 20.5 7.5 20.5H16.5C17.0523 20.5 17.5 20.0523 17.5 19.5V9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M10 20.5V15.5C10 14.9477 10.4477 14.5 11 14.5H13C13.5523 14.5 14 14.9477 14 15.5V20.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </div>
          <span class="nav-button-label" v-show="isExpanded">{{ g.name || 'Grid' }}</span>
          <div class="active-dot" v-if="isActiveGrid(g.id)"></div>
        </router-link>
      </template>
    </div>
  </nav>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { auth } from "@/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useLayoutStore } from "@/stores/layout";
import type { Layout } from "@/types/Layout";
import { firestoreValueToMillis } from "@/utils/firestoreTime";

export default defineComponent({
  name: "LeftNavBar",
  setup() {
    const route = useRoute();
    const layoutStore = useLayoutStore();
    const user = ref<User | null>(null);
    const isExpanded = ref(false);
    let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

    onMounted(() => {
      onAuthStateChanged(auth, (currentUser) => {
        user.value = currentUser;
        if (currentUser) {
          layoutStore.fetchLayouts();
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

    const recentGrids = computed<Layout[]>(() => {
      const scored = (layoutStore.layouts || []).map((l) => ({
        l,
        s:
          firestoreValueToMillis(l.lastOpenedAt) ||
          firestoreValueToMillis(l.updatedAt) ||
          firestoreValueToMillis(l.createdAt) ||
          0,
      }));

      const sorted = scored
        .sort((a, b) => b.s - a.s)
        .map((x) => x.l)
        .filter((x, idx, arr) => arr.findIndex((y) => y.id === x.id) === idx)
        .slice(0, 3);

      if (sorted.length === 0) {
        if (layoutStore.currentLayout) return [layoutStore.currentLayout];
        if (layoutStore.layouts.length > 0) return [layoutStore.layouts[0]];
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
      layoutStore,
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
  transition: width var(--duration-normal) var(--easing-ease-in-out),
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
    transition: opacity var(--duration-normal) var(--easing-ease-in-out),
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
