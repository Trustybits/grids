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
    <FloatingTooltip
      :text="isEmbedInteractive ? 'Stop Interacting' : 'Delete'"
      placement="right"
    >
      <button
        class="tile-action-btn tile-action-btn--primary"
        @click="isEmbedInteractive ? onStopInteracting($event) : onDelete()"
      >
        <span class="primary-icon-slot">
          <CloseIcon class="icon-delete" />
          <LogOutIcon class="icon-logout" />
        </span>
      </button>
    </FloatingTooltip>

    <!-- Quick Actions Group: collapses upward when embed is interactive -->
    <div class="tile-actions-group-collapse">
      <div v-if="!isSuggestionTile" class="tile-actions-group">
        <FloatingTooltip v-if="hasLink" text="Follow Link" placement="right">
          <a
            class="tile-action-btn"
            :href="resolvedTileUrl"
            target="_blank"
            rel="noopener noreferrer"
            @click.stop
          >
            <ArrowUpRightIcon />
          </a>
        </FloatingTooltip>

        <FloatingTooltip text="Duplicate Tile" placement="right">
          <button
            class="tile-action-btn"
            @click="onDuplicate"
          >
            <DuplicateIcon />
          </button>
        </FloatingTooltip>

        <FloatingTooltip
          v-if="hasCopyable"
          text="Copy to Clipboard"
          placement="right"
        >
          <button
            class="tile-action-btn"
            @click="onCopyToClipboard"
          >
            <ClipboardIcon />
          </button>
        </FloatingTooltip>

        <FloatingTooltip v-if="hasDownload" text="Download" placement="right">
          <button
            class="tile-action-btn"
            @click="onDownload"
          >
            <DownloadCloudIcon />
          </button>
        </FloatingTooltip>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {
  proxyRefs,
  defineComponent,
  computed,
  inject,
  ref,
  watch,
  type PropType,
  type Ref,
} from "vue";
import { ContentType, type Tile } from "@grids/contracts/types";
import { getTileDefinition } from "@/registries/tileRegistry";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import { useToastStore } from "@/stores/toast";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import ArrowUpRightIcon from "@/components/icons/tile-actionbar/ArrowUpRightIcon.vue";
import DuplicateIcon from "@/components/icons/DuplicateIcon.vue";
import ClipboardIcon from "@/components/icons/tile-actionbar/ClipboardIcon.vue";
import DownloadCloudIcon from "@/components/icons/tile-actionbar/DownloadCloudIcon.vue";
import CloseIcon from "@/components/icons/tile-actionbar/CloseIcon.vue";
import LogOutIcon from "@/components/icons/tile-actionbar/LogOutIcon.vue";
import FloatingTooltip from "@/components/ui-elements/FloatingTooltip.vue";

// Cache server-approved download URLs per `ownerId:hash` so many tiles
// referencing the same file (and re-renders) don't each call the function.
// Cleared on reload.
const shareableDownloadUrlCache = new Map<string, string>();

export default defineComponent({
  components: {
    ArrowUpRightIcon,
    DuplicateIcon,
    ClipboardIcon,
    DownloadCloudIcon,
    CloseIcon,
    LogOutIcon,
    FloatingTooltip,
  },
  props: {
    tile: {
      type: Object as PropType<Tile>,
      required: true,
    },
  },
  emits: ["delete"],
  setup(props, { emit }) {
    const gridView = proxyRefs(useGridViewContext());
    const hoveredToolbarZone = inject<Ref<string | null>>("hoveredToolbarZone");
    const isEmbedInteractive = inject<Ref<boolean>>("isEmbedInteractive", ref(false));
    const justExitedInteractive = ref(false);
    const toastStore = useToastStore();

    const isSuggestionTile = computed(
      () => props.tile.content.type === ContentType.SUGGESTION,
    );
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

    const tileDef = computed(() => getTileDefinition(props.tile.content.type));

    const tileUrl = computed<string | null>(() => {
      return tileDef.value?.actions?.externalUrl?.(props.tile.content as never) ?? null;
    });

    const resolvedTileUrl = computed<string>(() => {
      const url = (tileUrl.value || "").trim();
      if (!url) return "";
      if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
      return `https://${url}`;
    });

    const hasLink = computed(() => !!resolvedTileUrl.value);

    const hasCopyable = computed(() => {
      return !!tileDef.value?.actions?.copyContent;
    });

    // Archive-backed media (an image/video whose bytes live in the source
    // owner's upload archive) exposes a download only when the owner has marked
    // the file `shareable`. Non-archive sources (external URLs, legacy
    // `src`-only tiles) keep their existing download behaviour.
    const archiveHash = computed<string | null>(() => {
      const content = props.tile.content as { srcHash?: unknown };
      return typeof content.srcHash === "string" && content.srcHash
        ? content.srcHash
        : null;
    });
    const archiveOwnerId = computed<string | null>(
      () => gridView.grid?.userId ?? null,
    );

    const archiveDownloadUrl = ref<string | null>(null);
    let archiveDownloadRequestId = 0;

    const resolveArchiveDownloadUrl = async (
      ownerId: string,
      hash: string,
      requestId: number,
    ) => {
      const cacheKey = `${ownerId}:${hash}`;
      const cached = shareableDownloadUrlCache.get(cacheKey);
      if (cached !== undefined) {
        archiveDownloadUrl.value = cached;
        return;
      }
      try {
        const url = await getServiceFactory()
          .getStorageService()
          .getShareableArchiveDownloadUrl(ownerId, hash);
        shareableDownloadUrlCache.set(cacheKey, url);
        if (requestId === archiveDownloadRequestId) {
          archiveDownloadUrl.value = url;
        }
      } catch {
        if (requestId === archiveDownloadRequestId) {
          archiveDownloadUrl.value = null;
        }
      }
    };

    watch(
      [archiveOwnerId, archiveHash],
      ([ownerId, hash]) => {
        archiveDownloadRequestId += 1;
        archiveDownloadUrl.value = null;
        if (ownerId && hash) {
          void resolveArchiveDownloadUrl(
            ownerId,
            hash,
            archiveDownloadRequestId,
          );
        }
      },
      { immediate: true },
    );

    const hasDownload = computed(() => {
      if (!tileDef.value?.actions?.downloadUrl) return false;
      // Non-archive sources are always downloadable; archive-backed files only
      // once the server has returned a shareable download URL.
      if (archiveHash.value === null) return true;
      return !!archiveDownloadUrl.value;
    });

    // --- Actions ---

    const onDelete = () => {
      emit("delete");
    };

    const onDuplicate = () => {
      const newId = gridView.duplicateTile(props.tile.i);
      if (newId) {
        toastStore.addToast("Tile duplicated", "success");
      }
    };

    const onCopyToClipboard = async () => {
      const text = tileDef.value?.actions?.copyContent?.(props.tile.content as never) ?? "";
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        toastStore.addToast("Copied to clipboard", "success");
      } catch {
        toastStore.addToast("Failed to copy", "error");
      }
    };

    const onDownload = async () => {
      const src = archiveHash.value
        ? archiveDownloadUrl.value ?? ""
        : tileDef.value?.actions?.downloadUrl?.(props.tile.content as never) ?? "";
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
      isSuggestionTile,
      hasLink,
      hasCopyable,
      hasDownload,
      onDelete,
      onDuplicate,
      onCopyToClipboard,
      onDownload,
      hoveredToolbarZone,
      isEmbedInteractive,
      justExitedInteractive,
      onStopInteracting,
      resolvedTileUrl,
    };
  },
});

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
  color: var(--color-content-default);
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
    color: var(--color-text-primary);
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
