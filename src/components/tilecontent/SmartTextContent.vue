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
        'can-edit': layoutStore.canEdit,
        'is-wide-1-high': isWideOneHigh,
        'is-tall-1-wide': isTallOneWide,
        'owner-view': layoutStore.canEdit,
        'viewer-view': !layoutStore.canEdit,
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
        v-if="showSlashMenu && filteredSlashCommands.length > 0"
        class="slash-menu"
        :style="{
          top: `${slashMenuPosition.top}px`,
          left: `${slashMenuPosition.left}px`,
        }"
      >
        <button
          v-for="(item, idx) in filteredSlashCommands"
          :key="item.id"
          type="button"
          class="slash-menu-item"
          :class="{ active: idx === selectedSlashIndex }"
          @mousedown.prevent
          @click="executeSlashByIndex(idx)"
        >
          <span class="slash-menu-label">{{ item.label }}</span>
          <span class="slash-menu-hint">{{ item.hint }}</span>
        </button>
      </div>
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
        style="display: none"
      />
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
import { useEditor, EditorContent, type Editor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { FontSize } from "../tiptap/FontSize";
import { SmartButton } from "../tiptap/SmartButton";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useLayoutStore } from "@/stores/layout";
import AddLinkModal from "../AddLinkModal.vue";
import LinkIndicatorIcon from "../icons/LinkIndicatorIcon.vue";
import type { SmartTextContent } from "@/types/TileContent";
import { useTileLink } from "@/composables/useTileLink";
import { useColorPicker } from "@/composables/useColorPicker";
import { useEditorAutosave } from "@/composables/useEditorAutosave";
import { useFileUpload } from "@/composables/useFileUpload";

type SlashCommand = {
  id: string;
  label: string;
  hint: string;
  keywords: string[];
  run: (editor: Editor) => void | Promise<void>;
};

