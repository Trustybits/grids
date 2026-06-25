import { ref, computed, type Ref } from "vue";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridController } from "@/controllers/useGridController";
import { useRouter } from "vue-router";
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
  const sessionStore = useGridSessionStore();
  const controller = useGridController();
  const toastStore = useToastStore();
  const router = useRouter();
  const showLinkModal = ref(false);

  const tileLink = computed(() => content?.tileLink);
  const tileLinkExists = computed(() => !!content?.tileLink);

  const openUrlInput = () => {
    if (!sessionStore.isOwner) return;
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
    if (!sessionStore.isOwner) return;
    const normalized = normalizeUrl(link);
    if (!normalized) {
      toastStore.addToast("Invalid URL format", "error");
      return;
    }
    if (tileId) {
      controller.patchTileContent(tileId, { tileLink: normalized });
    } else {
      // Local-only preview (no live tile identity); no grid persistence.
      Object.assign(content, { tileLink: normalized });
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
    if (!sessionStore.isOwner) return;
    if (tileId) {
      controller.patchTileContent(tileId, { tileLink: "" });
    } else {
      // Local-only preview (no live tile identity); no grid persistence.
      Object.assign(content, { tileLink: undefined });
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
