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
  const uploading = ref(false);
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
   * Upload one or more files straight into the archive (no tile is created) and
   * refresh the list. Used by the File Archive upload button; each file routes
   * through the same hash → authorize → finalize flow as tile uploads.
   */
  const uploadFiles = async (files: File[]): Promise<void> => {
    if (files.length === 0) return;
    uploading.value = true;
    error.value = null;
    try {
      const uid = requireUserId();
      const service = getArchiveStorageService();
      for (const file of files) {
        await service.uploadArchiveFile(uid, file);
      }
      await refresh();
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to upload file.";
      throw err;
    } finally {
      uploading.value = false;
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
   * Resolve the download URL to render for an archive file. Prefer a freshly
   * SDK-resolved URL for the canonical path (its download token is guaranteed
   * valid for the current environment) and fall back to the archive doc's
   * stored URL. This mirrors the pre-refactor upload flow, which resolved the
   * client `getDownloadURL` rather than trusting a server-constructed token URL.
   */
  const resolveDisplayUrl = async (
    doc: UploadArchiveDocument,
  ): Promise<string | null> => {
    if (doc.path) {
      try {
        return await getArchiveStorageService().getDownloadUrl(doc.path);
      } catch {
        // Fall through to the stored URL below.
      }
    }
    return doc.url ?? null;
  };

  /**
   * Add an image or video archive file to the open grid as a new media tile.
   * Returns the new tile id, or `null` if the file has no URL / no tile could
   * be placed.
   */
  const addMediaToGrid = async (
    doc: UploadArchiveDocument,
  ): Promise<string | null> => {
    const src = await resolveDisplayUrl(doc);
    if (!src) return null;
    const type =
      doc.kind === "videos" ? ContentType.VIDEO : ContentType.IMAGE;
    const content = createTileContent(type, {
      src,
      srcHash: doc.hash,
    });
    return getArchiveController().addTile(content);
  };

  /**
   * Add a document archive file to the open grid as a new documents tile with a
   * single item. Returns the new tile id, or `null` if the file has no URL.
   */
  const addDocumentToGrid = async (
    doc: UploadArchiveDocument,
  ): Promise<string | null> => {
    const url = await resolveDisplayUrl(doc);
    if (!url) return null;
    const content = createTileContent(ContentType.DOCUMENT, {
      items: [
        {
          id: uuidv4(),
          fileName: doc.displayName ?? `${doc.hash}.${doc.ext}`,
          url,
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
  const addToGrid = (
    doc: UploadArchiveDocument,
  ): Promise<string | null> =>
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
    uploading,
    error,
    refresh,
    uploadFiles,
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
