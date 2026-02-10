<template>
  <div id="toolbarArea">
    <div class="toolbarAlpha">
      <!-- <button class="btn btn-primary me-2" @click="addTextElement">✒</button>    
      <button class="btn btn-secondary me-2" @click="selectFile">🖼</button>
      <button class="btn btn-dark me-2" @click="addLinkElement">🔗</button> -->

      <!-- {{ isDarkMode ? '☀🌑' : '🔆🌙' }} -->
      <!-- <template v-if="isDarkMode"> -->
      <button class="btn btn-secondary" @click="addTextElement">
        <TextIcon />
      </button>

      <button class="btn btn-secondary" @click="addProfileElement">
        <ProfileIcon />
      </button>

      <button class="btn btn-secondary" @click="addChatElement">
        <ChatIcon />
      </button>

      <button class="btn btn-secondary" @click="selectFile">
        <ImageIcon />
      </button>
      <button class="btn btn-secondary" @click="addLinkElement">
        <LinkIcon />
      </button>
      <!-- <button class="btn btn-secondary" @click="addLinkElement">📽</button>
      <button class="btn btn-secondary" @click="addLinkElement">🎵</button>
      <button class="btn btn-secondary" @click="addLinkElement">📌</button> -->
      <button class="btn btn-secondary" @click="addEmbedElement">
        <EmbedIcon />
      </button>
      <button class="btn btn-secondary" @click="addMapElement">
        <MapIcon />
      </button>
      <button class="btn btn-secondary" @click="addCampfireElement">
        <CampfireIcon />
      </button>
      <!-- <button class="btn btn-secondary" @click="addRPGElement">
        <RPGIcon />
      </button> -->
      <!-- <button class="btn btn-secondary" @click="addLinkElement">➕</button> -->

      <input
        type="file"
        ref="imageInput"
        style="display: none"
        accept="image/*,video/*"
        @change.stop="addFile"
      />
    </div>

    <!-- Modals -->
    <AddLinkModal
      :show="showLinkModal"
      @close="closeLinkModal"
      @add="handleAddLink"
    />
    <AddEmbedModal
      :show="showEmbedModal"
      @close="closeEmbedModal"
      @add="handleAddEmbed"
    />
    <AddMapModal
      :show="showMapModal"
      @close="closeMapModal"
      @add="handleAddMap"
    />
  </div>
</template>

<script lang="ts">
import { ref } from "vue";
import { useLayoutStore } from "@/stores/layout";
import { ContentType } from "@/types/TileContent";
import { createTileContent, createTileContentFromEmbedUrl } from "@/utils/TileUtils";
import { getAuth } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { useThemeStore } from "@/stores/theme";
import { computed } from "vue";
import AddLinkModal from "./AddLinkModal.vue";
import AddEmbedModal from "./AddEmbedModal.vue";
import AddMapModal from "./AddMapModal.vue";
import TextIcon from "./icons/TextIcon.vue";
import ChatIcon from "./icons/ChatIcon.vue";
import ImageIcon from "./icons/ImageIcon.vue";
import LinkIcon from "./icons/LinkIcon.vue";
import EmbedIcon from "./icons/EmbedIcon.vue";
import ProfileIcon from "./icons/ProfileIcon.vue";
import MapIcon from "./icons/MapIcon.vue";
import CampfireIcon from "./icons/CampfireIcon.vue";
import RPGIcon from "./icons/RPGIcon.vue";

