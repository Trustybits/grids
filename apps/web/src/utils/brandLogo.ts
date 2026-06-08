import type { BrandLogoRef } from "@grids/contracts/types";

// Brandfetch client ID (publishable, safe for client-side use — same model as
// VITE_MAPBOX_TOKEN). Logos are hotlinked from the Brandfetch CDN so they stay
// up to date; we store only the brand's domain, never a snapshot.
const BRANDFETCH_CLIENT_ID = import.meta.env.VITE_BRANDFETCH_CLIENT_ID ?? "";

const SEARCH_BASE = "https://api.brandfetch.io/v2/search";
const CDN_BASE = "https://cdn.brandfetch.io";

export interface BrandSearchResult {
  name: string;
  domain: string;
  icon?: string;
  brandId?: string;
}

export function hasBrandfetchClientId(): boolean {
  return BRANDFETCH_CLIENT_ID.length > 0;
}

export function brandSearchUrl(query: string): string {
  return `${SEARCH_BASE}/${encodeURIComponent(query)}?c=${encodeURIComponent(
    BRANDFETCH_CLIENT_ID,
  )}`;
}

export interface BrandLogoUrlOptions {
  // Square icon mark by default — matches a logo "dock" layout.
  type?: "icon" | "logo" | "symbol";
  theme?: "light" | "dark";
  // Requested edge length in px; rendered at 2x for crisp high-density display.
  size?: number;
}

export function brandfetchLogoUrl(
  domain: string,
  { type = "icon", theme, size }: BrandLogoUrlOptions = {},
): string {
  const params = new URLSearchParams({ c: BRANDFETCH_CLIENT_ID, type });
  if (theme && theme !== undefined) params.set("theme", theme);
  if (size && size > 0) {
    const px = String(Math.round(size * 2));
    params.set("w", px);
    params.set("h", px);
  }
  params.set("fallback", "transparent");
  return `${CDN_BASE}/${encodeURIComponent(domain)}?${params.toString()}`;
}

// Resolve the <img> src for a logo ref: uploaded image for custom refs,
// otherwise the dynamic Brandfetch CDN URL.
export function resolveBrandLogoSrc(ref: BrandLogoRef, size?: number): string {
  if (ref.provider === "custom") return ref.src ?? "";
  if (!ref.domain) return "";
  const theme = ref.theme === "light" || ref.theme === "dark" ? ref.theme : undefined;
  return brandfetchLogoUrl(ref.domain, { theme, size });
}

// Resolve the click-through link: explicit link wins, otherwise default to the
// brand's site (https://{domain}) unless the owner disabled linking.
export function resolveBrandLogoLink(ref: BrandLogoRef): string | null {
  if (ref.linkDisabled) return null;
  if (ref.link && ref.link.trim()) return ref.link.trim();
  if (ref.provider === "brandfetch" && ref.domain) return `https://${ref.domain}`;
  return null;
}
