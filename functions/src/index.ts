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
import * as logger from "firebase-functions/logger";
import * as cheerio from "cheerio";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import * as functions from "firebase-functions/v1";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

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
        // Some sites return 403/401 to bot-like UAs; this improves compatibility.
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) {
      logger.debug("Link preview response was not HTML", {
        url: normalized.toString(),
        contentType,
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

// Define secrets for Discord webhook URLs
const discordNewUsersWebhookUrl = defineSecret("DISCORD_NEW_USERS_WEBHOOK_URL");
const discordUserActivityWebhookUrl = defineSecret("DISCORD_USER_ACTIVITY_WEBHOOK_URL");

// ---------------------------------------------------------------------------
// Dev team filter — update these lists to suppress notifications for internal
// accounts. Email patterns are matched as case-insensitive substrings.
// ---------------------------------------------------------------------------
const DEV_TEAM_USER_IDS: string[] = [
  // Add Firebase UIDs here, e.g.:
  // "abc123uid",
  "F4vIerh5rzgEGrlWKugF17lSoeq2"
];

const DEV_TEAM_EMAIL_PATTERNS: string[] = [
  // Add email substrings/domains here, e.g.:
  // "@yourcompany.com",
  // "+test",
  // "dev+",
  "@trustybits.com",
  "@grids.so",
];

/**
 * Returns true if the given uid or email belongs to a dev team member
 * and should be excluded from Discord notifications.
 */
function isDevTeamMember(uid?: string, email?: string): boolean {
  if (uid && DEV_TEAM_USER_IDS.includes(uid)) {
    return true;
  }
  if (email) {
    const lower = email.toLowerCase();
    if (DEV_TEAM_EMAIL_PATTERNS.some((pattern) => lower.includes(pattern.toLowerCase()))) {
      return true;
    }
  }
  return false;
}

// Define secret for YouTube API key
const youtubeApiKey = defineSecret("YOUTUBE_API_KEY");

/**
 * Cloud Function to fetch YouTube metadata for videos, playlists, channels, and shorts.
 * Uses YouTube Data API v3 to retrieve public metadata.
 */
export const getYouTubeMetadata = functions
  .runWith({
    secrets: [youtubeApiKey],
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to fetch YouTube metadata.");
    }

    const { youtubeType, youtubeId } = data as { youtubeType?: string; youtubeId?: string };

    if (!youtubeType || !youtubeId) {
      throw new HttpsError("invalid-argument", "Missing youtubeType or youtubeId.");
    }

    const validTypes = ["video", "playlist", "channel", "short"];
    if (!validTypes.includes(youtubeType)) {
      throw new HttpsError("invalid-argument", `Invalid youtubeType: ${youtubeType}`);
    }

    try {
      const apiKey = youtubeApiKey.value();

      if (!apiKey) {
        logger.error("YouTube API key not configured");
        throw new HttpsError("failed-precondition", "YouTube API not configured.");
      }

      // Shorts are just videos with a different URL format
      const effectiveType = youtubeType === "short" ? "video" : youtubeType;

      logger.info("Fetching YouTube metadata", {
        youtubeType,
        youtubeId,
        effectiveType,
      });

      // Fetch metadata based on type
      switch (effectiveType) {
        case "video": {
          // Fetch video details
          const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${youtubeId}&key=${apiKey}`;
          const videoResponse = await fetch(videoUrl);

          if (!videoResponse.ok) {
            logger.error("YouTube API error for video", {
              status: videoResponse.status,
              youtubeId,
            });
            throw new HttpsError("not-found", "YouTube video not found.");
          }

          const videoData = await videoResponse.json();
          
          if (!videoData.items || videoData.items.length === 0) {
            throw new HttpsError("not-found", "YouTube video not found.");
          }

          const video = videoData.items[0];
          const snippet = video.snippet;
          const statistics = video.statistics;
          const contentDetails = video.contentDetails;

          // Fetch channel thumbnail
          let channelThumbnail = "";
          if (snippet.channelId) {
            const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${snippet.channelId}&key=${apiKey}`;
            const channelResponse = await fetch(channelUrl);
            if (channelResponse.ok) {
              const channelData = await channelResponse.json();
              if (channelData.items && channelData.items.length > 0) {
                channelThumbnail = channelData.items[0].snippet.thumbnails?.default?.url || "";
              }
            }
          }

          const result = {
            title: snippet.title,
            description: snippet.description,
            thumbnails: snippet.thumbnails,
            publishedAt: snippet.publishedAt,
            channelTitle: snippet.channelTitle,
            channelId: snippet.channelId,
            channelThumbnail,
            duration: contentDetails.duration,
            viewCount: statistics.viewCount,
            likeCount: statistics.likeCount,
            commentCount: statistics.commentCount,
            categoryId: snippet.categoryId,
          };

          logger.info("Video metadata fetched successfully", {
            title: result.title,
            channelTitle: result.channelTitle,
          });

          return result;
        }

        case "playlist": {
          // Fetch playlist details
          const playlistUrl = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${youtubeId}&key=${apiKey}`;
          const playlistResponse = await fetch(playlistUrl);

          if (!playlistResponse.ok) {
            logger.error("YouTube API error for playlist", {
              status: playlistResponse.status,
              youtubeId,
            });
            throw new HttpsError("not-found", "YouTube playlist not found.");
          }

          const playlistData = await playlistResponse.json();
          
          if (!playlistData.items || playlistData.items.length === 0) {
            throw new HttpsError("not-found", "YouTube playlist not found.");
          }

          const playlist = playlistData.items[0];
          const snippet = playlist.snippet;
          const contentDetails = playlist.contentDetails;

          // Fetch playlist items (first 20 videos)
          const itemsUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${youtubeId}&maxResults=20&key=${apiKey}`;
          const itemsResponse = await fetch(itemsUrl);
          
          let playlistItems = [];
          if (itemsResponse.ok) {
            const itemsData = await itemsResponse.json();
            playlistItems = itemsData.items?.map((item: any, index: number) => ({
              videoId: item.snippet.resourceId.videoId,
              title: item.snippet.title,
              thumbnails: item.snippet.thumbnails,
              channelTitle: item.snippet.channelTitle,
              position: index,
            })) || [];
          }

          return {
            title: snippet.title,
            description: snippet.description,
            thumbnails: snippet.thumbnails,
            publishedAt: snippet.publishedAt,
            channelTitle: snippet.channelTitle,
            channelId: snippet.channelId,
            itemCount: contentDetails.itemCount,
            playlistItems,
          };
        }

        case "channel": {
          // For channel handles (@username) or custom URLs, we need to resolve to a channel ID first
          let channelId = youtubeId;
          
          // If it doesn't look like a channel ID (UC...), resolve it
          if (!youtubeId.startsWith("UC")) {
            let resolved = false;

            // Try the forHandle parameter first (for @username handles)
            // The youtubeId may or may not have the @ prefix
            const handle = youtubeId.startsWith("@") ? youtubeId : `@${youtubeId}`;
            const handleUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`;
            const handleResponse = await fetch(handleUrl);
            if (handleResponse.ok) {
              const handleData = await handleResponse.json();
              if (handleData.items && handleData.items.length > 0) {
                channelId = handleData.items[0].id;
                resolved = true;
              }
            }

            // Fall back to forUsername (for /user/ style URLs)
            if (!resolved) {
              const username = youtubeId.startsWith("@") ? youtubeId.slice(1) : youtubeId;
              const userUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forUsername=${encodeURIComponent(username)}&key=${apiKey}`;
              const userResponse = await fetch(userUrl);
              if (userResponse.ok) {
                const userData = await userResponse.json();
                if (userData.items && userData.items.length > 0) {
                  channelId = userData.items[0].id;
                  resolved = true;
                }
              }
            }

            // Last resort: search API
            if (!resolved) {
              const searchQuery = youtubeId.startsWith("@") ? youtubeId.slice(1) : youtubeId;
              const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(searchQuery)}&maxResults=1&key=${apiKey}`;
              const searchResponse = await fetch(searchUrl);
              if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                if (searchData.items && searchData.items.length > 0) {
                  channelId = searchData.items[0].snippet.channelId;
                }
              }
            }
          }

          // Fetch channel details
          const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${apiKey}`;
          const channelResponse = await fetch(channelUrl);

          if (!channelResponse.ok) {
            logger.error("YouTube API error for channel", {
              status: channelResponse.status,
              youtubeId,
            });
            throw new HttpsError("not-found", "YouTube channel not found.");
          }

          const channelData = await channelResponse.json();
          
          if (!channelData.items || channelData.items.length === 0) {
            throw new HttpsError("not-found", "YouTube channel not found.");
          }

          const channel = channelData.items[0];
          const snippet = channel.snippet;
          const statistics = channel.statistics;
          const contentDetails = channel.contentDetails;

          // Fetch recent videos from the channel's uploads playlist
          let recentVideos = [];
          if (contentDetails.relatedPlaylists?.uploads) {
            const uploadsPlaylistId = contentDetails.relatedPlaylists.uploads;
            const uploadsUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=12&key=${apiKey}`;
            const uploadsResponse = await fetch(uploadsUrl);
            
            if (uploadsResponse.ok) {
              const uploadsData = await uploadsResponse.json();
              recentVideos = uploadsData.items?.map((item: any, index: number) => ({
                videoId: item.snippet.resourceId.videoId,
                title: item.snippet.title,
                thumbnails: item.snippet.thumbnails,
                channelTitle: snippet.title,
                position: index,
              })) || [];
            }
          }

          return {
            channelData: {
              channelId: channel.id,
              title: snippet.title,
              description: snippet.description,
              customUrl: snippet.customUrl,
              thumbnails: snippet.thumbnails,
              subscriberCount: statistics.subscriberCount,
              videoCount: statistics.videoCount,
              viewCount: statistics.viewCount,
            },
            title: snippet.title,
            description: snippet.description,
            thumbnails: snippet.thumbnails,
            recentVideos,
          };
        }

        default:
          throw new HttpsError("invalid-argument", "Unsupported YouTube content type.");
      }
    } catch (error: any) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error("Failed to fetch YouTube metadata", {
        error: String(error),
        youtubeType,
        youtubeId,
      });
      throw new HttpsError("internal", "Failed to fetch YouTube metadata.");
    }
  });

/**
 * Firebase function that triggers when a new user signs up.
 * Sends a formatted notification to Discord via webhook.
 */
export const onNewUserSignup = functions
  .runWith({
    secrets: [discordNewUsersWebhookUrl],
  })
  .auth.user()
  .onCreate(async (user) => {
    logger.info("New user signup detected", {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
    });

    // Skip dev team members
    if (isDevTeamMember(user.uid, user.email ?? undefined)) {
      logger.info("Skipping Discord notification for dev team member", { uid: user.uid });
      return null;
    }

    // Get the Discord webhook URL from secrets
    const webhookUrl = discordNewUsersWebhookUrl.value();
    
    if (!webhookUrl) {
      logger.error("DISCORD_NEW_USERS_WEBHOOK_URL secret is not configured");
      return null;
    }

    // Determine sign-in method
    const providerInfo = user.providerData[0];
    const signInMethod = providerInfo?.providerId === "google.com" 
      ? "Google" 
      : providerInfo?.providerId === "password"
      ? "Email/Password"
      : "Email Link";

    // Build Discord embed payload
    const discordPayload = {
      embeds: [
        {
          title: "🎉 New User Joined Grids",
          color: 5814783, // Purple/blue color
          fields: [
            {
              name: "Display Name",
              value: user.displayName || "Not set",
              inline: true,
            },
            {
              name: "Email",
              value: user.email || "Not available",
              inline: true,
            },
            {
              name: "Sign-in Method",
              value: signInMethod,
              inline: true,
            },
            {
              name: "User ID",
              value: user.uid,
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: "Grids User Signup",
          },
        },
      ],
    };

    try {
      // Send webhook to Discord
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(discordPayload),
      });

      // Read response body for debugging
      const responseText = await response.text();

      if (!response.ok) {
        logger.error("Discord webhook returned error status", {
          uid: user.uid,
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText,
          webhookUrlLength: webhookUrl.length, // Verify URL was loaded
        });
      } else {
        logger.info("Discord notification sent successfully", {
          uid: user.uid,
          email: user.email,
          status: response.status,
          responseBody: responseText,
        });
      }
      
      return null;
    } catch (error) {
      logger.error("Failed to send Discord webhook", {
        error: String(error),
        uid: user.uid,
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  });

/**
 * Firebase function that triggers when a user logs in.
 * Detects login by monitoring updates to the lastLogin field in Firestore users collection.
 */
export const onUserLogin = functions
  .runWith({
    secrets: [discordUserActivityWebhookUrl],
  })
  .firestore.document("users/{userId}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const userId = context.params.userId;

    // Only trigger if lastLogin field was updated
    if (!afterData.lastLogin || beforeData.lastLogin === afterData.lastLogin) {
      return null;
    }

    logger.info("User login event detected", {
      userId,
      email: afterData.email,
    });

    // Skip dev team members
    if (isDevTeamMember(userId, afterData.email)) {
      logger.info("Skipping Discord notification for dev team member", { userId });
      return null;
    }

    // Get the Discord webhook URL from secrets
    const webhookUrl = discordUserActivityWebhookUrl.value();
    
    if (!webhookUrl) {
      logger.error("DISCORD_USER_ACTIVITY_WEBHOOK_URL secret is not configured");
      return null;
    }

    // Build Discord embed payload
    const discordPayload = {
      embeds: [
        {
          title: "🔐 User Logged In",
          color: 3447003, // Blue color
          fields: [
            {
              name: "Email",
              value: afterData.email || "Not available",
              inline: true,
            },
            {
              name: "User ID",
              value: userId,
              inline: true,
            },
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: "Grids User Activity",
          },
        },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(discordPayload),
      });

      const responseText = await response.text();

      if (!response.ok) {
        logger.error("Discord webhook returned error status", {
          userId,
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText,
        });
      } else {
        logger.info("Discord login notification sent successfully", {
          userId,
          status: response.status,
        });
      }
      
      return null;
    } catch (error) {
      logger.error("Failed to send Discord webhook", {
        error: String(error),
        userId,
      });
      return null;
    }
  });

/**
 * Firebase function that triggers when a new grid/layout is created.
 * Sends a notification to the user-activity Discord channel.
 */
export const onGridCreated = functions
  .runWith({
    secrets: [discordUserActivityWebhookUrl],
  })
  .firestore.document("layouts/{layoutId}")
  .onCreate(async (snapshot, context) => {
    const layoutData = snapshot.data();
    const layoutId = context.params.layoutId;

    logger.info("New grid created", {
      layoutId,
      userId: layoutData.userId,
      name: layoutData.name,
    });

    // Skip dev team members — look up email from users collection
    let ownerEmail: string | undefined;
    try {
      const userDoc = await admin.firestore().collection("users").doc(layoutData.userId).get();
      ownerEmail = userDoc.data()?.email;
    } catch {
      // Non-fatal — proceed without email check
    }
    if (isDevTeamMember(layoutData.userId, ownerEmail)) {
      logger.info("Skipping Discord notification for dev team member", { userId: layoutData.userId });
      return null;
    }

    // Get the Discord webhook URL from secrets
    const webhookUrl = discordUserActivityWebhookUrl.value();
    
    if (!webhookUrl) {
      logger.error("DISCORD_USER_ACTIVITY_WEBHOOK_URL secret is not configured");
      return null;
    }

    // Build Discord embed payload
    const discordPayload = {
      embeds: [
        {
          title: "📊 New Grid Created",
          color: 3066993, // Green color
          fields: [
            {
              name: "Grid Name",
              value: layoutData.name || "Untitled",
              inline: true,
            },
            {
              name: "Grid ID",
              value: layoutId,
              inline: true,
            },
            {
              name: "Grid Link",
              value: `https://grids.so/grid/${layoutId}`,
              inline: true,
            },
            {
              name: "User ID",
              value: layoutData.userId || "Unknown",
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: "Grids Activity",
          },
        },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(discordPayload),
      });

      const responseText = await response.text();

      if (!response.ok) {
        logger.error("Discord webhook returned error status", {
          layoutId,
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText,
        });
      } else {
        logger.info("Discord grid creation notification sent successfully", {
          layoutId,
          status: response.status,
        });
      }
    } catch (error) {
      logger.error("Failed to send Discord webhook", {
        error: String(error),
        layoutId,
      });
    }

    // Auto-assign this grid as the user's default if they don't have one set yet
    const userId = layoutData.userId;
    if (userId) {
      try {
        const db = admin.firestore();
        await db.runTransaction(async (transaction) => {
          const userRef = db.collection("users").doc(userId);
          const userDoc = await transaction.get(userRef);

          if (!userDoc.exists || !userDoc.data()?.defaultGridId) {
            transaction.set(userRef, { defaultGridId: layoutId }, { merge: true });

            const userSlug = userDoc.exists ? userDoc.data()?.slug : null;
            if (userSlug) {
              const slugRef = db.collection("slugs").doc(userSlug);
              transaction.update(slugRef, { defaultGridId: layoutId });
            }

            logger.info("Auto-assigned default grid for user", { userId, layoutId });
          }
        });
      } catch (error) {
        logger.error("Failed to auto-assign default grid", {
          error: String(error),
          userId,
          layoutId,
        });
      }
    }

    return null;
  });

