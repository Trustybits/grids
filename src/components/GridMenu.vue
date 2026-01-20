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
        <!-- Share Grid Button -->
        <div class="grid-menu-section">
          <button class="grid-menu-item" @click="shareGrid">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="margin-right: 8px; display: inline-block; vertical-align: middle;">
              <path d="M4 12V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M16 6L12 2L8 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 2V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Share Grid
          </button>
        </div>

        <!-- Gravity Toggle -->
        <div class="grid-menu-section">
          <label class="grid-menu-toggle-row">
            <span>Gravity</span>
            <div class="toggle-switch" :class="{ 'toggle-switch--checked': layoutStore.verticalCompact }">
              <input
                type="checkbox"
                class="toggle-input"
                :checked="layoutStore.verticalCompact"
                @change="(e) => layoutStore.setVerticalCompact((e.target as HTMLInputElement).checked)"
              />
              <span class="toggle-slider"></span>
            </div>
          </label>
        </div>

        <div class="grid-menu-section" v-if="isOwner">
          <!-- <button class="grid-menu-item" @click="selectImage">Edit Background</button>
          <button class="grid-menu-item" @click="embedBackground">Embed Background</button> -->
          <button class="grid-menu-item grid-menu-item--danger" @click="confirmDelete">Delete Layout</button>
        </div>

        <!-- Debug Accordion -->
        <div class="grid-menu-divider"></div>
        <div class="grid-menu-section">
          <button class="grid-menu-accordion-header" @click.stop="toggleDebug">
            <span>Debug</span>
            <svg 
              class="accordion-icon" 
              :class="{ 'accordion-icon--open': debugExpanded }"
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <Transition name="accordion">
            <div v-if="debugExpanded" class="grid-menu-accordion-content">
            <label class="grid-menu-toggle-row">
              <span>Metadata</span>
              <div class="toggle-switch" :class="{ 'toggle-switch--checked': layoutStore.showMetaData }">
                <input
                  type="checkbox"
                  class="toggle-input"
                  v-model="layoutStore.showMetaData"
                />
                <span class="toggle-slider"></span>
              </div>
            </label>
            </div>
          </Transition>
        </div>
      </div>
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted } from "vue";
import { getAuth } from "firebase/auth";
import { useLayoutStore } from "@/stores/layout";
import { useToastStore } from "@/stores/toast";

export default defineComponent({
  name: "GridMenu",
  emits: ["select-image", "embed-background", "confirm-delete"],
  setup(props, { emit }) {
    const layoutStore = useLayoutStore();
    const toastStore = useToastStore();
    const auth = getAuth();
    const showMenu = ref(false);
    const debugExpanded = ref(false);
    const menuRef = ref<HTMLElement | null>(null);

    const isOwner = computed(() => {
      const user = auth.currentUser;
      const layout = layoutStore.currentLayout;
      return user && layout && user.uid === layout.userId;
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

    const selectImage = () => {
      emit("select-image");
      showMenu.value = false;
    };

    const embedBackground = () => {
      emit("embed-background");
      showMenu.value = false;
    };

    const confirmDelete = () => {
      emit("confirm-delete");
      showMenu.value = false;
    };

    const toggleDebug = () => {
      debugExpanded.value = !debugExpanded.value;
    };

    const shareGrid = async () => {
      const currentUrl = window.location.href;
      try {
        await navigator.clipboard.writeText(currentUrl);
        toastStore.addToast('Grid URL copied to clipboard!', 'success');
      } catch (err) {
        toastStore.addToast('Failed to copy URL', 'error');
      }
      showMenu.value = false;
    };

    return {
      layoutStore,
      isOwner,
      showMenu,
      debugExpanded,
      menuRef,
      toggleMenu,
      selectImage,
      embedBackground,
      confirmDelete,
      toggleDebug,
      shareGrid,
    };
  },
});
</script>

<style lang="scss" scoped>
.grid-menu {
  position: fixed;
  bottom: calc(var(--spacing-md) + 48px);
  left: var(--spacing-md);
  z-index: var(--z-fixed);
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

  &:hover {
    background: var(--color-base-34);

    .grid-menu-icon {
      color: var(--color-figma-purple);
    }
  }

  .grid-menu-dropdown {
    position: absolute;
    bottom: -4px;
    left: 48px;
    background: var(--color-tile-background);
    border: var(--tile-border-width) solid var(--color-tile-stroke);
    border-radius: var(--radius-md);
    padding: var(--spacing-xs);
    min-width: 200px;
    box-shadow: var(--shadow-lg);
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .grid-menu-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .grid-menu-title {
    font-size: 12px;
    font-weight: bold;
    margin: 0;
    padding: 4px 0;
    text-transform: uppercase;
    opacity: 0.7;
  }

  .grid-menu-item {
    display: flex;
    align-items: center;
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

    &--danger:hover {
      background-color: var(--color-figma-red);
      color: var(--color-base-100);
    }
  }

  .grid-menu-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--color-text-primary);

    &:hover:not(&--disabled) {
      background-color: var(--color-base-34);
    }

    &--disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }

  .grid-menu-accordion-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--spacing-sm);
    background: transparent;
    border: none;
    color: var(--color-text-primary);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: background-color var(--duration-fast) var(--easing-smooth);
    font-family: var(--font-family-base);
    font-size: var(--font-size-sm);
    font-weight: 500;
    text-align: left;

    &:hover {
      background-color: var(--color-base-34);
    }

    .accordion-icon {
      transition: transform var(--duration-fast) var(--easing-smooth);
      color: var(--color-content-default);

      &--open {
        transform: rotate(180deg);
      }
    }
  }

  .grid-menu-accordion-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding-left: var(--spacing-sm);
    overflow: hidden;
  }

  .grid-menu-divider {
    height: 1px;
    background-color: var(--color-tile-stroke);
    opacity: 0.3;
    margin: var(--spacing-xs) 0;
  }

  .toggle-switch {
    position: relative;
    width: 36px;
    height: 20px;
    flex-shrink: 0;

    .toggle-input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }

    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: var(--color-base-34);
      transition: var(--duration-fast);
      border-radius: 20px;

      &:before {
        position: absolute;
        content: "";
        height: 14px;
        width: 14px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: var(--duration-fast);
        border-radius: 50%;
      }
    }

    &--checked .toggle-slider {
      background-color: var(--color-figma-purple);

      &:before {
        transform: translateX(16px);
      }
    }

    &--disabled {
      .toggle-slider {
        cursor: not-allowed;
        opacity: 0.5;
      }
    }
  }
}

.accordion-enter-active,
.accordion-leave-active {
  transition: all 0.3s ease;
  max-height: 200px;
}

.accordion-enter-from,
.accordion-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
