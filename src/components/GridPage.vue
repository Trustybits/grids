<template>
  <div class="grid-page">
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <div class="error-icon">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4m0 4h.01" />
        </svg>
      </div>
      <h1>{{ errorTitle }}</h1>
      <p class="error-description">{{ errorMessage }}</p>

      <div v-if="isSlugRoute" class="cta-section">
        <p class="cta-text">Want to claim <strong>@{{ slug }}</strong>?</p>
        <router-link to="/login" class="cta-button">
          Create Account & Claim Handle
        </router-link>
        <router-link to="/" class="secondary-link">
          Or browse home
        </router-link>
      </div>
    </div>

    <div v-else class="background-image-container">
      <div :style="backgroundStyle" class="background-image-overlay"></div>

      <input
        v-if="layoutStore.canEdit"
        type="file"
        ref="imageInput"
        style="display: none"
        accept="image/*,image/svg+xml"
        @change.stop="addBackgroundImage"
      />
      <iframe
        v-if="layoutStore.currentLayout?.backgroundEmbed"
        style="width: 100%; height: 100%; position: fixed; top: 0; z-index: 0"
        scrolling="no"
        :src="layoutStore.currentLayout?.backgroundImageSrc"
        frameborder="no"
        loading="lazy"
        allowtransparency="true"
        allowfullscreen="true"
      >
        embedded background
      </iframe>

      <div class="layout-container" ref="layoutContainer" :class="{ 'drag-over': isDraggingOver }">
        <!-- Drag overlay indicator -->
        <div v-if="isDraggingOver && layoutStore.canEdit" class="drag-overlay">
          <div class="drag-message">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <p>Drop to add to grid</p>
          </div>
        </div>

        <!--
          Option B: Floating breakpoint switcher at top of viewport.
          Renders independently of the toolbar, so it works even when
          the toolbar is scrolled off-screen.
        -->
        <BreakpointSwitcher
          v-if="layoutStore.isOwner && switcherVariant === 'floating'"
          variant="floating"
        />
        <UndoRedoControls v-if="layoutStore.isOwner" />

        <!--
          Toolbar area: tile-add buttons are hidden during view-only preview
          (canEdit), but the breakpoint switcher stays visible for owners
          (isOwner) so they can switch back.
        -->
        <div v-if="layoutStore.canEdit" class="toolbar">
          <div class="row">
            <div class="col-md-12">
              <!--
                Option A: Inline — switcher sits inside the toolbar row,
                right next to the tile-add buttons.
              -->
              <div v-if="switcherVariant === 'inline'" class="toolbar-with-switcher">
                <GridButtons />
                <BreakpointSwitcher variant="inline" />
              </div>
              <GridButtons v-else />
            </div>
          </div>
          <!--
            Option D: Toolbar-row — switcher is a second row stacked
            below the tile-add toolbar, same styling family.
          -->
          <BreakpointSwitcher
            v-if="switcherVariant === 'toolbar-row'"
            variant="toolbar-row"
          />
        </div>
        <!--
          When the toolbar is hidden (view-only preview), still show the
          inline/toolbar-row switcher so the owner can switch back.
        -->
        <div v-else-if="layoutStore.isOwner && switcherVariant === 'inline'" class="toolbar">
          <div class="row">
            <div class="col-md-12">
              <BreakpointSwitcher variant="inline" />
            </div>
          </div>
        </div>
        <div v-else-if="layoutStore.isOwner && switcherVariant === 'toolbar-row'" class="toolbar">
          <BreakpointSwitcher variant="toolbar-row" />
        </div>
        <Grid :row-height="rowHeight" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import Grid from "@/components/Grid.vue";
import GridButtons from "@/components/TileButtons.vue";
import BreakpointSwitcher from "@/components/BreakpointSwitcher.vue";
import UndoRedoControls from "@/components/UndoRedoControls.vue";
import { useLayoutStore } from "@/stores/layout";
import { usePageTitle } from "@/composables/usePageTitle";
import { useDynamicFavicon } from "@/composables/useDynamicFavicon";
import { useDragAndPaste } from "@/composables/useDragAndPaste";
import { useFileUpload } from "@/composables/useFileUpload";
import { useThemeStore } from "@/stores/theme";
import { useUndoRedoKeys } from "@/composables/useUndoRedoKeys";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import type { ProfileBioContent } from "@/types/TileContent";

// ── Breakpoint switcher placement ────────────────────────────────
// Change this value to flip between the three UI placements:
//   "inline"      → Option A: sits inside the tile-add toolbar row
//   "floating"    → Option B: fixed pill near the top of the viewport
//   "toolbar-row" → Option D: second row stacked below the toolbar
type SwitcherVariant = "inline" | "floating" | "toolbar-row";
const SWITCHER_VARIANT = "floating" as SwitcherVariant;