/**
 * Firebase function that triggers when a grid/layout is updated.
 * Only fires when the updatedAt field changes to avoid spurious triggers.
 * Sends a notification to the user-activity Discord channel.
 */
export const onGridUpdated = functions
  .runWith({
    secrets: [discordUserActivityWebhookUrl],
  })
  .firestore.document("layouts/{layoutId}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const layoutId = context.params.layoutId;

    // Only trigger when updatedAt actually changed
    const beforeUpdatedAt = beforeData.updatedAt?.toMillis?.() ?? beforeData.updatedAt;
    const afterUpdatedAt = afterData.updatedAt?.toMillis?.() ?? afterData.updatedAt;
    if (!afterUpdatedAt || beforeUpdatedAt === afterUpdatedAt) {
      return null;
    }

    // Check for meaningful changes (name, tiles, or privacy settings)
    const nameChanged = beforeData.name !== afterData.name;
    const tilesChanged = JSON.stringify(beforeData.tiles || []) !== JSON.stringify(afterData.tiles || []);
    const privacyChanged = beforeData.isPublic !== afterData.isPublic;
    
    const hasMeaningfulChanges = nameChanged || tilesChanged || privacyChanged;
    
    if (!hasMeaningfulChanges) {
      logger.info("Grid updated but no meaningful changes detected, skipping notification", {
        layoutId,
        userId: afterData.userId,
      });
      return null;
    }

    logger.info("Grid updated with meaningful changes", {
      layoutId,
      userId: afterData.userId,
      name: afterData.name,
      nameChanged,
      tilesChanged,
      privacyChanged,
    });

    // Skip dev team members — look up email from users collection
    let ownerEmail: string | undefined;
    try {
      const userDoc = await admin.firestore().collection("users").doc(afterData.userId).get();
      ownerEmail = userDoc.data()?.email;
    } catch {
      // Non-fatal — proceed without email check
    }
    if (isDevTeamMember(afterData.userId, ownerEmail)) {
      logger.info("Skipping Discord notification for dev team member", { userId: afterData.userId });
      return null;
    }

    // 10-minute debounce: Check if we've notified this user recently
    const DEBOUNCE_MS = 10 * 60 * 1000; // 10 minutes
    const db = admin.firestore();
    const notificationTrackingRef = db.collection("notification_tracking").doc(`grid_update_${afterData.userId}`);
    
    try {
      const trackingDoc = await notificationTrackingRef.get();
      const lastNotifiedAt = trackingDoc.data()?.lastNotifiedAt?.toMillis?.();
      
      if (lastNotifiedAt && (Date.now() - lastNotifiedAt < DEBOUNCE_MS)) {
        logger.info("Skipping notification due to 10-minute debounce", {
          userId: afterData.userId,
          layoutId,
          lastNotifiedAt: new Date(lastNotifiedAt).toISOString(),
        });
        return null;
      }
    } catch (error) {
      logger.warn("Failed to check notification tracking, proceeding with notification", {
        error: String(error),
      });
    }

    // Get the Discord webhook URL from secrets
    const webhookUrl = discordUserActivityWebhookUrl.value();

    if (!webhookUrl) {
      logger.error("DISCORD_USER_ACTIVITY_WEBHOOK_URL secret is not configured");
      return null;
    }

    // Build Discord embed payload
    const discordPayload = {
      embeds: [
        {
          title: "✏️ Grid Updated",
          color: 16776960, // Yellow color
          fields: [
            {
              name: "Grid Name",
              value: afterData.name || "Untitled",
              inline: true,
            },
            {
              name: "Grid ID",
              value: layoutId,
              inline: true,
            },
            {
              name: "Grid Link",
              value: `https://grids.so/grid/${layoutId}`,
              inline: true,
            },
            {
              name: "User ID",
              value: afterData.userId || "Unknown",
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: "Grids Activity",
          },
        },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(discordPayload),
      });

      const responseText = await response.text();

      if (!response.ok) {
        logger.error("Discord webhook returned error status", {
          layoutId,
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText,
        });
      } else {
        logger.info("Discord grid update notification sent successfully", {
          layoutId,
          status: response.status,
        });
        
        // Update notification tracking timestamp for debounce
        try {
          await notificationTrackingRef.set({
            lastNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            userId: afterData.userId,
            layoutId,
          });
        } catch (error) {
          logger.warn("Failed to update notification tracking", {
            error: String(error),
          });
        }
      }

      return null;
    } catch (error) {
      logger.error("Failed to send Discord webhook", {
        error: String(error),
        layoutId,
      });
      return null;
    }
  });

