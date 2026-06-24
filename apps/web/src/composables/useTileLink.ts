import { ref, computed, type Ref } from "vue";
import { useRouter } from "vue-router";
import { useGridStore } from "@/stores/grid";
import { useToastStore } from "@/stores/toast";
import { resolveInternalGridRoute } from "@/utils/InternalLink";

interface LinkableContent {
  tileLink?: string;
}

export interface TileLinkValues {
  showLinkModal: Ref<boolean>;
  tileLink: Ref<string | undefined>;
  tileLinkExists: Ref<boolean>;
  openUrlInput: () => void;
  closeLinkModal: () => void;
  handleAddLink: (link: string) => void;
  handleFollowLink: () => void;
  clearLink: () => void;
}

export const useTileLink = (
  tileId: string | null,
  content: LinkableContent,
): TileLinkValues => {
  const gridStore = useGridStore();
  const toastStore = useToastStore();
  const router = useRouter();
  const showLinkModal = ref(false);

  const tileLink = computed(() => content?.tileLink);
  const tileLinkExists = computed(() => !!content?.tileLink);

  const openUrlInput = () => {
    if (!gridStore.isOwner) return;
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
    } catch {
      return "";
    }
  };

  const handleAddLink = (link: string) => {
    if (!gridStore.isOwner) return;
    const normalized = normalizeUrl(link);
    if (!normalized) {
      toastStore.addToast("Invalid URL format", "error");
      return;
    }
    content.tileLink = normalized;
    if (tileId) {
      gridStore.patchTileContent(tileId, { tileLink: normalized });
    } else {
      gridStore.saveGrid();
    }
    showLinkModal.value = false;
  };

  const handleFollowLink = () => {
    if (!tileLinkExists.value) return;
    // Links to another grid on this same site navigate in-app rather than
    // opening a new tab.
    const internal = resolveInternalGridRoute(tileLink.value ?? "");
    if (internal) {
      router.push(internal);
      return;
    }
    window.open(tileLink.value, "_blank", "noopener,noreferrer");
  };

  const clearLink = () => {
    if (!gridStore.isOwner) return;
    content.tileLink = undefined;
    if (tileId) {
      gridStore.patchTileContent(tileId, { tileLink: "" });
    } else {
      gridStore.saveGrid();
    }
  };

  return {
    showLinkModal,
    tileLink,
    tileLinkExists,
    openUrlInput,
    closeLinkModal,
    handleAddLink,
    handleFollowLink,
    clearLink,
  };
};
