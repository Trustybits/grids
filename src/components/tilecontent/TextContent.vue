<template>
  <div
    class="text-container"
    ref="textContentDiv"
    :class="{ overflowing: shouldShowOverflow }"
  >
    <div
      class="text-content"
      :class="{
        'not-editing': !isEditing,
        'can-edit': layoutStore.isOwner,
        'is-wide-1-high': isWideOneHigh,
        'is-tall-1-wide': isTallOneWide,
        'owner-view': layoutStore.isOwner,
        'viewer-view': !layoutStore.isOwner,
      }"
      :style="{
        '--tile-bg': backgroundColor,
        '--tile-text-color': textColor,
        color: textColor,
        textAlign: textAlign,
      }"
      :spellcheck="layoutStore.isOwner && isEditing"
    >
      <EditorContent :editor="editor" />
      <div
        v-if="!isTallOneWide && !isOneByOne && textLinkExists"
        class="tile-link-indicator"
        aria-hidden="true"
        @click="handleOwnerClick"
      >
        <svg
          class="tile-link-indicator-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7 17L17 7"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M10 7H17V14"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <div
        v-if="isTallOneWide && textLinkExists"
        class="tile-link-indicator tile-link-indicator--bottom"
        aria-hidden="true"
        @click="handleOwnerClick"
      >
        <svg
          class="tile-link-indicator-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7 17L17 7"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M10 7H17V14"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </div>
  </div>
  <AddLinkModal
    :show="showLinkModal"
    @close="closeLinkModal"
    @add="handleAddLink"
  />
</template>

<script lang="ts">
import {
  defineComponent,
  ref,
  onMounted,
  watch,
  inject,
  computed,
  type ComputedRef,
  nextTick,
  onUnmounted,
} from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import { FontSize } from "../tiptap/FontSize";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useLayoutStore } from "@/stores/layout";
import AddLinkModal from "../AddLinkModal.vue";
import type { TextContent } from "@/types/TileContent";
import { useToastStore } from "@/stores/toast";
import { useColorPicker } from "@/composables/useColorPicker";
import { useEditorAutosave } from "@/composables/useEditorAutosave";