/**
 * Firebase function that triggers when a grid/layout is deleted.
 * Sends a notification to the user-activity Discord channel.
 */
export const onGridDeleted = functions
  .runWith({
    secrets: [discordUserActivityWebhookUrl],
  })
  .firestore.document("layouts/{layoutId}")
  .onDelete(async (snapshot, context) => {
    const layoutData = snapshot.data();
    const layoutId = context.params.layoutId;

    logger.info("Grid deleted", {
      layoutId,
      userId: layoutData.userId,
      name: layoutData.name,
    });

    // Skip dev team members — look up email from users collection
    let ownerEmail: string | undefined;
    try {
      const userDoc = await admin.firestore().collection("users").doc(layoutData.userId).get();
      ownerEmail = userDoc.data()?.email;
    } catch {
      // Non-fatal — proceed without email check
    }
    if (isDevTeamMember(layoutData.userId, ownerEmail)) {
      logger.info("Skipping Discord notification for dev team member", { userId: layoutData.userId });
      return null;
    }

    // Get the Discord webhook URL from secrets
    const webhookUrl = discordUserActivityWebhookUrl.value();

    if (!webhookUrl) {
      logger.error("DISCORD_USER_ACTIVITY_WEBHOOK_URL secret is not configured");
      return null;
    }

    // Build Discord embed payload
    const discordPayload = {
      embeds: [
        {
          title: "🗑️ Grid Deleted",
          color: 15158332, // Red color
          fields: [
            {
              name: "Grid Name",
              value: layoutData.name || "Untitled",
              inline: true,
            },
            {
              name: "Grid ID",
              value: layoutId,
              inline: true,
            },
            {
              name: "User ID",
              value: layoutData.userId || "Unknown",
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: "Grids Activity",
          },
        },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(discordPayload),
      });

      const responseText = await response.text();

      if (!response.ok) {
        logger.error("Discord webhook returned error status", {
          layoutId,
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText,
        });
      } else {
        logger.info("Discord grid deletion notification sent successfully", {
          layoutId,
          status: response.status,
        });
      }

      return null;
    } catch (error) {
      logger.error("Failed to send Discord webhook", {
        error: String(error),
        layoutId,
      });
      return null;
    }
  });

