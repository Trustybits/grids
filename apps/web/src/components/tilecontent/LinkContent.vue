<template>
  <div
    class="link-tile-content"
    :class="{
      'is-wide-1-high': isWideOneHigh,
      'is-tall-1-wide': isTallOneWide,
      'is-editing': isEditing,
      'is-owner': gridView.canEdit,
      'is-drag-over': isDragOver,
    }"
    :style="{ '--link-title-lines': String(titleLineClamp) }"
    ref="linkTileRef"
    @click="onTileClick"
    @contextmenu="onContextMenu"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <router-link
      v-if="!gridView.canEdit && internalRoute"
      class="link-tile-anchor"
      :to="internalRoute"
      :aria-label="displayTitle || displaySubtitle || 'Open link'"
    ></router-link>
    <a
      v-else-if="!gridView.canEdit && resolvedHref"
      class="link-tile-anchor"
      :href="resolvedHref"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="displayTitle || displaySubtitle || 'Open link'"
    ></a>

    <div v-if="backgroundImageUrl" class="tile-background" aria-hidden="true">
      <img
        class="tile-background-image"
        :src="backgroundImageUrl"
        :alt="content.metaTitle || content.domain"
      />
      <div class="tile-background-overlay"></div>
    </div>

    <!-- Full-card color wash — renders with or without a preview image. -->
    <div
      v-if="overlayColor"
      class="link-color-overlay"
      :style="{ backgroundColor: overlayColor }"
      aria-hidden="true"
    />

    <div v-if="isDragOver" class="link-image-drop-overlay" aria-hidden="true">
      Drop image to upload
    </div>

    <div class="tile-foreground">
      <div class="tile-header">
        <div class="tile-logo">
          <div
            v-if="isTelLink || isMailtoLink"
            class="tile-logo-contact"
            aria-hidden="true"
          >
            <PhoneIcon v-if="isTelLink" class="tile-logo-contact-icon" />
            <EmailIcon v-else class="tile-logo-contact-icon" />
          </div>
          <template v-else>
            <img
              v-if="!!content.faviconUrl"
              :src="content.faviconUrl"
              :alt="content.domain"
            />
            <button
              v-if="gridView.canEdit && !!content.faviconUrl"
              class="tile-logo-close"
              @mousedown.stop
              @mouseup.stop
              @click.stop="handleRemoveFavicon"
            ></button>
          </template>
        </div>

        <template v-if="isWideOneHigh">
          <input
            v-if="isEditing"
            ref="titleInputRef"
            v-model="draftTitle"
            class="tile-input tile-input--title tile-input--wide"
            type="text"
            placeholder="Add a title"
            @keydown.enter.prevent
          />
          <p
            v-else-if="displayTitle"
            class="tile-title tile-title--wide"
            @mousedown.stop
            @click="() => startEditing()"
          >
            {{ displayTitle }}
          </p>
        </template>

        <div
          v-if="!isTallOneWide && !isOneByOne"
          class="tile-link-indicator"
          aria-hidden="true"
        >
          <LinkIndicatorIcon class="tile-link-indicator-icon" />
        </div>
      </div>

      <div
        v-if="isTallOneWide"
        class="tile-link-indicator tile-link-indicator--bottom"
        aria-hidden="true"
      >
        <LinkIndicatorIcon class="tile-link-indicator-icon" />
      </div>

      <div
        v-if="!isWideOneHigh && !isTallOneWide && !isOneByOne"
        ref="detailsRef"
        class="tile-details"
        :class="{
          'is-hovered': isDetailsHovered && !isEditing,
          'is-editing': isEditing,
          'additional-top-padding': !displayTitle,
        }"
        @mouseenter="isDetailsHovered = true"
        @mouseleave="isDetailsHovered = false"
        @mousedown.stop
        @click.stop="onDetailsClick"
      >
        <div
          v-if="
            !displayTitle &&
            !displayDescription &&
            !displaySubtitle &&
            !isEditing &&
            isDetailsHovered
          "
          class="tile-details-placeholder"
        >
          Add a title
        </div>
        <div
          class="tile-field-wrap tile-field-wrap--title scrollable-thin"
          :class="{
            'is-visible': isEditing || !!displayTitle,
            'has-overflow': !isEditing,
          }"
        >
          <textarea
            ref="titleInputRef"
            v-model="draftTitle"
            class="tile-field tile-field--title"
            :readonly="!isEditing"
            :tabindex="isEditing ? 0 : -1"
            placeholder="Add a title"
            rows="1"
          ></textarea>
        </div>
        <div
          class="tile-field-wrap tile-field-wrap--description scrollable-thin"
          :class="{
            'is-visible': isEditing || !!displayDescription,
            'has-overflow': !isEditing,
          }"
        >
          <textarea
            ref="descriptionInputRef"
            v-model="draftDescription"
            class="tile-field tile-field--description"
            :readonly="!isEditing"
            :tabindex="isEditing ? 0 : -1"
            placeholder="Add a description"
            rows="1"
          ></textarea>
        </div>
        <div
          class="tile-field-wrap tile-field-wrap--subtitle"
          :class="{
            'is-visible': isEditing || !!displaySubtitle,
          }"
        >
          <input
            ref="subtitleInputRef"
            v-model="draftSubtitle"
            class="tile-field tile-field--subtitle"
            type="text"
            :readonly="!isEditing"
            :tabindex="isEditing ? 0 : -1"
            placeholder="Add a subtitle"
          />
        </div>
      </div>
    </div>

    <input
      v-if="gridView.canEdit"
      ref="customImageInput"
      class="link-image-input"
      type="file"
      accept="image/*"
      @change.stop="onCustomImageSelected"
    />

    <teleport to="body">
      <div
        v-if="gridView.canEdit && showContextMenu"
        ref="contextMenuRef"
        class="link-context-menu"
        :style="contextMenuStyle"
        @mousedown.stop
      >
        <button
          type="button"
          class="link-context-menu-item"
          @click.stop="handleContextUpload"
        >
          Upload image
        </button>
        <button
          type="button"
          class="link-context-menu-item"
          @click.stop="handleContextUseUrl"
        >
          Use image URL
        </button>
        <button
          v-if="content.customImageUrl || content.metaImageUrl"
          type="button"
          class="link-context-menu-item link-context-menu-item--danger"
          @click.stop="handleContextRemove"
        >
          Remove image
        </button>
      </div>
    </teleport>
  </div>
