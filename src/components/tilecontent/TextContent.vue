<template>
  <TextOptions
    v-if="layoutStore.isOwner && editor"
    v-show="isEditing"
    :editor="editor"
  />
  <div class="text-container" ref="textContentDiv">
    <div
      class="text-content"
      :class="{
        'not-editing': !isEditing,
        overflowing: isTextOverflowing,
        'can-edit': layoutStore.isOwner,
        'is-wide-1-high': isWideOneHigh,
        'is-tall-1-wide': isTallOneWide,
      }"
      :style="{ '--tile-bg': backgroundColor, color: textColor }"
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
} from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import TextOptions from "./TextOptions.vue";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import { FontSize } from "../tiptap/FontSize";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useLayoutStore } from "@/stores/layout";
import AddLinkModal from "../AddLinkModal.vue";
import type { TextContent } from "@/types/TileContent";
import { useToastStore } from "@/stores/toast";
import { useThemeStore } from "@/stores/theme";

export default defineComponent({
  components: {
    EditorContent,
    TextOptions,
    AddLinkModal,
  },
  props: {
    content: {
      type: Object as () => TextContent,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const themeStore = useThemeStore();

    const isTextOverflowing = ref(false);
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

    const DEFAULT_COLOR = "var(--color-tile-background)";

    const backgroundColor = computed(() => {
      if (props.content?.backgroundColor) {
        return props.content?.backgroundColor;
      } else {
        return DEFAULT_COLOR;
      }
    });

    const textLink = computed(() => props.content?.textLink);
    const textLinkExists = computed(() => !!props.content?.textLink);
    const isBoldActive = ref(false);
    const isItalicActive = ref(false);

    const showLinkModal = ref<boolean>(false);
    const toastStore = useToastStore();

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
      onUpdate({ editor }) {
        // props.content.text = editor.getHTML();
        checkOverflow();
      },
    });

    const colorHexMap: Record<string, string> = {
      "var(--color-red)": "#FFAFA3",
      "var(--color-orange)": "#FFD3A8",
      "var(--color-yellow)": "#FFE299",
      "var(--color-green)": "#B3EFBD",
      "var(--color-cyan)": "#B3F4EF",
      "var(--color-blue)": "#A8DAFF",
      "var(--color-purple)": "#D3BDFF",
      "var(--color-pink)": "#FFA8DB",
      "var(--color-light-100)": "#FEFDEC",
      "var(--color-dark-0)": "#33312C",
      "var(--color-tile-background)": "#000000",
      "var(--color-content-background)": "#10100E",
    };

    const getLuminance = (hex: string): number => {
      const c = hex.replace("#", "");
      const r = parseInt(c.substring(0, 2), 16);
      const g = parseInt(c.substring(2, 4), 16);
      const b = parseInt(c.substring(4, 6), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    };

    const textColor = computed(() => {
      const bg = backgroundColor.value;
      let hex: string | undefined;

      if (bg.startsWith("#")) {
        hex = bg;
      } else if (bg === "var(--color-tile-background)") {
        hex = themeStore.isDarkMode ? "#000000" : "#FFFEF5";
      } else if (bg === "var(--color-content-background)") {
        hex = themeStore.isDarkMode ? "#10100E" : "#FFFEF5";
      } else {
        hex = colorHexMap[bg];
      }

      if (!hex) return "";
      return getLuminance(hex) > 0.5 ? "#000000" : "#FFFFFF";
    });

    const checkOverflow = () => {
      if (!editor || !editor.value?.view) return;

      const container = textContentDiv.value;
      if (!container) return;

      const editorDom = editor.value.view.dom as HTMLElement;
      const isOverflowing = container.clientHeight < editorDom.clientHeight + 5;

      isTextOverflowing.value = isOverflowing;
    };

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

        // Owner is leaving edit mode: persist changes.
        let output = JSON.stringify(editor.value.getJSON());
        output = output.replace(/^"(.*)"$/, "$1");
        props.content.text = output;
        layoutStore.saveLayout();
      },
    );

    const onShortClick = () => {
      if (!layoutStore.isOwner) {
        if (textLinkExists) {
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

    // if (editor?.value?.view?.dom) {
    //   editor.value.commands.focus("start");
    // }
    // setTimeout(() => {
    //   isEditing.value = false;
    // }, 50);
    // };

    // Inject the tile ID provided by GridTile so we can check if this tile
    // should auto-focus on mount (e.g. after paste or toolbar "add text").
    const tileId = inject<string | null>("tileId", null);

    onMounted(() => {
      checkOverflow();

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
      layoutStore.saveLayout();
      showLinkModal.value = false;
    };

    const handleOwnerClick = () => {
      if (!textLinkExists) return;

      window.open(textLink.value, "_blank", "noopener,noreferrer");
    };

    const handleBackgroundColorChange = (color: string) => {
      if (!layoutStore.isOwner) return;

      props.content.backgroundColor = color;
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

    return {
      layoutStore,
      editor,
      isTextOverflowing,
      isEditing,
      textContentDiv,
      showLinkModal,
      isTallOneWide,
      isOneByOne,
      isWideOneHigh,
      textLinkExists,
      backgroundColor,
      textColor,
      onShortClick,
      onExitClick,
      openUrlInput,
      closeLinkModal,
      handleAddLink,
      handleOwnerClick,
      handleBackgroundColorChange,
      toggleItalic,
      toggleBold,
      isBoldActive,
      isItalicActive,
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
  /* background-color: rgba(255, 255, 255, 0.1); */
  background-color: var(--tile-bg) !important;
  padding: var(--spacing-md);
  width: 100%;
  scroll-behavior: smooth;
  border-radius: var(--radius-lg);
  overflow: auto;
  margin: 0;
  line-height: 1.3;
  transition: background-color 0.3s ease;
  position: relative;

  &::-webkit-scrollbar {
    display: none;
  }
}

.not-editing {
  background-color: transparent;
}

.not-editing.can-edit:hover {
  /* background-color: var(--color-editable-hover); */
  cursor: text;
  background-color: color-mix(
    in srgb,
    var(--tile-bg) 85%,
    white 15%
  ) !important;
}

.overflowing::after {
  content: "...";
  position: absolute;
  right: 8px;
  bottom: 8px;
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
  position: absolute;
  top: 9px;
  right: 9px;
  width: 24px;
  height: 24px;
  color: var(--color-text-primary);
  opacity: 0.21;
  transition: opacity var(--duration-fast) var(--easing-ease-in-out);
  pointer-events: auto;
  z-index: 1200;
}

.text-content:hover .tile-link-indicator {
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
