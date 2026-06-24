import { isNonGridPath } from "@/constants/marketing";

type GridHostGroup = "production" | "local";

const PRODUCTION_HOSTS = new Set(["grids.so", "www.grids.so"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase();
}

function getGridHostGroup(hostname: string): GridHostGroup | null {
  const normalized = normalizeHostname(hostname);
  if (PRODUCTION_HOSTS.has(normalized)) return "production";
  if (LOCAL_HOSTS.has(normalized)) return "local";
  return null;
}

/** Effective port for origin comparison (default http/https ports when omitted). */
function effectivePort(url: URL): string {
  if (url.port) return url.port;
  if (url.protocol === "https:") return "443";
  if (url.protocol === "http:") return "80";
  return "";
}

/**
 * Whether two origins refer to the same grids deployment for in-app navigation.
 *
 * Production: `grids.so` and `www.grids.so` (same port).
 * Local dev: `localhost` and `127.0.0.1` (same port).
 * Cross-group (e.g. localhost page + grids.so link) is never equivalent.
 * Protocol (http vs https) is ignored within a group so pasted links still route
 * in-app without opening a new tab.
 */
export function areEquivalentGridOrigins(
  linkOrigin: string,
  pageOrigin: string,
): boolean {
  let linkUrl: URL;
  let pageUrl: URL;
  try {
    linkUrl = new URL(linkOrigin);
    pageUrl = new URL(pageOrigin);
  } catch {
    return false;
  }

  if (linkUrl.protocol !== "http:" && linkUrl.protocol !== "https:") {
    return false;
  }
  if (pageUrl.protocol !== "http:" && pageUrl.protocol !== "https:") {
    return false;
  }

  const linkGroup = getGridHostGroup(linkUrl.hostname);
  const pageGroup = getGridHostGroup(pageUrl.hostname);
  if (!linkGroup || linkGroup !== pageGroup) return false;

  return effectivePort(linkUrl) === effectivePort(pageUrl);
}

/**
 * If `href` points to a grid hosted on this same site, return the in-app route
 * path (`pathname` + `search`) suitable for `router.push` / `<router-link :to>`.
 * Otherwise return null so the caller can fall back to a normal external link.
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
  if (!areEquivalentGridOrigins(url.origin, origin)) return null;

  // Normalize away any trailing slash for matching (keep "/" itself).
  const path = url.pathname.replace(/\/+$/, "") || "/";

  // `/grid/:id` is always a grid route.
  const isGridIdRoute = /^\/grid\/[^/]+$/.test(path);
  // `/:slug` is a single non-reserved path segment.
  const isSlugRoute = /^\/[^/]+$/.test(path) && !isNonGridPath(path);

  if (!isGridIdRoute && !isSlugRoute) return null;

  return path + url.search;
}