</template>

<script lang="ts">
import {
  proxyRefs,
  defineComponent,
  inject,
  computed,
  ref,
  type ComputedRef,
  onMounted,
  onUnmounted,
  nextTick,
  watch,
  toRef,
} from "vue";

import { type LinkContent } from "@grids/contracts/types";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import { useFileUpload } from "@/composables/useFileUpload";
import { useColorPicker } from "@/composables/useColorPicker";
import { resolveInternalGridRoute } from "@/utils/InternalLink";
import LinkIndicatorIcon from "../icons/LinkIndicatorIcon.vue";
import EmailIcon from "../icons/EmailIcon.vue";
import PhoneIcon from "../icons/PhoneIcon.vue";
import { useEditorAutosave } from "@/composables/useEditorAutosave";
import { useTileContentWriter } from "@/composables/useTileContentWriter";

export default defineComponent({
  emits: ["background-color-change", "text-color-change"],
  components: {
    LinkIndicatorIcon,
    EmailIcon,
    PhoneIcon,
  },
  props: {
    content: {
      type: Object as () => LinkContent,
      required: true,
    },
  },
  setup(props, { emit }) {
    const gridView = proxyRefs(useGridViewContext());
    const tileId = inject<string | null>("tileId", null);
    const gridTileH = inject<ComputedRef<number> | null>("gridTileH", null);
    const gridTileW = inject<ComputedRef<number> | null>("gridTileW", null);
    const { patchContent, autosaveContent } = useTileContentWriter(
      tileId,
      () => props.content,
    );

    const isOneByOne = computed(
      () => (gridTileW?.value ?? 0) === 1 && (gridTileH?.value ?? 0) === 1,
    );
    const isWideOneHigh = computed(
      () => (gridTileW?.value ?? 0) > 1 && (gridTileH?.value ?? 0) === 1,
    );
    const isTallOneWide = computed(
      () => (gridTileW?.value ?? 0) === 1 && (gridTileH?.value ?? 0) > 1,
    );
    const titleLineClamp = computed(() =>
      (gridTileH?.value ?? 0) < 3 ? 2 : 3,
    );

    const isEditing = ref(false);
    const isDetailsHovered = ref(false);
    const titleInputRef = ref<HTMLTextAreaElement | null>(null);
    const descriptionInputRef = ref<HTMLTextAreaElement | null>(null);
    const subtitleInputRef = ref<HTMLInputElement | null>(null);
    const detailsRef = ref<HTMLElement | null>(null);
    const draftTitle = ref("");
    const draftDescription = ref("");
    const draftSubtitle = ref("");
    const customImageInput = ref<HTMLInputElement | null>(null);
    const linkTileRef = ref<HTMLElement | null>(null);
    const contextMenuRef = ref<HTMLDivElement | null>(null);
    const showContextMenu = ref(false);
    const contextMenuPosition = ref({ x: 0, y: 0 });
    const isDragOver = ref(false);
    const { uploadFileToUrl } = useFileUpload();

    const formatLink = (link: string) => {
      if (!link) return "@handle or address";

      if (/^mailto:/i.test(link)) {
        try {
          const u = new URL(link);
          const addr = decodeURIComponent(
            (u.pathname || "").replace(/^\/+/, ""),
          );
          return addr || link;
        } catch {
          return link;
        }
      }

      if (/^tel:/i.test(link)) {
        return link.replace(/^tel:/i, "").trim() || link;
      }

      if (link.startsWith("http://") || link.startsWith("https://")) {
        try {
          const url = new URL(link);
          return `@${url.hostname.replace("www.", "")}`;
        } catch {
          return `@${link}`;
        }
      }

      return link.startsWith("@") ? link : `@${link}`;
    };

    const rawLink = computed(() => (props.content.link || "").trim());
    const isTelLink = computed(() => /^tel:/i.test(rawLink.value));
    const isMailtoLink = computed(() => /^mailto:/i.test(rawLink.value));

    const defaultTitle = computed(() => {
      if (props.content.metaTitle) return props.content.metaTitle;
      if (props.content.metaSiteName) return props.content.metaSiteName;
      if (isTelLink.value) return "Phone";
      if (isMailtoLink.value) return "Email";
      if (props.content.domain) return props.content.domain;
      return "Link";
    });
    const defaultDescription = computed(
      () => props.content.metaDescription || "",
    );
    const defaultSubtitle = computed(() => formatLink(props.content.link));

    const displayTitle = computed(() =>
      props.content.customTitle !== undefined
        ? props.content.customTitle
        : defaultTitle.value,
    );
    const displayDescription = computed(() =>
      props.content.customDescription !== undefined
        ? props.content.customDescription
        : defaultDescription.value,
    );
    const displaySubtitle = computed(() =>
      props.content.customSubtitle !== undefined
        ? props.content.customSubtitle
        : defaultSubtitle.value,
    );
    const backgroundImageUrl = computed(
      () => props.content.customImageUrl || props.content.metaImageUrl || "",
    );

    const contextMenuStyle = computed(() => ({
      top: `${contextMenuPosition.value.y}px`,
      left: `${contextMenuPosition.value.x}px`,
    }));

    const syncDrafts = () => {
      draftTitle.value = displayTitle.value;
      draftDescription.value = displayDescription.value;
      draftSubtitle.value = displaySubtitle.value;
    };

    // Keep drafts in sync with display values when not editing
    // so readonly inputs always show the correct text
    watch(
      [displayTitle, displayDescription, displaySubtitle],
      () => {
        if (!isEditing.value) syncDrafts();
      },
      { immediate: true },
    );

    // Track whether the user has ever manually edited each field
    const userEditedTitle = ref(props.content.customTitle !== undefined);
    const userEditedDescription = ref(
      props.content.customDescription !== undefined,
    );
    const userEditedSubtitle = ref(props.content.customSubtitle !== undefined);

    watch([draftTitle, draftDescription, draftSubtitle], () => {
      if (isEditing.value) {
        // Mark fields as user-edited once the user starts typing
        userEditedTitle.value = true;
        userEditedDescription.value = true;
        userEditedSubtitle.value = true;
        schedulePersist();
      }
    });

    // When metadata arrives from getLinkPreview and the user hasn't manually
    // edited a field yet, bake the metadata into the custom fields so it's
    // persisted in the DB and survives future loads.
    watch(
      () => ({
        metaTitle: props.content.metaTitle,
        metaDescription: props.content.metaDescription,
        metaSiteName: props.content.metaSiteName,
        link: props.content.link,
      }),
      (newMeta) => {
        if (!tileId || !gridView.canEdit) return;
        // Only run when not editing — this handles the async metadata fetch
        if (isEditing.value) return;

        const patch: Record<string, string> = {};

        if (!userEditedTitle.value) {
          const title = newMeta.metaTitle || newMeta.metaSiteName || "";
          if (title) {
            patch.customTitle = title;
            userEditedTitle.value = true;
          }
        }

        if (!userEditedDescription.value) {
          const desc = newMeta.metaDescription || "";
          if (desc) {
            patch.customDescription = desc;
            userEditedDescription.value = true;
          }
        }

        if (!userEditedSubtitle.value) {
          const sub = formatLink(newMeta.link);
          if (sub) {
            patch.customSubtitle = sub;
            userEditedSubtitle.value = true;
          }
        }

        if (Object.keys(patch).length > 0) {
          patchContent(patch);
        }
      },
    );

    const { schedulePersist, flushPersist } = useEditorAutosave(() =>
      saveEdits(),
    );

    const saveEdits = () => {
      if (!gridView.canEdit) return;

      const nextTitle = draftTitle.value.trim();
      const nextDescription = draftDescription.value.trim();
      const nextSubtitle = draftSubtitle.value.trim();

      const updatedFields = {
        customTitle: nextTitle,
        customDescription: nextDescription,
        customSubtitle: nextSubtitle,
      };

      autosaveContent(updatedFields);
    };

    const closeContextMenu = () => {
      showContextMenu.value = false;
    };

    const applyImageUrlFromToolbar = (normalizedUrl: string) => {
      if (!gridView.canEdit) return;
      patchContent({ customImageUrl: normalizedUrl });
    };

    const openCustomImagePicker = () => {
      if (!gridView.canEdit) return;
      customImageInput.value?.click();
    };

    const removeImage = () => {
      if (!gridView.canEdit) return;

      let changes: Partial<LinkContent> = {};

      if (props.content.customImageUrl !== undefined) {
        changes = { customImageUrl: undefined };
      } else {
        changes = { metaImageUrl: undefined };
      }

      patchContent(changes);

      closeContextMenu();
    };

    const uploadCustomImage = async (file: File) => {
      if (!gridView.canEdit) return;

      if (!file.type.startsWith("image/")) {
        alert("Unsupported file type. Please upload an image.");
        return;
      }

      try {
        const url = await uploadFileToUrl(file, { fileType: "images" });
        patchContent({ customImageUrl: url });
      } catch (error: unknown) {
        console.error("Link tile image upload failed:", error);
        alert(error instanceof Error ? error.message : "Failed to upload image. Please try again.");
      }
    };

    const onCustomImageSelected = async (event: Event) => {
      if (!gridView.canEdit) return;
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await uploadCustomImage(file);
      if (customImageInput.value) customImageInput.value.value = "";
    };

    const onDragEnter = (event: DragEvent) => {
      if (!gridView.canEdit) return;
      if (!event.dataTransfer?.types.includes("Files")) return;
      isDragOver.value = true;
    };

    const onDragOver = (event: DragEvent) => {
      if (!gridView.canEdit) return;
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.dataTransfer.dropEffect = "copy";
    };

    const onDragLeave = (event: DragEvent) => {
      if (!gridView.canEdit) return;
      const container = linkTileRef.value;
      if (!container) {
        isDragOver.value = false;
        return;
      }
      const rect = container.getBoundingClientRect();
      const { clientX, clientY } = event;
      if (
        clientX <= rect.left ||
        clientX >= rect.right ||
        clientY <= rect.top ||
        clientY >= rect.bottom
      ) {
        isDragOver.value = false;
      }
    };

    const onDrop = async (event: DragEvent) => {
      if (!gridView.canEdit) return;
      isDragOver.value = false;
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      await uploadCustomImage(file);
    };

    const clampContextMenuPosition = (
      x: number,
      y: number,
      menuWidth: number,
      menuHeight: number,
    ) => {
      const padding = 8;
      const maxX = window.innerWidth - menuWidth - padding;
      const maxY = window.innerHeight - menuHeight - padding;
      return {
        x: Math.max(padding, Math.min(x, maxX)),
        y: Math.max(padding, Math.min(y, maxY)),
      };
    };

    const onContextMenu = (event: MouseEvent) => {
      if (!gridView.canEdit) return;
      event.preventDefault();
      event.stopPropagation();

      const nextX = event.clientX;
      const nextY = event.clientY;
      const fallbackWidth = 180;
      const fallbackHeight = props.content.customImageUrl ? 88 : 48;

      contextMenuPosition.value = clampContextMenuPosition(
        nextX,
        nextY,
        fallbackWidth,
        fallbackHeight,
      );
      showContextMenu.value = true;

      nextTick(() => {
        const menu = contextMenuRef.value;
        if (!menu) return;
        const { width, height } = menu.getBoundingClientRect();
        contextMenuPosition.value = clampContextMenuPosition(
          nextX,
          nextY,
          width,
          height,
        );
      });
    };

    const handleContextUpload = () => {
      closeContextMenu();
      openCustomImagePicker();
    };

    const handleContextUseUrl = () => {
      closeContextMenu();
      if (tileId) {
        gridView.setPanelActive(tileId, "imageUrl");
      }
    };

    const handleContextRemove = () => {
      closeContextMenu();
      removeImage();
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (!showContextMenu.value) return;
      if (contextMenuRef.value?.contains(event.target as Node)) return;
      showContextMenu.value = false;
    };

    onMounted(() => {
      document.addEventListener("click", handleDocumentClick);
      document.addEventListener("contextmenu", handleDocumentClick);
    });

    onUnmounted(() => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("contextmenu", handleDocumentClick);
      removeExitClickHandler();
    });

    let exitClickHandler: ((event: MouseEvent) => void) | null = null;

    const removeExitClickHandler = () => {
      if (exitClickHandler) {
        document.removeEventListener("click", exitClickHandler);
        exitClickHandler = null;
      }
    };

    const startEditing = (
      focusTarget?: "title" | "description" | "subtitle",
    ) => {
      if (!gridView.canEdit || isEditing.value) return;
      if (tileId) gridView.beginEditing(tileId);
      isEditing.value = true;
      syncDrafts();
      nextTick(() => {
        setTimeout(() => {
          const targetRef =
            focusTarget === "subtitle"
              ? subtitleInputRef
              : focusTarget === "description"
                ? descriptionInputRef
                : titleInputRef;
          targetRef.value?.focus();
          // Register exit listener since @mousedown.stop bypasses GridTile's addClickListener
          exitClickHandler = (event: MouseEvent) => {
            if (
              linkTileRef.value &&
              !linkTileRef.value.contains(event.target as Node)
            ) {
              stopEditing();
            }
          };
          document.addEventListener("click", exitClickHandler);
        }, 0);
      });
    };

    const stopEditing = () => {
      if (!isEditing.value) return;
      flushPersist();
      gridView.commitEditing();
      removeExitClickHandler();
      isEditing.value = false;
      // Re-sync drafts so readonly inputs reflect saved values
      nextTick(() => syncDrafts());
    };

    const onDetailsClick = (event: MouseEvent) => {
      if (isEditing.value) return;
      if (!gridView.canEdit) return;

      // Determine which field is closest to the click position
      const el = detailsRef.value;
      if (!el) {
        startEditing();
        return;
      }

      const fields = [
        { name: "title" as const, el: el.querySelector(".tile-field--title") },
        {
          name: "description" as const,
          el: el.querySelector(".tile-field--description"),
        },
        {
          name: "subtitle" as const,
          el: el.querySelector(".tile-field--subtitle"),
        },
      ];

      // When all fields are empty, default to title
      if (
        !displayTitle.value &&
        !displayDescription.value &&
        !displaySubtitle.value
      ) {
        startEditing("title");
        return;
      }

      const clickY = event.clientY;
      let closest: "title" | "description" | "subtitle" = "title";
      let minDist = Infinity;

      for (const f of fields) {
        if (!f.el) continue;
        const rect = f.el.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;
        const dist = Math.abs(clickY - centerY);
        if (dist < minDist) {
          minDist = dist;
          closest = f.name;
        }
      }

      startEditing(closest);
    };

    const resolvedHref = computed(() => {
      const link = rawLink.value;
      if (!link) return "";
      if (/^(mailto|tel):/i.test(link)) return link;
      if (/^[a-z][a-z0-9+.-]*:/i.test(link)) return link;
      return `https://${link}`;
    });

    // When the resolved link points at another grid on this same site, viewers
    // navigate in-app (via <router-link>) instead of opening a new tab.
    const internalRoute = computed(() =>
      gridView.canEdit ? null : resolveInternalGridRoute(resolvedHref.value),
    );

    const onTileClick = (event: MouseEvent) => {
      if (isEditing.value) {
        const target = event.target as HTMLElement;
        if (!target.closest("input, textarea")) {
          stopEditing();
        }
      }
    };

    const onShortClick = () => {
      if (isEditing.value) return;
      // Owners use the action bar "Follow Link" control.
      // Viewers get native anchor behavior from the full-tile anchor.
      if (gridView.canEdit) return;
    };

    const onExitClick = () => {
      if (!gridView.canEdit) return;
      if (!isEditing.value) return;
      stopEditing();
    };

    const {
      overlayColor: linkOverlayColor,
      pickerFillColor,
      pickerOverlayColor,
      colorMode,
      setColorMode,
      handleBackgroundColorChange,
      handleOverlayColorChange,
    } = useColorPicker(tileId, toRef(props, "content"), emit, {
      overlayCapable: true,
      legacyBackgroundAlsoOverlay: true,
    });

    const handleRemoveFavicon = () => {
      patchContent({ faviconUrl: undefined });
    };

    return {
      gridView,
      overlayColor: linkOverlayColor,
      pickerFillColor,
      pickerOverlayColor,
      colorMode,
      setColorMode,
      handleBackgroundColorChange,
      handleOverlayColorChange,
      formatLink,
      isTelLink,
      isMailtoLink,
      onTileClick,
      onShortClick,
      onExitClick,
      internalRoute,
      isEditing,
      isDetailsHovered,
      detailsRef,
      descriptionInputRef,
      subtitleInputRef,
      startEditing,
      onDetailsClick,
      titleInputRef,
      resolvedHref,
      titleLineClamp,
      isOneByOne,
      isWideOneHigh,
      isTallOneWide,
      displayTitle,
      displayDescription,
      displaySubtitle,
      backgroundImageUrl,
      contextMenuStyle,
      draftTitle,
      draftDescription,
      draftSubtitle,
      customImageInput,
      linkTileRef,
      contextMenuRef,
      showContextMenu,
      isDragOver,
      openCustomImagePicker,
      applyImageUrlFromToolbar,
      removeImage,
      onCustomImageSelected,
      onDragEnter,
      onDragOver,
      onDragLeave,
      onDrop,
      onContextMenu,
      handleContextUpload,
      handleContextUseUrl,
      handleContextRemove,
      handleRemoveFavicon,
    };
  },
});
</script>