export default {
  components: {
    AddLinkModal,
    AddEmbedModal,
    AddMapModal,
    TextIcon,
    ChatIcon,
    ImageIcon,
    LinkIcon,
    EmbedIcon,
    ProfileIcon,
    MapIcon,
    CampfireIcon,
    RPGIcon,
  },
  setup() {
    const themeStore = useThemeStore();
    const isDarkMode = computed(() => themeStore.isDarkMode);

    const layoutStore = useLayoutStore();
    const imageInput = ref<HTMLInputElement | null>(null);
    const auth = getAuth();
    const storage = getStorage();

    const showLinkModal = ref(false);
    const showEmbedModal = ref(false);
    const showMapModal = ref(false);

    const addTextElement = () => {
      const textContent = createTileContent(ContentType.TEXT, {});
      layoutStore.addTile(textContent);
    };

    const addProfileElement = () => {
      const profileContent = createTileContent(ContentType.PROFILE, {});
      layoutStore.addTile(profileContent);
    };

    const addChatElement = () => {
      const chatContent = createTileContent(ContentType.CHAT, {});
      layoutStore.addTile(chatContent);
    };

    const addCampfireElement = () => {
      const campfireContent = createTileContent(ContentType.CAMPFIRE, {});
      layoutStore.addTile(campfireContent);
    };

    const selectFile = () => {
      imageInput.value?.click();
    };

    const addFile = async (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      
      // Reset input immediately so the same file can be selected again
      input.value = "";
      
      if (!file) return;

      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const maxSize = isImage ? 10 * 1024 * 1024 : 500 * 1024 * 1024; // 10MB for images, 500MB for videos

      if (!isImage && !isVideo) {
        alert("Unsupported file type. Please upload an image or video.");
        return;
      }

      if (file.size > maxSize) {
        alert(`File is too large! Maximum size: ${isImage ? "10MB" : "500MB"}`);
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
      } catch (error: any) {
        console.error("File upload failed:", error);
        // Show more specific error message to help with debugging
        const errorMessage = error?.message || error?.code || "Unknown error";
        alert(`Failed to upload file: ${errorMessage}\n\nCheck console for details.`);
      }
    };

    const addLinkElement = () => {
      showLinkModal.value = true;
    };

    const closeLinkModal = () => {
      showLinkModal.value = false;
    };

    const handleAddLink = (link: string) => {
      closeLinkModal();
      
      // Check if this URL should be a special content type (YouTube, image, video, etc.)
      // instead of a generic link tile
      const detectedContent = createTileContentFromEmbedUrl(link);
      
      // If it's detected as YouTube, image, or video, use that specialized type
      if (detectedContent.type === ContentType.YOUTUBE || 
          detectedContent.type === ContentType.IMAGE ||
          detectedContent.type === ContentType.VIDEO) {
        layoutStore.addTile(detectedContent);
        return;
      }
      
      // Otherwise, create a link tile with preview
      const linkContent = createTileContent(ContentType.LINK, { link });
      const tileId = layoutStore.addTile(linkContent);

      if (tileId) {
        (async () => {
          try {
            const getLinkPreview = httpsCallable(functions, "getLinkPreview");
            const result = await getLinkPreview({ url: (linkContent as any).link });
            const data = result.data as any;

            layoutStore.patchTileContent(tileId, {
              link: data?.url,
              domain: data?.domain,
              faviconUrl: data?.faviconUrl || (linkContent as any).faviconUrl,
              metaTitle: data?.title,
              metaDescription: data?.description,
              metaImageUrl: data?.imageUrl,
              metaSiteName: data?.siteName,
            });
          } catch (error) {
            console.error("Failed to fetch link preview:", error);
          }
        })();
      }
    };

    const addEmbedElement = () => {
      showEmbedModal.value = true;
    };

    const closeEmbedModal = () => {
      showEmbedModal.value = false;
    };

    const handleAddEmbed = (link: string) => {
      closeEmbedModal();
      const content = createTileContentFromEmbedUrl(link);
      layoutStore.addTile(content);
    };

    const addMapElement = () => {
      showMapModal.value = true;
    };

    const closeMapModal = () => {
      showMapModal.value = false;
    };

    const handleAddMap = (query: string) => {
      closeMapModal();
      const content = createTileContent(ContentType.MAP, {
        searchQuery: query || undefined,
      });
      layoutStore.addTile(content);
    };

    const addRPGElement = () => {
      const rpgContent = createTileContent(ContentType.RPG, {});
      layoutStore.addTile(rpgContent);
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
      addProfileElement,
      addChatElement,
      addCampfireElement,
      selectFile,
      addFile,
      addLinkElement,
      addEmbedElement,
      addMapElement,
      addRPGElement,
      updateMetaData,
      isDarkMode,
      showLinkModal,
      showEmbedModal,
      showMapModal,
      closeLinkModal,
      closeEmbedModal,
      closeMapModal,
      handleAddLink,
      handleAddEmbed,
      handleAddMap,
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
  top: -8px;
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
  color: var(--color-content-default);
  border: none;
  background-color: var(--color-tile-background);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;

  &:hover {
    background-color: var(--color-base-55);
    color: var(--color-text-primary);
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
