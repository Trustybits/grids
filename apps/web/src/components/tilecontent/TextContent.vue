<!-- eslint-disable vue/no-mutating-props -->
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
        'can-edit': gridStore.canEdit,
        'is-wide-1-high': isWideOneHigh,
        'is-tall-1-wide': isTallOneWide,
        'owner-view': gridStore.canEdit,
        'viewer-view': !gridStore.canEdit,
        'is-overflowing': isTextOverflowing,
      }"
      :style="{
        '--tile-bg': backgroundColor,
        '--tile-text-color': textColor,
        color: textColor,
        textAlign: textAlign,
        justifyContent: verticalAlignJustify,
      }"
      :spellcheck="gridStore.canEdit && isEditing"
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
</template>

<script lang="ts">
/* eslint-disable vue/no-mutating-props */
import {
  defineComponent,
  ref,
  watch,
  inject,
  computed,
  toRef,
  type ComputedRef,
  nextTick,
  onUnmounted,
} from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import { FontSize } from "../../extensions/tiptap/FontSize";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useGridStore } from "@/stores/grid";
import FloatingInputModal from "../modal/FloatingInputModal.vue";
import { isValidLink } from "@/utils/UrlValidation";
import LinkIndicatorIcon from "../icons/LinkIndicatorIcon.vue";
import type { TextContent } from "@grids/contracts/types";
import { useTileLink } from "@/composables/useTileLink";
import { useColorPicker } from "@/composables/useColorPicker";
import { useEditorAutosave } from "@/composables/useEditorAutosave";
import {
  useEditingLifecycle,
  useEditorContentSync,
} from "@/composables/useEditingLifecycle";

export default defineComponent({
  components: {
    EditorContent,
    FloatingInputModal,
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
    const gridStore = useGridStore();

    // Reactive ref so the template updates when canEdit changes
    // (e.g. owner toggles a larger-than-viewport breakpoint preview).
    const isOwner = computed(() => gridStore.canEdit);

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
    const verticalAlign = computed(() => props.content?.verticalAlign ?? "top");

    // Map the stored vertical alignment to a flex justify-content value. When
    // the text overflows the tile we force top alignment so the scrollable
    // content stays reachable (centered/bottom flex content clips its top edge
    // and cannot be scrolled into view).
    const verticalAlignJustify = computed(() => {
      if (isTextOverflowing.value) return "flex-start";
      switch (verticalAlign.value) {
        case "center":
          return "center";
        case "bottom":
          return "flex-end";
        default:
          return "flex-start";
      }
    });

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
      onCreate({ editor: _editor }) {
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
      onUpdate({ editor: _editor }) {
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

    const { tileId } = useEditingLifecycle({
      editor,
      isEditing,
      containerRef: textContentDiv,
      flushPersist,
    });

    useEditorContentSync(editor, () => props.content.text);

    const onShortClick = () => {
      if (!gridStore.canEdit) {
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
      useColorPicker(tileId, toRef(props, "content"), emit);

    const handleTextAlignChange = (align: "left" | "center" | "right") => {
      if (!gridStore.canEdit) return;
      props.content.textAlign = align;
      if (tileId) {
        gridStore.patchTileContent(tileId, { textAlign: align });
      }
    };

    const handleVerticalAlignChange = (align: "top" | "center" | "bottom") => {
      if (!gridStore.canEdit) return;
      props.content.verticalAlign = align;
      if (tileId) {
        gridStore.patchTileContent(tileId, { verticalAlign: align });
      }
    };

    const persistEditorText = () => {
      if (!editor.value || !gridStore.canEdit) return;

      const output = JSON.stringify(editor.value.getJSON());

      if (tileId && gridStore.currentGrid) {
        const tile = gridStore.currentGrid.tiles.find(
          (t) => t.i === tileId,
        );
        if (tile && (tile.content as TextContent).type === "text") {
          (tile.content as TextContent).text = output;
        }
      } else {
        props.content.text = output;
      }

      gridStore.saveGrid();
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
      const fontSize = editor.value?.getAttributes("textStyle")?.fontSize;

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
      gridStore,
      editor,
      shouldShowOverflow,
      isEditing,
      textContentDiv,
      isValidLink,
      showLinkModal,
      isTallOneWide,
      isOneByOne,
      isWideOneHigh,
      tileLinkExists,
      backgroundColor,
      textColor,
      textAlign,
      verticalAlign,
      verticalAlignJustify,
      onShortClick,
      onExitClick,
      openUrlInput,
      closeLinkModal,
      handleAddLink,
      handleFollowLink,
      clearLink,
      handleBackgroundColorChange,
      handleTextAlignChange,
      handleVerticalAlignChange,
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
  /* Flex column lets justify-content position the editor content vertically
     (top / center / bottom) within the full-height tile. The justify-content
     value itself is bound inline from the tile's verticalAlign setting. */
  display: flex;
  flex-direction: column;
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

/* Strip the leading/trailing block margins (browser defaults on <p>,
   headings, etc.). Without this, a single line of text measures ~1em of
   phantom margin top and bottom, which inflates the editor's scrollHeight
   past a short tile's available height and triggers a false overflow
   scrollbar even when the text fits on one line. Inter-paragraph spacing is
   preserved because only the first/last child margins are removed. */
:deep(.ProseMirror > :first-child) {
  margin-top: 0;
}

:deep(.ProseMirror > :last-child) {
  margin-bottom: 0;
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

/* Divider (horizontal rule). The browser default renders a flat grey line
   that clashes on colored backgrounds. Derive it from the tile's own text
   color mixed into transparent so it stays a subtle, contrast-aware line on
   light, dark, and colored tiles. */
:deep(hr) {
  border: none;
  height: 1px;
  margin: 0.75em 0;
  background: color-mix(in srgb, var(--tile-text-color) 21%, transparent);
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
