<template>
  <div
    class="tile-actions"
    @mousedown.stop
    @click.stop
    @mouseenter="hoveredToolbarZone = 'actions'"
    @mouseleave="hoveredToolbarZone = null"
  >
    <!-- Delete Tile -->
    <button
      class="tile-action-btn tile-action-btn--delete"
      data-tooltip="Delete"
      @click="onDelete"
    >
      <CloseIcon />
    </button>

    <!-- Quick Actions Group -->
    <div class="tile-actions-group">
      <button
        v-if="hasLink"
        class="tile-action-btn"
        data-tooltip="Follow Link"
        @click="onFollowLink"
      >
        <ArrowUpRightIcon />
      </button>

      <button
        class="tile-action-btn"
        data-tooltip="Duplicate Tile"
        @click="onDuplicate"
      >
        <DuplicateIcon />
      </button>

      <button
        v-if="hasCopyable"
        class="tile-action-btn"
        data-tooltip="Copy to Clipboard"
        @click="onCopyToClipboard"
      >
        <ClipboardIcon />
      </button>

      <button
        v-if="hasDownload"
        class="tile-action-btn"
        data-tooltip="Download"
        @click="onDownload"
      >
        <DownloadCloudIcon />
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  computed,
  inject,
  type PropType,
  type Ref,
} from "vue";
import type { Tile } from "@/types/Tile";
import {
  ContentType,
  type TextContent,
  type LinkContent,
  type ImageContent,
  type VideoContent,
  type EmbedContent,
  type MusicContent,
  type YouTubeContent,
} from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";
import { useToastStore } from "@/stores/toast";
import TrashIcon from "./icons/toolbar/TrashIcon.vue";
import ArrowUpRightIcon from "./icons/actionbar/ArrowUpRightIcon.vue";
import DuplicateIcon from "./icons/actionbar/DuplicateIcon.vue";
import ClipboardIcon from "./icons/actionbar/ClipboardIcon.vue";
import DownloadCloudIcon from "./icons/actionbar/DownloadCloudIcon.vue";
import CloseIcon from "./icons/actionbar/CloseIcon.vue";

export default defineComponent({
  components: {
    TrashIcon,
    ArrowUpRightIcon,
    DuplicateIcon,
    ClipboardIcon,
    DownloadCloudIcon,
    CloseIcon,
  },
  props: {
    tile: {
      type: Object as PropType<Tile>,
      required: true,
    },
  },
  emits: ["delete"],
  setup(props, { emit }) {
    const layoutStore = useLayoutStore();
    const hoveredToolbarZone = inject<Ref<string | null>>("hoveredToolbarZone");
    const toastStore = useToastStore();

    // --- Computed: which actions are available per tile type ---

    const tileUrl = computed<string | null>(() => {
      const c = props.tile.content;
      switch (c.type) {
        case ContentType.LINK:
          return (c as LinkContent).link || null;
        case ContentType.MUSIC:
          return (c as MusicContent).trackUrl || null;
        case ContentType.YOUTUBE:
          return (c as YouTubeContent).youtubeUrl || null;
        case ContentType.EMBED:
          return (c as EmbedContent).src || null;
        case ContentType.IMAGE:
          return (c as ImageContent).tileLink || null;
        case ContentType.VIDEO:
          return (c as VideoContent).tileLink || null;
        case ContentType.TEXT:
          return (c as TextContent).tileLink || null;
        default:
          return null;
      }
    });

    const hasLink = computed(() => !!tileUrl.value);

    const hasCopyable = computed(() => {
      const c = props.tile.content;
      switch (c.type) {
        case ContentType.TEXT:
          return true;
        case ContentType.LINK:
        case ContentType.MUSIC:
        case ContentType.YOUTUBE:
        case ContentType.EMBED:
          return true;
        default:
          return false;
      }
    });

    const hasDownload = computed(() => {
      const c = props.tile.content;
      return c.type === ContentType.IMAGE || c.type === ContentType.VIDEO;
    });

    // --- Actions ---

    const onDelete = () => {
      emit("delete");
    };

    const onFollowLink = () => {
      const url = tileUrl.value;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    };

    const onDuplicate = () => {
      const newId = layoutStore.duplicateTile(props.tile.i);
      if (newId) {
        toastStore.addToast("Tile duplicated", "success");
      }
    };

    const onCopyToClipboard = async () => {
      const c = props.tile.content;
      let text = "";

      switch (c.type) {
        case ContentType.TEXT: {
          // Extract plain text from tiptap JSON doc
          const raw = (c as TextContent).text;
          try {
            const doc = JSON.parse(raw);
            text = extractPlainText(doc);
          } catch {
            text = raw || "";
          }
          break;
        }
        case ContentType.LINK:
          text = (c as LinkContent).link || "";
          break;
        case ContentType.MUSIC:
          text = (c as MusicContent).trackUrl || "";
          break;
        case ContentType.YOUTUBE:
          text = (c as YouTubeContent).youtubeUrl || "";
          break;
        case ContentType.EMBED:
          text = (c as EmbedContent).src || "";
          break;
      }

      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        toastStore.addToast("Copied to clipboard", "success");
      } catch {
        toastStore.addToast("Failed to copy", "error");
      }
    };

    const onDownload = async () => {
      const c = props.tile.content;
      let src = "";

      if (c.type === ContentType.IMAGE) {
        src = (c as ImageContent).src;
      } else if (c.type === ContentType.VIDEO) {
        src = (c as VideoContent).src;
      }

      if (!src) return;

      try {
        const a = document.createElement("a");
        a.href = src;
        a.download = "";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch {
        toastStore.addToast("Failed to download", "error");
      }
    };

    return {
      hasLink,
      hasCopyable,
      hasDownload,
      onDelete,
      onFollowLink,
      onDuplicate,
      onCopyToClipboard,
      onDownload,
      hoveredToolbarZone,
    };
  },
});

// Extract plain text from a tiptap/ProseMirror JSON document
function extractPlainText(node: any): string {
  if (!node) return "";
  if (node.type === "text") return node.text || "";
  if (Array.isArray(node.content)) {
    return node.content
      .map((child: any, i: number) => {
        const text = extractPlainText(child);
        // Add newline between block-level nodes
        if (
          i > 0 &&
          child.type &&
          child.type !== "text" &&
          child.type !== "hardBreak"
        ) {
          return "\n" + text;
        }
        if (child.type === "hardBreak") return "\n";
        return text;
      })
      .join("");
  }
  return "";
}
</script>

<style scoped lang="scss">
.tile-actions {
  position: absolute;
  top: -12px;
  right: -16px;
  z-index: 11;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;

  /* Hidden by default */
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--easing-ease-out);
}

.tile-actions-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tile-action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: 8px;
  background-color: var(--color-actionbar-background);
  color: var(--color-content-high);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--easing-ease-in-out),
    transform var(--duration-fast) var(--easing-ease-out),
    color var(--duration-fast) var(--easing-ease-in-out);

  :deep(svg) {
    width: 16px;
    height: 16px;
    display: block;
  }

  &:hover {
    background-color: var(--color-actionbar-background);
    color: var(--color-figma-purple);
    //transform: scale(1.1);
  }
}

.tile-action-btn--delete {
  :deep(svg) {
    width: 20px;
    height: 20px;
    color: var(--color-content-full);
  }

  &:hover {
    background-color: #ff3737;
    border-color: #ff3737;
    color: var(--color-light-100);
  }
}
</style>
