/**
 * URL validation helpers shared by the input modals.
 */

/** Extract the `src` attribute from a pasted `<iframe>` tag, or null. */
export function extractIframeSrc(text: string): string | null {
  const m = text.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

/**
 * Validate a string as a link suitable for a Link Tile.
 * Accepts http(s) URLs, mailto:/tel: schemes, and bare domains (must contain a dot).
 */
export function isValidLink(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  try {
    if (/^(mailto|tel):/i.test(value)) {
      new URL(value);
      return true;
    }
    if (value.startsWith("http://") || value.startsWith("https://")) {
      new URL(value);
      return true;
    }
    if (value.includes(".")) {
      new URL(`https://${value}`);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Validate a string as embeddable content — either a URL (like {@link isValidLink}
 * but without mailto/tel) or an `<iframe>` snippet with a usable src.
 */
export function isValidEmbed(text: string): boolean {
  const value = text.trim();
  if (!value) return false;

  if (value.startsWith("<iframe") || value.startsWith("<IFRAME")) {
    return !!extractIframeSrc(value);
  }

  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      new URL(value);
      return true;
    }
    if (value.includes(".")) {
      new URL(`https://${value}`);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
