<template>
  <div id="toolbarArea">
    <div class="toolbarAlpha">
      <!-- <button class="btn btn-primary me-2" @click="addTextElement">✒</button>    
      <button class="btn btn-secondary me-2" @click="selectFile">🖼</button>
      <button class="btn btn-dark me-2" @click="addLinkElement">🔗</button> -->

      <!-- {{ isDarkMode ? '☀🌑' : '🔆🌙' }} -->
      <!-- <template v-if="isDarkMode"> -->
      <button class="btn btn-secondary" data-tooltip="Text" @click="addTextElement">
        <TextIcon />
      </button>

      <button class="btn btn-secondary" data-tooltip="Profile" @click="addProfileElement">
        <ProfileIcon />
      </button>

      <button class="btn btn-secondary" data-tooltip="Chat" @click="addChatElement">
        <ChatIcon />
      </button>

      <button class="btn btn-secondary" data-tooltip="Image / Video" @click="selectFile">
        <ImageIcon />
      </button>
      <button class="btn btn-secondary" data-tooltip="Link" @click="addLinkElement">
        <LinkIcon />
      </button>
      <!-- <button class="btn btn-secondary" @click="addLinkElement">📽</button>
      <button class="btn btn-secondary" @click="addLinkElement">🎵</button>
      <button class="btn btn-secondary" @click="addLinkElement">📌</button> -->
      <button class="btn btn-secondary" data-tooltip="Embed" @click="addEmbedElement">
        <EmbedIcon />
      </button>
      <button class="btn btn-secondary" data-tooltip="Map" @click="addMapElement">
        <MapIcon />
      </button>
      <button class="btn btn-secondary" data-tooltip="Campfire" @click="addCampfireElement">
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

    <!-- Breakpoint preview toggle -->
    <div class="toolbar-divider" />
    <div class="breakpoint-toggle">
      <div class="breakpoint-slider" :style="sliderStyle" />
      <button
        class="bp-btn"
        :class="{ active: layoutStore.previewMode === 'mobile' }"
        data-tooltip="Mobile"
        @click="setPreviewMode('mobile')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
      </button>
      <button
        class="bp-btn"
        :class="{ active: layoutStore.previewMode === 'tablet' }"
        data-tooltip="Tablet"
        @click="setPreviewMode('tablet')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
      </button>
      <button
        class="bp-btn"
        :class="{ active: layoutStore.previewMode === 'desktop' }"
        data-tooltip="Desktop"
        @click="setPreviewMode('desktop')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      </button>
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
import { ref, computed } from "vue";
import { useLayoutStore } from "@/stores/layout";
import { ContentType } from "@/types/TileContent";
import { createTileContent, createTileContentFromEmbedUrl } from "@/utils/TileUtils";
import { useFileUpload } from "@/composables/useFileUpload";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import { useThemeStore } from "@/stores/theme";
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
    const { uploadFileOptimistic } = useFileUpload();

    const showLinkModal = ref(false);
    const showEmbedModal = ref(false);
    const showMapModal = ref(false);

    const addTextElement = () => {
      const textContent = createTileContent(ContentType.TEXT, {});
      const tileId = layoutStore.addTile(textContent);
      // Auto-focus the new text tile so the user can start typing immediately
      if (tileId) {
        layoutStore.pendingFocusTileId = tileId;
      }
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
      try {
        await uploadFileOptimistic(file);
      } catch (error: any) {
        const errorMessage = error?.message || error?.code || "Unknown error";
        alert(`Failed to upload file: ${errorMessage}`);
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

    const setPreviewMode = (mode: 'desktop' | 'tablet' | 'mobile') => {
      layoutStore.previewMode = mode;
    };

    const sliderStyle = computed(() => {
      const index = { mobile: 0, tablet: 1, desktop: 2 }[layoutStore.previewMode];
      return { transform: `translateX(${index * 100}%)` };
    });

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
      setPreviewMode,
      sliderStyle,
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

/* Tooltip via data-tooltip attribute */
.toolbarAlpha button[data-tooltip] {
  position: relative;
}

.toolbarAlpha button[data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%) scale(0.9);
  white-space: nowrap;
  font-size: 11px;
  line-height: 1;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  background-color: var(--color-text-primary);
  color: var(--color-tile-background);
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--easing-ease-out),
              transform var(--duration-fast) var(--easing-ease-out);
  z-index: var(--z-tooltip);
}

.toolbarAlpha button[data-tooltip]:hover::after {
  opacity: 1;
  transform: translateX(-50%) scale(1);
}

.toolbarAlpha button svg {
  width: 28px;
  height: 28px;
  display: block;
  flex: 0 0 auto;
}

/* ── Breakpoint toggle ───────────────────────────────────── */
.toolbar-divider {
  width: 1px;
  height: 28px;
  background: var(--color-tile-stroke);
  flex-shrink: 0;
}

.breakpoint-toggle {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  padding: 3px;
  gap: 0;
  backdrop-filter: blur(20px);
}

.breakpoint-slider {
  position: absolute;
  top: 0px;
  left: 0px;
  width: calc((100% - 0px) / 3);
  height: calc(100% - 0px);
  background: var(--color-base-55);
  border-radius: calc(var(--radius-md) - 2px);
  transition: transform var(--duration-normal, 200ms) var(--easing-smooth, cubic-bezier(0.4, 0, 0.2, 1));
  pointer-events: none;
}

.bp-btn {
  position: relative;
  z-index: 1;
  height: 48px;
  width: 48px;
  border: none;
  background: transparent;
  border-radius: calc(var(--radius-md) - 2px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-content-low);
  transition: color var(--duration-fast) var(--easing-ease-out);

  svg {
    width: 24px;
    height: 24px;
    display: block;
  }

  &:hover {
    color: var(--color-text-primary);
  }

  &.active {
    color: var(--color-text-primary);
  }
}

/* Tooltip reuse for bp-btn */
.bp-btn[data-tooltip] {
  position: relative;
}

.bp-btn[data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%) scale(0.9);
  white-space: nowrap;
  font-size: 11px;
  line-height: 1;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  background-color: var(--color-text-primary);
  color: var(--color-tile-background);
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--easing-ease-out),
              transform var(--duration-fast) var(--easing-ease-out);
  z-index: var(--z-tooltip);
}

.bp-btn[data-tooltip]:hover::after {
  opacity: 1;
  transform: translateX(-50%) scale(1);
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
