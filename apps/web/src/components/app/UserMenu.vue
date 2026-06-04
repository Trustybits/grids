<template>
  <div
    class="user-menu"
    v-if="user"
    ref="menuRef"
    :data-tooltip="showUserMenu ? null : 'User Menu'"
  >
    <button class="user-menu-button" @click="toggleUserMenu">
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
        <ProfileIcon v-else :size="20" />
      </div>
    </button>
    <div class="user-menu-dropdown" v-if="showUserMenu" @click.stop>
      <div class="user-info-section">
        <button
          type="button"
          @click="openSlugModal"
          class="info-item clickable"
        >
          <div class="info-content">
            <span class="info-label">Handle</span>
            <span class="info-value">{{ currentSlug || "Not set" }}</span>
          </div>
          <EditIcon class="edit-icon" :size="14" />
        </button>
      </div>
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
      <div class="menu-divider"></div>
      <div class="billing-section">
        <span v-if="isProOrAbove" class="billing-chip billing-chip--pro"
          >Pro Plan</span
        >
        <span
          v-else-if="hasSupporterBadge"
          class="billing-chip billing-chip--supporter"
          >Supporter</span
        >
        <span v-else class="billing-label">Free Account</span>
        <button
          v-if="isProOrAbove"
          class="billing-action billing-action-button"
          :disabled="checkout.loading.value"
          @click="openBillingPortal"
        >
          {{ checkout.loading.value ? "Opening..." : "Manage Billing" }}
        </button>
        <router-link
          v-else
          to="/pricing"
          class="billing-action"
          @click="showUserMenu = false"
        >
          Upgrade
        </router-link>
      </div>
      <div class="menu-divider"></div>
      <button @click="logout" class="menu-action-item">Logout</button>
    </div>
    <div class="menu-divider"></div>
  </div>

  <!-- Slug Management Modal -->
  <SlugClaimModal
    :is-open="showSlugModal"
    :current-slug="currentSlug"
    @close="closeSlugModal"
    @skip="closeSlugModal"
  />
</template>

