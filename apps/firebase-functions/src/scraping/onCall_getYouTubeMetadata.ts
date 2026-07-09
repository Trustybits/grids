import * as functions from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { noopIfMaintenance } from "../maintenance.js";
import {
  requireAuth,
  requireStringFields,
} from "../shared/utils_callable.js";

// Define secret for YouTube API key
const youtubeApiKey = defineSecret("YOUTUBE_API_KEY");

/**
 * Cloud Function to fetch YouTube metadata for videos, playlists, channels, and shorts.
 * Uses YouTube Data API v3 to retrieve public metadata.
 */
export const getYouTubeMetadata = functions
  .runWith({
    minInstances: 1,
    secrets: [youtubeApiKey],
  })
  .https.onCall(async (data, context) => {
    if (noopIfMaintenance("getYouTubeMetadata")) return null;

    requireAuth(context, "You must be signed in to fetch YouTube metadata.");
    const { youtubeType, youtubeId } = requireStringFields(
      data,
      ["youtubeType", "youtubeId"],
      "Missing youtubeType or youtubeId.",
    );

    const validTypes = ["video", "playlist", "channel", "short"];
    if (!validTypes.includes(youtubeType)) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid youtubeType: ${youtubeType}`,
      );
    }

    try {
      const apiKey = youtubeApiKey.value();

      if (!apiKey) {
        logger.error("YouTube API key not configured");
        throw new HttpsError(
          "failed-precondition",
          "YouTube API not configured.",
        );
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
                channelThumbnail =
                  channelData.items[0].snippet.thumbnails?.default?.url || "";
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
            playlistItems =
              itemsData.items?.map((item: { snippet: { resourceId: { videoId: string }; title: string; thumbnails: unknown; channelTitle: string } }, index: number) => ({
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
            const handle = youtubeId.startsWith("@")
              ? youtubeId
              : `@${youtubeId}`;
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
              const username = youtubeId.startsWith("@")
                ? youtubeId.slice(1)
                : youtubeId;
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
              const searchQuery = youtubeId.startsWith("@")
                ? youtubeId.slice(1)
                : youtubeId;
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
              recentVideos =
                uploadsData.items?.map((item: { snippet: { resourceId: { videoId: string }; title: string; thumbnails: unknown } }, index: number) => ({
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
          throw new HttpsError(
            "invalid-argument",
            "Unsupported YouTube content type.",
          );
      }
    } catch (error: unknown) {
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
