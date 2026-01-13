<template>
  <div class="grid-menu">
    <button
      type="button"
      class="grid-menu-button"
      :title="showMenu ? 'Close menu' : 'Open menu'"
      @click="toggleMenu"
      @blur="handleBlur"
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

      <div class="grid-menu-dropdown" v-if="showMenu">
        <div class="grid-menu-section" v-if="isOwner">
          <h3 class="grid-menu-title">Layout Options</h3>
          <button class="grid-menu-item" @click="selectImage">Edit Background</button>
          <button class="grid-menu-item" @click="embedBackground">Embed Background</button>
          <button class="grid-menu-item grid-menu-item--danger" @click="confirmDelete">Delete Layout</button>
        </div>

        <div class="grid-menu-section">
          <h3 class="grid-menu-title">Debug</h3>
          <label class="grid-menu-toggle-row">
            <input
              type="checkbox"
              class="grid-menu-checkbox"
              v-model="layoutStore.showMetaData"
            />
            <span>Metadata</span>
          </label>
        </div>
      </div>
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from "vue";
import { getAuth } from "firebase/auth";
import { useLayoutStore } from "@/stores/layout";

export default defineComponent({
  name: "GridMenu",
  emits: ["select-image", "embed-background", "confirm-delete"],
  setup(props, { emit }) {
    const layoutStore = useLayoutStore();
    const auth = getAuth();
    const showMenu = ref(false);

    const isOwner = computed(() => {
      const user = auth.currentUser;
      const layout = layoutStore.currentLayout;
      return user && layout && user.uid === layout.userId;
    });

    const toggleMenu = () => {
      showMenu.value = !showMenu.value;
    };

    const handleBlur = () => {
      setTimeout(() => {
        showMenu.value = false;
      }, 200);
    };

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

    return {
      layoutStore,
      isOwner,
      showMenu,
      toggleMenu,
      handleBlur,
      selectImage,
      embedBackground,
      confirmDelete,
    };
  },
});
</script>

<style lang="scss">
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

.grid-menu-button:hover {
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
}

.grid-menu-item:hover {
  background-color: var(--color-base-34);
}

.grid-menu-item--danger:hover {
  background-color: var(--color-figma-red);
  color: var(--color-base-100);
}

.grid-menu-toggle-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-primary);
}

.grid-menu-toggle-row:hover {
  background-color: var(--color-base-34);
}

.grid-menu-checkbox {
  position: relative;
  height: 18px;
  width: 18px;
  margin: 0;
}
</style>
