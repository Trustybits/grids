import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { useGridStore } from "@/stores/grid";
import { ContentType, type LinkContent, type TileContent } from "@grids/contracts/types";
import {
  createTileContent,
  createTileContentFromEmbedUrl,
} from "@/utils/TileUtils";

interface LinkPreviewResponse {
  url?: string;
  domain?: string;
  faviconUrl?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

type TileInputTarget = { mode: "add" } | { mode: "replace"; tileId: string };

const isRichAutoDetectedContent = (content: TileContent): boolean => {
  return (
    content.type === ContentType.YOUTUBE ||
    content.type === ContentType.IMAGE ||
    content.type === ContentType.VIDEO
  );
};

export const useTileInput = () => {
  const gridStore = useGridStore();

  const applyContentToTarget = (
    content: TileContent,
    target: TileInputTarget,
  ): string | null => {
    if (target.mode === "add") {
      return gridStore.addTile(content);
    }

    gridStore.setTileContent(target.tileId, content);
    return target.tileId;
  };

  const submitLink = async (
    input: string,
    target: TileInputTarget,
  ): Promise<string | null> => {
    const trimmed = (input || "").trim();
    if (!trimmed) return null;

    const isNonWebLink = /^(mailto|tel):/i.test(trimmed);
    const detectedContent = isNonWebLink
      ? createTileContent(ContentType.LINK, { link: trimmed })
      : createTileContentFromEmbedUrl(trimmed);

    if (isRichAutoDetectedContent(detectedContent)) {
      return applyContentToTarget(detectedContent, target);
    }

    const linkContent = createTileContent(ContentType.LINK, { link: trimmed });
    const tileId = applyContentToTarget(linkContent, target);
    if (!tileId) return null;

    try {
      const url = (linkContent as LinkContent).link?.trim() || "";
      if (/^(mailto|tel):/i.test(url)) return tileId;

      const data = await getServiceFactory()
        .getCloudFunctionsService()
        .callFunction<{ url: string }, LinkPreviewResponse>("getLinkPreview", { url });

      gridStore.patchTileContent(tileId, {
        link: data.url,
        domain: data.domain,
        faviconUrl: data.faviconUrl || (linkContent as LinkContent).faviconUrl,
        metaTitle: data.title,
        metaDescription: data.description,
        metaImageUrl: data.imageUrl,
        metaSiteName: data.siteName,
      });
    } catch (error) {
      console.error("Failed to fetch link preview:", error);
    }

    return tileId;
  };

  const submitEmbed = (
    input: string,
    target: TileInputTarget,
  ): string | null => {
    const trimmed = (input || "").trim();
    if (!trimmed) return null;

    const content = createTileContentFromEmbedUrl(trimmed);
    return applyContentToTarget(content, target);
  };

  return {
    submitLink,
    submitEmbed,
  };
};
