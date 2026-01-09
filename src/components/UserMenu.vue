<template>
  <div class="user-menu" v-if="user">
    <button
      class="user-menu-button"
      @click="toggleUserMenu"
      @blur="handleBlur"
    >
      <div class="user-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/>
          <path d="M6 21C6 17.134 8.68629 14 12 14C15.3137 14 18 17.134 18 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="user-menu-dropdown" v-if="showUserMenu">
        <button @click="logout" class="user-menu-item">
          Logout
        </button>
      </div>
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { auth } from "@/firebase";
import { signOut, onAuthStateChanged, type User } from "firebase/auth";

export default defineComponent({
  name: "UserMenu",
  setup() {
    const router = useRouter();
    const user = ref<User | null>(null);
    const showUserMenu = ref(false);

    onMounted(() => {
      onAuthStateChanged(auth, (currentUser) => {
        user.value = currentUser;
      });
    });

    const toggleUserMenu = () => {
      showUserMenu.value = !showUserMenu.value;
    };

    const handleBlur = () => {
      // Close menu when clicking outside
      setTimeout(() => {
        showUserMenu.value = false;
      }, 200);
    };

    const logout = async () => {
      await signOut(auth);
      router.push("/login");
      showUserMenu.value = false;
    };

    return {
      user,
      showUserMenu,
      toggleUserMenu,
      handleBlur,
      logout,
    };
  },
});
</script>

<style lang="scss" scoped>
.user-menu {
  position: fixed;
  bottom: var(--spacing-md);
  left: var(--spacing-md);
  z-index: var(--z-fixed);
}

.user-menu-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: none;
//   background: var(--color-tile-background);
//   border: var(--tile-border-width) solid var(--color-tile-stroke);
  cursor: pointer;
  color: var(--color-text-primary);
  transition: all var(--duration-fast) var(--easing-smooth);
  padding: 0;

  .user-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: var(--color-content-default);
    transition: color var(--duration-fast) var(--easing-smooth);

    svg {
      width: 100%;
      height: 100%;
    }
  }

  &:hover {
    background: var(--color-content-low);
    
    .user-icon {
      color: var(--color-figma-purple);
    }
  }

  .user-menu-dropdown {
    position: absolute;
    bottom: -4px;
    left: 48px;
    background: var(--color-tile-background);
    border: var(--tile-border-width) solid var(--color-tile-stroke);
    border-radius: var(--radius-md);
    padding: var(--spacing-xs);
    min-width: 120px;
    box-shadow: var(--shadow-lg);
    z-index: 100;
  }

  .user-menu-item {
    width: 100%;
    padding: var(--spacing-sm);
    text-align: left;
    background: transparent;
    border: none;
    color: var(--color-text-primary);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: background-color var(--duration-fast) var(--easing-smooth);
    font-family: var(--font-family-base);
    font-size: var(--font-size-sm);

    &:hover {
      background-color: var(--color-content-low);
    }
  }
}
</style>
