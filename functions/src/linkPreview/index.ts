import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as logger from "firebase-functions/logger";
import * as cheerio from "cheerio";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPrivateOrLocalhost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost") || lower.endsWith(".local")) {
    return true;
  }

  if (lower === "0.0.0.0" || lower === "127.0.0.1" || lower === "::1") {
    return true;
  }

  if (isIP(lower) === 4) {
    const parts = lower.split(".").map((p) => Number(p));
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
      return true;
    }
    const [a, b] = parts;

    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }

  if (isIP(lower) === 6) {
    // Allow public IPv6. Block only loopback, link-local, and unique-local ranges.
    if (lower === "::1" || lower === "::") {
      return true;
    }

    // Block IPv4-mapped IPv6 addresses that point to private ranges.
    // Example: ::ffff:192.168.0.1
    const v4MappedPrefix = "::ffff:";
    if (lower.startsWith(v4MappedPrefix)) {
      const v4 = lower.slice(v4MappedPrefix.length);
      return isPrivateOrLocalhost(v4);
    }

    // IPv6 can be compressed and begin with "::" (leading zeros). In that case,
    // the first hextet is effectively 0.
    const firstHextetStr = lower.startsWith("::") ? "0" : (lower.split(":")[0] || "0");
    const firstHextet = Number.parseInt(firstHextetStr, 16);
    if (Number.isNaN(firstHextet)) {
      return true;
    }

    // Unique local addresses: fc00::/7 (fc00-fdff)
    if (firstHextet >= 0xfc00 && firstHextet <= 0xfdff) {
      return true;
    }

    // Link-local addresses: fe80::/10 (fe80-febf)
    if (firstHextet >= 0xfe80 && firstHextet <= 0xfebf) {
      return true;
    }

    return false;
  }

  return false;
}

function googleFaviconUrl(base: URL): string {
  return `https://s2.googleusercontent.com/s2/favicons?sz=64&domain_url=${base.origin}`;
}

function resolveUrl(maybeUrl: string | undefined, base: URL): string | undefined {
  if (!maybeUrl) return undefined;
  const trimmed = maybeUrl.trim();
  if (!trimmed) return undefined;

  try {
    if (trimmed.startsWith("//")) {
      return `${base.protocol}${trimmed}`;
    }
    return new URL(trimmed, base).toString();
  } catch {
    return undefined;
  }
}

