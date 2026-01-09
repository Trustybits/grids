<template>
  <div id="toolbarArea">
    <div class="toolbarAlpha">
      <!-- <button class="btn btn-primary me-2" @click="addTextElement">✒</button>    
      <button class="btn btn-secondary me-2" @click="selectFile">🖼</button>
      <button class="btn btn-dark me-2" @click="addLinkElement">🔗</button> -->

      <!-- {{ isDarkMode ? '☀🌑' : '🔆🌙' }} -->
      <!-- <template v-if="isDarkMode"> -->
      <button
        v-if="!isDarkMode"
        class="btn btn-secondary"
        @click="addTextElement"
      >
        ✏️<!-- <img src="/src/svgs/icons/dark-textTile.svg" /> -->
      </button>
      <!-- </template> -->
      <button v-else class="btn btn-secondary" @click="addTextElement">
        ✏️<!-- <img src="/src/svgs/icons/textTile.svg" /> -->
      </button>

      <button class="btn btn-secondary" @click="selectFile">
        📷<!-- <img src="/src/svgs/icons/imageTile.svg" /> -->
      </button>
      <button class="btn btn-secondary" @click="addLinkElement">
        🔗<!-- <img src="/src/svgs/icons/linkTile.svg" \/> -->
      </button>
      <!-- <button class="btn btn-secondary" @click="addLinkElement">📽</button>
      <button class="btn btn-secondary" @click="addLinkElement">🎵</button>
      <button class="btn btn-secondary" @click="addLinkElement">📌</button> -->
      <button class="btn btn-secondary" @click="addEmbedElement">💻</button>
      <!-- <button class="btn btn-secondary" @click="addLinkElement">➕</button> -->

      <input
        type="file"
        ref="imageInput"
        style="display: none"
        accept="image/*,video/*"
        @change.stop="addFile"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { ref } from "vue";
import { useLayoutStore } from "@/stores/layout";
import { ContentType } from "@/types/TileContent";
import { createTileContent } from "@/utils/TileUtils";
import { getAuth } from "firebase/auth";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { useThemeStore } from "@/stores/theme";
import { computed } from "vue";

export default {
  setup() {
    const themeStore = useThemeStore();
    const isDarkMode = computed(() => themeStore.isDarkMode);

    const layoutStore = useLayoutStore();
    const imageInput = ref<HTMLInputElement | null>(null);
    const auth = getAuth();
    const storage = getStorage();

    const addTextElement = () => {
      const textContent = createTileContent(ContentType.TEXT, {});
      layoutStore.addTile(textContent);
    };

    const selectFile = () => {
      imageInput.value?.click();
    };

    const addFile = async (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const maxSize = isImage ? 10 * 1024 * 1024 : 50 * 1024 * 1024; // 10MB for images, 50MB for videos

      if (!isImage && !isVideo) {
        alert("Unsupported file type. Please upload an image or video.");
        return;
      }

      if (file.size > maxSize) {
        alert(`File is too large! Maximum size: ${isImage ? "10MB" : "50MB"}`);
        return;
      }

      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          alert("You must be logged in to upload.");
          return;
        }

        // Determine storage path based on file type
        const filePath = `users/${currentUser.uid}/${
          isImage ? "images" : "videos"
        }/${Date.now()}_${file.name}`;
        const fileRef = storageRef(storage, filePath);

        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);

        const contentType = isImage ? ContentType.IMAGE : ContentType.VIDEO;
        const contentData = { src: url };

        const content = createTileContent(contentType, contentData);
        layoutStore.addTile(content);
      } catch (error) {
        console.error("File upload failed:", error);
        alert("Failed to upload file. Please try again.");
      }
    };

    const addLinkElement = () => {
      let link = prompt("Please enter a link");
      if (link) {
        const linkContent = createTileContent(ContentType.LINK, { link });
        layoutStore.addTile(linkContent);
      }
    };

    const addEmbedElement = () => {
      let link = prompt("Please enter an embed URL");
      if (link) {
        const embedContent = createTileContent(ContentType.EMBED, {
          src: link,
        });
        layoutStore.addTile(embedContent);
      }
    };

    const addOtherElement = () => {
      let link = prompt(
        "More tile types coming soon! Any others you might be expecting to see?"
      );
      if (link) {
        const linkContent = createTileContent(ContentType.LINK, {
          src: link,
        });
        layoutStore.addTile(linkContent);
      }
    };

    const updateMetaData = () => {
      layoutStore.setCookieValue(
        "showMetaData",
        layoutStore.showMetaData.toString()
      );
    };

    return {
      imageInput,
      layoutStore,
      addTextElement,
      selectFile,
      addFile,
      addLinkElement,
      addEmbedElement,
      updateMetaData,

      isDarkMode,
    };
  },
};
</script>

<style>
#toolbarArea {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.toolbarAlpha {
  /* border: 2px solid transparent; */
  width: fit-content;
  height: fit-content;
  padding: 8px;

  display: flex;
  gap: 8px;

  position: relative;
  top: -32px;
  background-color: var(--color-tile-background);
  border-radius: var(--radius-md);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  backdrop-filter: blur(20px);
}

/* .toolbarAlpha::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 32px;
    padding: 2px;
    background: linear-gradient(to bottom right, #FFFFFF66, #FFFFFF00, #FFFFFF00, #FFFFFF1A);
    mask:
      linear-gradient(#000 0 0) content-box, 
      linear-gradient(#000 0 0);
    mask-composite: exclude;
  } */

.toolbarAlpha button {
  height: 40px;
  width: 40px;
  border-radius: var(--radius-md);
  padding: 4px;
  cursor: pointer;
  font-size: 12px;
  color: white;
  border: none;
  background-color: var(--color-tile-background);

  &:hover {
    background-color: var(--color-content-low);
  }
}

.devToolbar {
  position: fixed;
  top: 20;
  right: 0;
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
    /* opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0; */
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
</style>