export default defineComponent({
  components: {
    Grid,
    GridButtons,
    BreakpointSwitcher,
    UndoRedoControls,
  },
  setup() {
    const layoutStore = useLayoutStore();
    const themeStore = useThemeStore();
    useUndoRedoKeys();
    const rowHeight = 75;
    const imageInput = ref<HTMLInputElement | null>(null);
    const layoutContainer = ref<HTMLElement | null>(null);
    const route = useRoute();
    const router = useRouter();
    const isLoading = ref(true);
    const error = ref(false);
    const errorTitle = ref("Handle Not Found");
    const errorMessage = ref("");
    const slug = ref("");
    let loadRequestId = 0;

    // Setup drag and drop + paste functionality
    const { isDraggingOver } = useDragAndPaste(layoutContainer);
    const { uploadFileToUrl } = useFileUpload();

    const isOwner = computed(() => {
      return layoutStore.isOwner;
    });

    const selectImage = () => {
      if (!layoutStore.canEdit) return;
      imageInput.value?.click();
    };

    const backgroundStyle = computed(() => {
      return {
        backgroundImage: `url(${layoutStore.currentLayout?.backgroundImageSrc})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
        position: "fixed" as const,
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
      };
    });

    const isSlugRoute = computed(() => typeof route.params.slug === "string");

    // Dynamic page title with grid name, falling back to the public handle while resolving
    const pageTitle = computed(() => layoutStore.currentLayout?.name ?? (slug.value ? `@${slug.value}` : undefined));
    usePageTitle(pageTitle, "|");

    // Dynamic favicon from first profile tile's photo
    const profilePhotoUrl = computed(() => {
      const tiles = layoutStore.currentLayout?.tiles;
      if (!tiles) return null;
      
      const profileTile = tiles.find(tile => tile.content?.type === 'profile');
      if (!profileTile?.content) return null;
      
      const profileContent = profileTile.content as ProfileBioContent;
      return profileContent.profilePhotoUrl || null;
    });
    
    useDynamicFavicon(profilePhotoUrl);

    const addBackgroundImage = async (event: Event) => {
      if (!layoutStore.canEdit) return;
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const url = await uploadFileToUrl(file, { fileType: "images" });
        layoutStore.addBackgroundImage(url, false);
      } catch (error: unknown) {
        console.error("Failed to upload image:", error);
        alert(error instanceof Error ? error.message : "Failed to upload image. Please try again.");
      }
    };

    const embedBackground = () => {
      if (!layoutStore.canEdit) return;
      const link = prompt("Please enter an embed URL");
      if (link) {
        layoutStore.addBackgroundImage(link, true);
      }
    };

    const confirmDelete = async () => {
      if (!layoutStore.canEdit) return;
      if (!layoutStore.currentLayout) return;

      const confirmed = confirm("Are you sure you want to delete this layout?");
      if (!confirmed) return;

      await layoutStore.deleteLayout(layoutStore.currentLayout.id);
      router.push("/dashboard");
    };

    const paramToString = (value: unknown): string => {
      if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
      return typeof value === "string" ? value : "";
    };

    const setError = (title: string, message: string) => {
      errorTitle.value = title;
      errorMessage.value = message;
      error.value = true;
    };

    const loadLayoutById = async (
      requestId: number,
      layoutId: string,
      notFoundTitle = "Grid Not Found",
      notFoundMessage = "This grid could not be loaded.",
    ) => {
      await layoutStore.loadLayout(layoutId);
      if (requestId !== loadRequestId) {
        void loadCurrentRoute();
        return false;
      }
      if (!layoutStore.currentLayout) {
        setError(notFoundTitle, layoutStore.error ?? notFoundMessage);
        return false;
      }
      return true;
    };

    const loadCurrentRoute = async () => {
      const requestId = ++loadRequestId;
      const layoutId = paramToString(route.params.id);
      const routeSlug = paramToString(route.params.slug);

      isLoading.value = true;
      error.value = false;
      errorTitle.value = "Handle Not Found";
      errorMessage.value = "";
      slug.value = routeSlug;
      layoutStore.clearCurrentLayout();

      try {
        if (layoutId) {
          await loadLayoutById(requestId, layoutId);
          return;
        }

        if (!routeSlug) {
          setError("Handle Not Found", "No handle provided.");
          return;
        }

        const slugData = await getServiceFactory()
          .getUserService()
          .getSlugData(routeSlug);

        if (requestId !== loadRequestId) return;

        if (!slugData) {
          setError(
            "Handle Not Found",
            `The handle "@${routeSlug}" doesn't exist or is not currently in use.`,
          );
          return;
        }

        if (!slugData.defaultGridId) {
          setError(
            "No Default Grid",
            `@${routeSlug} hasn't set a default grid yet.`,
          );
          return;
        }

        await loadLayoutById(
          requestId,
          slugData.defaultGridId,
          "Handle Not Found",
          "An error occurred while loading this handle.",
        );
      } catch (err) {
        console.error("Error loading grid route:", err);
        setError("Handle Not Found", "An error occurred while loading this handle.");
      } finally {
        if (requestId === loadRequestId) {
          isLoading.value = false;
        }
      }
    };

    onMounted(loadCurrentRoute);

    // Apply the grid's saved theme when the layout finishes loading
    watch(
      () => layoutStore.currentLayout?.themeId,
      (themeId) => {
        themeStore.applyGridTheme(themeId);
      },
    );

    watch(
      () => [route.params.id, route.params.slug],
      loadCurrentRoute,
    );

    // Expose the switcher variant so the template can gate rendering
    const switcherVariant = SWITCHER_VARIANT;
    // Restore dark mode when leaving the grid page
    onUnmounted(() => {
      themeStore.resetToAppDefault();
    });

    return {
      layoutStore,
      rowHeight,
      isLoading,
      error,
      errorTitle,
      errorMessage,
      slug,
      isSlugRoute,
      backgroundStyle,
      addBackgroundImage,
      selectImage,
      embedBackground,
      confirmDelete,
      imageInput,
      layoutContainer,
      isDraggingOver,
      isOwner,
      switcherVariant,
    };
  },
});
</script>

