/**
 * Client-side helpers for picking a grids.so handle. The server
 * (`checkSlugAvailability` / `claimSlug`) stays the source of truth for
 * format, reserved words, and uniqueness — these only shape suggestions and
 * give instant format feedback.
 */

export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 30;

const HANDLE_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export type HandleFormatIssue = "too-short" | "too-long" | "invalid-format";

/** Mirrors the server's isValidSlugFormat. Null when the format is fine. */
export function getHandleFormatIssue(handle: string): HandleFormatIssue | null {
  if (handle.length < HANDLE_MIN_LENGTH) return "too-short";
  if (handle.length > HANDLE_MAX_LENGTH) return "too-long";
  if (!HANDLE_PATTERN.test(handle)) return "invalid-format";
  return null;
}

/**
 * Turn free text (a name, an email local part) into a valid-looking handle:
 * strips accents, lowercases, turns anything else into single hyphens, and
 * trims to the max length. Returns "" when nothing usable is left.
 */
export function toHandle(raw: string, separator: "-" | "" = "-"): string {
  const handle = raw
    .normalize("NFKD")
    // Drop the accents NFKD split off (e.g. é -> e + U+0301).
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, HANDLE_MAX_LENGTH)
    .replace(/-$/, "");
  return getHandleFormatIssue(handle) ? "" : handle;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Candidate handles for a new user, best first: full name, then first name,
 * then the email's local part. Numbered fallbacks come from
 * `numberedHandles` once these turn out to be taken.
 */
export function suggestHandles(user: {
  displayName?: string | null;
  email?: string | null;
}): string[] {
  const name = user.displayName?.trim() ?? "";
  const localPart = user.email?.split("@")[0] ?? "";
  const firstName = name.split(/\s+/)[0] ?? "";

  return unique([
    toHandle(name),
    toHandle(name, ""),
    toHandle(firstName),
    toHandle(localPart),
    toHandle(localPart, ""),
  ]);
}

/** `count` numbered variants of `base`, e.g. amor-42. Random so repeats differ. */
export function numberedHandles(
  base: string,
  count: number,
  random: () => number = Math.random,
): string[] {
  const root = base.slice(0, HANDLE_MAX_LENGTH - 3).replace(/-$/, "");
  if (!root) return [];
  const results = new Set<string>();
  // Bounded loop: two-digit suffixes can collide, but never forever.
  for (let i = 0; results.size < count && i < count * 5; i++) {
    const suffix = 10 + Math.floor(random() * 90);
    results.add(`${root}-${suffix}`);
  }
  return [...results];
}
