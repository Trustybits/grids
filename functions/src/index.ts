/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */


// Start writing functions
// https://firebase.google.com/docs/functions/typescript

import { onCall, HttpsError } from "firebase-functions/v1/https";
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
    return true;
  }

  return false;
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
      if (addresses.some((a) => isPrivateOrLocalhost(a.address))) {
        throw new HttpsError("permission-denied", "This hostname resolves to a disallowed address.");
      }
    } catch (err) {
      if (err instanceof HttpsError) {
        throw err;
      }
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
        "user-agent": "Mozilla/5.0 (compatible; gridsLinkPreview/1.0)",
        "accept": "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      throw new HttpsError("unavailable", `Failed to fetch URL (status ${res.status}).`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new HttpsError("failed-precondition", "URL did not return HTML.");
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

    const iconHref = pickFirst(
      $("link[rel='icon']").attr("href"),
      $("link[rel='shortcut icon']").attr("href"),
      $("link[rel='apple-touch-icon']").attr("href")
    );

    const title = pickFirst(ogTitle, twTitle, docTitle);
    const description = pickFirst(ogDesc, twDesc, metaDesc);
    const imageUrl = pickFirst(ogImageSecure, ogImageUrl, ogImage, twImage, twImageSrc);

    const faviconUrl = resolveUrl(iconHref, normalized);
    const resolvedImageUrl = resolveUrl(imageUrl, normalized);

    return {
      url: normalized.toString(),
      domain: normalized.hostname,
      siteName: ogSiteName?.trim() || undefined,
      title,
      description,
      imageUrl: resolvedImageUrl,
      faviconUrl,
    };
  } catch (err: any) {
    if (err?.name === "AbortError") {
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

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
