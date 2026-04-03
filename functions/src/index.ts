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

// Notion OAuth secrets — set via: firebase functions:secrets:set NOTION_CLIENT_ID etc.
const notionClientId = defineSecret("NOTION_CLIENT_ID");
const notionClientSecret = defineSecret("NOTION_CLIENT_SECRET");

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
  "404",
  "about",
  "about-us",
  "account",
  "account-security",
  "account-settings",
  "activate",
  "activation",
  "admin",
  "admin-dashboard",
  "admin-panel",
  "admin-support",
  "administrator",
  "analytics",
  "analytics-dashboard",
  "api",
  "api-docs",
  "api-key",
  "api-keys",
  "app",
  "auth",
  "authentication",
  "backend",
  "backup",
  "backups",
  "billing",
  "billing-department",
  "blog",
  "cache",
  "careers",
  "challenge",
  "challenges",
  "company",
  "config",
  "configure",
  "contact",
  "contact-us",
  "dashboard",
  "database",
  "db",
  "debug",
  "debug-mode",
  "demo",
  "docs",
  "documentation",
  "download",
  "downloads",
  "email",
  "error",
  "example",
  "explore",
  "faq",
  "faqs",
  "favicon.ico",
  "feature",
  "features",
  "files",
  "forgot-password",
  "ftp",
  "grid",
  "grids",
  "health",
  "help",
  "helpdesk",
  "home",
  "index",
  "jobs",
  "legal",
  "localhost",
  "log-in",
  "log-out",
  "login",
  "logout",
  "mail",
  "manage",
  "management",
  "manager",
  "marketplace",
  "moderation",
  "moderator",
  "news",
  "not-found",
  "null",
  "oauth",
  "openid",
  "panel",
  "password",
  "policy",
  "press",
  "pricing",
  "privacy",
  "privacy-policy",
  "profile",
  "register",
  "reset-password",
  "roadmap",
  "roadmap-feed",
  "robots.txt",
  "root",
  "safety",
  "sample",
  "security",
  "settings",
  "setup",
  "sign-in",
  "sign-out",
  "sign-up",
  "signin",
  "signout",
  "signup",
  "sitemap.xml",
  "sso",
  "status",
  "superuser",
  "support",
  "support-center",
  "sysadmin",
  "team",
  "temp",
  "temporary",
  "terms",
  "terms-and-conditions",
  "terms-of-service",
  "test",
  "testing",
  "tos",
  "trust",
  "undefined",
  "uploads",
  "user",
  "users",
  "verification",
  "verify",
  "webhook",
  "webhooks",
  "welcome",
  "wp-admin",
  "wp-login",
  "www",
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

// ── Music Track Metadata (Spotify / Apple Music) ───────────────────────────

/**
 * Helper: fetch a URL and return its text body.
 */
async function fetchText(urlStr: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(urlStr, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const body = await res.text();
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Convert a Spotify RGBA color object to an rgba() CSS string.
 */
function toRgba(c: { red: number; green: number; blue: number; alpha?: number }): string {
  const a = c.alpha ?? 1;
  return `rgba(${c.red}, ${c.green}, ${c.blue}, ${a})`;
}

/**
 * Darken a hex color by a factor (0–1). Returns hex string.
 */
function darkenHex(hex: string, factor: number): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.substring(0, 2), 16) * (1 - factor));
  const g = Math.round(parseInt(h.substring(2, 4), 16) * (1 - factor));
  const b = Math.round(parseInt(h.substring(4, 6), 16) * (1 - factor));
  return `rgba(${r}, ${g}, ${b}, 1)`;
}

/**
 * Lighten an RGB triplet by a factor. Returns rgba() string.
 */
function lightenRgb(r: number, g: number, b: number, factor: number): string {
  const lr = Math.min(255, Math.round(r + (255 - r) * factor));
  const lg = Math.min(255, Math.round(g + (255 - g) * factor));
  const lb = Math.min(255, Math.round(b + (255 - b) * factor));
  return `rgba(${lr}, ${lg}, ${lb}, 1)`;
}

/**
 * Scrape Apple Music embed page for background hex color.
 */
