/**
 * useTileActions — what a tile can *do*, independent of how it is presented.
 *
 * Extracted from `TileActions.vue` so the desktop hover action bar and the
 * Mobile 2.0 `/EDIT` sheet offer the same set from one implementation. The
 * availability rules (is there a link, is there anything to copy, is the file
 * downloadable) are the subtle part and are exactly what must not be restated
 * per surface.
 *
 * Deliberately presentation-free: no positioning, no visibility, no icons. It
 * reports what is possible and performs it; the caller decides how it looks.
 * Deletion is not here — it needs a confirmation flow that differs per surface,
 * so each one owns that.
 */

import {
  computed,
  proxyRefs,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import type { Tile } from "@grids/contracts/types";
import { getTileDefinition } from "@/registries/tileRegistry";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import { useToastStore } from "@/stores/toast";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";

/**
 * Server-approved download URLs, keyed `ownerId:hash`. Many tiles can reference
 * the same archive file, and each would otherwise call the function again on
 * every re-render. Process-lifetime only; cleared on reload.
 */
const shareableDownloadUrlCache = new Map<string, string>();

export function useTileActions(tileSource: MaybeRefOrGetter<Tile>) {
  const gridView = proxyRefs(useGridViewContext());
  const toastStore = useToastStore();

  const tile = computed(() => toValue(tileSource));
  const tileDef = computed(() => getTileDefinition(tile.value.content.type));

  // ── Link ───────────────────────────────────────────────────────────────────
  const tileUrl = computed<string | null>(
    () =>
      tileDef.value?.actions?.externalUrl?.(tile.value.content as never) ?? null,
  );

  /** The tile's link as something an <a href> can use — bare hosts get https. */
  const resolvedTileUrl = computed<string>(() => {
    const url = (tileUrl.value || "").trim();
    if (!url) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
    return `https://${url}`;
  });

  const hasLink = computed(() => !!resolvedTileUrl.value);

  // ── Copy ───────────────────────────────────────────────────────────────────
  const hasCopyable = computed(() => !!tileDef.value?.actions?.copyContent);

  // ── Download ───────────────────────────────────────────────────────────────
  // Archive-backed media (an image/video whose bytes live in the source owner's
  // upload archive) exposes a download only once the owner has marked the file
  // `shareable` and the server has returned a URL. Non-archive sources
  // (external URLs, legacy `src`-only tiles) keep their existing behaviour.
  const archiveHash = computed<string | null>(() => {
    const content = tile.value.content as { srcHash?: unknown };
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
        void resolveArchiveDownloadUrl(ownerId, hash, archiveDownloadRequestId);
      }
    },
    { immediate: true },
  );

  const hasDownload = computed(() => {
    if (!tileDef.value?.actions?.downloadUrl) return false;
    if (archiveHash.value === null) return true;
    return !!archiveDownloadUrl.value;
  });

  // ── Perform ────────────────────────────────────────────────────────────────
  const duplicate = () => {
    const newId = gridView.duplicateTile(tile.value.i);
    if (newId) toastStore.addToast("Tile duplicated", "success");
  };

  const copyToClipboard = async () => {
    const text =
      tileDef.value?.actions?.copyContent?.(tile.value.content as never) ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toastStore.addToast("Copied to clipboard", "success");
    } catch {
      toastStore.addToast("Failed to copy", "error");
    }
  };

  const download = async () => {
    const src = archiveHash.value
      ? archiveDownloadUrl.value ?? ""
      : tileDef.value?.actions?.downloadUrl?.(tile.value.content as never) ?? "";
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
    resolvedTileUrl,
    hasLink,
    hasCopyable,
    hasDownload,
    duplicate,
    copyToClipboard,
    download,
  };
}
