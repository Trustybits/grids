import { ref } from "vue";
import { v4 as uuidv4 } from "uuid";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { useGridController } from "@/controllers/useGridController";
import { createTileContent } from "@/utils/TileUtils";
import { ContentType } from "@grids/contracts/types";
import type {
  PrepareGridDuplicateStorageResponse,
  UploadArchiveDocument,
} from "@grids/contracts/types";

type AuthProvider = ReturnType<typeof getAuthProvider>;
type ServiceFactory = ReturnType<typeof getServiceFactory>;
type StorageService = ReturnType<ServiceFactory["getStorageService"]>;
type GridController = ReturnType<typeof useGridController>;

/** Coerce an archive timestamp (`Date | { toDate() } | null`) to epoch millis. */
function toMillis(
  value: UploadArchiveDocument["createdAt"],
): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && "toDate" in value) {
    try {
      return value.toDate().getTime();
    } catch {
      return 0;
    }
  }
  return 0;
}

/**
 * Read/list and manage a user's upload archive (`users/{uid}/uploads`) for the
 * File Archive UI. Reads go straight through Firestore (archive docs are
 * server-written); every mutation routes through the storage service's server
 * callables so the client never writes an archive doc directly.
 *
 * Mutations update the local list optimistically and revert on failure so the
 * UI can reflect pending/saving state without a full refresh.
 */
export function useFileArchive() {
  const uploads = ref<UploadArchiveDocument[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  let authProvider: AuthProvider | null = null;
  let storageService: StorageService | null = null;
  let controller: GridController | null = null;

  const getArchiveAuthProvider = (): AuthProvider => {
    authProvider ??= getAuthProvider();
    return authProvider;
  };

  const getArchiveStorageService = (): StorageService => {
    storageService ??= getServiceFactory().getStorageService();
    return storageService;
  };

  const getArchiveController = (): GridController => {
    controller ??= useGridController();
    return controller;
  };

  const requireUserId = (): string => {
    const uid = getArchiveAuthProvider().getCurrentUserId();
    if (!uid) {
      throw new Error("You must be logged in to view your file archive.");
    }
    return uid;
  };

  const findUpload = (hash: string): UploadArchiveDocument | undefined =>
    uploads.value.find((u) => u.hash === hash);

  /** Load the current user's archive, newest first. */
  const refresh = async (): Promise<void> => {
    loading.value = true;
    error.value = null;
    try {
      const uid = requireUserId();
      const docs = await getArchiveStorageService().listArchiveUploads(uid);
      uploads.value = [...docs].sort(
        (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt),
      );
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to load file archive.";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Toggle a file's shareable flag. Applies optimistically and reverts if the
   * server callable rejects.
   */
  const setShareable = async (
    hash: string,
    shareable: boolean,
  ): Promise<void> => {
    const upload = findUpload(hash);
    const previous = upload?.shareable;
    if (upload) upload.shareable = shareable;
    try {
      const persisted =
        await getArchiveStorageService().setUploadShareable(hash, shareable);
      if (upload) upload.shareable = persisted;
    } catch (err) {
      if (upload && previous !== undefined) upload.shareable = previous;
      throw err;
    }
  };

  /**
   * Rename a file's display label. Applies optimistically and reverts if the
   * server callable rejects. Only the label changes — path, hash, and grid
   * references are untouched.
   */
  const rename = async (
    hash: string,
    displayName: string,
  ): Promise<void> => {
    const upload = findUpload(hash);
    const previous = upload?.displayName;
    if (upload) upload.displayName = displayName;
    try {
      const persisted =
        await getArchiveStorageService().renameUpload(hash, displayName);
      if (upload) upload.displayName = persisted;
    } catch (err) {
      if (upload) upload.displayName = previous;
      throw err;
    }
  };

  /**
   * Permanently delete a file. `force` is required for files still referenced
   * by a grid (refCount > 0). Removes the row from the local list on success.
   */
  const remove = async (hash: string, force = false): Promise<void> => {
    await getArchiveStorageService().deleteArchiveUpload(hash, force);
    uploads.value = uploads.value.filter((u) => u.hash !== hash);
  };

  /**
   * Add an image or video archive file to the open grid as a new media tile.
   * Returns the new tile id, or `null` if the file has no URL / no tile could
   * be placed.
   */
  const addMediaToGrid = (doc: UploadArchiveDocument): string | null => {
    if (!doc.url) return null;
    const type =
      doc.kind === "videos" ? ContentType.VIDEO : ContentType.IMAGE;
    const content = createTileContent(type, {
      src: doc.url,
      srcHash: doc.hash,
    });
    return getArchiveController().addTile(content);
  };

  /**
   * Add a document archive file to the open grid as a new documents tile with a
   * single item. Returns the new tile id, or `null` if the file has no URL.
   */
  const addDocumentToGrid = (doc: UploadArchiveDocument): string | null => {
    if (!doc.url) return null;
    const content = createTileContent(ContentType.DOCUMENT, {
      items: [
        {
          id: uuidv4(),
          fileName: doc.displayName ?? `${doc.hash}.${doc.ext}`,
          url: doc.url,
          hash: doc.hash,
          mimeType: doc.contentType || undefined,
        },
      ],
    });
    return getArchiveController().addTile(content);
  };

  /**
   * Add a file to the open grid, dispatching to the correct tile type. Relies on
   * the next persisted grid diff to update the file's refCount server-side.
   */
  const addToGrid = (doc: UploadArchiveDocument): string | null =>
    doc.kind === "documents" ? addDocumentToGrid(doc) : addMediaToGrid(doc);

  /**
   * Estimate the storage impact of fully duplicating a grid: copiable vs.
   * non-copiable referenced files, additional quota required, and (when the
   * server has anything to report) the tile ids that must become suggestions.
   */
  const prepareGridDuplicate = (
    sourceGridId: string,
    copyDepth: "full" | "structure" = "full",
  ): Promise<PrepareGridDuplicateStorageResponse> =>
    getArchiveStorageService().prepareGridDuplicateStorage({
      sourceGridId,
      copyDepth,
    });

  /**
   * Execute the storage side of a full grid duplication after the user confirms
   * the quota impact. Copies shareable files into the caller's archive and
   * returns the URL/hash rewrite + tile-replacement maps.
   */
  const confirmGridDuplicate = (
    sourceGridId: string,
    copyDepth: "full" | "structure" = "full",
  ): Promise<PrepareGridDuplicateStorageResponse> =>
    getArchiveStorageService().prepareGridDuplicateStorage({
      sourceGridId,
      copyDepth,
      confirmed: true,
    });

  return {
    uploads,
    loading,
    error,
    refresh,
    setShareable,
    rename,
    remove,
    addMediaToGrid,
    addDocumentToGrid,
    addToGrid,
    prepareGridDuplicate,
    confirmGridDuplicate,
  };
}