async function scrapeAppleEmbedColors(songId: string): Promise<string | null> {
  try {
    const html = await fetchText(`https://embed.music.apple.com/us/song/${songId}`);
    const hexMatch = html.match(/#([0-9a-fA-F]{6})\b/);
    return hexMatch ? hexMatch[1] : null;
  } catch {
    return null;
  }
}

/**
 * Cloud Function to fetch music track metadata from Spotify or Apple Music.
 * Scrapes embed pages / iTunes API for track details and color palette.
 */
export const getMusicTrackMetadata = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to fetch music metadata.");
  }

  const { platform, trackId, trackType } = data as { platform?: string; trackId?: string; trackType?: string };

  if (!platform || !trackId) {
    throw new HttpsError("invalid-argument", "Missing platform or trackId.");
  }

  if (platform !== "spotify" && platform !== "apple") {
    throw new HttpsError("invalid-argument", `Unsupported platform: ${platform}`);
  }

  try {
    if (platform === "spotify") {
      // ── Spotify ──────────────────────────────────────────────────────
      // For album IDs, fetch the album embed and extract the first track entity
      const isAlbum = trackType === "album";
      const embedUrl = isAlbum
        ? `https://open.spotify.com/embed/album/${trackId}`
        : `https://open.spotify.com/embed/track/${trackId}`;
      const body = await fetchText(embedUrl);

      const scriptMatch = body.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (!scriptMatch) {
        throw new HttpsError("not-found", "Could not parse Spotify embed data.");
      }

      const nextData = JSON.parse(scriptMatch[1]);
      const pageEntity = nextData?.props?.pageProps?.state?.data?.entity;
      if (!pageEntity) {
        throw new HttpsError("not-found", "Entity not found in Spotify data.");
      }

      // For albums, use the first track as the representative entity
      const entity = isAlbum
        ? (pageEntity.tracks?.items?.[0] ?? pageEntity)
        : pageEntity;

      const vi = pageEntity.visualIdentity || {};
      const artists = entity.artists || pageEntity.artists || [];
      const artistId = artists[0]?.uri?.split(":").pop() || "";
      const trackEntityId = entity.id || entity.uri?.split(":").pop() || trackId;

      return {
        trackName: entity.name || pageEntity.name || "",
        artistName: artists.map((a: any) => a.name).join(", ") || "",
        albumArt: vi.image?.[0]?.url ?? "",
        previewUrl: entity.audioPreview?.url ?? pageEntity.audioPreview?.url ?? "",
        trackUrl: isAlbum
          ? `https://open.spotify.com/album/${trackId}`
          : `https://open.spotify.com/track/${trackEntityId}`,
        artistUrl: artistId ? `https://open.spotify.com/artist/${artistId}` : "",
        backgroundColor: vi.backgroundBase ? toRgba(vi.backgroundBase) : "rgba(30, 30, 30, 1)",
        backgroundTinted: vi.backgroundTintedBase ? toRgba(vi.backgroundTintedBase) : "rgba(50, 50, 50, 1)",
        textSubdued: vi.textSubdued ? toRgba(vi.textSubdued) : "rgba(180, 180, 180, 1)",
      };
    } else {
      // ── Apple Music ──────────────────────────────────────────────────
      const itunesUrl = `https://itunes.apple.com/lookup?id=${trackId}&entity=song`;
      const itunesBody = await fetchText(itunesUrl);
      const itunesData = JSON.parse(itunesBody);
      const track = itunesData?.results?.[0];

      if (!track) {
        throw new HttpsError("not-found", "Track not found in iTunes lookup.");
      }

      const albumArt = (track.artworkUrl100 || "").replace("100x100bb", "600x600bb");

      // Scrape embed page for color
      const bgHex = await scrapeAppleEmbedColors(trackId);

      let backgroundColor = "rgba(30, 30, 30, 1)";
      let backgroundTinted = "rgba(50, 50, 50, 1)";
      let textSubdued = "rgba(180, 180, 180, 1)";

      if (bgHex) {
        const r = parseInt(bgHex.substring(0, 2), 16);
        const g = parseInt(bgHex.substring(2, 4), 16);
        const b = parseInt(bgHex.substring(4, 6), 16);
        backgroundColor = `rgba(${r}, ${g}, ${b}, 1)`;
        backgroundTinted = darkenHex(bgHex, 0.15);
        textSubdued = lightenRgb(r, g, b, 0.45);
      }

      return {
        trackName: track.trackName || track.collectionName || "",
        artistName: track.artistName || "",
        albumArt,
        previewUrl: track.previewUrl || "",
        trackUrl: track.trackViewUrl || `https://music.apple.com/us/song/${trackId}`,
        artistUrl: track.artistViewUrl || "",
        backgroundColor,
        backgroundTinted,
        textSubdued,
      };
    }
  } catch (error: any) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Failed to fetch music track metadata", {
      error: String(error),
      platform,
      trackId,
    });
    throw new HttpsError("internal", "Failed to fetch music track metadata.");
  }
});

