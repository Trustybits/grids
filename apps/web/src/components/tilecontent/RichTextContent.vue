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
        'can-edit': gridView.canEdit,
        'is-wide-1-high': isWideOneHigh,
        'is-tall-1-wide': isTallOneWide,
        'owner-view': gridView.canEdit,
        'viewer-view': !gridView.canEdit,
        'is-overflowing': isScrollableOverflow,
      }"
      :style="{
        '--tile-bg': backgroundColor,
        '--tile-text-color': textColor,
        color: textColor,
        textAlign: textAlign,
        justifyContent: verticalAlignJustify,
      }"
      :spellcheck="gridView.canEdit && isEditing"
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
      <input
        ref="imageInput"
        type="file"
        accept="image/*"
        class="image-input"
      />
    </div>
  </div>
  <SlashMenu
    :visible="slashMenu.visible.value"
    :items="slashMenu.items.value"
    :selected-index="slashMenu.selectedIndex.value"
    :position="slashMenu.position.value"
    @select="slashMenu.execute"
  />
  <TableToolbar
    :editor="editor"
    :active="isEditing && gridView.canEdit"
    @changed="schedulePersist"
  />
  <InlineFieldsPopover
    :request="inlineFields.current.value"
    :position="inlineFields.position.value"
    @submit="inlineFields.submit"
    @cancel="inlineFields.cancel"
  />
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
/**
 * The unified text tile: renders `text` and `smart_text` tiles when the
 * `editor-unified-text` gate is on (see registries/tiles/text.ts). It is the
 * text tile's layout (vertical align, overflow rules, caret-at-click) plus
 * everything smart text could do: the slash menu, tables, images, buttons and
 * the block drag handle. What can be inserted comes from an editor profile.
 */
import {
  proxyRefs,
  defineComponent,
  ref,
  watch,
  inject,
  computed,
  toRef,
  type ComputedRef,
  type PropType,
  nextTick,
  onUnmounted,
} from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import type { Content } from "@tiptap/core";
import type {
  SmartTextContent,
  TextContent,
} from "@grids/contracts/types";
import { richTextSchemaExtensions } from "@/extensions/tiptap/richTextExtensions";
import { DragHandle } from "@/extensions/tiptap/DragHandle";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import FloatingInputModal from "../modal/FloatingInputModal.vue";
import LinkIndicatorIcon from "../icons/LinkIndicatorIcon.vue";
import SlashMenu from "../richtext/SlashMenu.vue";
import TableToolbar from "../richtext/TableToolbar.vue";
import InlineFieldsPopover from "../richtext/InlineFieldsPopover.vue";
import { isValidLink } from "@/utils/UrlValidation";
import {
  resolveVerticalAlignJustify,
  shouldDisableTopBottomAlign,
  isScrollableOverflow as computeScrollableOverflow,
  type VerticalAlign,
} from "@/utils/textTileAlign";
import { resolveShortClickPosition } from "@/utils/editorClickPosition";
import {
  fontSizeLabelToPx,
  getDefaultFont,
  pxToFontSizeLabel,
} from "@/utils/SmartTextHelpers";
import { FULL_PROFILE, type TextEditorProfile } from "@/utils/richText/profiles";
import {
  commandsForProfile,
  type InlineFieldsRequest,
  type InsertedImage,
} from "@/utils/richText/slashCommands";
import { useTileLink } from "@/composables/useTileLink";
import { useColorPicker } from "@/composables/useColorPicker";
import { useEditorAutosave } from "@/composables/useEditorAutosave";
import { useTileContentWriter } from "@/composables/useTileContentWriter";
import { useFileUpload } from "@/composables/useFileUpload";
import { placeBelowOrAbove, useSlashMenu } from "@/composables/useSlashMenu";
import { useInlineFields } from "@/composables/useInlineFields";
import {
  useEditingLifecycle,
  useEditorContentSync,
} from "@/composables/useEditingLifecycle";

