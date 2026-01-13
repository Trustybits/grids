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
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M22 10.5V12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2H13.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <path
            d="M19.7867 2.35955L20.0956 2.05059C20.6075 1.53868 21.4375 1.53868 21.9494 2.05059C22.4613 2.56249 22.4613 3.39244 21.9494 3.90435L21.6404 4.2133M19.7867 2.35955C19.7867 2.35955 19.8253 3.01609 20.4046 3.59539C20.9839 4.17468 21.6404 4.2133 21.6404 4.2133M19.7867 2.35955L16.9463 5.19996C16.7539 5.39236 16.6577 5.48853 16.575 5.59459C16.4774 5.71973 16.3937 5.85509 16.3255 5.99833C16.2676 6.11976 16.2246 6.24883 16.1385 6.50693L15.7739 7.60069M21.6404 4.2133L18.8 7.05373C18.6076 7.24609 18.5115 7.34229 18.4054 7.42503C18.2803 7.52263 18.1449 7.60629 18.0017 7.67456C17.8802 7.73243 17.7512 7.77543 17.4931 7.86146L16.3993 8.22606M15.7739 7.60069L15.6848 7.86806C15.6425 7.99506 15.6755 8.13509 15.7702 8.22979C15.8649 8.32446 16.0049 8.35753 16.132 8.31519L16.3993 8.22606M15.7739 7.60069L16.3993 8.22606"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path d="M7 14H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          <path d="M7 17.5H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <!-- <img src="/src/svgs/icons/dark-textTile.svg" /> -->
      </button>
      <!-- </template> -->
      <button v-else class="btn btn-secondary" @click="addTextElement">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M22 10.5V12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2H13.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <path
            d="M19.7867 2.35955L20.0956 2.05059C20.6075 1.53868 21.4375 1.53868 21.9494 2.05059C22.4613 2.56249 22.4613 3.39244 21.9494 3.90435L21.6404 4.2133M19.7867 2.35955C19.7867 2.35955 19.8253 3.01609 20.4046 3.59539C20.9839 4.17468 21.6404 4.2133 21.6404 4.2133M19.7867 2.35955L16.9463 5.19996C16.7539 5.39236 16.6577 5.48853 16.575 5.59459C16.4774 5.71973 16.3937 5.85509 16.3255 5.99833C16.2676 6.11976 16.2246 6.24883 16.1385 6.50693L15.7739 7.60069M21.6404 4.2133L18.8 7.05373C18.6076 7.24609 18.5115 7.34229 18.4054 7.42503C18.2803 7.52263 18.1449 7.60629 18.0017 7.67456C17.8802 7.73243 17.7512 7.77543 17.4931 7.86146L16.3993 8.22606M15.7739 7.60069L15.6848 7.86806C15.6425 7.99506 15.6755 8.13509 15.7702 8.22979C15.8649 8.32446 16.0049 8.35753 16.132 8.31519L16.3993 8.22606M15.7739 7.60069L16.3993 8.22606"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path d="M7 14H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          <path d="M7 17.5H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <!-- <img src="/src/svgs/icons/textTile.svg" /> -->
      </button>

      <button class="btn btn-secondary" @click="selectFile">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path
            d="M16 10C17.1046 10 18 9.10457 18 8C18 6.89543 17.1046 6 16 6C14.8954 6 14 6.89543 14 8C14 9.10457 14.8954 10 16 10Z"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path
            d="M5 13.307L5.81051 12.5542C6.73658 11.6941 8.18321 11.7424 9.04988 12.6623L11.6974 15.4727C12.2356 16.0439 13.1166 16.1209 13.7457 15.6516C14.6522 14.9753 15.9144 15.0522 16.7322 15.8334L19 18"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        <!-- <img src="/src/svgs/icons/imageTile.svg" /> -->
      </button>
      <button class="btn btn-secondary" @click="addLinkElement">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path
            d="M9 16C7.11438 16 6.17157 16 5.58579 15.4142C5 14.8284 5 13.8856 5 12C5 10.1144 5 9.17157 5.58579 8.58579C6.17157 8 7.11438 8 9 8C10.8856 8 11.8284 8 12.4142 8.58579C13 9.17157 13 10.1144 13 12"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M11 12C11 13.8856 11 14.8284 11.5858 15.4142C12.1716 16 13.1144 16 15 16C16.8856 16 17.8284 16 18.4142 15.4142C19 14.8284 19 13.8856 19 12C19 10.1144 19 9.17157 18.4142 8.58579C17.8284 8 16.8856 8 15 8"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <!-- <img src="/src/svgs/icons/linkTile.svg" \/> -->
      </button>
      <!-- <button class="btn btn-secondary" @click="addLinkElement">📽</button>
      <button class="btn btn-secondary" @click="addLinkElement">🎵</button>
      <button class="btn btn-secondary" @click="addLinkElement">📌</button> -->
      <button class="btn btn-secondary" @click="addEmbedElement">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M15.5 11L15.6716 11.1716C17.0049 12.5049 17.6716 13.1716 17.6716 14C17.6716 14.8284 17.0049 15.4951 15.6716 16.8284L15.5 17"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <path
            d="M13.2939 7.17041L11.9998 12L10.7058 16.8297"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <path
            d="M8.50019 7L8.32861 7.17157C6.99528 8.5049 6.32861 9.1716 6.32861 10C6.32861 10.8284 6.99528 11.4951 8.32861 12.8284L8.50019 13"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <path
            d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
      </button>
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
  padding: 6px;

  display: flex;
  gap: 4px;

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
  border-radius: var(--radius-sm);
  padding: 4px;
  cursor: pointer;
  font-size: 12px;
  color: var(--color-text-primary);
  border: none;
  background-color: var(--color-tile-background);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;

  &:hover {
    background-color: var(--color-base-55);
    color: var(--color-figma-purple);
  }
}

.toolbarAlpha button svg {
  width: 28px;
  height: 28px;
  display: block;
  flex: 0 0 auto;
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