// ── Notion Integration ─────────────────────────────────────────────────────

/**
 * Exchanges a Notion OAuth authorization code for an access token and stores
 * it encrypted in Firestore at layouts/{layoutId}/notionTokens/{tileId}.
 *
 * The token is stored server-side only — it is never returned to the client
 * and is not part of the publicly-readable tile content.
 *
 * Called by the NotionCallback page after the user completes Notion OAuth.
 */
export const notionOAuthExchange = functions
  .runWith({ secrets: [notionClientId, notionClientSecret] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const { code, layoutId, tileId, redirectUri } = data as {
      code?: string;
      layoutId?: string;
      tileId?: string;
      redirectUri?: string;
    };

    if (!code || !layoutId || !tileId || !redirectUri) {
      throw new HttpsError("invalid-argument", "Missing code, layoutId, tileId, or redirectUri.");
    }

    // Verify the caller owns the layout before storing any token
    const db = admin.firestore();
    const layoutDoc = await db.collection("layouts").doc(layoutId).get();
    if (!layoutDoc.exists || layoutDoc.data()?.userId !== context.auth.uid) {
      throw new HttpsError("permission-denied", "You do not own this layout.");
    }

    const clientId = notionClientId.value();
    const clientSecret = notionClientSecret.value();

    if (!clientId || !clientSecret) {
      throw new HttpsError("failed-precondition", "Notion OAuth not configured.");
    }

    // Exchange the authorization code for an access token via Notion's token endpoint
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        // Must exactly match the URI used in the authorize request.
        // Passed from the client via the state parameter to guarantee consistency.
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      logger.error("Notion token exchange failed", { status: tokenRes.status, body });
      throw new HttpsError("internal", "Failed to exchange Notion authorization code.");
    }

    const tokenData = await tokenRes.json() as {
      access_token: string;
      workspace_id: string;
      workspace_name?: string;
      bot_id: string;
    };

    // Store the token in a private subcollection — not readable by clients via Firestore rules
    await db
      .collection("layouts").doc(layoutId)
      .collection("notionTokens").doc(tileId)
      .set({
        accessToken: tokenData.access_token,
        workspaceId: tokenData.workspace_id,
        workspaceName: tokenData.workspace_name || "",
        botId: tokenData.bot_id,
        ownerId: context.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    logger.info("Notion OAuth token stored", { layoutId, tileId, workspaceId: tokenData.workspace_id });

    return {
      success: true,
      workspaceName: tokenData.workspace_name || "",
    };
  });

/**
 * Lists all Notion databases the user has shared with this integration.
 * Called after OAuth to let the owner pick a database without pasting an ID.
 */
export const listNotionDatabases = functions
  .runWith({ secrets: [notionClientId, notionClientSecret] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const { layoutId, tileId } = data as { layoutId?: string; tileId?: string };
    if (!layoutId || !tileId) {
      throw new HttpsError("invalid-argument", "Missing layoutId or tileId.");
    }

    const db = admin.firestore();
    const tokenDoc = await db
      .collection("layouts").doc(layoutId)
      .collection("notionTokens").doc(tileId)
      .get();

    if (!tokenDoc.exists) {
      throw new HttpsError("not-found", "Notion integration not connected for this tile.");
    }

    const accessToken = tokenDoc.data()?.accessToken as string;

    // Use Notion's search endpoint to find all databases the integration can access
    const searchRes = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        filter: { value: "database", property: "object" },
        page_size: 50,
      }),
    });

    if (!searchRes.ok) {
      const body = await searchRes.text();
      logger.error("Notion database list failed", { status: searchRes.status, body });
      throw new HttpsError("internal", "Failed to list Notion databases.");
    }

    const searchData = await searchRes.json() as { results: any[] };

    const databases = searchData.results.map((db: any) => ({
      id: db.id,
      // Notion database titles are rich text arrays
      title: (db.title as any[])?.map((t: any) => t.plain_text || "").join("") || "Untitled",
    }));

    return { databases };
  });