type RichTextTileContent = TextContent | SmartTextContent;

/**
 * Stored text is a stringified Tiptap doc, `""` for an empty tile, or (for
 * very old tiles) plain text. Plain text loads as a paragraph instead of
 * throwing.
 */
export function parseStoredText(text: string | undefined): Content {
  if (!text) return "";
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Content)
      : text;
  } catch {
    return text;
  }
}

const INLINE_FIELDS_SIZE = { width: 280, height: 200 };

export default defineComponent({
  components: {
    EditorContent,
    FloatingInputModal,
    LinkIndicatorIcon,
    SlashMenu,
    TableToolbar,
    InlineFieldsPopover,
  },
  emits: ["background-color-change", "text-color-change"],
  props: {
    content: {
      type: Object as PropType<RichTextTileContent>,
      required: true,
    },
    profile: {
      type: Object as PropType<TextEditorProfile>,
      default: () => FULL_PROFILE,
    },
  },
  setup(props, { emit }) {
    const gridView = proxyRefs(useGridViewContext());
    const isOwner = computed(() => gridView.canEdit);
    const { uploadFileToArchive } = useFileUpload();

    const isTextOverflowing = ref(false);
    const isScrolledToBottom = ref(false);
    const editorDomRef = ref<HTMLElement | null>(null);
    const isEditing = ref(false);
    const textContentDiv = ref<HTMLDivElement | null>(null);
    const imageInput = ref<HTMLInputElement | null>(null);
    const resizeObserver = ref<ResizeObserver | null>(null);

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
    const verticalAlign = computed<VerticalAlign>(() =>
      "verticalAlign" in props.content && props.content.verticalAlign
        ? props.content.verticalAlign
        : "top",
    );

    const isScrollableOverflow = computed(() =>
      computeScrollableOverflow(isWideOneHigh.value, isTextOverflowing.value),
    );
    const disableTopBottomAlign = computed(() =>
      shouldDisableTopBottomAlign(isWideOneHigh.value, isTextOverflowing.value),
    );
    const verticalAlignJustify = computed(() =>
      resolveVerticalAlignJustify({
        verticalAlign: verticalAlign.value,
        isWideOneHigh: isWideOneHigh.value,
        isTextOverflowing: isTextOverflowing.value,
      }),
    );

    const { schedulePersist, flushPersist } = useEditorAutosave(() =>
      persistEditorText(),
    );

    // ── Slash menu and the inline UI its commands open ──────────────────
    const pickImage = (): Promise<InsertedImage | null> => {
      const input = imageInput.value;
      if (!input) return Promise.resolve(null);
      return new Promise((resolve) => {
        const settle = (file: File | null) => {
          input.removeEventListener("change", onChange);
          input.removeEventListener("cancel", onCancel);
          input.value = "";
          if (!file) {
            resolve(null);
            return;
          }
          uploadFileToArchive(file, { fileType: "images" })
            .then(({ url, hash }) =>
              resolve({ src: url, alt: file.name || "image", hash }),
            )
            .catch((error: unknown) => {
              console.error("[RichText] image upload failed:", error);
              resolve(null);
            });
        };
        const onChange = () => settle(input.files?.[0] ?? null);
        const onCancel = () => settle(null);
        input.addEventListener("change", onChange, { once: true });
        input.addEventListener("cancel", onCancel, { once: true });
        input.click();
      });
    };

    const inlineFields = useInlineFields();
    const requestFields = (request: InlineFieldsRequest) => {
      const e = editor.value;
      const caret = e
        ? e.view.coordsAtPos(e.state.selection.from)
        : { top: 0, bottom: 0, left: 0 };
      return inlineFields.request(
        request,
        placeBelowOrAbove(caret, INLINE_FIELDS_SIZE),
      );
    };

    const slashCommands = computed(() => commandsForProfile(props.profile));
    const slashMenu = useSlashMenu({
      editor: computed(() => editor.value),
      isActive: () => isEditing.value && gridView.canEdit,
      commands: () => slashCommands.value,
      pickImage,
      requestFields,
      onCommandDone: () => schedulePersist(),
    });

    const editor = useEditor({
      editable: false,
      extensions: [
        ...richTextSchemaExtensions(),
        DragHandle.configure({ isEditing }),
      ],
      content: parseStoredText(props.content.text),
      onCreate() {
        nextTick(() => {
          checkOverflow();
          const scrollable = textContentDiv.value?.querySelector<HTMLElement>(
            ".text-content",
          );
          if (!scrollable) return;
          editorDomRef.value = scrollable;
          scrollable.addEventListener("scroll", handleScroll);
          if (typeof ResizeObserver !== "undefined") {
            resizeObserver.value = new ResizeObserver(() =>
              scheduleCheckOverflow(),
            );
            resizeObserver.value.observe(scrollable);
          }
        });
      },
      onUpdate() {
        checkOverflow();
        if (isEditing.value) schedulePersist();
        slashMenu.update();
      },
      onSelectionUpdate() {
        slashMenu.update();
      },
      editorProps: {
        handleKeyDown: (_view, event) => slashMenu.handleKeyDown(event),
      },
    });

    // ── Overflow (same rules as the classic text tile) ──────────────────
    const checkScrollPosition = () => {
      const scrollable = editorDomRef.value;
      if (!scrollable) return;
      isScrolledToBottom.value =
        scrollable.scrollTop + scrollable.clientHeight >=
        scrollable.scrollHeight - 5;
    };

    const checkOverflow = () => {
      const view = editor.value?.view;
      const scrollable = textContentDiv.value?.querySelector<HTMLElement>(
        ".text-content",
      );
      if (!view || !scrollable) return;
      const style = getComputedStyle(scrollable);
      const available =
        scrollable.clientHeight -
        (parseFloat(style.paddingTop) || 0) -
        (parseFloat(style.paddingBottom) || 0);
      isTextOverflowing.value =
        (view.dom as HTMLElement).scrollHeight > available;
      checkScrollPosition();
    };

    const handleScroll = () => checkScrollPosition();

    let overflowRafId: number | null = null;
    const scheduleCheckOverflow = () => {
      if (overflowRafId != null) return;
      overflowRafId = requestAnimationFrame(() => {
        overflowRafId = null;
        checkOverflow();
      });
    };

    const shouldShowOverflow = computed(
      () => isScrollableOverflow.value && !isScrolledToBottom.value,
    );

    // ── Editing lifecycle ───────────────────────────────────────────────
    let pendingFocusPosition: number | null = null;

    const { tileId } = useEditingLifecycle({
      editor,
      isEditing,
      containerRef: textContentDiv,
      flushPersist,
      resolveFocusPosition: () => {
        const position = pendingFocusPosition ?? "end";
        pendingFocusPosition = null;
        return position;
      },
      onExit: () => {
        slashMenu.hide();
        inlineFields.cancel();
      },
      // Picking an image or filling in a link happens outside the tile; those
      // clicks must not end the edit session that started the command.
      shouldBlockExit: () => slashMenu.running.value,
    });
    const { patchContent, autosaveContent } = useTileContentWriter(
      tileId,
      () => props.content,
    );

    useEditorContentSync(editor, () => props.content.text, (text) =>
      parseStoredText(text),
    );

    // Only reached for a settled click or tap (see TextContent.onShortClick):
    // drags and swipe-to-scroll never enter edit mode.
    const onShortClick = (event?: MouseEvent | TouchEvent) => {
      if (!gridView.canEdit) {
        if (tileLinkExists.value) handleFollowLink();
        return;
      }
      if (!editor.value) return;
      if (!isEditing.value) {
        pendingFocusPosition = resolveShortClickPosition(
          editor.value.view,
          event,
        );
        isEditing.value = true;
        return;
      }
      if (!editor.value.isFocused) editor.value.commands.focus("end");
    };

    const onExitClick = () => {
      if (slashMenu.running.value) return;
      isEditing.value = false;
    };

    onUnmounted(() => {
      editorDomRef.value?.removeEventListener("scroll", handleScroll);
      editorDomRef.value = null;
      resizeObserver.value?.disconnect();
      resizeObserver.value = null;
      if (overflowRafId != null) cancelAnimationFrame(overflowRafId);
      inlineFields.cancel();
    });

    // ── Tile-level settings ─────────────────────────────────────────────
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
      if (!gridView.canEdit) return;
      patchContent({ textAlign: align });
    };

    const handleVerticalAlignChange = (align: VerticalAlign) => {
      if (!gridView.canEdit) return;
      patchContent({ verticalAlign: align } as Partial<RichTextTileContent>);
    };

    const persistEditorText = () => {
      if (!editor.value || !gridView.canEdit) return;
      // An empty editor serializes to a non-empty doc rather than the `""` a
      // fresh tile stores; persist "" so an untouched tile registers no change.
      const output = editor.value.isEmpty
        ? ""
        : JSON.stringify(editor.value.getJSON());
      autosaveContent({ text: output });
    };

    // ── Text formatting (tile toolbar) ──────────────────────────────────
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
      editor.value?.chain().focus().toggleItalic().run();
    };

    const toggleBold = () => {
      editor.value?.chain().focus().toggleBold().run();
    };

    const handleFontSizeChange = (size: string) => {
      editor.value
        ?.chain()
        .focus(undefined, { scrollIntoView: false })
        .setFontSize(fontSizeLabelToPx(size))
        .run();
    };

    const getCurrentFontSize = () =>
      pxToFontSizeLabel(editor.value?.getAttributes("textStyle")?.fontSize);

    const handleFontChange = (font: string) => {
      editor.value
        ?.chain()
        .focus(undefined, { scrollIntoView: false })
        .setFontFamily(font)
        .run();
    };

    const getCurrentFont = () =>
      getDefaultFont(editor.value?.getAttributes("textStyle")?.fontFamily);

    return {
      gridView,
      editor,
      shouldShowOverflow,
      isEditing,
      textContentDiv,
      imageInput,
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
      slashMenu,
      inlineFields,
      schedulePersist,
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
      isScrollableOverflow,
      disableTopBottomAlign,
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
  /* Flex column so justify-content (bound from verticalAlign) can place the
     content at the top, center or bottom of the tile. */
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

.image-input {
  display: none;
}

:deep(.ProseMirror),
:deep(.ProseMirror:focus-visible) {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
}

/* Strip the leading/trailing block margins so a single line doesn't measure
   ~1em of phantom margin and trigger a false overflow scrollbar. */
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

:deep(blockquote) {
  border-left: 2px solid
    color-mix(in srgb, var(--tile-text-color) 35%, transparent);
  margin: 0;
  padding-left: 10px;
  opacity: 0.95;
}

/* Divider: derived from the tile's text color so it stays a subtle,
   contrast-aware line on light, dark and colored tiles. */
:deep(hr) {
  border: none;
  height: 1px;
  margin: 0.75em 0;
  background: color-mix(in srgb, var(--tile-text-color) 21%, transparent);
}

:deep(ul[data-type="taskList"]) {
  padding: 0;
  margin: 0;
  list-style-type: none;
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

/* Inline links follow the tile's text color (automatic or picked) rather
   than the browser's default blue, which clashes with most tile colors. */
:deep(.ProseMirror a[href]:not(.smart-button)) {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

:deep(.ProseMirror .image-node-view) {
  max-width: 100%;
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

.text-content.viewer-view:hover .tile-link-indicator,
.text-content.owner-view .tile-link-indicator:hover {
  opacity: 1;
}

.text-content.viewer-view:hover,
.tile-link-indicator:hover {
  cursor: pointer;
}

.tile-link-indicator-icon {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