<style scoped>
.link-tile-content {
  --link-title-lines: 3;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: var(--tile-padding);
  position: relative;
  border-radius: var(--tile-border-radius);
  overflow: hidden;
  isolation: isolate;
  transform: translateZ(0);
}

.link-tile-anchor {
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: inherit;
}

.tile-background {
  position: absolute;
  inset: -1px;
  z-index: 0;
  pointer-events: none;
}

.tile-wrapper[data-link-background="off"] .tile-background {
  display: none;
}

.tile-background-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  transform: translateZ(0);
}

.link-color-overlay {
  position: absolute;
  inset: 0;
  /* Sits above the preview image / card background but below the foreground
     text (z-index 1), so it washes the whole card while keeping text legible. */
  z-index: 0;
  opacity: 0.6;
  pointer-events: none;
  border-radius: inherit;
}

.tile-background-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(
      180deg,
      transparent 50%,
      color-mix(in srgb, var(--tile-bg) 45%, transparent) 80%,
      var(--tile-bg) 120%
    ),
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--tile-bg) 0%, transparent) 0%,
      color-mix(in srgb, var(--tile-bg) 20%, transparent) 100%
    );
  /* linear-gradient(
      180deg,
      transparent 21%,
      color-mix(in srgb, var(--color-tile-background) 76%, transparent) 76%,
      var(--color-tile-background) 100%
    ),
    linear-gradient(90deg, color-mix(in srgb, var(--color-tile-background) 34%, transparent) 0%, color-mix(in srgb, var(--color-tile-background) 34%, transparent) 100%); */
  transform: translateZ(0);
}

