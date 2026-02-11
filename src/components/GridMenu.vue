<template>
  <div class="grid-menu" ref="menuRef">
    <button
      type="button"
      class="grid-menu-button"
      :title="showMenu ? 'Close menu' : 'Open menu'"
      @click.stop="toggleMenu"
    >
      <div class="grid-menu-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 0 0 2.572-1.065Z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5" />
        </svg>
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
            label="Gravity" 
            v-model="layoutStore.verticalCompact"
          />
        </MenuSection>

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
import { getAuth } from "firebase/auth";
import { useLayoutStore } from "@/stores/layout";
import { useToastStore } from "@/stores/toast";
import { usePixelRacersStore } from "@/stores/pixelRacers";
import MenuItem from "./MenuItem.vue";
import Toggle from "./Toggle.vue";
import Accordion from "./Accordion.vue";
import MenuSection from "./MenuSection.vue";
import Divider from "./Divider.vue";

const emit = defineEmits<{
  "confirm-delete": [];
}>();

const layoutStore = useLayoutStore();
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

const confirmDelete = () => {
  emit("confirm-delete");
  showMenu.value = false;
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
</style>
