<template>
  <div class="grid-menu">
    <button type="button" class="grid-menu-toggle" @click="toggleMenu">
      ⚙️
    </button>
    <div class="grid-menu-content" v-show="showMenu">
      <div class="grid-menu-section" v-if="isOwner">
        <h3 class="grid-menu-title">Layout Options</h3>
        <button
          class="btn btn-secondary grid-menu-button"
          @click="selectImage"
        >
          Edit Background
        </button>
        <button
          class="btn btn-secondary grid-menu-button"
          @click="embedBackground"
        >
          Embed Background
        </button>
        <button
          class="btn btn-danger grid-menu-button"
          @click="confirmDelete"
        >
          🗑 Delete Layout
        </button>
      </div>
      <div class="grid-menu-section">
        <h3 class="grid-menu-title">Debug</h3>
        <div class="devOptions">
          <label class="form-check-label">
            <input
              type="checkbox"
              class="form-check-input"
              v-model="layoutStore.showMetaData"
            />
            Metadata
          </label>
        </div>
      </div>
    </div>
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
  right: 0px;
  top: 0px;
  transform: translate(-2px, 200px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  align-items: center;
  height: auto;
  backdrop-filter: blur(20px);
  padding: 8px;
  background-color: rgba(108, 108, 255, 0.22);
  border: solid rgba(255, 255, 255, 0.22) 1px;
  border-radius: 8px;
  z-index: 1000;
}

.grid-menu-toggle {
  background-color: rgba(238, 238, 238, 0.13);
  color: #444;
  cursor: pointer;
  padding: 12px;
  border: none;
  text-align: center;
  outline: none;
  font-size: 15px;
  border-radius: 4px;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(204, 204, 204, 0.5);
  }
}

.grid-menu-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 200px;
  margin-top: 8px;
}

.grid-menu-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.grid-menu-title {
  font-size: 12px;
  font-weight: bold;
  margin: 0;
  padding: 4px 0;
  text-transform: uppercase;
  opacity: 0.7;
}

.grid-menu-button {
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  font-size: 14px;
}

.devOptions {
  background-color: rgba(241, 241, 241, 0.12);
  border-radius: 8px;
  padding: 8px;
}

.form-check-label {
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;

  input {
    position: relative;
    background-color: rgba(0, 0, 0, 0.103);
    height: 18px;
    width: 18px;
    border: solid rgba(255, 255, 255, 0.527) 2px;
    border-radius: 4px !important;
    margin: 0px;
  }
}
</style>
