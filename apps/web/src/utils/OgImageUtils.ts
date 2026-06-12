/**
 * OG (social share) image helpers.
 *
 * Each grid has at most ONE custom OG image, stored at a fixed path that is
 * overwritten on every re-upload — so removing/replacing never piles up
 * orphaned files. The path must stay in sync with:
 *   - storage.rules (owner-write rule for og-images/custom/{gridId})
 *   - apps/firebase-functions onRequest_generateOgImage.ts (custom short-circuit)
 */

// The /api/og route is a Vercel serverless function (apps/web/api/og.ts) that
// only exists on the deployed site — local dev servers have no such route, so
// we always call production. api/og.ts sends Access-Control-Allow-Origin: *
// so cross-origin fetches from dev work.
const OG_API_BASE = "https://grids.so/api/og";

export function customOgImagePath(gridId: string): string {
  return `og-images/custom/${gridId}/og`;
}

/**
 * URL of the auto-generated OG image for a grid, served through the
 * rate-limited Vercel proxy (api/og.ts → Firebase generateOgImage).
 * Requesting it generates the image if it doesn't exist yet.
 */
export function generatedOgImageUrl(
  gridId: string,
  options: { refresh?: boolean; cacheBust?: number } = {},
): string {
  const params = new URLSearchParams({ gridId });
  if (options.refresh) params.set("refresh", "1");
  // Unique param defeats the Vercel CDN's 24h cache after a regenerate.
  if (options.cacheBust) params.set("t", String(options.cacheBust));
  return `${OG_API_BASE}?${params.toString()}`;
}

/**
 * Existence probe — asks the OG function whether a generated image is cached
 * for this grid WITHOUT triggering generation. Responds with JSON {exists}.
 */
export function ogImageCheckUrl(gridId: string): string {
  const params = new URLSearchParams({ gridId, check: "1", t: String(Date.now()) });
  return `${OG_API_BASE}?${params.toString()}`;
}

/** The site-wide default OG image (shown for grids with no image yet). */
export function defaultOgImageUrl(): string {
  return `${OG_API_BASE}?slug=grids`;
}

/** Append a version param so CDNs and social platforms re-fetch the new image. */
export function withVersionParam(url: string, version: number): string {
  return `${url}${url.includes("?") ? "&" : "?"}v=${version}`;
}