.tile-foreground {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--spacing-md);
  width: 100%;
  height: 100%;
  min-height: 0;
}

.tile-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
}

.link-tile-content.is-wide-1-high .tile-header {
  align-items: center;
  gap: 12px;
}

.link-tile-content.is-wide-1-high .tile-link-indicator {
  margin-left: auto;
}

.link-tile-content.is-tall-1-wide .tile-foreground {
  gap: 0;
}

.link-tile-content.is-tall-1-wide .tile-link-indicator--bottom {
  margin-top: auto;
  align-self: flex-end;
  width: 100%;
}

.tile-logo {
  position: relative;
  width: 32px;
  height: 32px;
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.tile-logo img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}

.tile-logo-contact {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--tile-text-color);
  opacity: 0.85;
}

.tile-logo-contact-icon {
  width: 22px;
  height: 22px;
  display: block;
}

.tile-logo-close {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  padding: 0;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.45);
  border-radius: inherit;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--easing-ease-in-out);
}

.tile-logo-close::before,
.tile-logo-close::after {
  content: "";
  position: absolute;
  width: 2px;
  height: 14px;
  background: #fff;
  border-radius: 1px;
}

.tile-logo-close::before {
  transform: rotate(45deg);
}

.tile-logo-close::after {
  transform: rotate(-45deg);
}

