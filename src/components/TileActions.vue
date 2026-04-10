<template>
  <div
    class="tile-actions"
    :class="{ 'is-embed-interactive': isEmbedInteractive, 'just-exited-interactive': justExitedInteractive }"
    @mousedown.stop
    @touchstart.stop
    @click.stop
    @mouseenter="hoveredToolbarZone = 'actions'"
    @mouseleave="hoveredToolbarZone = null"
  >
    <!-- Primary button: delete normally, stop interacting when embed is active -->
    <button
      class="tile-action-btn tile-action-btn--primary"
      :data-tooltip="isEmbedInteractive ? 'Stop Interacting' : 'Delete'"
      @click="isEmbedInteractive ? onStopInteracting($event) : onDelete()"
    >
      <span class="primary-icon-slot">
        <CloseIcon class="icon-delete" />
        <LogOutIcon class="icon-logout" />
      </span>
    </button>

    <!-- Quick Actions Group: collapses upward when embed is interactive -->
    <div class="tile-actions-group-collapse">
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
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  computed,
  inject,
  ref,
  type PropType,
  type Ref,
} from "vue";
import type { Tile } from "@/types/Tile";
import {
  ContentType,
  type TextContent,
  type SmartTextContent,
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
import LogOutIcon from "./icons/actionbar/LogOutIcon.vue";

export default defineComponent({
  components: {
    TrashIcon,
    ArrowUpRightIcon,
    DuplicateIcon,
    ClipboardIcon,
    DownloadCloudIcon,
    CloseIcon,
    LogOutIcon,
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
    const isEmbedInteractive = inject<Ref<boolean>>("isEmbedInteractive", ref(false));
    const justExitedInteractive = ref(false);
    const toastStore = useToastStore();

    const onStopInteracting = (event: MouseEvent) => {
      isEmbedInteractive.value = false;
      justExitedInteractive.value = true;
      const origin = { x: event.clientX, y: event.clientY };
      const onMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - origin.x;
        const dy = e.clientY - origin.y;
        if (dx * dx + dy * dy > 25) { // ~5px threshold
          justExitedInteractive.value = false;
          window.removeEventListener("mousemove", onMouseMove);
        }
      };
      window.addEventListener("mousemove", onMouseMove);
    };

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
        case ContentType.SMART_TEXT:
          return (c as SmartTextContent).tileLink || null;
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
        case ContentType.SMART_TEXT:
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
        case ContentType.SMART_TEXT: {
          // Extract plain text from tiptap JSON doc
          const raw = (c as SmartTextContent).text;
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
      isEmbedInteractive,
      justExitedInteractive,
      onStopInteracting,
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

.tile-actions-group-collapse {
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 0.2s ease,
    transform 0.25s ease;
}

.is-embed-interactive .tile-actions-group-collapse {
  opacity: 0;
  transform: translateY(-8px);
  pointer-events: none;
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
  }
}

/* Primary button: delete by default, stop-interacting when active */
.tile-action-btn--primary {
  :deep(svg) {
    width: 20px;
    height: 20px;
    color: var(--color-content-full);
  }

  &:hover {
    background-color: #ff3737;
    border-color: #ff3737;
    color: var(--color-light-100);

    :deep(svg) {
      color: var(--color-light-100);
    }
  }
}

/* Prevent accidental delete immediately after exiting interactive mode */
.just-exited-interactive .tile-action-btn--primary {
  pointer-events: none;
}

.is-embed-interactive .tile-action-btn--primary {
  &:hover {
    background-color: var(--color-figma-purple, #a259ff);
    border-color: var(--color-figma-purple, #a259ff);
    color: var(--color-light-100);
  }
}

/* Icon morph: cross-fade + rotate between close and logout */
.primary-icon-slot {
  position: relative;
  width: 20px;
  height: 20px;
}

.icon-delete,
.icon-logout {
  position: absolute;
  inset: 0;
  transition: opacity 0.2s ease, transform 0.25s ease;
}

.icon-delete {
  opacity: 1;
  transform: rotate(0deg) scale(1);
}

.icon-logout {
  opacity: 0;
  transform: rotate(-30deg) scale(0.6);
}

.is-embed-interactive {
  .icon-delete {
    opacity: 0;
    transform: rotate(30deg) scale(0.6);
  }

  .icon-logout {
    opacity: 1;
    transform: rotate(0deg) scale(1);
  }
}
</style>
