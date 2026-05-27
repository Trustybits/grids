import { ContentType, type LinkContent } from "@/types/TileContent";
import type { TileDefinition } from "@/types/TileDefinition";
import { RESIZE_PRESETS, BORDER_TOGGLE, COLOR_BUTTON } from "@/registries/tileToolbar/sharedButtons";
import { LINK_MORE_MENU } from "@/registries/tileToolbar/linkButtons";

export const linkDefinition: TileDefinition<LinkContent> = {
  type: ContentType.LINK,
  label: "Link",
  category: "embed",

  component: () => import("@/components/tilecontent/LinkContent.vue"),

  defaultContent: (data) => {
    const trimmed = (data?.link || "").trim();
    let domain: string | undefined;
    let faviconUrl: string | undefined;
    let link = trimmed;

    if (trimmed && !/^(mailto|tel):/i.test(trimmed)) {
      try {
        const formattedUrl = trimmed.startsWith("http")
          ? trimmed
          : `https://${trimmed}`;
        const parsedUrl = new URL(formattedUrl);
        domain = parsedUrl.hostname;
        faviconUrl = `https://s2.googleusercontent.com/s2/favicons?sz=64&domain_url=${parsedUrl.origin}`;
        link = formattedUrl;
      } catch {
        // keep original
      }
    }

    return {
      type: ContentType.LINK,
      link,
      domain: data?.domain ?? domain,
      faviconUrl: data?.faviconUrl ?? faviconUrl,
      metaTitle: data?.metaTitle,
      metaDescription: data?.metaDescription,
      metaImageUrl: data?.metaImageUrl,
      metaSiteName: data?.metaSiteName,
      customTitle: data?.customTitle,
      customDescription: data?.customDescription,
      customSubtitle: data?.customSubtitle,
      linkBackgroundEnabled: data?.linkBackgroundEnabled ?? true,
      customImageUrl: data?.customImageUrl,
      backgroundColor: data?.backgroundColor,
    };
  },

  validate: (content) =>
    !!content.link &&
    (content.link.startsWith("http") ||
      /^mailto:/i.test(content.link) ||
      /^tel:/i.test(content.link)),

  capabilities: {
    caption: false,
    border: true,
  },

  colorTheming: {
    backgroundColor: true,
  },

  editMode: "fields",

  actions: {
    copyContent: (content) => content.link || null,
    externalUrl: (content) => content.link || null,
  },

  toolbar: [...RESIZE_PRESETS, BORDER_TOGGLE, COLOR_BUTTON, LINK_MORE_MENU],
};
