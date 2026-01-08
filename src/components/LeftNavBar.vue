<template>
  <nav 
    class="left-nav-bar" 
    :class="{ 'is-expanded': isExpanded }"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div class="nav-bar-container">
      <!-- Home Button -->
      <router-link
        to="/"
        class="nav-button"
        :class="{ 'is-active': isActiveRoute('/') }"
      >
        <div class="nav-button-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 12.2039C2 9.91549 2 8.77128 2.5192 7.82274C3.0384 6.87421 3.98695 6.28551 5.88403 5.10813L7.88403 3.86687C9.88939 2.62229 10.8921 2 12 2C13.1079 2 14.1106 2.62229 16.116 3.86687L18.116 5.10812C20.0131 6.28551 20.9616 6.87421 21.4808 7.82274C22 8.77128 22 9.91549 22 12.2039V13.725C22 17.6258 22 19.5763 20.8284 20.7881C19.6569 22 17.7712 22 14 22H10C6.22876 22 4.34315 22 3.17157 20.7881C2 19.5763 2 17.6258 2 13.725V12.2039Z" stroke="currentColor" stroke-width="1.5"/>
            <path d="M15 18H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="nav-button-label" v-show="isExpanded">Home</span>
        <div class="active-indicator" v-if="isActiveRoute('/') && isExpanded"></div>
      </router-link>

      <!-- Dashboard Button -->
      <router-link
        v-if="user"
        to="/dashboard"
        class="nav-button"
        :class="{ 'is-active': isActiveRoute('/dashboard') }"
      >
        <div class="nav-button-icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <rect x="18" y="4" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <rect x="4" y="18" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <rect x="18" y="18" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <path d="M23 23H28M28 23V28M28 23H23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="nav-button-label" v-show="isExpanded">Dashboard</span>
        <div class="active-indicator" v-if="isActiveRoute('/dashboard') && isExpanded"></div>
      </router-link>

      <!-- Logout/Login Button -->
      <button
        v-if="user"
        class="nav-button"
        @click="logout"
      >
        <div class="nav-button-icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 16H22M22 16L19 13M22 16L19 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M6 10V22C6 24.2091 7.79086 26 10 26H18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M10 6H22C24.2091 6 26 7.79086 26 10V12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="nav-button-label" v-show="isExpanded">Logout</span>
      </button>

      <div
        v-else
        class="nav-button"
        @click="redirectToLogin"
      >
        <div class="nav-button-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/>
            <path d="M6 21C6 17.134 8.68629 14 12 14C15.3137 14 18 17.134 18 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="nav-button-label" v-show="isExpanded">Login</span>
      </div>
    </div>

  </nav>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { auth } from "@/firebase";
import { signOut, onAuthStateChanged, type User } from "firebase/auth";

export default defineComponent({
  name: "LeftNavBar",
  setup() {
    const router = useRouter();
    const route = useRoute();
    const user = ref<User | null>(null);
    const isExpanded = ref(false);
    let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

    onMounted(() => {
      onAuthStateChanged(auth, (currentUser) => {
        user.value = currentUser;
      });
    });

    const isActiveRoute = (path: string) => {
      if (path === "/") {
        return route.path === "/" || route.path === "/home";
      }
      return route.path.startsWith(path);
    };


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

    const logout = async () => {
      await signOut(auth);
      router.push("/login");
    };

    const redirectToLogin = () => {
      router.push("/login");
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
      handleMouseEnter,
      handleMouseLeave,
      logout,
      redirectToLogin,
    };
  },
});
</script>

<style lang="scss" scoped>
.left-nav-bar {
  position: fixed;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  z-index: var(--z-fixed);
  width: 8px;
  transition: width var(--duration-normal) var(--easing-smooth);
  padding: var(--spacing-sm) 0;

  &.is-expanded {
    width: 40px;
    height: fit-content;
  }

  .nav-bar-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md);
    background: var(--color-tile-stroke);
    border: 1.4px solid var(--color-tile-stroke);
    border-radius: var(--radius-full);
    padding: var(--spacing-sm) var(--spacing-xs);
    width: 100%;
    min-height: 64px;
    transition: all var(--duration-normal) var(--easing-smooth);
  }

  .nav-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: var(--radius-full);
    background: transparent;
    border: none;
    cursor: pointer;
    text-decoration: none;
    color: var(--color-text-primary);
    transition: all var(--duration-fast) var(--easing-smooth);
    padding: 0;
    overflow: hidden;

    &::before {
      content: "";
      position: absolute;
      inset: 0;
      background: var(--color-content-low);
      border-radius: var(--radius-full);
      opacity: 0;
      transition: opacity var(--duration-fast) var(--easing-smooth);
    }

    &::after {
      content: "";
      position: absolute;
      inset: 0;
      background: var(--color-content-default);
      border-radius: var(--radius-full);
      mix-blend-mode: color-dodge;
      opacity: 0;
      transition: opacity var(--duration-fast) var(--easing-smooth);
    }

    &:hover {
      &::before,
      &::after {
        opacity: 1;
      }
    }

    &.is-active {
      background: var(--color-figma-purple);
      opacity: 0.2;
      box-shadow: 0px 0px 6px 0px var(--color-figma-purple);

      &::before,
      &::after {
        opacity: 1;
      }

      .nav-button-icon {
        color: var(--color-text-primary);
      }
    }

    .nav-button-icon {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      color: var(--color-content-default);
      transition: color var(--duration-fast) var(--easing-smooth);

      svg {
        width: 100%;
        height: 100%;
      }
    }

    &.is-active .nav-button-icon {
      color: var(--color-text-primary);
    }

    .nav-button-label {
      position: absolute;
      left: 56px;
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

  .is-expanded .nav-button {
    width: 44px;
    height: 44px;
  }

  .nav-button {
    position: relative;

    .active-indicator {
      position: absolute;
      right: -2px;
      top: 50%;
      transform: translateY(-50%);
      width: 1px;
      height: 50px;
      background: var(--color-figma-purple);
      border-radius: 0 1px 1px 0;
      box-shadow: 0px 0px 6px 0px var(--color-figma-purple),
        -35px 0px 20px 9px var(--color-figma-purple);
      opacity: 0.6;
      z-index: 10;
    }
  }
}

.left-nav-bar:hover {
  .nav-bar-container {
    padding: var(--spacing-sm) var(--spacing-sm);
  }
}

// Adjust for collapsed state - show thin bar
.left-nav-bar:not(.is-expanded) {
  width: 6px;

  .nav-bar-container {
    background: var(--color-content-background);
    border: 1px solid var(--color-tile-stroke);
    padding: var(--spacing-md) 0;
    min-height: 200px;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  .nav-button {
    width: 4px;
    height: 4px;
    border-radius: var(--radius-full);
    background: var(--color-content-default);
    margin: var(--spacing-sm) 0;
    opacity: 0.5;

    .nav-button-icon {
      display: none;
    }

    &.is-active {
      background: var(--color-content-high);
      opacity: 0.8;
    }
  }

  .active-indicator {
    display: none;
  }
}
</style>
