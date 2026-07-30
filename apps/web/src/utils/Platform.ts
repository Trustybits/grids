/**
 * Platform detection.
 *
 * For choosing platform-conventional affordances only — never for gating
 * behavior, features or data. User-agent sniffing is unreliable by nature, so
 * anything that depends on it has to degrade to merely looking slightly foreign
 * when it guesses wrong.
 */

/**
 * Whether the user is on an Apple platform (iOS, iPadOS or macOS).
 *
 * Read from the user-agent string rather than `navigator.userAgentData`, which
 * Safari — the browser most Apple users are on — does not implement. iPadOS 13+
 * identifies itself as "Macintosh", so it matches on the Mac branch without
 * needing a touch-point check.
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