/**
 * Fetches pages from the connected Notion database and maps them to
 * RoadmapItem objects using the owner-configured status mapping.
 *
 * Returns up to 100 items sorted by upvote count descending.
 * Also returns the list of available select options for the status property
 * so the owner can configure the mapping in the tile settings UI.
 */
export const fetchNotionRoadmap = functions
  .runWith({ secrets: [notionClientId, notionClientSecret] })
  .https.onCall(async (data, _context) => {
    // No auth required — roadmap data is public (visible to anyone who can view the grid).
    // The Notion access token is read server-side from Firestore and never returned to the client.

    const { layoutId, tileId, statusPropertyName, upvotePropertyName, statusMapping, databaseIdOverride, queryFilters } = data as {
      layoutId?: string;
      tileId?: string;
      statusPropertyName?: string;
      upvotePropertyName?: string;
      // Maps Notion select option names → "backlog" | "in_progress" | "done"
      statusMapping?: Record<string, string>;
      // Optional: pass the database ID directly so the client doesn't need to
      // wait for patchTileContent to persist to Firestore before calling this function.
      databaseIdOverride?: string;
      // Owner-configured filters applied when querying Notion.
      // Each filter maps to a Notion API filter condition.
      queryFilters?: Array<{ propertyName: string; type: string; value: boolean | string | string[] }>;
    };

    if (!layoutId || !tileId) {
      throw new HttpsError("invalid-argument", "Missing layoutId or tileId.");
    }

    // Retrieve the stored Notion access token for this tile
    const db = admin.firestore();
    const tokenDoc = await db
      .collection("layouts").doc(layoutId)
      .collection("notionTokens").doc(tileId)
      .get();

    if (!tokenDoc.exists) {
      throw new HttpsError("not-found", "Notion integration not connected for this tile.");
    }

    // Only the layout owner or any authenticated user can fetch (items are public on the roadmap)
    // but the token itself is only accessible server-side
    const accessToken = tokenDoc.data()?.accessToken as string;

    // Fetch the tile content to get the configured databaseId
    const layoutDoc = await db.collection("layouts").doc(layoutId).get();
    if (!layoutDoc.exists) {
      throw new HttpsError("not-found", "Layout not found.");
    }

    const tiles: any[] = layoutDoc.data()?.tiles || [];
    const tile = tiles.find((t: any) => t.i === tileId);

    // Prefer the client-supplied override (used when selectDatabase hasn't persisted yet)
    const databaseId = databaseIdOverride || tile?.content?.notionDatabaseId as string | undefined;
    if (!databaseId || databaseId === "pending") {
      throw new HttpsError("not-found", "Roadmap tile or database ID not configured.");
    }
    const effectiveStatusProp = statusPropertyName || tile.content.statusPropertyName || "";
    const effectiveUpvoteProp = upvotePropertyName || tile.content.upvotePropertyName || "";
    const effectiveMapping: Record<string, string> = statusMapping || tile.content.statusMapping || {};
    // Owner-configured query filters — applied as Notion API filter conditions
    const effectiveQueryFilters: Array<{ propertyName: string; type: string; value: boolean | string | string[] }> =
      queryFilters || (tile.content.queryFilters as Array<{ propertyName: string; type: string; value: boolean | string | string[] }> | undefined) || [];

    logger.info("[fetchNotionRoadmap] Received queryFilters from client:", { queryFilters });
    logger.info("[fetchNotionRoadmap] Effective queryFilters after fallback:", { effectiveQueryFilters });

    // Build the Notion API `filter` object from effectiveQueryFilters.
    // All conditions are ANDed together using a compound `and` filter.
    // multi_select uses OR logic: item must have at least one of the selected tags.
    const buildNotionFilter = (): Record<string, any> | undefined => {
      if (effectiveQueryFilters.length === 0) return undefined;
      const conditions: Record<string, any>[] = [];
      for (const qf of effectiveQueryFilters) {
        if (qf.type === "checkbox") {
          conditions.push({ property: qf.propertyName, checkbox: { equals: qf.value as boolean } });
        } else if (qf.type === "select") {
          conditions.push({ property: qf.propertyName, select: { equals: qf.value as string } });
        } else if (qf.type === "status") {
          conditions.push({ property: qf.propertyName, status: { equals: qf.value as string } });
        } else if (qf.type === "multi_select") {
          const values = Array.isArray(qf.value) ? qf.value as string[] : [qf.value as string];
          if (values.length === 0) continue;
          if (values.length === 1) {
            conditions.push({ property: qf.propertyName, multi_select: { contains: values[0] } });
          } else {
            // OR: at least one tag must match — expressed as a nested `or` compound
            conditions.push({ or: values.map((v) => ({ property: qf.propertyName, multi_select: { contains: v } })) });
          }
        }
      }
      if (conditions.length === 0) return undefined;
      if (conditions.length === 1) return conditions[0];
      return { and: conditions };
    };
    const notionFilter = buildNotionFilter();
    logger.info("[fetchNotionRoadmap] Built Notion filter:", { notionFilter: JSON.stringify(notionFilter) });

    // Fetch the database schema and all pages in parallel (schema fetch is independent)
    const schemaFetchPromise = fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Notion-Version": "2022-06-28",
      },
    });

    // Paginate through all Notion results — the API caps each response at 100 rows.
    // We keep fetching until has_more is false.
    const sorts = effectiveUpvoteProp
      ? [{ property: effectiveUpvoteProp, direction: "descending" }]
      : [];

    const allPages: any[] = [];
    let startCursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const body: Record<string, any> = { page_size: 100, sorts };
      if (startCursor) body.start_cursor = startCursor;
      if (notionFilter) body.filter = notionFilter;

      const queryRes = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify(body),
      });

      if (!queryRes.ok) {
        const errBody = await queryRes.text();
        logger.error("Notion database query failed", { status: queryRes.status, body: errBody, databaseId });
        throw new HttpsError("internal", "Failed to query Notion database.");
      }

      const queryData = await queryRes.json() as { results: any[]; has_more: boolean; next_cursor: string | null };
      allPages.push(...queryData.results);
      hasMore = queryData.has_more;
      startCursor = queryData.next_cursor ?? undefined;
    }

    // Map Notion pages to RoadmapItem shape
    const items = allPages.map((page: any) => {
      const props = page.properties || {};

      // Extract title from the first title-type property
      let title = "";
      for (const key of Object.keys(props)) {
        const prop = props[key];
        if (prop.type === "title" && Array.isArray(prop.title)) {
          title = prop.title.map((t: any) => t.plain_text || "").join("");
          break;
        }
      }

      // Extract status from the configured select/status property
      let rawStatus = "";
      if (effectiveStatusProp && props[effectiveStatusProp]) {
        const statusProp = props[effectiveStatusProp];
        if (statusProp.type === "select" && statusProp.select?.name) {
          rawStatus = statusProp.select.name;
        } else if (statusProp.type === "status" && statusProp.status?.name) {
          rawStatus = statusProp.status.name;
        }
      }

      // Map the raw Notion status value to one of our three canonical buckets
      const mappedStatus = effectiveMapping[rawStatus] || "backlog";

      // Extract upvote count from the configured number property
      let upvoteCount = 0;
      if (effectiveUpvoteProp && props[effectiveUpvoteProp]) {
        const upvoteProp = props[effectiveUpvoteProp];
        if (upvoteProp.type === "number" && typeof upvoteProp.number === "number") {
          upvoteCount = upvoteProp.number;
        }
      }

      return {
        notionPageId: page.id,
        title: title || "Untitled",
        status: mappedStatus,
        upvoteCount,
      };
    });

    // Resolve the schema fetch that was started in parallel with the page queries
    let propertyOptions: { name: string; type: string; selectOptions?: string[] }[] = [];
    try {
      const dbRes = await schemaFetchPromise;
      if (dbRes.ok) {
        const dbData = await dbRes.json() as { properties: Record<string, any> };
        propertyOptions = Object.entries(dbData.properties).map(([name, prop]) => ({
          name,
          type: prop.type,
          selectOptions:
            prop.type === "select"
              ? (prop.select?.options || []).map((o: any) => o.name as string)
              : prop.type === "status"
              ? (prop.status?.options || []).map((o: any) => o.name as string)
              : prop.type === "multi_select"
              ? (prop.multi_select?.options || []).map((o: any) => o.name as string)
              : undefined,
        }));
      }
    } catch (err) {
      // Non-fatal — owner can still use the feed even without property options
      logger.warn("Failed to fetch Notion database schema", { error: String(err) });
    }

    logger.info("Notion roadmap fetched", { layoutId, tileId, itemCount: items.length });

    return { items, propertyOptions };
  });