/**
 * Cloud Function that triggers when a file is uploaded to Firebase Storage.
 * Updates the user's storage usage in Firestore.
 */
export const onFileUploaded = functions.storage.object().onFinalize(async (object) => {
  const filePath = object.name;
  const fileSize = parseInt(object.size || "0", 10);

  if (!filePath) {
    logger.warn("File path is undefined");
    return null;
  }

  // Extract userId from the file path (e.g., users/{userId}/images/{imageId})
  const pathParts = filePath.split("/");
  if (pathParts.length < 2 || pathParts[0] !== "users") {
    logger.debug("File is not in a user directory, skipping storage tracking", { filePath });
    return null;
  }

  const userId = pathParts[1];

  logger.info("File uploaded, updating storage usage", {
    userId,
    filePath,
    fileSize,
  });

  try {
    const userRef = admin.firestore().collection("users").doc(userId);
    
    // Use a transaction to safely increment the storage usage
    await admin.firestore().runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      // Initialize storageUsed if it doesn't exist
      const currentUsage = userDoc.exists && userDoc.data()?.storageUsed 
        ? userDoc.data()!.storageUsed 
        : 0;
      
      const newUsage = currentUsage + fileSize;
      
      // Update or create the user document with the new storage usage
      if (userDoc.exists) {
        transaction.update(userRef, { storageUsed: newUsage });
      } else {
        transaction.set(userRef, { storageUsed: newUsage }, { merge: true });
      }
      
      logger.info("Storage usage updated", {
        userId,
        previousUsage: currentUsage,
        newUsage,
        fileSize,
      });
    });

    return null;
  } catch (error) {
    logger.error("Failed to update storage usage on upload", {
      error: String(error),
      userId,
      filePath,
      fileSize,
    });
    return null;
  }
});