.tile-logo:hover .tile-logo-close {
  opacity: 1;
}

.tile-link-indicator {
  width: 24px;
  height: 24px;
  color: var(--tile-text-color);
  opacity: 0.21;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--easing-ease-in-out);
}

.link-tile-content:hover .tile-link-indicator {
  opacity: 1;
}

.tile-link-indicator-icon {
  width: 100%;
  height: 100%;
  display: block;
}

.tile-details-placeholder {
  color: var(--tile-text-color);
  opacity: 0.5;
  padding: 6px 6px;
  margin-top: -4px;
  transition: opacity 0.2s ease;
}

.tile-details {
  display: flex;
  flex-direction: column;
  width: calc(100% + 16px);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
  padding: 2px;
  margin-left: -8px;
  margin-bottom: -4px;
  overflow: hidden;
  min-height: 0;
  margin-top: auto;
}

.link-tile-content.is-owner .tile-details {
  cursor: text;
}

.tile-details.is-hovered {
  background-color: color-mix(
    in srgb,
    transparent 45%,
    color-mix(in srgb, var(--tile-bg) 82%, var(--tile-text-color) 3%) 65%
  );
}

.tile-details.is-editing {
  background-color: var(--tile-bg);
  border-color: transparent;
}

.tile-details.additional-top-padding {
  padding-top: 4px;
}