/**
 * Records a Grids user's upvote on a roadmap item and patches the upvote
 * count back to the corresponding Notion page.
 *
 * Upvotes are stored in Firestore at:
 *   layouts/{layoutId}/tiles/{tileId}/upvotes/{userId}
 *
 * One document per user per tile item — the notionPageId field identifies
 * which item within the tile the user voted on. This naturally deduplicates
 * votes (set with merge:false will fail if the doc already exists, so we
 * use a transaction to check and toggle).
 */
export const upvoteRoadmapItem = functions
  .runWith({ secrets: [notionClientId, notionClientSecret] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to upvote.");
    }

    const { layoutId, tileId, notionPageId } = data as {
      layoutId?: string;
      tileId?: string;
      notionPageId?: string;
    };

    if (!layoutId || !tileId || !notionPageId) {
      throw new HttpsError("invalid-argument", "Missing layoutId, tileId, or notionPageId.");
    }

    const db = admin.firestore();
    const userId = context.auth.uid;

    // One doc per user per item, keyed by "{userId}_{notionPageId}".
    // This allows a user to upvote multiple items independently.
    // The userId prefix lets the client query all of a user's votes with a
    // where("userId", "==", uid) filter without needing a collection-group index.
    const docId = `${userId}_${notionPageId}`;
    const upvoteRef = db
      .collection("layouts").doc(layoutId)
      .collection("tiles").doc(tileId)
      .collection("upvotes").doc(docId);

    // Retrieve the Notion access token for this tile
    const tokenDoc = await db
      .collection("layouts").doc(layoutId)
      .collection("notionTokens").doc(tileId)
      .get();

    if (!tokenDoc.exists) {
      throw new HttpsError("not-found", "Notion integration not connected for this tile.");
    }

    const accessToken = tokenDoc.data()?.accessToken as string;

    // Use a transaction to toggle the upvote atomically
    const { isNowUpvoted, newCount } = await db.runTransaction(async (transaction) => {
      const upvoteDoc = await transaction.get(upvoteRef);

      if (upvoteDoc.exists) {
        // Toggle off — remove this item's upvote (other items unaffected)
        transaction.delete(upvoteRef);
        return { isNowUpvoted: false, newCount: -1 };
      } else {
        // Toggle on — record the upvote for this specific item
        transaction.set(upvoteRef, {
          userId,
          notionPageId,
          votedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { isNowUpvoted: true, newCount: 1 };
      }
    });

    // Retrieve the tile content to find the upvote property name
    const layoutDoc = await db.collection("layouts").doc(layoutId).get();
    const tiles: any[] = layoutDoc.data()?.tiles || [];
    const tile = tiles.find((t: any) => t.i === tileId);
    const upvotePropertyName: string = tile?.content?.upvotePropertyName || "";

    // Patch the upvote count on the Notion page if a property name is configured.
    // We fetch the current value first so we can increment/decrement correctly.
    if (upvotePropertyName) {
      try {
        // Fetch the current page to get the existing upvote count
        const pageRes = await fetch(`https://api.notion.com/v1/pages/${notionPageId}`, {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Notion-Version": "2022-06-28",
          },
        });

        if (pageRes.ok) {
          const pageData = await pageRes.json() as { properties: Record<string, any> };
          const currentCount: number =
            pageData.properties[upvotePropertyName]?.number ?? 0;

          const updatedCount = Math.max(0, currentCount + newCount);

          // Patch the Notion page with the new upvote count
          await fetch(`https://api.notion.com/v1/pages/${notionPageId}`, {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              "Notion-Version": "2022-06-28",
            },
            body: JSON.stringify({
              properties: {
                [upvotePropertyName]: { number: updatedCount },
              },
            }),
          });

          logger.info("Notion upvote count patched", {
            notionPageId,
            upvotePropertyName,
            updatedCount,
            isNowUpvoted,
          });
        }
      } catch (err) {
        // Non-fatal — the Firestore vote is already recorded; Notion sync is best-effort
        logger.error("Failed to patch Notion upvote count", {
          error: String(err),
          notionPageId,
        });
      }
    }

    return { isNowUpvoted };
  });