export default defineComponent({
  components: {
    EditorContent,
    AddLinkModal,
  },
  emits: ["background-color-change", "text-color-change"],
  props: {
    content: {
      type: Object as () => TextContent,
      required: true,
    },
  },
  setup(props, { emit }) {
    const layoutStore = useLayoutStore();

    const isOwner = ref(layoutStore?.isOwner);

    const isTextOverflowing = ref(false);
    const isScrolledToBottom = ref(false);
    const editorDomRef = ref<HTMLElement | null>(null);
    const isEditing = ref(false);
    const textContentDiv = ref<HTMLDivElement | null>(null);

    const gridTileH = inject<ComputedRef<number> | null>("gridTileH", null);
    const gridTileW = inject<ComputedRef<number> | null>("gridTileW", null);
    const isTallOneWide = computed(
      () => (gridTileW?.value ?? 0) === 1 && (gridTileH?.value ?? 0) > 1,
    );
    const isWideOneHigh = computed(
      () => (gridTileW?.value ?? 0) > 1 && (gridTileH?.value ?? 0) === 1,
    );
    const isOneByOne = computed(
      () => (gridTileW?.value ?? 0) === 1 && (gridTileH?.value ?? 0) === 1,
    );

    const textLink = computed(() => props.content?.textLink);
    const textLinkExists = computed(() => !!props.content?.textLink);
    const isBoldActive = ref(false);
    const isItalicActive = ref(false);
    const textAlign = computed(() => props.content?.textAlign ?? "left");

    const showLinkModal = ref<boolean>(false);
    const toastStore = useToastStore();

    const { schedulePersist, flushPersist } = useEditorAutosave(() =>
      persistEditorText(),
    );

    const editor = useEditor({
      editable: false,
      extensions: [
        StarterKit,
        TextStyle,
        Color,
        FontFamily,
        FontSize,
        TaskList,
        TaskItem,
      ],
      content: props.content.text ? JSON.parse(props.content.text) : "",
      onCreate({ editor }) {
        nextTick(() => {
          checkOverflow();

          const container = textContentDiv.value;
          if (container) {
            const scrollableElement = container.querySelector(
              ".text-content",
            ) as HTMLElement;
            if (scrollableElement) {
              editorDomRef.value = scrollableElement;
              scrollableElement.addEventListener("scroll", handleScroll);
            }
          }
        });
      },
      onUpdate({ editor }) {
        // props.content.text = editor.getHTML();
        checkOverflow();
        if (isEditing.value) {
          schedulePersist();
        }
      },
    });

    const checkOverflow = () => {
      if (!editor || !editor.value?.view) return;

      const container = textContentDiv.value;
      if (!container) return;

      const editorDom = editor.value.view.dom as HTMLElement;
      const isOverflowing = container.clientHeight < editorDom.clientHeight + 5;

      isTextOverflowing.value = isOverflowing;

      checkScrollPosition();
    };

    const checkScrollPosition = () => {
      const container = textContentDiv.value;
      if (!container) return;

      const scrollableElement = container.querySelector(
        ".text-content",
      ) as HTMLElement;
      if (!scrollableElement) return;

      const threshold = 5;
      const isAtBottom =
        scrollableElement.scrollTop + scrollableElement.clientHeight >=
        scrollableElement.scrollHeight - threshold;

      isScrolledToBottom.value = isAtBottom;
    };

    const handleScroll = () => {
      checkScrollPosition();
    };

    const shouldShowOverflow = computed(
      () => isTextOverflowing.value && !isScrolledToBottom.value,
    );

    watch(
      [() => layoutStore.isOwner, () => isEditing.value],
      ([isOwner, editing]) => {
        if (!editor?.value) return;

        const shouldBeEditable = isOwner && editing;
        editor.value.setEditable(shouldBeEditable);

        if (shouldBeEditable) {
          editor.value.commands.focus("end");
          return;
        }

        // Ensure the editor never appears editable to public viewers.
        editor.value.commands.blur();

        if (!isOwner) {
          isEditing.value = false;
          return;
        }
        // Owner is leaving edit mode: flush any pending debounce and persist.
        flushPersist();
      },
    );

    const onShortClick = () => {
      if (!layoutStore.isOwner) {
        if (textLinkExists.value) {
          window.open(textLink.value, "_blank", "noopener,noreferrer");
        }
        return;
      }
      if (!editor?.value) return;

      if (!isEditing.value) {
        isEditing.value = true;
        return;
      }

      if (!editor.value.isFocused) {
        editor.value.commands.focus("end");
      }
    };

    const onExitClick = () => {
      isEditing.value = false;
    };

    // Inject the tile ID provided by GridTile so we can check if this tile
    // should auto-focus on mount (e.g. after paste or toolbar "add text").
    const tileId = inject<string | null>("tileId", null);

    onMounted(() => {
      // If this tile was just created and flagged for auto-focus, enter
      // edit mode immediately so the user can start typing right away.
      if (
        tileId &&
        layoutStore.isOwner &&
        layoutStore.pendingFocusTileId === tileId
      ) {
        layoutStore.pendingFocusTileId = null;
        isEditing.value = true;
      }
    });

    onUnmounted(() => {
      if (editorDomRef.value) {
        editorDomRef.value.removeEventListener("scroll", handleScroll);
        editorDomRef.value = null;
      }
    });

    const openUrlInput = () => {
      if (!layoutStore.isOwner) return;
      showLinkModal.value = true;
    };

    const closeLinkModal = () => {
      showLinkModal.value = false;
    };

    const normalizeUrl = (link: string): string => {
      const trimmed = link.trim();
      if (!trimmed) return "";
      const normalized =
        trimmed.startsWith("http://") || trimmed.startsWith("https://")
          ? trimmed
          : `https://${trimmed}`;
      try {
        new URL(normalized);
        return normalized;
      } catch (error) {
        return "";
      }
    };

    const handleAddLink = (link: string) => {
      if (!layoutStore.isOwner) return;
      const normalized = normalizeUrl(link);
      if (!normalized) {
        toastStore.addToast("Invalid URL format", "error");
        return;
      }
      props.content.textLink = normalized;
      if (tileId) {
        layoutStore.patchTileContent(tileId, { textLink: normalized });
      } else {
        layoutStore.saveLayout();
      }
      showLinkModal.value = false;
    };

    const handleOwnerClick = () => {
      if (!textLinkExists.value) return;

      window.open(textLink.value, "_blank", "noopener,noreferrer");
    };

    const { backgroundColor, textColor, handleBackgroundColorChange } =
      useColorPicker(tileId, props.content, emit);

    const handleTextAlignChange = (align: "left" | "center" | "right") => {
      if (!layoutStore.isOwner) return;
      props.content.textAlign = align;
      if (tileId) {
        layoutStore.patchTileContent(tileId, { textAlign: align });
      }
    };

    const persistEditorText = () => {
      if (!editor.value || !layoutStore.isOwner) return;

      const output = JSON.stringify(editor.value.getJSON());

      if (tileId && layoutStore.currentLayout) {
        const tile = layoutStore.currentLayout.tiles.find(
          (t) => t.i === tileId,
        );
        if (tile && (tile.content as TextContent).type === "text") {
          (tile.content as TextContent).text = output;
        }
      } else {
        props.content.text = output;
      }

      layoutStore.saveLayout();
    };

    const syncMarkState = () => {
      const e = editor.value;
      if (!e) return;
      isBoldActive.value = e.isActive("bold");
      isItalicActive.value = e.isActive("italic");
    };

    watch(
      editor,
      (e, _prev, onCleanup) => {
        if (!e) return;
        syncMarkState();
        e.on("selectionUpdate", syncMarkState);
        e.on("transaction", syncMarkState);

        onCleanup(() => {
          e.off("selectionUpdate", syncMarkState);
          e.off("transaction", syncMarkState);
        });
      },
      { immediate: true },
    );

    const toggleItalic = () => {
      if (!editor.value) return;
      editor.value.chain().focus().toggleItalic().run();
    };

    const toggleBold = () => {
      if (!editor.value) return;
      editor.value.chain().focus().toggleBold().run();
    };

    const handleFontSizeChange = (size: string) => {
      if (!editor.value) return;

      let fontSizePx = "14px";
      const normalizedSize = size.trim().toLowerCase();

      if (normalizedSize === "small") {
        fontSizePx = "12px";
      } else if (normalizedSize === "medium") {
        fontSizePx = "14px";
      } else if (normalizedSize === "large") {
        fontSizePx = "20px";
      } else if (normalizedSize === "larger") {
        fontSizePx = "26px";
      }

      editor.value
        .chain()
        .focus(undefined, { scrollIntoView: false })
        .setFontSize(fontSizePx)
        .run();
    };

    const getCurrentFontSize = () => {
      let fontSize = editor.value?.getAttributes("textStyle")?.fontSize;

      if (!fontSize) {
        return "Medium";
      }

      if (fontSize === "12px") {
        return "Small";
      } else if (fontSize === "14px") {
        return "Medium";
      } else if (fontSize === "20px") {
        return "Large";
      } else if (fontSize === "26px") {
        return "Larger";
      }

      return fontSize;
    };

    const handleFontChange = (font: string) => {
      if (!editor.value) return;

      editor.value
        .chain()
        .focus(undefined, { scrollIntoView: false })
        .setFontFamily(font)
        .run();
    };

    const getCurrentFont = () => {
      const fontFamily = editor.value?.getAttributes("textStyle")?.fontFamily;
      return fontFamily || "Inter";
    };

    return {
      layoutStore,
      editor,
      shouldShowOverflow,
      isEditing,
      textContentDiv,
      showLinkModal,
      isTallOneWide,
      isOneByOne,
      isWideOneHigh,
      textLinkExists,
      backgroundColor,
      textColor,
      textAlign,
      onShortClick,
      onExitClick,
      openUrlInput,
      closeLinkModal,
      handleAddLink,
      handleOwnerClick,
      handleBackgroundColorChange,
      handleTextAlignChange,
      toggleItalic,
      toggleBold,
      isBoldActive,
      isItalicActive,
      isOwner,
      getCurrentFontSize,
      handleFontSizeChange,
      handleFontChange,
      getCurrentFont,
    };
  },
});
</script>

