<template>
  <div class="background-image-container">
    <div :style="backgroundStyle" class="background-image-overlay"></div>

    <button
      v-if="isOwner"
      class="btn btn-secondary background-image-button"
      @click="selectImage"
    >
      Edit Background
    </button>

    <!-- Embed background -->
    <button
      v-if="isOwner"
      class="btn btn-secondary background-embed-button"
      @click="embedBackground"
    >
      Embed Background
    </button>

    <!-- Delete layout -->
    <button
      v-if="isOwner"
      class="btn btn-danger delete-layout-button"
      @click="confirmDelete"
    >
      🗑 Delete Layout
    </button>

    <input
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

    <div class="layout-container">
      <div class="toolbar">
        <div class="row">
          <div class="col-md-12">
            <joju-buttons />
          </div>
        </div>
      </div>
      <joju-grid :row-height="rowHeight" />
    </div>
  </div>

  <div class="devToolbar">
    <button type="button" class="devToolMenu" @click="toggleDevToolbar">
      🛠
    </button>
    <div class="content" v-show="showDevToolbar">
      <p>DEV TOOLBAR</p>
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
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { getAuth } from "firebase/auth";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import JojuGrid from "@/components/JojuGrid.vue";
import JojuButtons from "@/components/TileButtons.vue";
import { useLayoutStore } from "@/stores/layout";

export default defineComponent({
  components: {
    JojuGrid,
    JojuButtons,
  },
  setup() {
    const layoutStore = useLayoutStore();
    const rowHeight = 75;
    const auth = getAuth();
    const storage = getStorage();
    const imageInput = ref<HTMLInputElement | null>(null);
    const route = useRoute();
    const router = useRouter();

    const isOwner = computed(() => {
      const user = auth.currentUser;
      const layout = layoutStore.currentLayout;
      return user && layout && user.uid === layout.userId;
    });

    const selectImage = () => {
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

    const addBackgroundImage = async (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          alert("You must be logged in to upload an image.");
          return;
        }

        const filePath = `users/${currentUser.uid}/images/${Date.now()}_${file.name}`;
        const fileRef = storageRef(storage, filePath);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        layoutStore.addBackgroundImage(url, false);
      } catch (error) {
        console.error("Failed to upload image:", error);
        alert("Failed to upload image. Please try again.");
      }
    };

    const embedBackground = () => {
      const link = prompt("Please enter an embed URL");
      if (link) {
        layoutStore.addBackgroundImage(link, true);
      }
    };

    const confirmDelete = async () => {
      if (!layoutStore.currentLayout) return;

      const confirmed = confirm("Are you sure you want to delete this layout?");
      if (!confirmed) return;

      await layoutStore.deleteLayout(layoutStore.currentLayout.id);
      router.push("/dashboard");
    };

    const showDevToolbar = ref(false);
    const toggleDevToolbar = () => {
      showDevToolbar.value = !showDevToolbar.value;
    };

    onMounted(() => {
      const layoutId = route.params.id;
      if (layoutId) {
        layoutStore.loadLayout(layoutId as string);
      } else {
        console.error("Layout ID is missing in the route.");
      }
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
      auth,
      isOwner,
      toggleDevToolbar,
      showDevToolbar,
    };
  },
});
</script>

<style lang="scss">
.background-image-container > .background-image-button {
  position: absolute;
  top: 70px;
  left: 10px;
  display: none;
  z-index: 1;
}

.background-image-container > .background-embed-button {
  position: absolute;
  z-index: 1;
  top: 70px;
  left: 170px;
  display: none;
}

.background-image-container > .delete-layout-button {
  position: absolute;
  z-index: 1;
  top: 70px;
  right: 10px;
  display: none;
}

.background-image-container:hover > .background-image-button,
.background-image-container:hover > .background-embed-button,
.background-image-container:hover > .delete-layout-button {
  display: block;
}

.devToolbar {
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
  background-color: #ff6c6c39;
  border: solid #ffffff39 1px;
  border-radius: 8px;
}

.devToolMenu {
  background-color: #eeeeee21;
  color: #444;
  cursor: pointer;
  padding: 12px;
  border: none;
  text-align: left;
  outline: none;
  font-size: 15px;
}

.active,
.devToolMenu:hover {
  background-color: #ccc;
}

.content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.devOptions {
  background-color: #f1f1f11f;
  border-radius: 8px;
  padding: 8px;
}

.form-check-label {
  cursor: pointer;
  font-size: 12px;

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

.checkmark {
  position: absolute;
  top: 0;
  left: 0;
  height: 12px;
  width: 12px;
  margin: 0px;
  background-color: rgba(0, 255, 255, 0.158);
}

.toolbar {
  position: fixed;
  z-index: 1;
  top: 6rem;
  left: 50vw;
  transform: translate(-50%, -50%);
}

.layout-container {
  padding-top: 7rem;
}
</style>
