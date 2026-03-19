import { ref, computed, type Ref } from "vue";
import { useLayoutStore } from "@/stores/layout";
import { useToastStore } from "@/stores/toast";

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
  const layoutStore = useLayoutStore();
  const toastStore = useToastStore();
  const showLinkModal = ref(false);

  const tileLink = computed(() => content?.tileLink);
  const tileLinkExists = computed(() => !!content?.tileLink);

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
    content.tileLink = normalized;
    if (tileId) {
      layoutStore.patchTileContent(tileId, { tileLink: normalized });
    } else {
      layoutStore.saveLayout();
    }
    showLinkModal.value = false;
  };

  const handleFollowLink = () => {
    if (!tileLinkExists.value) return;
    window.open(tileLink.value, "_blank", "noopener,noreferrer");
  };

  const clearLink = () => {
    if (!layoutStore.isOwner) return;
    content.tileLink = undefined;
    if (tileId) {
      layoutStore.patchTileContent(tileId, { tileLink: "" });
    } else {
      layoutStore.saveLayout();
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
