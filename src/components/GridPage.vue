<template>
  <div class="background-image-container">
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
              <grid-buttons />
              <BreakpointSwitcher variant="inline" />
            </div>
            <grid-buttons v-else />
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
      <grid :row-height="rowHeight" />
    </div>
  </div>

</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import Grid from "@/components/Grid.vue";
import GridButtons from "@/components/TileButtons.vue";
import BreakpointSwitcher from "@/components/BreakpointSwitcher.vue";
import { useLayoutStore } from "@/stores/layout";
import { usePageTitle } from "@/composables/usePageTitle";
import { useDynamicFavicon } from "@/composables/useDynamicFavicon";
import { useDragAndPaste } from "@/composables/useDragAndPaste";
import { useFileUpload } from "@/composables/useFileUpload";
import { useThemeStore } from "@/stores/theme";

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
  },
  setup() {
    const layoutStore = useLayoutStore();
    const themeStore = useThemeStore();
    const rowHeight = 75;
    const imageInput = ref<HTMLInputElement | null>(null);
    const layoutContainer = ref<HTMLElement | null>(null);
    const route = useRoute();
    const router = useRouter();

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

    // Dynamic page title with grid name
    const gridName = computed(() => layoutStore.currentLayout?.name);
    usePageTitle(gridName, '|');

    // Dynamic favicon from first profile tile's photo
    const profilePhotoUrl = computed(() => {
      const tiles = layoutStore.currentLayout?.tiles;
      if (!tiles) return null;
      
      const profileTile = tiles.find(tile => tile.content?.type === 'profile');
      if (!profileTile?.content) return null;
      
      const profileContent = profileTile.content as any;
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
      } catch (error: any) {
        console.error("Failed to upload image:", error);
        alert(error.message || "Failed to upload image. Please try again.");
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

    onMounted(() => {
      const layoutId = route.params.id;
      if (layoutId) {
        layoutStore.loadLayout(layoutId as string);
      } else {
        console.error("Layout ID is missing in the route.");
      }
    });

    // Apply the grid's saved theme when the layout finishes loading
    watch(
      () => layoutStore.currentLayout?.themeId,
      (themeId) => {
        themeStore.applyGridTheme(themeId);
      },
    );

    watch(
      () => route.params.id,
      (newId) => {
        if (newId) {
          layoutStore.loadLayout(newId as string);
        }
      }
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
</style>
