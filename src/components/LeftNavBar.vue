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
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <rect x="18" y="4" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <rect x="4" y="18" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <rect x="18" y="18" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <path d="M23 23H28M28 23V28M28 23H23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="nav-button-label" v-show="isExpanded">Dashboard</span>
        <div class="active-dot" v-if="isActiveRoute('/dashboard')"></div>
      </router-link>

      <!-- Current Grid Button -->
      <router-link
        v-if="user && currentGridPath"
        :to="currentGridPath"
        class="nav-button"
        :class="{ 'is-active': isActiveRoute('/grid') }"
      >
        <div class="nav-button-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </div>
        <span class="nav-button-label" v-show="isExpanded">{{ currentGridName || 'Grid' }}</span>
        <div class="active-dot" v-if="isActiveRoute('/grid')"></div>
      </router-link>
    </div>
  </nav>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { auth } from "@/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useLayoutStore } from "@/stores/layout";

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
        if (currentUser && layoutStore.layouts.length === 0) {
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

    const currentGridPath = computed(() => {
      if (layoutStore.currentLayout?.id) {
        return `/grid/${layoutStore.currentLayout.id}`;
      }
      // If no current layout, try to get the most recent one
      if (layoutStore.layouts.length > 0) {
        return `/grid/${layoutStore.layouts[0].id}`;
      }
      return null;
    });

    const currentGridName = computed(() => {
      return layoutStore.currentLayout?.name || layoutStore.layouts[0]?.name || null;
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
      currentGridPath,
      currentGridName,
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
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  z-index: var(--z-fixed);
  width: 6px;
  transition: width var(--duration-normal) var(--easing-smooth);

  &.is-expanded {
    width: 40px;
  }

  .nav-bar-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    background: var(--color-tile-stroke);
    border: 1.4px solid var(--color-tile-stroke);
    border-radius: var(--radius-full);
    padding: var(--spacing-sm);
    width: 100%;
    min-height: fit-content;
    transition: all var(--duration-normal) var(--easing-smooth);
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
    transition: all var(--duration-fast) var(--easing-smooth);
    padding: 0;
    overflow: visible;

    .nav-button-icon {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      color: var(--color-content-default);
      transition: color var(--duration-fast) var(--easing-smooth);

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
      width: 2px;
      height: 4px;
      background: white;
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
        color: var(--color-figma-purple);
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
      transition: all var(--duration-normal) var(--easing-smooth);
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
  width: 6px;

  .nav-bar-container {
    background: var(--color-tile-stroke);
    border: 1px solid var(--color-tile-stroke);
    padding: var(--spacing-xs) 0;
    min-height: 48px;
  }

  .nav-button {
    display: none;
  }
}
</style>