<style scoped>
.text-container {
  height: 100%;
  padding: var(--spacing-sm);
  display: flex;
  font-family: "Inter";
}

.text-content {
  padding: var(--spacing-md);
  width: 100%;
  scroll-behavior: smooth;
  border-radius: var(--radius-lg);
  overflow: auto;
  margin: 0;
  line-height: 1.3;
  transition: background-color 0.3s ease;
  position: relative;
  color: var(--tile-text-color);

  &::-webkit-scrollbar {
    display: none;
  }
}

.not-editing {
  background-color: transparent;
}

.not-editing.can-edit:hover {
  background-color: color-mix(
    in srgb,
    var(--tile-bg) 85%,
    var(--tile-text-color) 15%
  );
  cursor: text;
}

.overflowing::after {
  content: "...";
  position: absolute;
  right: 18px;
  bottom: 12px;
  color: inherit;
}

:deep(.ProseMirror:focus-visible) {
  outline: transparent !important;
}

.text-content ::selection {
  background: highlight;
  color: inherit;
}

/* Fix for Task List Items */
:deep(ul[data-type="taskList"]) {
  padding: 0;
  margin: 0;
  list-style-type: none; /* Removes the default bullet point */
}

:deep(ul[data-type="taskList"] li) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(ul[data-type="taskList"] li label) {
  display: inline-flex;
  align-items: center;
}

:deep(ul[data-type="taskList"] li input[type="checkbox"]) {
  margin: 0;
}

:deep(ul[data-type="taskList"] li div) {
  min-height: 1em;
  min-width: 1px;
  display: inline-block;
}

:deep(ul[data-type="taskList"] li p) {
  margin: 0;
  min-height: 1em;
  min-width: 1px;
  display: inline-block;
}

:deep(.ProseMirror strong) {
  font-weight: 700;
}

:deep(.ProseMirror em) {
  font-style: italic;
}

:deep(.ProseMirror strong em),
:deep(.ProseMirror em strong) {
  font-weight: 700;
  font-style: italic;
}

.text-content.is-wide-1-high .tile-link-indicator {
  margin-left: auto;
}

.text-content.is-tall-1-wide .tile-link-indicator--bottom {
  margin-top: auto;
  align-self: flex-end;
  width: 100%;
}

.tile-link-indicator {
  position: fixed;
  top: 21px;
  right: 21px;
  width: 24px;
  height: 24px;
  color: inherit;
  opacity: 0.21;
  transition: opacity var(--duration-fast) var(--easing-ease-in-out);
  pointer-events: auto;
  z-index: 1200;
}

.text-content.viewer-view:hover .tile-link-indicator {
  opacity: 1;
}

.text-content.owner-view .tile-link-indicator:hover {
  opacity: 1;
}

.tile-link-indicator:hover {
  cursor: pointer;
}

.tile-link-indicator-icon {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
