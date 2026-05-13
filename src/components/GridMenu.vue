<template>
  <div
    class="grid-menu"
    ref="menuRef"
    :data-tooltip="showMenu ? null : 'Grid Menu'"
  >
    <button type="button" class="grid-menu-button" @click.stop="toggleMenu">
      <div class="grid-menu-icon">
        <GridMenuIcon />
      </div>
    </button>

    <div class="grid-menu-dropdown" v-if="showMenu" @click.stop>
      <!-- Grid Page ID -->
      <MenuSection>
        <div class="grid-page-info" @click="shareGrid">
          <span class="grid-page-label">Grid Page:</span>
          <span class="grid-page-id">{{ gridPageId }}</span>
        </div>
      </MenuSection>
      <Divider />
      <!-- Settings -->
      <MenuSection>
        <Toggle
          label="Dark Mode"
          v-model="isDarkMode"
          tooltip="Toggle between dark and light theme for this grid"
        />
        <Toggle
          label="Gravity"
          v-model="verticalCompact"
          tooltip="When enabled, tiles automatically move up to fill empty space"
        />
        <Toggle
          v-if="isOwner"
          label="Allow Public Template"
          v-model="duplicatable"
          tooltip="When enabled, anyone can duplicate this grid's structure as a template"
        />
      </MenuSection>

      <!-- Breakpoint Layout -->
      <template v-if="isOwner && layoutStore.activeBreakpoint !== 'lg'">
        <MenuSection>
          <div class="breakpoint-section">
            <span class="breakpoint-label">{{ breakpointLabel }} Layout</span>
            <MenuItem v-if="!hasOverride" @click="saveBreakpoint">
              Save {{ breakpointLabel }} Layout
            </MenuItem>
            <template v-else>
              <MenuItem @click="saveBreakpoint"> Update Layout </MenuItem>
              <MenuItem danger @click="resetBreakpoint"> Reset to Auto </MenuItem>
            </template>
          </div>
        </MenuSection>
        <Divider />
      </template>

      <!-- Owner Actions -->
      <MenuSection v-if="isOwner">
        <GhostSplitButton
          ref="bgSplitRef"
          :open="showBgDropdown"
          @update:open="showBgDropdown = $event"
          @main-click="triggerBackgroundImagePicker"
        >
          <template #main>
            {{ hasBackgroundImage ? 'Change Background Image' : 'Add Background Image' }}
            <span class="beta-badge">BETA</span>
          </template>
          <template #dropdown>
            <button
              class="ghost-split-dropdown-item"
              @click="openBgColorPicker"
            >
              Change Background Color
            </button>
            <button
              v-if="hasBackgroundImage"
              class="ghost-split-dropdown-item ghost-split-dropdown-item--danger"
              @click="removeBackgroundImage"
            >
              Remove Background Image
            </button>
            <button
              v-if="hasBackgroundColor"
              class="ghost-split-dropdown-item ghost-split-dropdown-item--danger"
              @click="removeBackgroundColor"
            >
              Remove Background Color
            </button>
          </template>
        </GhostSplitButton>

        <input
          type="file"
          ref="bgImageInput"
          style="display: none"
          accept="image/*,image/svg+xml"
          @change.stop="handleBackgroundImageUpload"
        />

        <ColorPicker
          v-if="showBgColorPicker"
          :buttonEl="bgChevronEl"
          :onColorChange="handleBackgroundColorChange"
        />

        <GhostSplitButton
          :open="showDuplicateDropdown"
          @update:open="showDuplicateDropdown = $event"
          @main-click="duplicateGrid('full')"
        >
          <template #main>Duplicate Grid</template>
          <template #dropdown>
            <button
              class="ghost-split-dropdown-item"
              @click="duplicateGrid('structure')"
            >
              Structure Only
            </button>
          </template>
        </GhostSplitButton>
        <MenuItem danger @click="confirmDelete"> Delete Grid </MenuItem>
      </MenuSection>

      <!-- Debug -->
      <Divider />
      <MenuSection>
        <Accordion title="Debug" class="debug-accordion">
          <Toggle
            label="Metadata"
            :modelValue="layoutStore.showMetaData"
            @update:modelValue="layoutStore.setShowMetaData"
            tooltip="Show compact metadata on each tile"
          />
          <Toggle
            label="Verbose Metadata"
            :modelValue="layoutStore.showMetaDataVerbose"
            @update:modelValue="layoutStore.setShowMetaDataVerbose"
            tooltip="Show extended debug metadata details"
          />
          <MenuItem @click="launchPixelRacers"> 🏍️ Pixel Racers </MenuItem>
        </Accordion>
      </MenuSection>
    </div>

    <PromptModal
      :show="showDeleteModal"
      :title="`Delete ${currentLayoutName}`"
      :description='`Enter "${currentLayoutName}" exactly to confirm deletion.`'
      :placeholder="currentLayoutName"
      :require-match="currentLayoutName"
      confirm-label="Delete"
      variant="danger"
      @close="showDeleteModal = false"
      @confirm="deleteGrid"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { useLayoutStore } from "@/stores/layout";
