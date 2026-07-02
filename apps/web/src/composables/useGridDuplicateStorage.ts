import type {
  ConfirmedGridDuplicateStorage,
  CopyDepth,
  Grid,
  PrepareGridDuplicateStorageResponse,
} from "@grids/contracts/types";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { formatBytes } from "@/utils/StorageFormat";

const shouldConfirm = (estimate: PrepareGridDuplicateStorageResponse): boolean =>
  estimate.additionalBytesRequired > 0 ||
  estimate.nonCopiableCount > 0 ||
  estimate.removeBackgroundImage === true;

const hasStorageWork = (
  estimate: PrepareGridDuplicateStorageResponse,
): boolean =>
  estimate.copiableCount > 0 ||
  estimate.nonCopiableCount > 0 ||
  estimate.additionalBytesRequired > 0 ||
  estimate.removeBackgroundImage === true;

const buildConfirmationMessage = (
  estimate: PrepareGridDuplicateStorageResponse,
): string => {
  const lines: string[] = [];
  if (estimate.additionalBytesRequired > 0) {
    lines.push(
      `Duplicating this grid will copy ${estimate.copiableCount} shareable file${
        estimate.copiableCount === 1 ? "" : "s"
      } into your archive and use ${formatBytes(estimate.additionalBytesRequired)} of storage.`,
    );
  }
  if (estimate.nonCopiableCount > 0) {
    lines.push(
      `${estimate.nonCopiableCount} file-backed tile${
        estimate.nonCopiableCount === 1 ? "" : "s"
      } cannot be copied because the source file is not shareable. ${
        estimate.nonCopiableCount === 1 ? "It" : "They"
      } will be replaced with suggestion tiles.`,
    );
  }
  if (estimate.removeBackgroundImage) {
    lines.push(
      "The background image cannot be copied because the source file is not shareable. The duplicate will use no background image.",
    );
  }
  lines.push("Continue?");
  return lines.join("\n\n");
};

export function useGridDuplicateStorage() {
  const resolveStoragePlan = async (
    grid: Grid,
    copyDepth: CopyDepth,
  ): Promise<ConfirmedGridDuplicateStorage | null | undefined> => {
    if (copyDepth !== "full") return undefined;

    const storageService = getServiceFactory().getStorageService();
    const estimate = await storageService.prepareGridDuplicateStorage({
      sourceGridId: grid.id,
      copyDepth,
    });

    if (!hasStorageWork(estimate)) return undefined;
    if (shouldConfirm(estimate) && !window.confirm(buildConfirmationMessage(estimate))) {
      return null;
    }

    if (estimate.copiableCount === 0) {
      return {
        replacementTileIds: estimate.replacementTileIds,
        removeBackgroundImage: estimate.removeBackgroundImage,
      };
    }

    return storageService.prepareGridDuplicateStorage({
      sourceGridId: grid.id,
      copyDepth,
      confirmed: true,
    });
  };

  return { resolveStoragePlan };
}
