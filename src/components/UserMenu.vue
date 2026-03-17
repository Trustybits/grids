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
        <div class="user-info-section">
          <button @click="openSlugModal" class="info-item clickable">
            <div class="info-content">
              <span class="info-label">Handle</span>
              <span class="info-value">{{ currentSlug || 'Not set' }}</span>
            </div>
            <svg class="edit-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              <path d="M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>
          <div class="info-item">
            <div class="info-content">
              <span class="info-label">Email</span>
              <span class="info-value">{{ user.email }}</span>
            </div>
          </div>
        </div>
        <div v-if="currentSlug" class="menu-divider"></div>
        <div v-if="currentSlug" class="default-grid-section">
          <div class="info-item">
            <div class="info-content">
              <span class="info-label">Grid</span>
              <select
                v-model="selectedGridId"
                @change="handleDefaultGridChange"
                :disabled="pendingDefaultGrid"
                class="grid-select"
                @mousedown.stop
                @click.stop
              >
                <option :value="null">No default grid</option>
                <option
                  v-for="layout in layouts"
                  :key="layout.id"
                  :value="layout.id"
                >
                  {{ layout.name || 'Untitled Grid' }}
                </option>
              </select>
            </div>
            <span v-if="gridSaveSuccess" class="grid-save-success">&#10003;</span>
          </div>
          <p class="grid-hint">Shown at grids.so/{{ currentSlug }}</p>
        </div>
        <div class="menu-divider"></div>
        <button @click="logout" class="menu-action-item">
          Logout
        </button>
      </div>
    </button>
    
    <!-- Slug Management Modal -->
    <SlugClaimModal
      :is-open="showSlugModal"
      :current-slug="currentSlug"
      @close="closeSlugModal"
      @success="handleSlugSuccess"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { auth } from "@/firebase";
import { signOut, onAuthStateChanged, type User } from "firebase/auth";
import { getUserProfile, setDefaultGrid } from "@/services/UserProfileService";
import { useLayoutStore } from "@/stores/layout";
import SlugClaimModal from "./SlugClaimModal.vue";

export default defineComponent({
  name: "UserMenu",
  components: {
    SlugClaimModal,
  },
  setup() {
    const router = useRouter();
    const layoutStore = useLayoutStore();
    const user = ref<User | null>(null);
    const showUserMenu = ref(false);
    const showSlugModal = ref(false);
    const currentSlug = ref<string | undefined>(undefined);
    const selectedGridId = ref<string | null>(null);
    const pendingDefaultGrid = ref(false);
    const gridSaveSuccess = ref(false);

    const layouts = computed(() => layoutStore.layouts);

    onMounted(() => {
      onAuthStateChanged(auth, (currentUser) => {
        user.value = currentUser;
        // Load user profile to get current slug and default grid
        if (currentUser) {
          loadUserProfile();
          layoutStore.fetchLayouts();
        }
      });
    });

    const loadUserProfile = async () => {
      if (user.value) {
        try {
          const profile = await getUserProfile(user.value.uid);
          currentSlug.value = profile?.slug;
          selectedGridId.value = profile?.defaultGridId || null;
        } catch (error) {
          console.error('Error loading user profile:', error);
        }
      }
    };

    // Optimistic default grid change — UI updates instantly, rolls back on failure
    const handleDefaultGridChange = async () => {
      if (!user.value || pendingDefaultGrid.value) return;

      const previousGridId = selectedGridId.value;
      pendingDefaultGrid.value = true;
      gridSaveSuccess.value = true;

      const timeoutId = setTimeout(() => {
        if (pendingDefaultGrid.value) {
          console.warn('[UserMenu] setDefaultGrid timeout — clearing pending state');
          pendingDefaultGrid.value = false;
        }
      }, 10000);

      try {
        await setDefaultGrid(user.value.uid, selectedGridId.value);
        setTimeout(() => { gridSaveSuccess.value = false; }, 2000);
      } catch (error) {
        console.error('Error setting default grid:', error);
        selectedGridId.value = previousGridId;
        gridSaveSuccess.value = false;
      } finally {
        clearTimeout(timeoutId);
        pendingDefaultGrid.value = false;
      }
    };

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

    const openSlugModal = async () => {
      showUserMenu.value = false;
      if (user.value) {
        try {
          const profile = await getUserProfile(user.value.uid);
          currentSlug.value = profile?.slug;
          selectedGridId.value = profile?.defaultGridId || null;
        } catch (error) {
          console.error('Error loading user profile:', error);
        }
      }
      showSlugModal.value = true;
    };

    const closeSlugModal = () => {
      showSlugModal.value = false;
    };

    const handleSlugSuccess = async () => {
      // Reload profile to get updated slug
      if (user.value) {
        try {
          const profile = await getUserProfile(user.value.uid);
          currentSlug.value = profile?.slug;
          selectedGridId.value = profile?.defaultGridId || null;
        } catch (error) {
          console.error('Error reloading profile:', error);
        }
      }
    };

    return {
      user,
      showUserMenu,
      toggleUserMenu,
      handleBlur,
      logout,
      showSlugModal,
      currentSlug,
      openSlugModal,
      closeSlugModal,
      handleSlugSuccess,
      layouts,
      selectedGridId,
      pendingDefaultGrid,
      gridSaveSuccess,
      handleDefaultGridChange,
    };
  },
});
</script>

<style lang="scss" scoped>
.user-menu {
  position: relative;
}

.user-menu-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
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
    background: var(--color-base-34);
    
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
    padding: var(--spacing-sm);
    min-width: 240px;
    box-shadow: var(--shadow-lg);
    z-index: 100;
  }

  .user-info-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .info-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm);
    font-size: var(--font-size-sm);
    border-radius: var(--radius-sm);
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
    font-family: var(--font-family-base);
    transition: background-color var(--duration-fast) var(--easing-smooth);
    
    &.clickable {
      cursor: pointer;
      
      &:hover {
        background-color: var(--color-base-34);
        
        .edit-icon {
          opacity: 1;
        }
      }
    }
    
    &:not(.clickable) {
      cursor: default;
      
      .info-value {
        opacity: 0.5;
      }
    }
  }

  .info-content {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex: 1;
    min-width: 0;
  }

  .info-label {
    font-weight: var(--font-weight-medium);
    color: var(--color-content-low);
    min-width: 55px;
    flex-shrink: 0;
  }

  .info-value {
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .edit-icon {
    color: var(--color-content-default);
    opacity: 0.4;
    flex-shrink: 0;
    margin-left: var(--spacing-sm);
    transition: opacity var(--duration-fast) var(--easing-smooth);
  }

  .default-grid-section {
    padding: 0 var(--spacing-sm);
  }

  .grid-select {
    flex: 1;
    min-width: 0;
    padding: 4px 6px;
    background-color: var(--color-content-background);
    color: var(--color-text-primary);
    border: var(--tile-border-width) solid var(--color-tile-stroke);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-base);
    cursor: pointer;
    transition: border-color var(--duration-fast) var(--easing-smooth);

    &:focus {
      outline: none;
      border-color: var(--color-content-high);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .grid-save-success {
    font-size: 13px;
    color: #4ade80;
    font-weight: 600;
    flex-shrink: 0;
    margin-left: var(--spacing-xs);
  }

  .grid-hint {
    margin: 2px 0 4px 0;
    font-size: 11px;
    color: var(--color-content-low);
    opacity: 0.7;
  }

  .menu-divider {
    height: 1px;
    background-color: var(--color-tile-stroke);
    margin: var(--spacing-sm) 0;
  }

  .menu-action-item {
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
      background-color: var(--color-base-34);
    }
  }
}
</style>