/**
 * Cloud Function that triggers when a file is deleted from Firebase Storage.
 * Decrements the user's storage usage in Firestore.
 */
export const onFileDeleted = functions.storage.object().onDelete(async (object) => {
  const filePath = object.name;
  const fileSize = parseInt(object.size || "0", 10);

  if (!filePath) {
    logger.warn("File path is undefined");
    return null;
  }

  // Extract userId from the file path (e.g., users/{userId}/images/{imageId})
  const pathParts = filePath.split("/");
  if (pathParts.length < 2 || pathParts[0] !== "users") {
    logger.debug("File is not in a user directory, skipping storage tracking", { filePath });
    return null;
  }

  const userId = pathParts[1];

  logger.info("File deleted, updating storage usage", {
    userId,
    filePath,
    fileSize,
  });

  try {
    const userRef = admin.firestore().collection("users").doc(userId);
    
    // Use a transaction to safely decrement the storage usage
    await admin.firestore().runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        logger.warn("User document does not exist, cannot decrement storage", { userId });
        return;
      }
      
      const currentUsage = userDoc.data()?.storageUsed || 0;
      const newUsage = Math.max(0, currentUsage - fileSize); // Ensure we don't go negative
      
      transaction.update(userRef, { storageUsed: newUsage });
      
      logger.info("Storage usage updated after deletion", {
        userId,
        previousUsage: currentUsage,
        newUsage,
        fileSize,
      });
    });

    return null;
  } catch (error) {
    logger.error("Failed to update storage usage on deletion", {
      error: String(error),
      userId,
      filePath,
      fileSize,
    });
    return null;
  }
});

