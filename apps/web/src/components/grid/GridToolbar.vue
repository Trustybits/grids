<template>
  <div id="toolbarArea">
    <div class="toolbarAlpha">
      <!-- <button class="btn btn-primary me-2" @click="addTextElement">✒</button>    
      <button class="btn btn-secondary me-2" @click="selectFile">🖼</button>
      <button class="btn btn-dark me-2" @click="addLinkElement">🔗</button> -->

      <!-- {{ isDarkMode ? '☀🌑' : '🔆🌙' }} -->
      <!-- <template v-if="isDarkMode"> -->
      <button
        class="toolbar-btn"
        data-tooltip="Text"
        @click="addTextElement"
      >
        <TextLegacyIcon />
      </button>

      <button
        v-if="smartTextEnabled"
        class="toolbar-btn"
        data-tooltip="Smart Text"
        @click="addSmartTextElement"
      >
        <AppBarTextIcon />
      </button>

      <button
        class="toolbar-btn"
        data-tooltip="Profile"
        @click="addProfileElement"
      >
        <ProfileTileIcon />
      </button>

      <button
        class="toolbar-btn"
        data-tooltip="Chat"
        @click="addChatElement"
      >
        <ChatIcon />
      </button>

      <button
        class="toolbar-btn"
        data-tooltip="Image / Video"
        @click="selectFile"
      >
        <ImageIcon />
      </button>
      <button
        v-if="documentsEnabled"
        class="toolbar-btn"
        data-tooltip="Documents"
        @click="selectDocuments"
      >
        <DocumentsIcon />
      </button>
      <button
        v-if="brandTileEnabled"
        class="toolbar-btn"
        data-tooltip="Brands"
        @click="addBrandElement"
      >
        <BrandsIcon />
      </button>
      <button
        class="toolbar-btn"
        data-tooltip="Link"
        @click="addLinkElement"
      >
        <LinkTileIcon />
      </button>
      <button
        class="toolbar-btn"
        data-tooltip="Embed"
        @click="addEmbedElement"
      >
        <EmbedIcon />
      </button>
      <button
        class="toolbar-btn"
        data-tooltip="Map"
        @click="addMapElement"
      >
        <MapIcon />
      </button>
      <button
        class="toolbar-btn"
        data-tooltip="Campfire"
        @click="addCampfireElement"
      >
        <CampfireIcon />
      </button>
      <!-- <button class="btn btn-secondary" data-tooltip="Roadmap" @click="addRoadmapFeedElement">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M9 12h6M9 16h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button> -->
      <!-- <button class="btn btn-secondary" @click="addLinkElement">➕</button> -->

      <input
        type="file"
        ref="imageInput"
        style="display: none"
        accept="image/*,video/*"
        @change.stop="addFile"
      />
      <input
        type="file"
        ref="documentInput"
        style="display: none"
        accept=".pdf,.doc,.docx,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
        multiple
        @change.stop="addDocuments"
      />
    </div>

    <!-- Modals -->
    <FloatingInputModal
      :show="showLinkModal"
      placeholder="Type or paste a link..."
      inputmode="url"
      :validate="isValidLink"
      submit-title="Add link (Enter)"
      invalid-title="Enter a valid URL"
      @close="closeLinkModal"
      @submit="handleAddLink"
    />
    <FloatingInputModal
      :show="showEmbedModal"
      placeholder="Paste a URL or embed code (YouTube, Spotify, Apple Music...)"
      :validate="isValidEmbed"
      submit-title="Add embed (Enter)"
      invalid-title="Enter a valid URL"
      @close="closeEmbedModal"
      @submit="handleAddEmbed"
    />
    <FloatingInputModal
      :show="showMapModal"
      placeholder="Enter a location (optional)"
      :allow-empty="true"
      submit-title="Add map (Enter)"
      @close="closeMapModal"
      @submit="handleAddMap"
    >
      <template #hint>
        <p class="map-hint">Leave blank to use your current location.</p>
      </template>
    </FloatingInputModal>
  </div>
</template>

<script lang="ts">
import { ref } from "vue";
import { useGridStore } from "@/stores/grid";
import { ContentType } from "@grids/contracts/types";
import { createTileContent } from "@/utils/TileUtils";
import { useFileUpload } from "@/composables/useFileUpload";
import { useThemeStore } from "@/stores/theme";
import { computed } from "vue";
import { useFeatureFlags, FEATURE_FLAGS } from "@/composables/useFeatureFlags";
import { useTileInput } from "@/composables/useTileInput";
import FloatingInputModal from "@/components/modal/FloatingInputModal.vue";
import { isValidLink, isValidEmbed } from "@/utils/UrlValidation";
import TextLegacyIcon from "@/components/icons/appbar/TextLegacyIcon.vue";
import AppBarTextIcon from "@/components/icons/appbar/TextIcon.vue";
import ChatIcon from "@/components/icons/ChatIcon.vue";
import ImageIcon from "@/components/icons/ImageIcon.vue";
import LinkTileIcon from "@/components/icons/LinkTileIcon.vue";
import DocumentsIcon from "@/components/icons/appbar/DocumentsIcon.vue";
import BrandsIcon from "@/components/icons/appbar/BrandsIcon.vue";
import EmbedIcon from "@/components/icons/EmbedIcon.vue";
import ProfileTileIcon from "@/components/icons/ProfileTileIcon.vue";
import MapIcon from "@/components/icons/MapIcon.vue";
import CampfireIcon from "@/components/icons/CampfireIcon.vue";

