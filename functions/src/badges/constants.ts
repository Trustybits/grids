/**
 * Server-side badge constants.
 *
 * These mirror values referenced on the client (see `src/composables/...`),
 * but live separately because the client and functions packages don't share
 * a build. If you change a threshold here, update the corresponding doc /
 * comment on the client side.
 */

/**
 * Minimum cumulative paid amount (in cents) for a user to earn the
 * Supporter badge. $1.00 — kept low so a single PWYW $1 donation qualifies.
 */
export const SUPPORTER_BADGE_MIN_CENTS = 100;

/**
 * Minimum cumulative paid amount (in cents) to remove the Grids branding
 * from published pages. Currently advertised on the pricing page; not yet
 * enforced server-side (handled client-side via `useTier.can('remove_branding')`
 * as a thin convention — wire it server-side when we ship branding-removal).
 */
export const REMOVE_BRANDING_MIN_CENTS = 1000;
