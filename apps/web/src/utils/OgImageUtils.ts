/**
 * OG (social share) image helpers.
 *
 * Each grid has at most ONE custom OG image, stored at a fixed path that is
 * overwritten on every re-upload — so removing/replacing never piles up
 * orphaned files. The path is namespaced under the owner's uid so the storage
 * rule can verify ownership with a simple path check (no cross-service
 * Firestore lookup, which is unreliable in the emulator). It stays under
 * og-images/ rather than users/ so it isn't counted toward the user's storage
 * quota. The path must stay in sync with:
 *   - storage.rules (owner-write rule for og-images/custom/{userId}/{gridId})
 *   - apps/firebase-functions onRequest_generateOgImage.ts (custom short-circuit)
 */

// The /api/og route is a Vercel serverless function (apps/web/api/og.ts) that
// only exists on the deployed site — local dev servers have no such route, so
// by default we call production. Both the proxy and the Firebase function
// send Access-Control-Allow-Origin: * so cross-origin fetches from dev work.
//
// On production (grids.so or www.grids.so) we always use same-origin /api/og
// so fetch() from the share-image modal never crosses www↔apex (which triggers
// 307 redirects that strip CORS headers).
//
// Override with VITE_OG_IMAGE_ENDPOINT to target another environment, e.g.
// the local functions emulator:
//   VITE_OG_IMAGE_ENDPOINT=http://127.0.0.1:5001/grids-one/us-central1/generateOgImage
const PROD_OG_API_BASE = "https://grids.so/api/og";

function ogApiBase(): string {
  const override = import.meta.env.VITE_OG_IMAGE_ENDPOINT;
  if (override) return override;

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "grids.so" || host === "www.grids.so") {
      return `${window.location.origin}/api/og`;
    }
  }

  return PROD_OG_API_BASE;
}

export function customOgImagePath(userId: string, gridId: string): string {
  return `og-images/custom/${userId}/${gridId}/og`;
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
  return `${ogApiBase()}?${params.toString()}`;
}

/**
 * Existence probe — asks the OG function whether a generated image is cached
 * for this grid WITHOUT triggering generation. Responds with JSON {exists}.
 */
export function ogImageCheckUrl(gridId: string): string {
  const params = new URLSearchParams({ gridId, check: "1", t: String(Date.now()) });
  return `${ogApiBase()}?${params.toString()}`;
}

/** The site-wide default OG image (shown for grids with no image yet). */
export function defaultOgImageUrl(): string {
  // On production hosts this resolves to same-origin /api/og. Off-site (local
  // dev without VITE_OG_IMAGE_ENDPOINT) falls back to the cached apex default.
  return `${ogApiBase()}?slug=grids`;
}

/** Append a version param so CDNs and social platforms re-fetch the new image. */
export function withVersionParam(url: string, version: number): string {
  return `${url}${url.includes("?") ? "&" : "?"}v=${version}`;
}