export default {
  components: {
    FloatingInputModal,
    TextLegacyIcon,
    AppBarTextIcon,
    ChatIcon,
    ImageIcon,
    LinkTileIcon,
    DocumentsIcon,
    BrandsIcon,
    EmbedIcon,
    ProfileTileIcon,
    MapIcon,
    CampfireIcon,
  },
  setup() {
    const themeStore = useThemeStore();
    const isDarkMode = computed(() => themeStore.isDarkMode);

    const { isEnabled } = useFeatureFlags();
    const smartTextEnabled = computed(() => isEnabled(FEATURE_FLAGS.EDITOR_SMART_TEXT));
    const documentsEnabled = computed(() => isEnabled(FEATURE_FLAGS.BETA_DOCUMENTS));
    const brandTileEnabled = computed(() => isEnabled(FEATURE_FLAGS.BETA_BRAND_TILE));

    const gridStore = useGridStore();
    const imageInput = ref<HTMLInputElement | null>(null);
    const documentInput = ref<HTMLInputElement | null>(null);
    const { uploadFileOptimistic, uploadDocumentsOptimistic } =
      useFileUpload();
    const { submitLink, submitEmbed } = useTileInput();

    const showLinkModal = ref(false);
    const showEmbedModal = ref(false);
    const showMapModal = ref(false);

    const addTextElement = () => {
      const textContent = createTileContent(ContentType.TEXT, {});
      const tileId = gridStore.addTile(textContent);
      // Auto-focus the new text tile so the user can start typing immediately
      if (tileId) {
        gridStore.pendingFocusTileId = tileId;
      }
    };

    const addSmartTextElement = () => {
      const textContent = createTileContent(ContentType.SMART_TEXT, {});
      const tileId = gridStore.addTile(textContent);
      if (tileId) {
        gridStore.pendingFocusTileId = tileId;
      }
    };

    const addProfileElement = () => {
      const profileContent = createTileContent(ContentType.PROFILE, {});
      gridStore.addTile(profileContent);
    };

    const addChatElement = () => {
      const chatContent = createTileContent(ContentType.CHAT, {});
      gridStore.addTile(chatContent);
    };

    const addCampfireElement = () => {
      const campfireContent = createTileContent(ContentType.CAMPFIRE, {});
      gridStore.addTile(campfireContent);
    };

    const addBrandElement = () => {
      const brandContent = createTileContent(ContentType.BRAND, {});
      gridStore.addTile(brandContent);
    };

    const selectFile = () => {
      imageInput.value?.click();
    };

    const selectDocuments = () => {
      documentInput.value?.click();
    };

    const addDocuments = async (event: Event) => {
      const input = event.target as HTMLInputElement;
      const files = Array.from(input.files || []);
      input.value = "";
      if (!files.length) return;
      try {
        await uploadDocumentsOptimistic(files);
      } catch (error: unknown) {
        const err = error instanceof Error ? error : null;
        const errorMessage = err?.message || "Unknown error";
        alert(`Failed to upload documents: ${errorMessage}`);
      }
    };

    const addFile = async (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];

      // Reset input immediately so the same file can be selected again
      input.value = "";

      if (!file) return;
      try {
        await uploadFileOptimistic(file);
      } catch (error: unknown) {
        const err = error instanceof Error ? error : null;
        const errorMessage = err?.message || "Unknown error";
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
      void submitLink(link, { mode: "add" });
    };

    const addEmbedElement = () => {
      showEmbedModal.value = true;
    };

    const closeEmbedModal = () => {
      showEmbedModal.value = false;
    };

    const handleAddEmbed = (link: string) => {
      closeEmbedModal();
      submitEmbed(link, { mode: "add" });
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
      gridStore.addTile(content);
    };

    const addRoadmapFeedElement = () => {
      // Creates a disconnected roadmap tile; the owner connects Notion from inside the tile
      const roadmapContent = createTileContent(ContentType.ROADMAP_FEED, {});
      gridStore.addTile(roadmapContent);
    };

    const _addOtherElement = () => {
      const link = prompt(
        "More tile types coming soon! Any others you might be expecting to see?",
      );
      if (link) {
        const linkContent = createTileContent(ContentType.LINK, {
          src: link,
        });
        gridStore.addTile(linkContent);
      }
    };

    const updateMetaData = () => {
      gridStore.setCookieValue(
        "showMetaData",
        gridStore.showMetaData.toString(),
      );
    };

    return {
      isValidLink,
      isValidEmbed,
      imageInput,
      gridStore,
      smartTextEnabled,
      documentsEnabled,
      brandTileEnabled,
      addTextElement,
      addSmartTextElement,
      addProfileElement,
      addChatElement,
      addCampfireElement,
      addBrandElement,
      selectFile,
      selectDocuments,
      addFile,
      addDocuments,
      documentInput,
      addLinkElement,
      addEmbedElement,
      addMapElement,
      addRoadmapFeedElement,
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
.map-hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-content-default);
  width: 100%;
  text-align: center;
}

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

.toolbarAlpha .toolbar-btn {
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

.toolbarAlpha .toolbar-btn svg {
  width: 28px;
  height: 28px;
  display: block;
  flex: 0 0 auto;
  color: var(--color-text-primary);
  opacity: 0.55;
}

.toolbarAlpha .toolbar-btn:hover svg {
  opacity: 1;
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
