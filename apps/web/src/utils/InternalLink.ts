import { isNonGridPath } from "@/constants/marketing";

/**
 * If `href` points to a grid hosted on this same site, return the in-app route
 * path (`pathname` + `search`) suitable for `router.push` / `<router-link :to>`.
 * Otherwise return null so the caller can fall back to a normal external link.
 *
 * Only exact same-origin http(s) URLs are treated as internal. Links on other
 * hosts — including alternate domains or `www.` variants — open normally.
 */
export function resolveInternalGridRoute(
  href: string,
  origin: string = window.location.origin,
): string | null {
  if (!href) return null;

  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.origin !== origin) return null;

  // Normalize away any trailing slash for matching (keep "/" itself).
  const path = url.pathname.replace(/\/+$/, "") || "/";

  // `/grid/:id` is always a grid route.
  const isGridIdRoute = /^\/grid\/[^/]+$/.test(path);
  // `/:slug` is a single non-reserved path segment.
  const isSlugRoute = /^\/[^/]+$/.test(path) && !isNonGridPath(path);

  if (!isGridIdRoute && !isSlugRoute) return null;

  return path + url.search;
}
