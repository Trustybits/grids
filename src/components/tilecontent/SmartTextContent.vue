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
      <input
        ref="imageInput"
        type="file"
        accept="image/*"
        style="display: none"
      />
    </div>
  </div>
  <Teleport to="body">
    <div
      v-if="showSlashMenu && filteredSlashCommands.length > 0"
      ref="slashMenuRef"
      class="slash-menu scrollable-thin"
      :style="{
        top: `${slashMenuPosition.top}px`,
        left: `${slashMenuPosition.left}px`,
      }"
    >
      <button
        v-for="(item, idx) in filteredSlashCommands"
        :key="item.id"
        :ref="(el) => { if (el) slashMenuItemRefs[idx] = el as HTMLElement }"
        type="button"
        class="slash-menu-item"
        :class="{ active: idx === selectedSlashIndex }"
        @mousedown.stop.prevent
        @click.stop.prevent="executeSlashByIndex(idx)"
      >
        <span class="slash-menu-label">{{ item.label }}</span>
        <span class="slash-menu-hint">{{ item.hint }}</span>
      </button>
    </div>
  </Teleport>
  <Teleport to="body">
    <div
      v-if="showTableToolbar"
      class="table-toolbar"
      :style="{
        top: `${tableToolbarPosition.top}px`,
        left: `${tableToolbarPosition.left}px`,
      }"
      @mousedown.prevent
    >
      <div class="table-toolbar-group">
        <span class="table-toolbar-group-label">Col</span>
        <button
          type="button"
          class="table-toolbar-btn"
          title="Insert column before"
          @click="tableCmd((e) => e.chain().focus().addColumnBefore().run())"
        >+ Left</button>
        <button
          type="button"
          class="table-toolbar-btn"
          title="Insert column after"
          @click="tableCmd((e) => e.chain().focus().addColumnAfter().run())"
        >+ Right</button>
        <button
          type="button"
          class="table-toolbar-btn table-toolbar-btn--danger"
          title="Delete column"
          @click="tableCmd((e) => e.chain().focus().deleteColumn().run())"
        >&times;</button>
      </div>
      <span class="table-toolbar-sep" />
      <div class="table-toolbar-group">
        <span class="table-toolbar-group-label">Row</span>
        <button
          type="button"
          class="table-toolbar-btn"
          title="Insert row above"
          @click="tableCmd((e) => e.chain().focus().addRowBefore().run())"
        >+ Above</button>
        <button
          type="button"
          class="table-toolbar-btn"
          title="Insert row below"
          @click="tableCmd((e) => e.chain().focus().addRowAfter().run())"
        >+ Below</button>
        <button
          type="button"
          class="table-toolbar-btn table-toolbar-btn--danger"
          title="Delete row"
          @click="tableCmd((e) => e.chain().focus().deleteRow().run())"
        >&times;</button>
      </div>
      <span class="table-toolbar-sep" />
      <div class="table-toolbar-group">
        <button
          type="button"
          class="table-toolbar-btn"
          title="Merge or split selected cells"
          @click="tableCmd((e) => e.chain().focus().mergeOrSplit().run())"
        >Merge / Split</button>
        <button
          type="button"
          class="table-toolbar-btn"
          title="Toggle header row"
          @click="tableCmd((e) => e.chain().focus().toggleHeaderRow().run())"
        >H-Row</button>
        <button
          type="button"
          class="table-toolbar-btn"
          title="Toggle header column"
          @click="tableCmd((e) => e.chain().focus().toggleHeaderColumn().run())"
        >H-Col</button>
      </div>
      <span class="table-toolbar-sep" />
      <button
        type="button"
        class="table-toolbar-btn table-toolbar-btn--danger table-toolbar-btn--delete"
        title="Delete entire table"
        @click="tableCmd((e) => e.chain().focus().deleteTable().run()); showTableToolbar = false"
      >Delete Table</button>
    </div>
  </Teleport>
  <AddLinkModal
    :show="showLinkModal"
    @close="closeLinkModal"
    @add="handleAddLink"
  />
</template>

