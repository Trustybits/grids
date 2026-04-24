export type FileType = "images" | "videos";

export interface UploadOptions {
  /** Override the file type detection */
  fileType?: FileType;
  /** Custom max size in bytes (overrides default) */
  maxSize?: number;
}