<script lang="ts">
import { computed, defineComponent, ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import type { AuthUser } from "@grids/contracts/auth";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { useTier } from "@/composables/useTier";
import { useBadges } from "@/composables/useBadges";
import { useStripeCheckout } from "@/composables/useStripeCheckout";
import {
  ContentType,
  type AvatarShape,
  type ProfileBioContent,
  type UserProfile,
} from "@grids/contracts/types";
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
import SlugClaimModal from "@/components/modal/SlugClaimModal.vue";
import ProfileIcon from "@/components/icons/ProfileIcon.vue";
import EditIcon from "@/components/icons/EditIcon.vue";

const MENU_AVATAR_SIZE = 24;
const MENU_AVATAR_POLYGON_INSET = 0.5;

export default defineComponent({
  name: "UserMenu",
  components: {
    SlugClaimModal,
    ProfileIcon,
    EditIcon,
  },
  setup() {
    const router = useRouter();
    const { isProOrAbove } = useTier();
    const user = ref<AuthUser | null>(null);
    const userId = computed(() => user.value?.uid ?? null);
    const { hasBadge } = useBadges(userId);
    const hasSupporterBadge = computed(() => hasBadge("supporter"));
    const checkout = useStripeCheckout();
    const menuRef = ref<HTMLElement | null>(null);
    const showUserMenu = ref(false);
    const showSlugModal = ref(false);
    const currentSlug = ref<string | undefined>(undefined);
    const defaultGridId = ref<string | undefined>(undefined);
    const defaultGridProfileImageUrl = ref<string | undefined>(undefined);
    const defaultGridProfileAvatarShape =
      ref<AvatarShape>(DEFAULT_AVATAR_SHAPE);
    const defaultGridProfileAvatarRadius = ref(DEFAULT_AVATAR_RADIUS);
    const defaultGridProfileAvatarSides = ref(DEFAULT_AVATAR_SIDES);
    const polygonClipPathId = `user-menu-avatar-clip-${Math.random()
      .toString(36)
      .slice(2, 9)}`;
    const defaultGridName = ref<string | undefined>(undefined);
    // Bookkeeping for the live profile subscription. Tracking the last grid
    // id we loaded an avatar for lets us skip redundant grid fetches when the
    // profile pushes updates that don't change the default grid.
    let authUnsubscribe: (() => void) | null = null;
    let profileUnsubscribe: (() => void) | null = null;
    let loadedAvatarGridId: string | undefined;

    const resetDefaultGridProfileShape = () => {
      defaultGridProfileAvatarShape.value = DEFAULT_AVATAR_SHAPE;
      defaultGridProfileAvatarRadius.value = DEFAULT_AVATAR_RADIUS;
      defaultGridProfileAvatarSides.value = DEFAULT_AVATAR_SIDES;
    };

    const clearProfileState = () => {
      currentSlug.value = undefined;
      defaultGridId.value = undefined;
      defaultGridProfileImageUrl.value = undefined;
      resetDefaultGridProfileShape();
      defaultGridName.value = undefined;
      loadedAvatarGridId = undefined;
    };

    const applyProfile = (profile: UserProfile | null) => {
      currentSlug.value = profile?.slug;
      const gridId = profile?.defaultGridId ?? undefined;
      defaultGridId.value = gridId;
      // Only re-fetch the avatar/name when the default grid actually changes.
      if (gridId !== loadedAvatarGridId) {
        loadedAvatarGridId = gridId;
        void loadDefaultGridProfileImageAndName(gridId);
      }
    };

    const subscribeToProfile = (userId: string) => {
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }
      profileUnsubscribe = getServiceFactory()
        .getUserService()
        .subscribeToUserProfile(userId, applyProfile);
    };

    onMounted(() => {
      authUnsubscribe = getAuthProvider().onAuthStateChanged((currentUser) => {
        user.value = currentUser;
        // Live-subscribe to the profile so slug/default-grid updates (e.g.
        // right after claiming a handle) push automatically — no manual reload.
        if (currentUser) {
          subscribeToProfile(currentUser.uid);
        } else {
          if (profileUnsubscribe) {
            profileUnsubscribe();
            profileUnsubscribe = null;
          }
          clearProfileState();
        }
      });
      document.addEventListener("click", handleClickOutside, true);
    });

    onUnmounted(() => {
      document.removeEventListener("click", handleClickOutside, true);
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }
      if (authUnsubscribe) {
        authUnsubscribe();
        authUnsubscribe = null;
      }
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
          .getGridService()
          .fetchGrid(gridId);
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

      const scaledRadius = scaleAvatarRadius(
        defaultGridProfileAvatarRadius.value,
        PROFILE_TILE_AVATAR_SIZE,
        MENU_AVATAR_SIZE,
      );
      return {
        borderRadius: `${Math.max(0, scaledRadius)}px`,
      };
    });

    const toggleUserMenu = () => {
      showUserMenu.value = !showUserMenu.value;
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

    const openBillingPortal = async () => {
      await checkout.openCustomerPortal();
      showUserMenu.value = false;
    };

    const openSlugModal = () => {
      showUserMenu.value = false;
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
      hasSupporterBadge,
      isProOrAbove,
      checkout,
      openBillingPortal,
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

  .billing-section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: var(--spacing-sm);
  }

  .billing-label {
    font-size: var(--font-size-sm);
    color: var(--color-content-low);
  }

  .billing-chip {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .billing-chip--supporter {
    background: rgba(249, 115, 22, 0.15);
    color: #f97316;
    border: 1px solid rgba(249, 115, 22, 0.3);
  }

  .billing-chip--pro {
    background: rgba(99, 102, 241, 0.15);
    color: #818cf8;
    border: 1px solid rgba(99, 102, 241, 0.3);
  }

  .billing-action {
    font-size: var(--font-size-sm);
    color: var(--color-figma-purple);
    text-decoration: none;
    font-weight: 500;
    transition: opacity var(--duration-fast) var(--easing-smooth);

    &:hover {
      opacity: 0.75;
    }
  }

  .billing-action-button {
    background: transparent;
    border: none;
    text-align: left;
    padding: 0;
    cursor: pointer;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
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