/* ── Field wrapper (handles collapse / expand / overflow mask) ── */

.tile-field-wrap {
  overflow: hidden;
  border-radius: 4px;

  /* Stretch to full width of tile-details (cancel parent padding) */
  margin-left: -2px;
  margin-right: -2px;

  /* Collapsed: zero space */
  max-height: 0;
  padding: 0;
  opacity: 0;
  pointer-events: none;
  transition:
    max-height 0.3s ease,
    padding 0.3s ease,
    opacity 0.25s ease,
    background-color 0.15s ease;
}

.tile-field-wrap.is-visible {
  opacity: 1;
  pointer-events: auto;
  transition:
    max-height 0.35s ease,
    padding 0.35s ease,
    opacity 0.3s ease,
    background-color 0.15s ease;
}

.tile-field-wrap--title {
  margin-top: -2px;
}

.tile-field-wrap--subtitle {
  margin-bottom: -2px;
}

/* Remove mask when content fits (small enough text won't trigger it visually) */
.tile-details.is-editing .tile-field-wrap {
  -webkit-mask-image: none;
  mask-image: none;
}

/* Individual field hover highlight when editing */
.tile-details.is-editing .tile-field-wrap:hover {
  background-color: color-mix(
    in srgb,
    var(--color-input-edit) 97%,
    var(--tile-text-color) 3%
  );
}

