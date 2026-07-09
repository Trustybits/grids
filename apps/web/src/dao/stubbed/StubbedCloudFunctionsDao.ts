import type { CloudFunctionsDao } from "@grids/contracts/dao";
import type {
  AcceptGridTransferResponse,
  CancelGridTransferResponse,
  CreateGridTransferRequest,
  CreateGridTransferResponse,
  DeclineGridTransferResponse,
  GridTransfer,
  GridTransferRecipientRef,
  PreviewGridTransferAcceptanceResponse,
} from "@grids/contracts/types";
import {
  STUBBED_USER_ID,
  cloneValue,
  createId,
  memoryDatabase,
} from "./StubbedMemoryDatabase";
import { emitGridTransfersChanged } from "./StubbedGridTransferDao";

export class StubbedCloudFunctionsDao implements CloudFunctionsDao {
  public async callFunction<TRequest = unknown, TResponse = unknown>(
    functionName: string,
    data: TRequest,
  ): Promise<TResponse> {
    switch (functionName) {
      case "getLinkPreview":
        return this.stubLinkPreview(data) as TResponse;
      case "ensureDocumentItemThumbnail":
        return { skipped: true } as TResponse;
      case "authorizeStorageUpload":
        // No dedupe index in local mode: always require an upload. The service
        // builds the canonical path itself and the stubbed archive DAO reports
        // the upload as finalized immediately.
        return { uploadRequired: true } as TResponse;
      case "ext-firestore-stripe-payments-createPortalLink":
        return { url: this.localUrl("/dashboard") } as TResponse;
      case "notionOAuthExchange":
        return { success: true } as TResponse;
      case "createGridTransfer":
        return this.createGridTransfer(data) as TResponse;
      case "previewGridTransferAcceptance":
        return this.previewGridTransferAcceptance() as TResponse;
      case "acceptGridTransfer":
        return this.acceptGridTransfer(data) as TResponse;
      case "declineGridTransfer":
        return this.resolveGridTransfer(
          data,
          "declined",
        ) as TResponse;
      case "cancelGridTransfer":
        return this.resolveGridTransfer(
          data,
          "cancelled",
        ) as TResponse;
      case "getYouTubeMetadata":
      case "getMusicTrackMetadata":
        return {} as TResponse;
      default:
        return {} as TResponse;
    }
  }

  private createGridTransfer(data: unknown): CreateGridTransferResponse {
    const request = data as Partial<CreateGridTransferRequest>;
    const gridId = typeof request.gridId === "string" ? request.gridId : "";
    const grid = memoryDatabase.grids.get(gridId);
    const fromUserId = grid?.userId || STUBBED_USER_ID;
    const toUserId =
      this.resolveRecipientUid(request.recipient) || "stubbed-recipient-id";
    const transferId = createId("grid_transfer");
    const now = new Date();
    const transfer: GridTransfer = {
      id: transferId,
      gridId,
      gridName: grid?.name || "Untitled",
      fromUserId,
      fromSlug: this.findUserSlug(fromUserId),
      fromEmail: this.findUserEmail(fromUserId),
      toUserId,
      removeOrphanedFiles: request.removeOrphanedFiles === true,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    };
    memoryDatabase.gridTransfers.set(transferId, transfer);
    emitGridTransfersChanged();
    return {
      transferId,
      status: "pending",
      estimatedBytes: 0,
    };
  }

  private previewGridTransferAcceptance(): PreviewGridTransferAcceptanceResponse {
    return {
      additionalBytesRequired: 0,
      recipientQuotaRemaining: Number.MAX_SAFE_INTEGER,
      wouldExceedQuota: false,
      files: [],
      nonCopiableCount: 0,
    };
  }

  private acceptGridTransfer(data: unknown): AcceptGridTransferResponse {
    const transfer = this.getTransfer(data);
    transfer.status = "accepted";
    transfer.updatedAt = new Date();
    transfer.resolvedAt = new Date();
    const grid = memoryDatabase.grids.get(transfer.gridId);
    if (grid) {
      memoryDatabase.grids.set(transfer.gridId, {
        ...cloneValue(grid),
        userId: transfer.toUserId,
        rev: (grid.rev || 0) + 1,
        updatedAt: new Date(),
      });
    }
    emitGridTransfersChanged();
    return {
      transferId: transfer.id,
      gridId: transfer.gridId,
      status: "accepted",
    };
  }

  private resolveGridTransfer(
    data: unknown,
    status: "declined" | "cancelled",
  ): DeclineGridTransferResponse | CancelGridTransferResponse {
    const transfer = this.getTransfer(data);
    transfer.status = status;
    transfer.updatedAt = new Date();
    transfer.resolvedAt = new Date();
    emitGridTransfersChanged();
    if (status === "declined") {
      return { transferId: transfer.id, status: "declined" };
    }
    return { transferId: transfer.id, status: "cancelled" };
  }

  private getTransfer(data: unknown): GridTransfer {
    const transferId =
      data && typeof data === "object" && "transferId" in data
        ? String((data as { transferId: unknown }).transferId)
        : "";
    const transfer = memoryDatabase.gridTransfers.get(transferId);
    if (!transfer) {
      throw new Error("Transfer not found.");
    }
    return transfer;
  }

  private resolveRecipientUid(
    recipient: GridTransferRecipientRef | undefined,
  ): string | null {
    if (!recipient) return null;
    if (recipient.slug) {
      const slug = memoryDatabase.slugs.get(recipient.slug.toLowerCase());
      return typeof slug?.userId === "string" ? slug.userId : null;
    }
    if (recipient.email) {
      const email = recipient.email.toLowerCase();
      for (const [uid, user] of memoryDatabase.users.entries()) {
        if (
          typeof user.email === "string" &&
          user.email.toLowerCase() === email
        ) {
          return uid;
        }
      }
    }
    return null;
  }

  private findUserSlug(userId: string): string | null {
    for (const [slug, data] of memoryDatabase.slugs.entries()) {
      if (data.userId === userId) return slug;
    }
    return null;
  }

  private findUserEmail(userId: string): string | null {
    const email = memoryDatabase.users.get(userId)?.email;
    return typeof email === "string" ? email : null;
  }

  private stubLinkPreview(data: unknown): Record<string, unknown> {
    const rawUrl =
      data && typeof data === "object" && "url" in data
        ? String((data as { url: unknown }).url)
        : "";
    try {
      const url = new URL(rawUrl);
      return {
        url: url.toString(),
        domain: url.hostname.replace(/^www\./, ""),
        faviconUrl: `${url.origin}/favicon.ico`,
        title: url.hostname,
        description: "Preview metadata is stubbed in local memory mode.",
        siteName: url.hostname.replace(/^www\./, ""),
      };
    } catch {
      return { url: rawUrl };
    }
  }

  private localUrl(path: string): string {
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }
}
