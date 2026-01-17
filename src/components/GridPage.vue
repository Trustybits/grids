<template>
  <div class="background-image-container">
    <div :style="backgroundStyle" class="background-image-overlay"></div>

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
            <grid-buttons />
          </div>
        </div>
      </div>
      <grid :row-height="rowHeight" />
    </div>
  </div>

  <GridMenu
    @select-image="selectImage"
    @embed-background="embedBackground"
    @confirm-delete="confirmDelete"
  />
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

import Grid from "@/components/Grid.vue";
import GridButtons from "@/components/TileButtons.vue";
import GridMenu from "@/components/GridMenu.vue";
import { useLayoutStore } from "@/stores/layout";

export default defineComponent({
  components: {
    Grid,
    GridButtons,
    GridMenu,
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
}

.layout-container {
  padding-top: 7rem;
}
</style>
