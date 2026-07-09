import type { UploadKind } from "./Storage.js";

export type GridTransferStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "expired";

export type GridTransferTimestamp = Date | { toDate(): Date } | null;

export interface GridTransfer {
  id: string;
  gridId: string;
  gridName: string;
  fromUserId: string;
  fromSlug?: string | null;
  fromEmail?: string | null;
  toUserId: string;
  removeOrphanedFiles: boolean;
  status: GridTransferStatus;
  createdAt?: GridTransferTimestamp;
  updatedAt?: GridTransferTimestamp;
  resolvedAt?: GridTransferTimestamp;
  expiresAt: GridTransferTimestamp;
  failureReason?: string;
}

export interface GridTransferRecipientRef {
  email?: string;
  slug?: string;
}

export interface CreateGridTransferRequest {
  gridId: string;
  recipient: GridTransferRecipientRef;
  removeOrphanedFiles: boolean;
}

export interface CreateGridTransferResponse {
  transferId: string;
  status: "pending";
  estimatedBytes: number;
}

export interface PreviewGridTransferAcceptanceRequest {
  transferId: string;
}

export interface GridTransferPreviewFile {
  hash: string;
  displayName: string;
  kind: UploadKind;
  size: number;
  alreadyOwned: boolean;
}

export interface PreviewGridTransferAcceptanceResponse {
  additionalBytesRequired: number;
  recipientQuotaRemaining: number;
  wouldExceedQuota: boolean;
  files: GridTransferPreviewFile[];
  nonCopiableCount: number;
}

export interface AcceptGridTransferRequest {
  transferId: string;
}

export interface AcceptGridTransferResponse {
  transferId: string;
  gridId: string;
  status: "accepted";
}

export interface DeclineGridTransferRequest {
  transferId: string;
}

export interface DeclineGridTransferResponse {
  transferId: string;
  status: "declined";
}

export interface CancelGridTransferRequest {
  transferId: string;
}

export interface CancelGridTransferResponse {
  transferId: string;
  status: "cancelled";
}