/**
 * Validates slug format: lowercase alphanumeric and hyphens only, 3-30 characters
 */
function isValidSlugFormat(slug: string): boolean {
  if (!slug || typeof slug !== "string") return false;
  if (slug.length < 3 || slug.length > 30) return false;
  
  // Must be lowercase alphanumeric and hyphens only
  // Cannot start or end with a hyphen
  const slugRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
  return slugRegex.test(slug);
}

/**
 * Reserved slugs that cannot be claimed by users
 */
const RESERVED_SLUGS = [
  "login", "signup", "dashboard", "grid", "privacy", "terms",
  "admin", "api", "app", "about", "contact", "help", "support",
  "settings", "profile", "account", "user", "users", "grids",
  "home", "index", "www", "mail", "ftp", "localhost", "test",
];

/**
 * Cloud Function to claim or update a user's slug.
 * Enforces uniqueness and format validation.
 */
export const claimSlug = onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to claim a slug.");
  }

  const userId = context.auth.uid;
  const requestedSlug = (data as { slug?: string } | undefined)?.slug;

  if (!requestedSlug || typeof requestedSlug !== "string") {
    throw new HttpsError("invalid-argument", "Slug is required.");
  }

  // Normalize to lowercase
  const slug = requestedSlug.toLowerCase().trim();

  // Validate slug format
  if (!isValidSlugFormat(slug)) {
    throw new HttpsError(
      "invalid-argument",
      "Slug must be 3-30 characters, lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen."
    );
  }

  // Check if slug is reserved
  if (RESERVED_SLUGS.includes(slug)) {
    throw new HttpsError("invalid-argument", "This slug is reserved and cannot be used.");
  }

  const db = admin.firestore();

  try {
    // Use a transaction to ensure atomicity and prevent race conditions
    const result = await db.runTransaction(async (transaction) => {
      const userRef = db.collection("users").doc(userId);
      const userDoc = await transaction.get(userRef);
      const slugRef = db.collection("slugs").doc(slug);
      const slugDoc = await transaction.get(slugRef);

      // Check if slug is already taken
      if (slugDoc.exists) {
        const existingUserId = slugDoc.data()?.userId;
        
        // If userId is null or undefined, the slug was released and is available
        if (existingUserId !== null && existingUserId !== undefined) {
          // If the slug belongs to a different user, it's taken
          if (existingUserId !== userId) {
            throw new HttpsError("already-exists", "This slug is already taken.");
          }
          // If it's the same user, they're updating to the same slug (no-op)
          return { success: true, message: "Slug is already yours." };
        }
        // If userId is null, fall through to claim the released slug
      }

      // If user had a previous slug, update its history to mark it as released
      if (userDoc.exists && userDoc.data()?.slug) {
        const oldSlug = userDoc.data()!.slug;
        if (oldSlug !== slug) {
          const oldSlugRef = db.collection("slugs").doc(oldSlug);
          const oldSlugDoc = await transaction.get(oldSlugRef);
          
          if (oldSlugDoc.exists) {
            const oldSlugData = oldSlugDoc.data();
            // Add current ownership to history before releasing
            // Use the existing createdAt timestamp if available, otherwise use current time
            const claimedAt = oldSlugData?.createdAt || new Date();
            
            transaction.update(oldSlugRef, {
              userId: null, // Mark as available
              history: admin.firestore.FieldValue.arrayUnion({
                userId,
                claimedAt,
                releasedAt: new Date(), // Cannot use FieldValue.serverTimestamp() inside arrays
              }),
            });
          }
        }
      }

      // Get user's default grid to store in slug document for public access
      const defaultGridId = userDoc.exists ? userDoc.data()?.defaultGridId || null : null;

      // Create or update the slug document with history tracking
      const now = new Date();
      transaction.set(slugRef, {
        userId,
        defaultGridId, // Store for public access
        createdAt: admin.firestore.FieldValue.serverTimestamp(), // Can use FieldValue at top level
        history: admin.firestore.FieldValue.arrayUnion({
          userId,
          claimedAt: now, // Cannot use FieldValue.serverTimestamp() inside arrays
        }),
      }, { merge: true });

      // Update or create the user document with the new slug
      if (userDoc.exists) {
        transaction.update(userRef, { slug });
      } else {
        transaction.set(userRef, { slug }, { merge: true });
      }

      logger.info("Slug claimed successfully", { userId, slug });
      return { success: true, message: "Slug claimed successfully." };
    });

    return result;
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Failed to claim slug", {
      error: String(error),
      userId,
      slug,
    });
    throw new HttpsError("internal", "Failed to claim slug. Please try again.");
  }
});