<script lang="ts">
/* eslint-disable vue/no-mutating-props */

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
import { ResizableImage } from "../tiptap/ResizableImage";
import { FontSize } from "../tiptap/FontSize";
import { SmartButton } from "../tiptap/SmartButton";
import { DragHandle } from "../tiptap/DragHandle";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { useLayoutStore } from "@/stores/layout";
import AddLinkModal from "../AddLinkModal.vue";
import LinkIndicatorIcon from "../icons/LinkIndicatorIcon.vue";
import type { SmartTextContent } from "@/types/TileContent";
import { useTileLink } from "@/composables/useTileLink";
import { useColorPicker } from "@/composables/useColorPicker";
import { useEditorAutosave } from "@/composables/useEditorAutosave";
import { useFileUpload } from "@/composables/useFileUpload";
import {
  normalizeHttpUrl,
  fontSizeLabelToPx,
  pxToFontSizeLabel,
  getDefaultFont,
  filterSlashCommands,
  isTallOneWide as isTallOneWideFn,
  isWideOneHigh as isWideOneHighFn,
  isOneByOne as isOneByOneFn,
} from "@/utils/smartTextHelpers";

type SlashRange = { from: number; to: number };

type SlashCommand = {
  id: string;
  label: string;
  hint: string;
  keywords: string[];
  handlesDelete?: boolean;
  run: (editor: Editor, slashRange?: SlashRange) => void | Promise<void>;
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
    const slashMenuRef = ref<HTMLElement | null>(null);
    const slashMenuItemRefs = ref<Record<number, HTMLElement>>({});
    const slashMenuPosition = ref({ top: 0, left: 0 });
    const slashFrom = ref<number | null>(null);
    const slashTo = ref<number | null>(null);
    const slashCommandActive = ref(false);
    const showTableToolbar = ref(false);
    const tableToolbarPosition = ref({ top: 0, left: 0 });

    const gridTileH = inject<ComputedRef<number> | null>("gridTileH", null);
    const gridTileW = inject<ComputedRef<number> | null>("gridTileW", null);
    const isTallOneWide = computed(() =>
      isTallOneWideFn({ width: gridTileW?.value ?? 0, height: gridTileH?.value ?? 0 }),
    );
    const isWideOneHigh = computed(() =>
      isWideOneHighFn({ width: gridTileW?.value ?? 0, height: gridTileH?.value ?? 0 }),
    );
    const isOneByOne = computed(() =>
      isOneByOneFn({ width: gridTileW?.value ?? 0, height: gridTileH?.value ?? 0 }),
    );

    const isBoldActive = ref(false);
    const isItalicActive = ref(false);
    const textAlign = computed(() => props.content?.textAlign ?? "left");

    const { schedulePersist, flushPersist } = useEditorAutosave(() =>
      persistEditorText(),
    );

    const pickImageFile = async (): Promise<File | null> => {
      if (!imageInput.value) return null;
      return new Promise((resolve) => {
        const input = imageInput.value;
        if (!input) { resolve(null); return; }
        const cleanup = () => {
          input.removeEventListener("change", onChange);
          input.removeEventListener("cancel", onCancel);
        };
        const onChange = () => {
          const file = input.files?.[0] ?? null;
          input.value = "";
          cleanup();
          resolve(file);
        };
        const onCancel = () => {
          input.value = "";
          cleanup();
          resolve(null);
        };
        input.addEventListener("change", onChange, { once: true });
        input.addEventListener("cancel", onCancel, { once: true });
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
        handlesDelete: true,
        run: async (editor, slashRange) => {
          try {
            const file = await pickImageFile();
            if (!file) {
              if (slashRange) editor.chain().focus().deleteRange(slashRange).run();
              return;
            }
            const url = await uploadFileToUrl(file, { fileType: "images" });
            const chain = editor.chain().focus();
            if (slashRange) chain.deleteRange(slashRange);
            chain
              .setImage({ src: url, alt: file.name || "image" })
              .splitBlock()
              .run();
            schedulePersist();
          } catch (err) {
            console.error("[SmartText] /image failed:", err);
          }
        },
      },
      {
        id: "link",
        label: "Link",
        hint: "/link",
        keywords: ["link", "url"],
        handlesDelete: true,
        run: (editor, slashRange) => {
          const rawUrl = window.prompt("Enter URL");
          if (!rawUrl) {
            if (slashRange) editor.chain().focus().deleteRange(slashRange).run();
            return;
          }
          const href = normalizeHttpUrl(rawUrl);
          if (!href) {
            if (slashRange) editor.chain().focus().deleteRange(slashRange).run();
            return;
          }
          const label = window.prompt("Link text", href) || href;
          const chain = editor.chain().focus();
          if (slashRange) chain.deleteRange(slashRange);
          chain
            .insertContent({
              type: "text",
              text: label,
              marks: [{ type: "link", attrs: { href } }],
            })
            .run();
          schedulePersist();
        },
      },
      {
        id: "button",
        label: "Button link",
        hint: "/button",
        keywords: ["button", "cta", "link"],
        handlesDelete: true,
        run: (editor, slashRange) => {
          const rawUrl = window.prompt("Enter button URL");
          if (!rawUrl) {
            if (slashRange) editor.chain().focus().deleteRange(slashRange).run();
            return;
          }
          const href = normalizeHttpUrl(rawUrl);
          if (!href) {
            if (slashRange) editor.chain().focus().deleteRange(slashRange).run();
            return;
          }
          const label = window.prompt("Button label", "Button") || "Button";
          const chain = editor.chain().focus();
          if (slashRange) chain.deleteRange(slashRange);
          chain
            .insertContent({ type: "smartButton", attrs: { href, label } })
            .splitBlock()
            .run();
          schedulePersist();
        },
      },
      {
        id: "table",
        label: "Table",
        hint: "/table",
        keywords: ["table", "grid", "spreadsheet"],
        run: (editor) => {
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run();
          schedulePersist();
        },
      },
    ];

    const filteredSlashCommands = computed(() =>
      filterSlashCommands(slashCommands, slashQuery.value),
    );

    const scrollSlashItemIntoView = (idx: number) => {
      nextTick(() => {
        const el = slashMenuItemRefs.value[idx];
        if (el) {
          el.scrollIntoView({ block: "nearest" });
        }
      });
    };

    const hideSlashMenu = () => {
      showSlashMenu.value = false;
      slashQuery.value = "";
      selectedSlashIndex.value = 0;
      slashMenuItemRefs.value = {};
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
      const textBeforeCursor = $from.parent.textBetween(0, parentOffset, "\0", "\0");

      const lastSlash = textBeforeCursor.lastIndexOf("/");
      if (lastSlash === -1) {
        hideSlashMenu();
        return;
      }

      if (lastSlash > 0 && !/\s/.test(textBeforeCursor[lastSlash - 1] || "")) {
        hideSlashMenu();
        return;
      }

      const query = textBeforeCursor.slice(lastSlash + 1);
      if (query.includes(" ")) {
        hideSlashMenu();
        return;
      }

      const slashPos = parentStart + lastSlash;
      const coords = view.coordsAtPos(slashPos);

      const gap = 6;
      const padding = 8;
      const menuWidth = 300;
      const menuHeight = 240;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const spaceBelow = vh - coords.bottom - gap;
      const spaceAbove = coords.top - gap;

      let top: number;
      if (spaceBelow >= menuHeight || spaceBelow >= spaceAbove) {
        top = coords.bottom + gap;
      } else {
        top = coords.top - gap - Math.min(menuHeight, spaceAbove);
      }

      let left = coords.left;

      top = Math.max(padding, Math.min(top, vh - padding));
      left = Math.max(padding, Math.min(left, vw - menuWidth - padding));

      slashFrom.value = parentStart + lastSlash;
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
      const from = slashFrom.value;
      const to = slashTo.value;
      hideSlashMenu();
      slashCommandActive.value = true;
      const slashRange =
        from !== null && to !== null ? { from, to } : undefined;
      if (!command.handlesDelete && slashRange) {
        e.chain().focus().deleteRange(slashRange).run();
      }
      try {
        await command.run(e, slashRange);
      } finally {
        slashCommandActive.value = false;
      }
      schedulePersist();
    };

    const executeSlashByIndex = async (index: number) => {
      const command = filteredSlashCommands.value[index];
      if (!command) return;
      await executeSlashCommand(command);
    };

    const updateTableToolbarState = () => {
      const e = editor.value;
      if (!e || !isEditing.value) {
        showTableToolbar.value = false;
        return;
      }
      if (!e.isActive("table")) {
        showTableToolbar.value = false;
        return;
      }
      const { $from } = e.state.selection;
      let depth = $from.depth;
      while (depth > 0) {
        if ($from.node(depth).type.name === "table") break;
        depth--;
      }
      if (depth === 0) {
        showTableToolbar.value = false;
        return;
      }
      const tablePos = $from.before(depth);
      const tableDom = e.view.nodeDOM(tablePos);
      if (!tableDom || !(tableDom instanceof HTMLElement)) {
        showTableToolbar.value = false;
        return;
      }
      const tableEl =
        tableDom.tagName === "TABLE"
          ? tableDom
          : tableDom.querySelector("table");
      if (!tableEl) {
        showTableToolbar.value = false;
        return;
      }
      const rect = tableEl.getBoundingClientRect();
      const toolbarH = 36;
      const pad = 8;
      let top = rect.top - toolbarH - 4;
      let left = rect.left;
      if (top < pad) top = rect.bottom + 4;
      left = Math.max(pad, Math.min(left, window.innerWidth - 640 - pad));
      tableToolbarPosition.value = { top, left };
      showTableToolbar.value = true;
    };

    const tableCmd = (fn: (e: Editor) => boolean) => {
      const e = editor.value;
      if (!e) return;
      fn(e);
      schedulePersist();
    };

    const editor = useEditor({
      editable: true,
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
        ResizableImage.configure({ inline: true }),
        Table.configure({ resizable: true, cellMinWidth: 40, allowTableNodeSelection: true }),
        TableRow,
        TableHeader,
        TableCell,
        DragHandle.configure({ isEditing }),
      ],
      content: props.content.text ? JSON.parse(props.content.text) : "",
      onCreate({ editor: createdEditor }) {
        createdEditor.setEditable(false);
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
        updateTableToolbarState();
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
            scrollSlashItemIntoView(selectedSlashIndex.value);
            return true;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            selectedSlashIndex.value =
              (selectedSlashIndex.value - 1 + filteredSlashCommands.value.length) %
              filteredSlashCommands.value.length;
            scrollSlashItemIntoView(selectedSlashIndex.value);
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
        showTableToolbar.value = false;
        if (!canEdit) {
          isEditing.value = false;
          return;
        }
        flushPersist();
      },
    );

    watch(showSlashMenu, (open, _prev, onCleanup) => {
      if (!open) return;
      const reposition = () => updateSlashState();
      window.addEventListener("scroll", reposition, { capture: true, passive: true });
      window.addEventListener("resize", reposition, { passive: true });
      onCleanup(() => {
        window.removeEventListener("scroll", reposition, { capture: true } as EventListenerOptions);
        window.removeEventListener("resize", reposition);
      });
    });

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
      if (slashCommandActive.value) return;
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
      editor.value
        .chain()
        .focus(undefined, { scrollIntoView: false })
        .setFontSize(fontSizeLabelToPx(size))
        .run();
    };

    const getCurrentFontSize = () => {
      return pxToFontSizeLabel(editor.value?.getAttributes("textStyle")?.fontSize);
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
      return getDefaultFont(editor.value?.getAttributes("textStyle")?.fontFamily);
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
      isTextOverflowing,
      getCurrentFontSize,
      handleFontSizeChange,
      handleFontChange,
      getCurrentFont,
      imageInput,
      showSlashMenu,
      filteredSlashCommands,
      selectedSlashIndex,
      slashMenuRef,
      slashMenuItemRefs,
      slashMenuPosition,
      executeSlashByIndex,
      showTableToolbar,
      tableToolbarPosition,
      tableCmd,
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
  height: 100%;
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
  position: absolute;
  right: 18px;
  bottom: 12px;
  color: inherit;
}

/* ── ProseMirror / TipTap reset ──
   Use :deep() (single colon) for Vue 3 scoped deep selectors.
   ::deep() (double colon) is INVALID and silently ignored. */

:deep(.ProseMirror:focus-visible) {
  outline: none !important;
}

:deep(.ProseMirror) {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  min-height: 100%;
  transition: padding-left 0.15s ease;
}

/*:deep(.ProseMirror.has-drag-handles) {
  padding-left: 28px;
}*/

:deep(.tiptap) {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
}

:deep(blockquote) {
  border-left: 2px solid color-mix(in srgb, var(--tile-text-color) 35%, transparent);
  margin: 0;
  padding-left: 10px;
  opacity: 0.95;
}

.text-content ::selection {
  background: highlight;
  color: inherit;
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

:deep(.ProseMirror strong em),
:deep(.ProseMirror em strong) {
  font-weight: 700;
  font-style: italic;
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

<!-- Unscoped styles for the Teleported slash menu + SmartButton (rendered inside ProseMirror) -->
<style>
.slash-menu {
  position: fixed;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  min-width: 220px;
  max-width: 300px;
  max-height: 240px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scrollbar-color: transparent transparent;
  padding: 4px;
  border-radius: var(--radius-md);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  background: var(--color-tile-background);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
}

.slash-menu:hover {
  scrollbar-color: var(--color-border) transparent;
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
  cursor: pointer;
  font-size: 13px;
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

a[data-smart-button="true"].smart-button {
  display: inline-block;
  appearance: none;
  border: 1px solid var(--color-tile-stroke);
  border-radius: 9999px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.08);
  color: inherit;
  text-decoration: none;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

a[data-smart-button="true"].smart-button:hover {
  background: rgba(255, 255, 255, 0.14);
}

/* ── Table styles ── */
.ProseMirror table {
  border-collapse: collapse;
  width: 100%;
  margin: 0;
  table-layout: fixed;
  overflow: hidden;
}

.ProseMirror th,
.ProseMirror td {
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 6px 8px;
  vertical-align: top;
  position: relative;
  min-width: 1em;
  box-sizing: border-box;
  text-align: left;
}

.ProseMirror th {
  background: rgba(255, 255, 255, 0.08);
  font-weight: 600;
}

.ProseMirror td {
  background: transparent;
}

.ProseMirror th > p,
.ProseMirror td > p {
  margin: 0;
}

.ProseMirror .selectedCell {
  background: rgba(100, 150, 255, 0.15);
}

.ProseMirror .column-resize-handle {
  position: absolute;
  top: 0;
  right: -2px;
  bottom: -2px;
  width: 4px;
  background: rgba(100, 160, 255, 0.6);
  pointer-events: none;
  z-index: 20;
}

.ProseMirror.resize-cursor {
  cursor: col-resize !important;
}

.ProseMirror .tableWrapper {
  overflow-x: auto;
  margin: 8px 0;
}

/* ── Table toolbar ── */
.table-toolbar {
  position: fixed;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px 6px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--color-tile-stroke, rgba(255, 255, 255, 0.12));
  background: var(--color-tile-background, #1e1e1e);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
  flex-wrap: wrap;
  max-width: 640px;
}

.table-toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.table-toolbar-group-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.35);
  padding: 0 4px 0 2px;
  user-select: none;
}

.table-toolbar-sep {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 3px;
  flex-shrink: 0;
}

.table-toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.78);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  white-space: nowrap;
  transition: background 0.12s ease, color 0.12s ease;
}

.table-toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.table-toolbar-btn--danger {
  color: rgba(255, 255, 255, 0.55);
}

.table-toolbar-btn--danger:hover {
  background: rgba(255, 80, 80, 0.18);
  color: #ff6b6b;
}

.table-toolbar-btn--delete {
  font-weight: 500;
}

/* ── Drag handle ── */
.drag-handle {
  position: absolute;
  left: -20px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.2);
  cursor: grab;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
  z-index: 5;
  user-select: none;
}

.drag-handle.visible {
  opacity: 1;
  pointer-events: auto;
}

.drag-handle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.5);
}

.drag-handle:active {
  cursor: grabbing;
}

.drag-handle-dragging {
  opacity: 0.4;
}
</style>