function pickFirst(...values: Array<string | undefined>): string | undefined {
  for (const v of values) {
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}
export const getLinkPreview = onCall(async (data, context) => {
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to fetch link previews.");
  }

  const rawUrl = (data as { url?: string } | undefined)?.url ?? "";
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new HttpsError("invalid-argument", "Missing url.");
  }

  if (rawUrl.length > 2048) {
    throw new HttpsError("invalid-argument", "URL is too long.");
  }

  let normalized: URL;
  try {
    const withProtocol = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
      ? rawUrl
      : `https://${rawUrl}`;
    normalized = new URL(withProtocol);
  } catch {
    throw new HttpsError("invalid-argument", "Invalid URL.");
  }

  if (normalized.protocol !== "http:" && normalized.protocol !== "https:") {
    throw new HttpsError("invalid-argument", "Only http/https URLs are supported.");
  }

  if (isPrivateOrLocalhost(normalized.hostname)) {
    throw new HttpsError("permission-denied", "This hostname is not allowed.");
  }

  if (isIP(normalized.hostname) === 0) {
    try {
      const addresses = await lookup(normalized.hostname, { all: true });
      // Use console.* so the message appears in textPayload in Cloud Logs UI.
      /* eslint-disable no-console */
      console.log("Resolved link preview hostname", normalized.hostname, addresses.map((a) => a.address));
      logger.debug("Resolved link preview hostname", {
        hostname: normalized.hostname,
        addresses: addresses.map((a) => a.address),
      });
      const disallowed = addresses.filter((a) => isPrivateOrLocalhost(a.address)).map((a) => a.address);
      if (disallowed.length > 0) {
        console.warn("Blocked link preview request due to disallowed resolved address", normalized.hostname, disallowed);
        logger.warn("Blocked link preview request due to disallowed resolved address", {
          hostname: normalized.hostname,
          disallowed,
        });
        throw new HttpsError("permission-denied", "This hostname resolves to a disallowed address.");
      }
    } catch (err) {
      if (err instanceof HttpsError) {
        throw err;
      }
      console.warn("Failed to resolve hostname for link preview", normalized.hostname, String(err));
      logger.warn("Failed to resolve hostname for link preview", {
        hostname: normalized.hostname,
        error: String(err),
      });
      throw new HttpsError("unavailable", "Failed to resolve hostname.");
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(normalized.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // "facebookexternalhit" triggers Vercel middleware's isCrawler() check,
        // which injects personalised og: tags before </head>.  Without this,
        // grids.so pages return only the generic static fallback meta tags.
        // The Chrome prefix keeps compatibility with sites that block pure-bot UAs.
        "user-agent": "Mozilla/5.0 (compatible; facebookexternalhit/1.1) Chrome/120.0.0.0",
        "accept": "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
    });

    // Some sites block server-side fetches (403/401), and some return other non-OK
    // statuses from server-side environments. Return a usable fallback preview
    // instead of failing link tile creation.
    if (!res.ok) {
      logger.debug("Link preview fetch returned non-OK status", {
        url: normalized.toString(),
        status: res.status,
      });
      return {
        url: normalized.toString(),
        domain: normalized.hostname,
        siteName: undefined,
        title: undefined,
        description: undefined,
        imageUrl: undefined,
        faviconUrl: googleFaviconUrl(normalized),
      };
    }

    // Use the final URL after any redirects as the base for resolving relative URLs
    let finalUrl: URL;
    try {
      finalUrl = new URL(res.url);
    } catch {
      finalUrl = normalized;
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) {
      logger.debug("Link preview response was not HTML", {
        url: normalized.toString(),
        contentType,
      });
      return {
        url: finalUrl.toString(),
        domain: finalUrl.hostname,
        siteName: undefined,
        title: undefined,
        description: undefined,
        imageUrl: undefined,
        faviconUrl: googleFaviconUrl(finalUrl),
      };
    }

    const html = (await res.text()).slice(0, 1_000_000);
    const $ = cheerio.load(html);

    const ogTitle = $("meta[property='og:title']").attr("content");
    const twTitle = $("meta[name='twitter:title']").attr("content");
    const docTitle = $("title").first().text();

    const ogDesc = $("meta[property='og:description']").attr("content");
    const twDesc = $("meta[name='twitter:description']").attr("content");
    const metaDesc = $("meta[name='description']").attr("content");

    const ogImageSecure = $("meta[property='og:image:secure_url']").attr("content");
    const ogImageUrl = $("meta[property='og:image:url']").attr("content");
    const ogImage = $("meta[property='og:image']").attr("content");
    const twImage = $("meta[name='twitter:image']").attr("content");
    const twImageSrc = $("meta[name='twitter:image:src']").attr("content");

    const ogSiteName = $("meta[property='og:site_name']").attr("content");

    const title = pickFirst(ogTitle, twTitle, docTitle);
    const description = pickFirst(ogDesc, twDesc, metaDesc);
    const imageUrl = pickFirst(ogImageSecure, ogImageUrl, ogImage, twImage, twImageSrc);

    const faviconUrl = googleFaviconUrl(finalUrl);
    const resolvedImageUrl = resolveUrl(imageUrl, finalUrl);

    return {
      url: finalUrl.toString(),
      domain: finalUrl.hostname,
      siteName: ogSiteName?.trim() || undefined,
      title,
      description,
      imageUrl: resolvedImageUrl,
      faviconUrl,
    };
  } catch (err: unknown) {
    if ((err as { name?: string } | null)?.name === "AbortError") {
      throw new HttpsError("deadline-exceeded", "Timed out fetching URL.");
    }
    if (err instanceof HttpsError) {
      throw err;
    }
    throw new HttpsError("internal", "Failed to fetch link preview.");
  } finally {
    clearTimeout(timeout);
  }
});