/**
 * Cloud Function to update the default grid for a user's slug.
 * This syncs the defaultGridId to the slugs collection for public access.
 */
export const updateDefaultGrid = onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to update your default grid.");
  }

  const userId = context.auth.uid;
  const gridId = (data as { gridId?: string | null } | undefined)?.gridId || null;

  const db = admin.firestore();

  try {
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection("users").doc(userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const userSlug = userDoc.data()?.slug;

      // Update user's default grid
      transaction.update(userRef, { defaultGridId: gridId });

      // If user has a slug, update the slugs collection too for public access
      if (userSlug) {
        const slugRef = db.collection("slugs").doc(userSlug);
        transaction.update(slugRef, { defaultGridId: gridId });
      }
    });

    logger.info("Default grid updated successfully", { userId, gridId });
    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Failed to update default grid", {
      error: String(error),
      userId,
      gridId,
    });
    throw new HttpsError("internal", "Failed to update default grid. Please try again.");
  }
});

/**
 * Cloud Function to check if a slug is available.
 * Returns availability status without claiming it.
 */
export const checkSlugAvailability = onCall(async (data, context) => {
  // Authentication not strictly required for checking, but we'll require it
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to check slug availability.");
  }

  const requestedSlug = (data as { slug?: string } | undefined)?.slug;

  if (!requestedSlug || typeof requestedSlug !== "string") {
    throw new HttpsError("invalid-argument", "Slug is required.");
  }

  const slug = requestedSlug.toLowerCase().trim();

  // Validate slug format
  if (!isValidSlugFormat(slug)) {
    return {
      available: false,
      reason: "invalid-format",
      message: "Slug must be 3-30 characters, lowercase letters, numbers, and hyphens only.",
    };
  }

  // Check if slug is reserved
  if (RESERVED_SLUGS.includes(slug)) {
    return {
      available: false,
      reason: "reserved",
      message: "This slug is reserved.",
    };
  }

  const db = admin.firestore();

  try {
    const slugRef = db.collection("slugs").doc(slug);
    const slugDoc = await slugRef.get();
    
    if (slugDoc.exists) {
      const existingUserId = slugDoc.data()?.userId;
      
      // If userId is null, the slug was released and is available
      if (existingUserId === null || existingUserId === undefined) {
        return {
          available: true,
          reason: "available",
          message: "This slug is available!",
        };
      }
      
      // Check if it's the current user's slug
      if (existingUserId === context.auth.uid) {
        return {
          available: true,
          reason: "own-slug",
          message: "This is your current slug.",
        };
      }
      
      // Slug is taken by another user
      return {
        available: false,
        reason: "taken",
        message: "This slug is already taken.",
      };
    }

    return {
      available: true,
      reason: "available",
      message: "This slug is available!",
    };
  } catch (error) {
    logger.error("Failed to check slug availability", {
      error: String(error),
      slug,
    });
    throw new HttpsError("internal", "Failed to check slug availability.");
  }
});