import type { CopyDepth } from "@/types/Layout";
import { useThemeStore } from "@/stores/theme";
import { useToastStore } from "@/stores/toast";
import { usePixelRacersStore } from "@/stores/pixelRacers";
import MenuItem from "./MenuItem.vue";
import Toggle from "./Toggle.vue";
import Accordion from "./Accordion.vue";
import MenuSection from "./MenuSection.vue";
import Divider from "./Divider.vue";
import GridMenuIcon from "./icons/GridMenuIcon.vue";
import GhostSplitButton from "./GhostSplitButton.vue";
import ColorPicker from "./ColorPicker.vue";
import PromptModal from "./modal/PromptModal.vue";
import { useFileUpload } from "@/composables/useFileUpload";

const router = useRouter();
const layoutStore = useLayoutStore();
const themeStore = useThemeStore();
const toastStore = useToastStore();
const gameStore = usePixelRacersStore();
const authProvider = getAuthProvider();
const showMenu = ref(false);
const showDuplicateDropdown = ref(false);
const menuRef = ref<HTMLElement | null>(null);
const showBgDropdown = ref(false);
const showBgColorPicker = ref(false);
const showDeleteModal = ref(false);
const bgImageInput = ref<HTMLInputElement | null>(null);
const bgSplitRef = ref<InstanceType<typeof GhostSplitButton> | null>(null);
const bgChevronEl = computed(() => bgSplitRef.value?.chevronRef ?? null);
const { uploadFileToUrl } = useFileUpload();

const isOwner = computed(() => {
  const userId = authProvider.getCurrentUserId();
  const layout = layoutStore.currentLayout;
  return userId && layout && userId === layout.userId;
});

const gridPageId = computed(() => {
  return layoutStore.currentLayout?.id || "";
});

const hasBackgroundImage = computed(() => {
  return !!layoutStore.currentLayout?.backgroundImageSrc;
});

const hasBackgroundColor = computed(() => {
  return !!layoutStore.currentLayout?.backgroundColor;
});

const currentLayoutName = computed(() => {
  return layoutStore.currentLayout?.name?.trim() || "Untitled Grid";
});

// Computed property with setter to handle gravity toggle
const verticalCompact = computed({
  get: () => layoutStore.verticalCompact,
  set: (value: boolean) => layoutStore.setVerticalCompact(value),
});

// Computed property with setter to handle dark mode toggle for the grid
const isDarkMode = computed({
  get: () => themeStore.isDarkMode,
  set: (value: boolean) => {
    const newThemeId = value ? "dark" : "light";
    themeStore.setTheme(newThemeId);
    layoutStore.setGridTheme(newThemeId);
  },
});

watch(showBgDropdown, (open) => {
  if (open) {
    showBgColorPicker.value = false;
    showDuplicateDropdown.value = false;
  }
});
watch(showBgColorPicker, (open) => {
  if (open) {
    showBgDropdown.value = false;
    showDuplicateDropdown.value = false;
  }
});
watch(showDuplicateDropdown, (open) => {
  if (open) {
    showBgDropdown.value = false;
    showBgColorPicker.value = false;
  }
});

const toggleMenu = () => {
  showMenu.value = !showMenu.value;
};

const closeMenu = () => {
  showMenu.value = false;
  showBgDropdown.value = false;
  showBgColorPicker.value = false;
  showDuplicateDropdown.value = false;
};

const handleClickOutside = (event: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    closeMenu();
  }
};

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});

const hasOverride = computed(() => {
  return layoutStore.hasBreakpointOverride(layoutStore.activeBreakpoint);
});

const breakpointLabel = computed(() =>
  layoutStore.activeBreakpoint === "sm" ? "Mobile" : "Tablet",
);

const saveBreakpoint = () => {
  const bp = layoutStore.activeBreakpoint;
  if (bp === "lg") return;

  // Use the display positions published by Grid.vue — these reflect the
  // actual rendered positions at the current breakpoint (auto-repacked or
  // previously saved overrides after user edits).
  const positions = layoutStore.displayPositions;
  if (!positions.length) return;

  layoutStore.saveBreakpointPositions(bp, positions);
  toastStore.addToast(`${breakpointLabel.value} layout saved`, "success");
  closeMenu();
};

