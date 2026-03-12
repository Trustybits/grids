<template>
  <div class="grid-menu" ref="menuRef">
    <button
      type="button"
      class="grid-menu-button"
      @click.stop="toggleMenu"
    >
      <div class="grid-menu-icon">
        <GridMenuIcon />
      </div>

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
        </MenuSection>

        <!-- Breakpoint Layout -->
        <MenuSection v-if="isOwner && layoutStore.activeBreakpoint !== 'lg'">
          <div class="breakpoint-section">
            <span class="breakpoint-label">
              {{ layoutStore.activeBreakpoint === 'sm' ? 'Mobile' : 'Tablet' }} Layout
            </span>
            <MenuItem v-if="!hasOverride" @click="saveBreakpoint">
              Save {{ layoutStore.activeBreakpoint === 'sm' ? 'Mobile' : 'Tablet' }} Layout
            </MenuItem>
            <template v-else>
              <MenuItem @click="saveBreakpoint">
                Update Layout
              </MenuItem>
              <MenuItem danger @click="resetBreakpoint">
                Reset to Auto
              </MenuItem>
            </template>
          </div>
        </MenuSection>
        <Divider v-if="isOwner && layoutStore.activeBreakpoint !== 'lg'" />

        <!-- Owner Actions -->
        <MenuSection v-if="isOwner">
          <MenuItem danger @click="confirmDelete">
            Delete Grid
          </MenuItem>
        </MenuSection>

        <!-- Debug -->
        <Divider />
        <MenuSection>
          <Accordion title="Debug" class="debug-accordion">
            <Toggle 
              label="Metadata" 
              v-model="layoutStore.showMetaData"
            />
            <MenuItem @click="launchPixelRacers">
              🏍️ Pixel Racers
            </MenuItem>
          </Accordion>
        </MenuSection>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { getAuth } from "firebase/auth";
import { useLayoutStore } from "@/stores/layout";
import { useThemeStore } from "@/stores/theme";
import { useToastStore } from "@/stores/toast";
import { usePixelRacersStore } from "@/stores/pixelRacers";
import MenuItem from "./MenuItem.vue";
import Toggle from "./Toggle.vue";
import Accordion from "./Accordion.vue";
import MenuSection from "./MenuSection.vue";
import Divider from "./Divider.vue";
import GridMenuIcon from "./icons/GridMenuIcon.vue";

const router = useRouter();
const layoutStore = useLayoutStore();
const themeStore = useThemeStore();
const toastStore = useToastStore();
const gameStore = usePixelRacersStore();
const auth = getAuth();
const showMenu = ref(false);
const menuRef = ref<HTMLElement | null>(null);

const isOwner = computed(() => {
  const user = auth.currentUser;
  const layout = layoutStore.currentLayout;
  return user && layout && user.uid === layout.userId;
});

const gridPageId = computed(() => {
  return layoutStore.currentLayout?.id || '';
});

// Computed property with setter to handle gravity toggle
const verticalCompact = computed({
  get: () => layoutStore.verticalCompact,
  set: (value: boolean) => layoutStore.setVerticalCompact(value)
});

// Computed property with setter to handle dark mode toggle for the grid
const isDarkMode = computed({
  get: () => themeStore.isDarkMode,
  set: (value: boolean) => {
    const newThemeId = value ? 'dark' : 'light';
    themeStore.setTheme(newThemeId);
    layoutStore.setGridTheme(newThemeId);
  }
});

const toggleMenu = () => {
  showMenu.value = !showMenu.value;
};

// Click outside to close menu
const handleClickOutside = (event: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    showMenu.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

const hasOverride = computed(() => {
  return layoutStore.hasBreakpointOverride(layoutStore.activeBreakpoint);
});

const saveBreakpoint = () => {
  const bp = layoutStore.activeBreakpoint;
  if (bp === 'lg') return;

  // Use the display positions published by Grid.vue — these reflect the
  // actual rendered positions at the current breakpoint (auto-repacked or
  // previously saved overrides after user edits).
  const positions = layoutStore.displayPositions;
  if (!positions.length) return;

  layoutStore.saveBreakpointPositions(bp, positions);
  toastStore.addToast(
    `${bp === 'sm' ? 'Mobile' : 'Tablet'} layout saved`,
    'success'
  );
  showMenu.value = false;
};

const resetBreakpoint = () => {
  const bp = layoutStore.activeBreakpoint;
  if (bp === 'lg') return;
  layoutStore.resetBreakpoint(bp);
  toastStore.addToast(
    `${bp === 'sm' ? 'Mobile' : 'Tablet'} layout reset to auto`,
    'success'
  );
  showMenu.value = false;
};

// Handle grid deletion directly — no need to bubble up through parent components
const confirmDelete = async () => {
  if (!layoutStore.isOwner || !layoutStore.currentLayout) return;

  const confirmed = confirm("Are you sure you want to delete this layout?");
  if (!confirmed) return;

  await layoutStore.deleteLayout(layoutStore.currentLayout.id);
  showMenu.value = false;
  router.push("/dashboard");
};

const shareGrid = async () => {
  const currentUrl = window.location.href;
  try {
    await navigator.clipboard.writeText(currentUrl);
    toastStore.addToast('Link to Grid copied to the clipboard', 'success');
  } catch (err) {
    toastStore.addToast('Failed to copy link', 'error');
  }
  showMenu.value = false;
};

// Launch the Pixel Racers game
const launchPixelRacers = () => {
  gameStore.startGame();
  showMenu.value = false;
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
  color: var(--color-content-default);
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
    background-color: var(--color-base-34);
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
</style>
