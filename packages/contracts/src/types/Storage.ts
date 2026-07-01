export type UploadKind = "images" | "videos" | "documents";

export type UploadArchiveStatus = "pending" | "active" | "failed";

export interface UploadArchiveDocument {
  uid: string;
  hash: string;
  kind: UploadKind;
  path: string;
  url?: string;
  size: number;
  contentType: string;
  ext: string;
  status: UploadArchiveStatus;
  refCount: number;
  shareable: boolean;
  createdAt?: Date | { toDate(): Date } | null;
  updatedAt?: Date | { toDate(): Date } | null;
  activatedAt?: Date | { toDate(): Date } | null;
  failedAt?: Date | { toDate(): Date } | null;
  failureReason?: string;
}

export interface StoredFileReference {
  uid: string;
  kind: UploadKind;
  hash?: string;
  path?: string;
  url?: string;
}

export interface AuthorizeStorageUploadRequest {
  hash: string;
  size: number;
  kind: UploadKind;
  ext: string;
  contentType: string;
}

export interface AuthorizeStorageUploadResponse {
  hash: string;
  kind: UploadKind;
  path: string;
  uploadRequired: boolean;
  url?: string;
  status?: UploadArchiveStatus;
}

export interface DeleteStorageUploadRequest {
  hash: string;
  force?: boolean;
}

export interface DeleteStorageUploadResponse {
  deleted: boolean;
  hash: string;
}

export interface SetStorageUploadShareableRequest {
  hash: string;
  shareable: boolean;
}

export interface SetStorageUploadShareableResponse {
  hash: string;
  shareable: boolean;
}

export interface PrepareGridDuplicateStorageRequest {
  sourceGridId: string;
  copyDepth: "full" | "structure";
  confirmed?: boolean;
}

export interface PrepareGridDuplicateStorageResponse {
  additionalBytesRequired: number;
  copiableCount: number;
  nonCopiableCount: number;
  rewriteMap?: Record<
    string,
    {
      oldHash?: string;
      oldUrl?: string;
      newHash: string;
      newUrl: string;
    }
  >;
  replacementTileIds?: string[];
}