const resetBreakpoint = () => {
  const bp = layoutStore.activeBreakpoint;
  if (bp === "lg") return;
  layoutStore.resetBreakpoint(bp);
  toastStore.addToast(
    `${breakpointLabel.value} layout reset to auto`,
    "success",
  );
  closeMenu();
};

// Computed property with setter to handle the public duplication toggle
const duplicatable = computed({
  get: () => layoutStore.currentLayout?.duplicatable ?? false,
  set: (value: boolean) => layoutStore.setDuplicatable(value),
});

// Duplicate the current grid and navigate to the new copy.
// copyDepth controls how much tile content is carried over.
const duplicateGrid = async (copyDepth: CopyDepth = "full") => {
  if (!layoutStore.currentLayout) return;

  const newId = await layoutStore.duplicateLayout(
    layoutStore.currentLayout,
    copyDepth,
  );
  closeMenu();
  if (newId) {
    router.push(`/grid/${newId}`);
  }
};

const confirmDelete = () => {
  if (!layoutStore.isOwner || !layoutStore.currentLayout) return;
  showDeleteModal.value = true;
  closeMenu();
};

// Handle grid deletion directly — no need to bubble up through parent components
const deleteGrid = async () => {
  if (!layoutStore.isOwner || !layoutStore.currentLayout) return;

  await layoutStore.deleteLayout(layoutStore.currentLayout.id);
  showDeleteModal.value = false;
  closeMenu();
  router.push("/dashboard");
};

const triggerBackgroundImagePicker = () => {
  bgImageInput.value?.click();
};

const handleBackgroundImageUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const url = await uploadFileToUrl(file, { fileType: "images" });
    layoutStore.addBackgroundImage(url, false);
  } catch (error: unknown) {
    console.error("Failed to upload background image:", error);
    toastStore.addToast(
      error instanceof Error ? error.message : "Failed to upload image",
      "error",
    );
  }
  if (bgImageInput.value) bgImageInput.value.value = "";
};

const openBgColorPicker = () => {
  showBgDropdown.value = false;
  showBgColorPicker.value = true;
};

const handleBackgroundColorChange = (color: string) => {
  layoutStore.setBackgroundColor(color);
  showBgColorPicker.value = false;
};

const removeBackgroundImage = () => {
  layoutStore.removeBackgroundImage();
  showBgDropdown.value = false;
};

const removeBackgroundColor = () => {
  layoutStore.removeBackgroundColor();
  showBgDropdown.value = false;
};

const shareGrid = async () => {
  const currentUrl = window.location.href;
  try {
    await navigator.clipboard.writeText(currentUrl);
    toastStore.addToast("Link to Grid copied to the clipboard", "success");
  } catch {
    toastStore.addToast("Failed to copy link", "error");
  }
  closeMenu();
};

// Launch the Pixel Racers game
const launchPixelRacers = () => {
  gameStore.startGame();
  closeMenu();
};
</script>

<style lang="scss" scoped>
.grid-menu {
  position: relative;
}

.grid-menu-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: none;
  cursor: pointer;
  color: var(--color-text-primary);
  transition: all var(--duration-fast) var(--easing-smooth);
  padding: 0;
  border: none;
  line-height: 0;

  &:hover {
    background: var(--color-base-34);

    .grid-menu-icon {
      color: var(--color-figma-purple);
    }
  }
}

.grid-menu-icon {
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
    display: block;
  }
}

.grid-menu-dropdown {
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
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.grid-page-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  padding: var(--spacing-sm);
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-smooth);
  font-family: var(--font-family-base);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  min-height: 40px;

  &:hover {
    background-color: var(--color-input-edit);
  }

  .grid-page-label {
    color: var(--color-content-low);
    white-space: nowrap;
  }

  .grid-page-id {
    color: var(--color-content-low);
    word-break: break-all;
    font-family: var(--font-family-mono, monospace);
    white-space: nowrap;
  }
  .accordion_header {
    margin-top: var(--spacing-xs);
    color: var(--color-content-low);
  }
}

.breakpoint-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.breakpoint-label {
  font-size: var(--font-size-sm);
  color: var(--color-content-low);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-weight: 500;
}

.beta-badge {
  font-size: 10px;
  font-weight: 800;
  color: var(--color-red);
  margin-left: 4px;
}
</style>
