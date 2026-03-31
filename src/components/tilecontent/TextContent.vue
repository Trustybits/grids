<template>
  <div
    class="text-container"
    ref="textContentDiv"
    :class="{ overflowing: shouldShowOverflow }"
  >
    <div
      class="text-content scrollable-thin"
      :class="{
        'not-editing': !isEditing,
        'can-edit': layoutStore.canEdit,
        'is-wide-1-high': isWideOneHigh,
        'is-tall-1-wide': isTallOneWide,
        'owner-view': layoutStore.canEdit,
        'viewer-view': !layoutStore.canEdit,
        'is-overflowing': isTextOverflowing,
      }"
      :style="{
        '--tile-bg': backgroundColor,
        '--tile-text-color': textColor,
        color: textColor,
        textAlign: textAlign,
      }"
      :spellcheck="layoutStore.canEdit && isEditing"
    >
      <EditorContent :editor="editor" />
      <div
        v-if="!isTallOneWide && !isOneByOne && tileLinkExists"
        class="tile-link-indicator"
        aria-hidden="true"
        @click="handleFollowLink"
      >
        <LinkIndicatorIcon class="tile-link-indicator-icon" />
      </div>
      <div
        v-if="isTallOneWide && tileLinkExists"
        class="tile-link-indicator tile-link-indicator--bottom"
        aria-hidden="true"
        @click="handleFollowLink"
      >
        <LinkIndicatorIcon class="tile-link-indicator-icon" />
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
import LinkIndicatorIcon from "../icons/LinkIndicatorIcon.vue";
import type { TextContent } from "@/types/TileContent";
import { useTileLink } from "@/composables/useTileLink";
import { useColorPicker } from "@/composables/useColorPicker";
import { useEditorAutosave } from "@/composables/useEditorAutosave";

export default defineComponent({
  components: {
    EditorContent,
    AddLinkModal,
    LinkIndicatorIcon,
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

    // Reactive ref so the template updates when canEdit changes
    // (e.g. owner toggles a larger-than-viewport breakpoint preview).
    const isOwner = computed(() => layoutStore.canEdit);

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

    const isBoldActive = ref(false);
    const isItalicActive = ref(false);
    const textAlign = computed(() => props.content?.textAlign ?? "left");

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

      const scrollableElement = container.querySelector(
        ".text-content",
      ) as HTMLElement;
      if (!scrollableElement) return;

      const editorDom = editor.value.view.dom as HTMLElement;
      const style = getComputedStyle(scrollableElement);
      const paddingTop = parseFloat(style.paddingTop) || 0;
      const paddingBottom = parseFloat(style.paddingBottom) || 0;
      const availableHeight =
        scrollableElement.clientHeight - paddingTop - paddingBottom;
      const isOverflowing = editorDom.scrollHeight > availableHeight;

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
      [() => layoutStore.canEdit, () => isEditing.value],
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
      if (!layoutStore.canEdit) {
        if (tileLinkExists.value) {
          handleFollowLink();
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
        layoutStore.canEdit &&
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

    const {
      showLinkModal,
      tileLinkExists,
      openUrlInput,
      closeLinkModal,
      handleAddLink,
      handleFollowLink,
      clearLink,
    } = useTileLink(tileId, props.content);

    const { backgroundColor, textColor, handleBackgroundColorChange } =
      useColorPicker(tileId, props.content, emit);

    const handleTextAlignChange = (align: "left" | "center" | "right") => {
      if (!layoutStore.canEdit) return;
      props.content.textAlign = align;
      if (tileId) {
        layoutStore.patchTileContent(tileId, { textAlign: align });
      }
    };

    const persistEditorText = () => {
      if (!editor.value || !layoutStore.canEdit) return;

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
      tileLinkExists,
      backgroundColor,
      textColor,
      textAlign,
      onShortClick,
      onExitClick,
      openUrlInput,
      closeLinkModal,
      handleAddLink,
      handleFollowLink,
      clearLink,
      handleBackgroundColorChange,
      handleTextAlignChange,
      toggleItalic,
      toggleBold,
      isBoldActive,
      isItalicActive,
      isTextOverflowing,
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
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin: 0;
  line-height: 1.3;
  transition: background-color 0.3s ease;
  position: relative;
  color: var(--tile-text-color);
}

.text-content.is-overflowing {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scrollbar-color: transparent transparent;
}

.text-container:hover .text-content.is-overflowing {
  scrollbar-color: var(--color-border) transparent;
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
  /* content: "..."; */
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

.text-content.viewer-view:hover {
  cursor: pointer;
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