<style lang="scss">
.grid-page {
  min-height: 100vh;
  background-color: var(--color-content-background);
}

.grid-page:has(.loading-state),
.grid-page:has(.error-state) {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
}

.background-image-container {
  width: 100%;
  height: 100%;
}

.background-image-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
}

.toolbar {
  position: fixed;
  z-index: var(--z-dropdown);
  bottom: 0rem;
  left: 50vw;
  transform: translate(-50%, -10%);
  /* Stack toolbar rows vertically when Option D is active */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

/* Option A: inline — wraps tile buttons + breakpoint switcher in one row */
.toolbar-with-switcher {
  display: flex;
  align-items: center;
}

.layout-container {
  padding-top: var(--spacing-2xl);
  padding-bottom: var(--spacing-4xl);
  position: relative;
  
  &.drag-over {
    .drag-overlay {
      opacity: 1;
      pointer-events: auto;
    }
  }
}

.drag-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: color-mix(in srgb, var(--color-content-background) 50%, transparent);
  backdrop-filter: blur(8px);
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--easing-ease-out);
  
  .drag-message {
    background: var(--color-tile-background);
    border: var(--tile-border-width) solid var(--color-tile-stroke);
    border-style: dashed;
    border-radius: var(--tile-border-radius);
    padding: 2rem 3rem;
    text-align: center;
    box-shadow: var(--shadow-tile-hover);
    
    svg {
      color: var(--color-text-primary);
      margin-bottom: 0.75rem;
      opacity: 0.7;
      width: 48px;
      height: 48px;
      animation: bounce 2s ease-in-out infinite;
    }
    
    p {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-text-primary);
      opacity: 0.8;
    }
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  text-align: center;
  max-width: 500px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-tile-stroke);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-state p {
  margin: 0;
  color: var(--color-content-default);
  font-size: 14px;
}

.error-icon {
  color: var(--color-content-default);
}

.error-state h1 {
  margin: 0;
  font-size: 24px;
  color: var(--color-text-primary);
}

.error-description {
  margin: 0;
  color: var(--color-content-default);
  font-size: 14px;
  line-height: 1.5;
}

.cta-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-tile-stroke);
  width: 100%;
}

.cta-text {
  margin: 0;
  font-size: 16px;
  color: var(--color-text-primary);
}

.cta-button {
  padding: var(--spacing-md) var(--spacing-xl);
  background-color: var(--primary-color);
  color: var(--color-text-primary);
  text-decoration: none;
  border-radius: var(--radius-sm);
  font-size: 15px;
  font-weight: 600;
  transition: all var(--duration-fast) var(--easing-smooth);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.cta-button:hover {
  background-color: var(--color-content-high);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.secondary-link {
  color: var(--color-content-default);
  text-decoration: none;
  font-size: 14px;
  transition: color var(--duration-fast) var(--easing-smooth);
}

.secondary-link:hover {
  color: var(--color-text-primary);
  text-decoration: underline;
}
</style>
