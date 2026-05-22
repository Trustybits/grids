import { getServiceFactory } from "@/services/ServiceFactorySingleton";

export type EnsureDocumentThumbResponse = {
  thumbnailUrl?: string;
  skipped?: boolean;
  cached?: boolean;
};

export function documentItemIsPdf(fileName: string, mimeType?: string): boolean {
  const m = (mimeType || "").toLowerCase();
  if (m.includes("pdf")) return true;
  const i = fileName.lastIndexOf(".");
  const e = i >= 0 ? fileName.slice(i + 1).toLowerCase() : "";
  return e === "pdf";
}

/**
 * Ask the backend to rasterize page 1 of a PDF into Storage and update the grid.
 * No-op for non-PDFs (server returns skipped).
 */
export async function ensureDocumentItemThumbnailOnServer(
  gridId: string,
  tileId: string,
  itemId: string,
): Promise<EnsureDocumentThumbResponse> {
  return getServiceFactory()
    .getCloudFunctionsService()
    .callFunction<
      { gridId: string; tileId: string; itemId: string },
      EnsureDocumentThumbResponse
    >("ensureDocumentItemThumbnail", { gridId, tileId, itemId });
}
