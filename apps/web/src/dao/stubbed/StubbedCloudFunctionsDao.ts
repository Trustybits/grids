import type { CloudFunctionsDao } from "@grids/contracts/dao";

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
      case "getYouTubeMetadata":
      case "getMusicTrackMetadata":
        return {} as TResponse;
      default:
        return {} as TResponse;
    }
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