/* ── Inner field (textarea / input) ── */

.tile-field {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--tile-text-color);
  font-family: "Inter", sans-serif;
  cursor: inherit;
  resize: none;
  field-sizing: content;
  padding: 8px 8px;
  margin: -8px -8px;
}

.tile-field:focus {
  outline: none;
}

/* .tile-field:focus .tile-field-wrap {
  background-color: var(--color-input-edit);
} */

/* When readonly, hide placeholder text */
.tile-field[readonly]::placeholder {
  color: transparent;
}

.tile-field::placeholder {
  color: color-mix(in srgb, var(--tile-text-color) 55%, transparent 45%);
}

.tile-input::placeholder {
  color: color-mix(in srgb, var(--color-content-low) 55%, transparent 45%);
}

/* ── Title wrapper ── */

.tile-field-wrap--title {
  flex: 1 1 auto;
  min-height: 0;
}

.tile-field-wrap--title.is-visible {
  max-height: none;
  min-height: 28px;
  padding: 4px 6px;
  padding-top: 6px;
}

.tile-details.is-editing .tile-field-wrap--title.is-visible {
  max-height: none;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* ── Title field ── */

.tile-field--title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.25;
  padding: 0;
  margin: 0;
  border: none;
}

/* Wide variant (separate <p> in header) */
.tile-title {
  color: var(--tile-text-color);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.25;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tile-title--wide {
  display: block;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
}

.link-tile-content.is-owner .tile-title--wide {
  cursor: text;
  border-radius: var(--radius-sm);
  transition: background-color 0.3s ease;
}

.link-tile-content.is-owner:not(.is-editing) .tile-title--wide:hover {
  background-color: var(--color-editable-hover);
}

/* ── Description wrapper ── */

.tile-field-wrap--description {
  flex: 1 1 auto;
  min-height: 0;
}

.tile-field-wrap--description.is-visible {
  max-height: none;
  min-height: 28px;
  padding: 4px 6px;
}

.tile-details.is-editing .tile-field-wrap--description.is-visible {
  max-height: none;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* ── Description field ── */

.tile-field--description {
  font-size: 12px;
  line-height: 16px;
  color: var(--tile-text-color);
  padding: 0;
  margin: 0;
  border: none;
}

/* ── Subtitle wrapper ── */

.tile-field-wrap--subtitle {
  flex: 0 0 auto;
  min-height: 0;
}

.tile-field-wrap--subtitle.is-visible {
  max-height: 32px;
  min-height: 24px;
  padding: 4px 6px;
}

/* ── Subtitle field ── */

.tile-field--subtitle {
  font-size: 12px;
  line-height: 16px;
  /* color: color-mix(in srgb, var(--tile-text-color) 65%, transparent); */
  color: var(--tile-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Wide variant (1-high header input) ── */

.tile-input {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--tile-text-color);
  field-sizing: content;
  resize: none;
  font-family: "Inter", sans-serif;
}

.tile-input:focus {
  outline: none;
}

.tile-input--title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.25;
  min-height: 1.25em;
}

.tile-input--wide {
  min-width: 0;
}

.link-image-input {
  display: none;
}

.link-image-drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--color-text-primary);
  font-size: 12px;
  font-weight: 600;
  background: color-mix(in srgb, var(--color-tile-background) 70%, transparent);
  border: 1px dashed
    color-mix(in srgb, var(--color-text-primary) 35%, transparent);
  border-radius: var(--tile-border-radius);
  pointer-events: none;
}

.link-context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 160px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-tile-hover);
}

.link-context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  text-align: left;
  font-size: 12px;
  line-height: 1;
}

.link-context-menu-item:hover {
  background: var(--color-content-low);
}

.link-context-menu-item--danger {
  color: #ff3737;
}
</style>
