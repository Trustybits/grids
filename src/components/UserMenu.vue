<template>
  <div
    class="user-menu"
    v-if="user"
    ref="menuRef"
    :data-tooltip="showUserMenu ? null : 'User Menu'"
  >
    <button
      class="user-menu-button"
      @click="toggleUserMenu"
    >
      <div class="user-icon">
        <svg
          v-if="
            defaultGridProfileImageUrl &&
            defaultGridProfileAvatarShape === 'polygon'
          "
          class="user-icon-image-frame"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <defs>
            <clipPath :id="polygonClipPathId">
              <path :d="defaultGridProfilePolygonPath" />
            </clipPath>
          </defs>
          <image
            class="user-icon-image-svg"
            :href="defaultGridProfileImageUrl"
            width="24"
            height="24"
            preserveAspectRatio="xMidYMid slice"
            :clip-path="`url(#${polygonClipPathId})`"
          />
        </svg>
        <div
          v-else-if="defaultGridProfileImageUrl"
          class="user-icon-image-frame"
          :style="defaultGridProfileImageStyle"
        >
          <img
            class="user-icon-image"
            :src="defaultGridProfileImageUrl"
            alt=""
          />
        </div>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/>
          <path d="M6 21C6 17.134 8.68629 14 12 14C15.3137 14 18 17.134 18 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
    </button>
    <div class="user-menu-dropdown" v-if="showUserMenu" @click.stop>
      <div class="user-info-section">
        <button type="button" @click="openSlugModal" class="info-item clickable">
          <div class="info-content">
            <span class="info-label">Handle</span>
            <span class="info-value">{{ currentSlug || 'Not set' }}</span>
          </div>
          <svg class="edit-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <path d="M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>
        <button
          v-if="defaultGridId"
          type="button"
          @click="goToDefaultGrid"
          class="info-item clickable default-grid-link"
        >
          <div class="info-content">
            <span class="info-label">Default Grid</span>
            <span class="info-value">{{ defaultGridName }}</span>
          </div>
        </button>
        <div class="info-item">
          <div class="info-content">
            <span class="info-label">Email</span>
            <span class="info-value">{{ user.email }}</span>
          </div>
        </div>
      </div>
      <div class="menu-divider"></div>
      <button type="button" @click="logout" class="menu-action-item">
        Logout
      </button>
    </div>
    
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
import { computed, defineComponent, ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import type { AuthUser } from "@/auth/AuthProvider";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import {
  ContentType,
  type AvatarShape,
  type ProfileBioContent,
} from "@/types/TileContent";
import {
  DEFAULT_AVATAR_RADIUS,
  DEFAULT_AVATAR_SHAPE,
  DEFAULT_AVATAR_SIDES,
  getAvatarShapeSettings,
  getPolygonGeometry,
  getPolygonVertices,
  getRoundedPolygonPath,
  PROFILE_TILE_AVATAR_SIZE,
  scaleAvatarRadius,
} from "@/utils/AvatarShape";
import SlugClaimModal from "./SlugClaimModal.vue";

const MENU_AVATAR_SIZE = 24;
const MENU_AVATAR_POLYGON_INSET = 0.5;

export default defineComponent({
  name: "UserMenu",
  components: {
    SlugClaimModal,
  },
  setup() {
    const router = useRouter();
    const user = ref<AuthUser | null>(null);
    const menuRef = ref<HTMLElement | null>(null);
    const showUserMenu = ref(false);
    const showSlugModal = ref(false);
    const currentSlug = ref<string | undefined>(undefined);
    const defaultGridId = ref<string | undefined>(undefined);
    const defaultGridProfileImageUrl = ref<string | undefined>(undefined);
    const defaultGridProfileAvatarShape = ref<AvatarShape>(
      DEFAULT_AVATAR_SHAPE,
    );
    const defaultGridProfileAvatarRadius = ref(DEFAULT_AVATAR_RADIUS);
    const defaultGridProfileAvatarSides = ref(DEFAULT_AVATAR_SIDES);
    const polygonClipPathId = `user-menu-avatar-clip-${Math.random()
      .toString(36)
      .slice(2, 9)}`;
    const defaultGridName = ref<string | undefined>(undefined);
    const profileLoaded = ref(false);
    const profileLoading = ref(false);

    const resetDefaultGridProfileShape = () => {
      defaultGridProfileAvatarShape.value = DEFAULT_AVATAR_SHAPE;
      defaultGridProfileAvatarRadius.value = DEFAULT_AVATAR_RADIUS;
      defaultGridProfileAvatarSides.value = DEFAULT_AVATAR_SIDES;
    };

    onMounted(() => {
      getAuthProvider().onAuthStateChanged((currentUser) => {
        user.value = currentUser;
        // Load user profile to get current slug/default grid.
        if (currentUser) {
          loadUserProfile({ force: true });
        } else {
          currentSlug.value = undefined;
          defaultGridId.value = undefined;
          defaultGridProfileImageUrl.value = undefined;
          resetDefaultGridProfileShape();
          defaultGridName.value = undefined;
          profileLoaded.value = false;
        }
      });
      document.addEventListener("click", handleClickOutside, true);
    });

    onUnmounted(() => {
      document.removeEventListener("click", handleClickOutside, true);
    });

    const loadDefaultGridProfileImageAndName = async (gridId?: string) => {
      if (!gridId) {
        defaultGridName.value = undefined;
        defaultGridProfileImageUrl.value = undefined;
        resetDefaultGridProfileShape();
        return;
      }

      try {
        const layout = await getServiceFactory()
          .getLayoutService()
          .fetchLayout(gridId);
        defaultGridName.value = layout.name ? layout.name : undefined;
        const profileTile = layout.tiles.find(
          (tile) => tile.content.type === ContentType.PROFILE,
        );
        const profileContent = profileTile?.content as
          | ProfileBioContent
          | undefined;
        const avatarSettings = getAvatarShapeSettings(profileContent);
        defaultGridProfileImageUrl.value =
          profileContent?.profilePhotoUrl || undefined;
        defaultGridProfileAvatarShape.value = avatarSettings.avatarShape;
        defaultGridProfileAvatarRadius.value = avatarSettings.avatarRadius;
        defaultGridProfileAvatarSides.value = avatarSettings.avatarSides;
      } catch (error) {
        console.error("Error loading default grid profile image:", error);
      }
    };

    const defaultGridProfilePolygonPath = computed(() => {
      const geometry = getPolygonGeometry({
        sides: defaultGridProfileAvatarSides.value,
        size: MENU_AVATAR_SIZE,
        fit: "contain",
        inset: MENU_AVATAR_POLYGON_INSET,
      });
      const vertices = getPolygonVertices(
        defaultGridProfileAvatarSides.value,
        geometry,
      );
      return getRoundedPolygonPath({
        vertices,
        radius: Math.max(
          0,
          scaleAvatarRadius(
            defaultGridProfileAvatarRadius.value,
            PROFILE_TILE_AVATAR_SIZE,
            MENU_AVATAR_SIZE,
          ),
        ),
      });
    });

    const defaultGridProfileImageStyle = computed(() => {
      if (defaultGridProfileAvatarShape.value === "circle") {
        return { borderRadius: "50%" };
      }

      const scaledRadius =
        scaleAvatarRadius(
          defaultGridProfileAvatarRadius.value,
          PROFILE_TILE_AVATAR_SIZE,
          MENU_AVATAR_SIZE,
        );
      return {
        borderRadius: `${Math.max(0, scaledRadius)}px`,
      };
    });

    const loadUserProfile = async (options: { force?: boolean } = {}) => {
      if (!user.value) return;
      if (profileLoading.value) return;
      if (profileLoaded.value && !options.force) return;

      profileLoading.value = true;
      try {
        const profile = await getServiceFactory()
          .getUserService()
          .getUserProfile(user.value.uid);
        currentSlug.value = profile?.slug;
        defaultGridId.value = profile?.defaultGridId;
        await loadDefaultGridProfileImageAndName(profile?.defaultGridId);
        profileLoaded.value = true;
      } catch (error) {
        console.error("Error loading user profile:", error);
      } finally {
        profileLoading.value = false;
      }
    };

    const toggleUserMenu = async () => {
      showUserMenu.value = !showUserMenu.value;
      if (showUserMenu.value) {
        await loadUserProfile();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
        showUserMenu.value = false;
      }
    };

    const logout = async () => {
      await getAuthProvider().signOut();
      router.push("/login");
      showUserMenu.value = false;
    };

    const openSlugModal = async () => {
      showUserMenu.value = false;
      await loadUserProfile({ force: true });
      showSlugModal.value = true;
    };

    const goToDefaultGrid = () => {
      if (!defaultGridId.value) return;
      // router.push(`/grid/${defaultGridId.value}`);
      router.push(`/${currentSlug.value}`);
      showUserMenu.value = false;
    };

    const closeSlugModal = () => {
      showSlugModal.value = false;
    };

    const handleSlugSuccess = async () => {
      // Reload profile to get updated slug/default grid.
      await loadUserProfile({ force: true });
    };

    return {
      user,
      menuRef,
      showUserMenu,
      toggleUserMenu,
      logout,
      showSlugModal,
      currentSlug,
      defaultGridId,
      defaultGridProfileImageUrl,
      defaultGridProfileAvatarShape,
      defaultGridProfileImageStyle,
      defaultGridProfilePolygonPath,
      polygonClipPathId,
      defaultGridName,
      openSlugModal,
      goToDefaultGrid,
      closeSlugModal,
      handleSlugSuccess,
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
    color: var(--bg-contrast-color, var(--color-content-default));
    transition: color var(--duration-fast) var(--easing-smooth);

    svg {
      width: 100%;
      height: 100%;
    }

    .user-icon-image-frame {
      width: 24px;
      height: 24px;
      aspect-ratio: 1 / 1;
      flex-shrink: 0;
      overflow: hidden;
      background: var(--color-base-8);
    }

    .user-icon-image {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  &:hover {
    background: var(--color-base-34);
    
    .user-icon {
      color: var(--color-figma-purple);
    }
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
  width: max-content;
  max-width: min(420px, calc(100vw - 72px));
  box-shadow: var(--shadow-lg);
  z-index: 100;

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
    width: auto;
    min-width: 100%;
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
    max-width: 280px;
  }

  .default-grid-link {
    color: var(--color-text-primary);
  }

  .edit-icon {
    color: var(--color-content-default);
    opacity: 0.4;
    flex-shrink: 0;
    margin-left: var(--spacing-sm);
    transition: opacity var(--duration-fast) var(--easing-smooth);
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