export default defineComponent({
  components: {
    EditorContent,
    AddLinkModal,
    LinkIndicatorIcon,
  },
  emits: ["background-color-change", "text-color-change"],
  props: {
    content: {
      type: Object as () => SmartTextContent,
      required: true,
    },
  },
  setup(props, { emit }) {
    const layoutStore = useLayoutStore();
    const imageInput = ref<HTMLInputElement | null>(null);
    const { uploadFileToUrl } = useFileUpload();

    const isOwner = computed(() => layoutStore.canEdit);
    const isTextOverflowing = ref(false);
    const isScrolledToBottom = ref(false);
    const editorDomRef = ref<HTMLElement | null>(null);
    const isEditing = ref(false);
    const textContentDiv = ref<HTMLDivElement | null>(null);
    const showSlashMenu = ref(false);
    const slashQuery = ref("");
    const selectedSlashIndex = ref(0);
    const slashMenuPosition = ref({ top: 0, left: 0 });
    const slashFrom = ref<number | null>(null);
    const slashTo = ref<number | null>(null);

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

    const normalizeHttpUrl = (input: string): string => {
      const trimmed = input.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
      }
      return `https://${trimmed}`;
    };

    const pickImageFile = async (): Promise<File | null> => {
      if (!imageInput.value) return null;
      return new Promise((resolve) => {
        const input = imageInput.value!;
        const onChange = () => {
          const file = input.files?.[0] ?? null;
          input.value = "";
          input.removeEventListener("change", onChange);
          resolve(file);
        };
        input.addEventListener("change", onChange, { once: true });
        input.click();
      });
    };

    const slashCommands: SlashCommand[] = [
      {
        id: "h1",
        label: "Heading 1",
        hint: "/h1",
        keywords: ["h1", "heading", "title"],
        run: (editor) => {
          editor.chain().focus().toggleHeading({ level: 1 }).run();
        },
      },
      {
        id: "h2",
        label: "Heading 2",
        hint: "/h2",
        keywords: ["h2", "heading", "subtitle"],
        run: (editor) => {
          editor.chain().focus().toggleHeading({ level: 2 }).run();
        },
      },
      {
        id: "bullet",
        label: "Bulleted list",
        hint: "/bullet",
        keywords: ["bullet", "list", "ul"],
        run: (editor) => {
          editor.chain().focus().toggleBulletList().run();
        },
      },
      {
        id: "numbered",
        label: "Numbered list",
        hint: "/numbered",
        keywords: ["numbered", "ordered", "ol"],
        run: (editor) => {
          editor.chain().focus().toggleOrderedList().run();
        },
      },
      {
        id: "todo",
        label: "To-do list",
        hint: "/todo",
        keywords: ["todo", "task", "checkbox"],
        run: (editor) => {
          editor.chain().focus().toggleTaskList().run();
        },
      },
      {
        id: "quote",
        label: "Quote",
        hint: "/quote",
        keywords: ["quote", "blockquote"],
        run: (editor) => {
          editor.chain().focus().toggleBlockquote().run();
        },
      },
      {
        id: "divider",
        label: "Divider",
        hint: "/divider",
        keywords: ["divider", "rule", "hr"],
        run: (editor) => {
          editor.chain().focus().setHorizontalRule().run();
        },
      },
      {
        id: "image",
        label: "Image",
        hint: "/image",
        keywords: ["image", "photo", "upload"],
        run: async (editor) => {
          const file = await pickImageFile();
          if (!file) return;
          const url = await uploadFileToUrl(file, { fileType: "images" });
          editor
            .chain()
            .focus()
            .setImage({ src: url, alt: file.name || "image" })
            .insertContent({ type: "paragraph" })
            .run();
        },
      },
      {
        id: "link",
        label: "Link",
        hint: "/link",
        keywords: ["link", "url"],
        run: (editor) => {
          const rawUrl = window.prompt("Enter URL");
          if (!rawUrl) return;
          const href = normalizeHttpUrl(rawUrl);
          if (!href) return;
          const label = window.prompt("Link text", href) || href;
          editor
            .chain()
            .focus()
            .insertContent({
              type: "text",
              text: label,
              marks: [{ type: "link", attrs: { href } }],
            })
            .run();
        },
      },
      {
        id: "button",
        label: "Button link",
        hint: "/button",
        keywords: ["button", "cta", "link"],
        run: (editor) => {
          const rawUrl = window.prompt("Enter button URL");
          if (!rawUrl) return;
          const href = normalizeHttpUrl(rawUrl);
          if (!href) return;
          const label = window.prompt("Button label", "Button") || "Button";
          editor
            .chain()
            .focus()
            .insertContent({
              type: "smartButton",
              attrs: { href, label },
            })
            .insertContent({ type: "paragraph" })
            .run();
        },
      },
    ];

    const filteredSlashCommands = computed(() => {
      const q = slashQuery.value.trim().toLowerCase();
      if (!q) return slashCommands;
      return slashCommands.filter((item) =>
        item.keywords.some((k) => k.includes(q)),
      );
    });

    const hideSlashMenu = () => {
      showSlashMenu.value = false;
      slashQuery.value = "";
      selectedSlashIndex.value = 0;
      slashFrom.value = null;
      slashTo.value = null;
    };

    const updateSlashState = () => {
      const e = editor.value;
      if (!e || !isEditing.value || !layoutStore.canEdit) {
        hideSlashMenu();
        return;
      }

      const { state, view } = e;
      const { from, $from } = state.selection;
      if (!$from.parent.isTextblock || !state.selection.empty) {
        hideSlashMenu();
        return;
      }

      const parentOffset = $from.parentOffset;
      const parentStart = from - parentOffset;
      const textBeforeCursor = $from.parent.textBetween(
        0,
        parentOffset,
        "\0",
        "\0",
      );

      if (!textBeforeCursor.startsWith("/")) {
        hideSlashMenu();
        return;
      }

      const query = textBeforeCursor.slice(1);
      if (query.includes(" ")) {
        hideSlashMenu();
        return;
      }

      const coords = view.coordsAtPos(from);
      const containerRect = textContentDiv.value?.getBoundingClientRect();
      const left = containerRect
        ? coords.left - containerRect.left + 8
        : coords.left;
      const top = containerRect ? coords.bottom - containerRect.top + 8 : coords.bottom;

      slashFrom.value = parentStart;
      slashTo.value = from;
      slashQuery.value = query;
      slashMenuPosition.value = { top, left };
      showSlashMenu.value = true;

      const maxIndex = Math.max(0, filteredSlashCommands.value.length - 1);
      if (selectedSlashIndex.value > maxIndex) {
        selectedSlashIndex.value = 0;
      }
    };

    const executeSlashCommand = async (command: SlashCommand) => {
      const e = editor.value;
      if (!e) return;
      if (slashFrom.value !== null && slashTo.value !== null) {
        e.chain().focus().deleteRange({ from: slashFrom.value, to: slashTo.value }).run();
      }
      hideSlashMenu();
      await command.run(e);
      schedulePersist();
    };

    const executeSlashByIndex = async (index: number) => {
      const command = filteredSlashCommands.value[index];
      if (!command) return;
      await executeSlashCommand(command);
    };

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
        SmartButton,
        Link.configure({
          autolink: true,
          openOnClick: true,
        }),
        Image,
      ],
      content: props.content.text ? JSON.parse(props.content.text) : "",
      onCreate() {
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
      onUpdate() {
        checkOverflow();
        if (isEditing.value) {
          schedulePersist();
        }
        updateSlashState();
      },
      onSelectionUpdate() {
        updateSlashState();
      },
      editorProps: {
        handleKeyDown(_view, event) {
          if (!showSlashMenu.value || filteredSlashCommands.value.length === 0) {
            return false;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            selectedSlashIndex.value =
              (selectedSlashIndex.value + 1) % filteredSlashCommands.value.length;
            return true;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            selectedSlashIndex.value =
              (selectedSlashIndex.value - 1 + filteredSlashCommands.value.length) %
              filteredSlashCommands.value.length;
            return true;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            void executeSlashByIndex(selectedSlashIndex.value);
            return true;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            hideSlashMenu();
            return true;
          }
          return false;
        },
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
      [() => layoutStore.canEdit, () => isEditing.value],
      ([canEdit, editing]) => {
        if (!editor?.value) return;
        const shouldBeEditable = canEdit && editing;
        editor.value.setEditable(shouldBeEditable);
        if (shouldBeEditable) {
          editor.value.commands.focus("end");
          return;
        }
        editor.value.commands.blur();
        hideSlashMenu();
        if (!canEdit) {
          isEditing.value = false;
          return;
        }
        flushPersist();
      },
    );

    const onShortClick = () => {
      if (!layoutStore.canEdit) {
        if (tileLinkExists.value) handleFollowLink();
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
      hideSlashMenu();
    };

    const tileId = inject<string | null>("tileId", null);

    onMounted(() => {
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
        const tile = layoutStore.currentLayout.tiles.find((t) => t.i === tileId);
        if (tile && (tile.content as SmartTextContent).type === "smart_text") {
          (tile.content as SmartTextContent).text = output;
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
      if (normalizedSize === "small") fontSizePx = "12px";
      else if (normalizedSize === "medium") fontSizePx = "14px";
      else if (normalizedSize === "large") fontSizePx = "20px";
      else if (normalizedSize === "larger") fontSizePx = "26px";
      editor.value
        .chain()
        .focus(undefined, { scrollIntoView: false })
        .setFontSize(fontSizePx)
        .run();
    };

    const getCurrentFontSize = () => {
      const fontSize = editor.value?.getAttributes("textStyle")?.fontSize;
      if (!fontSize) return "Medium";
      if (fontSize === "12px") return "Small";
      if (fontSize === "14px") return "Medium";
      if (fontSize === "20px") return "Large";
      if (fontSize === "26px") return "Larger";
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
      isOwner,
      getCurrentFontSize,
      handleFontSizeChange,
      handleFontChange,
      getCurrentFont,
      imageInput,
      showSlashMenu,
      filteredSlashCommands,
      selectedSlashIndex,
      slashMenuPosition,
      executeSlashByIndex,
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

.slash-menu {
  position: absolute;
  z-index: 1300;
  display: flex;
  flex-direction: column;
  min-width: 220px;
  max-width: 300px;
  max-height: 240px;
  overflow: auto;
  padding: 4px;
  border-radius: var(--radius-md);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  background: var(--color-tile-background);
  box-shadow: var(--shadow-soft-md);
}

.slash-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  border-radius: var(--radius-sm);
  padding: 8px;
  text-align: left;
}

.slash-menu-item:hover,
.slash-menu-item.active {
  background: var(--color-base-55);
}

.slash-menu-label {
  font-size: 13px;
}

.slash-menu-hint {
  font-size: 11px;
  opacity: 0.7;
}

.smart-button {
  display: inline-block;
  appearance: none;
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-full);
  padding: 10px 14px;
  background: color-mix(
    in srgb,
    var(--tile-bg) 15%,
    var(--tile-text-color) 10%
  );
  color: inherit;
  text-decoration: none;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

.smart-button:hover {
  background: color-mix(
    in srgb,
    var(--tile-bg) 25%,
    var(--tile-text-color) 15%
  );
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

::deep(.ProseMirror:focus-visible) {
  outline: transparent !important;
}

.text-content ::selection {
  background: highlight;
  color: inherit;
}

::deep(ul[data-type="taskList"]) {
  padding: 0;
  margin: 0;
  list-style-type: none;
}

::deep(ul[data-type="taskList"] li) {
  display: flex;
  align-items: center;
  gap: 8px;
}

::deep(ul[data-type="taskList"] li label) {
  display: inline-flex;
  align-items: center;
}

::deep(ul[data-type="taskList"] li input[type="checkbox"]) {
  margin: 0;
}

::deep(ul[data-type="taskList"] li div) {
  min-height: 1em;
  min-width: 1px;
  display: inline-block;
}

::deep(ul[data-type="taskList"] li p) {
  margin: 0;
  min-height: 1em;
  min-width: 1px;
  display: inline-block;
}

::deep(.ProseMirror strong) {
  font-weight: 700;
}

::deep(.ProseMirror em) {
  font-style: italic;
}

::deep(.ProseMirror img) {
  max-width: 100%;
  border-radius: var(--radius-sm);
  height: auto;
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
