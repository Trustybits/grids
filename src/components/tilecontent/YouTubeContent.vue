<template>
  <div class="youtube-content" :class="['tier-' + layout.tier, 'orient-' + layout.orientation, contentTypeClass, { 'dim-w1': layout.w === 1, 'dim-h1': layout.h === 1 }]">
    <!-- YouTube logo badge (top-left, matches link tile favicon) -->
    <div class="yt-logo" aria-hidden="true">
      <svg viewBox="0 0 28 20" fill="none">
        <rect width="28" height="20" rx="5" fill="#FF0000"/>
        <path d="M18.5 10L11.5 14V6L18.5 10Z" fill="white"/>
      </svg>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="youtube-loading">
      <div class="youtube-spinner"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="hasError" class="youtube-error">
      <p>Failed to load YouTube content</p>
      <button @click="fetchMetadata" class="retry-btn">Retry</button>
    </div>

    <!-- Video / Short -->
    <div v-else-if="isVideo || isShort" class="yt-video" @click="openYouTube">
      <!-- Edge-to-edge thumbnail background -->
      <div v-if="layout.showThumbnail && thumbnailUrl" class="yt-bg">
        <img :src="thumbnailUrl" :alt="content.title || 'YouTube video'" />
        <div class="yt-bg-overlay"></div>
      </div>
      <!-- Badges -->
      <div v-if="isShort" class="yt-shorts-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 14.65v-5.3L15 12l-5 2.65zm7.77-4.33c-.77-.32-1.2-.5-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25.03.01 1.2.5 1.2.5L6 14.93c-1.83.97-2.53 3.24-1.56 5.07.97 1.83 3.24 2.53 5.07 1.56l8.5-4.5c1.29-.68 2.06-2.04 1.99-3.49-.07-1.42-.94-2.68-2.23-3.25z"/>
        </svg>
        SHORT
      </div>
      <div v-else-if="layout.showDuration && formattedDuration" class="yt-duration">
        {{ formattedDuration }}
      </div>
      <!-- Foreground info (overlaid at bottom) -->
      <div v-if="layout.showTitle || layout.showChannel" class="yt-fg">
        <p v-if="layout.showTitle" class="yt-title" :style="{ '-webkit-line-clamp': layout.titleLineClamp }">
          {{ content.title || 'Untitled' }}
        </p>
        <div v-if="layout.showChannel" class="yt-channel-row">
          <img
            v-if="layout.showChannelAvatar && content.channelThumbnail"
            :src="content.channelThumbnail"
            :alt="content.channelTitle"
            class="yt-channel-avatar"
          />
          <span class="yt-channel-name">{{ content.channelTitle || 'Unknown Channel' }}</span>
        </div>
        <div v-if="layout.showStats" class="yt-stats">
          <span v-if="content.viewCount">{{ formatViews(content.viewCount) }} views</span>
          <span v-if="content.publishedAt">{{ formatDate(content.publishedAt) }}</span>
        </div>
      </div>
    </div>

    <!-- Playlist -->
    <div v-else-if="isPlaylist" class="yt-playlist" @click="openYouTube">
      <!-- Edge-to-edge thumbnail background -->
      <div v-if="layout.showThumbnail && thumbnailUrl" class="yt-bg">
        <img :src="thumbnailUrl" :alt="content.title || 'YouTube playlist'" />
        <div class="yt-bg-overlay"></div>
      </div>
      <div class="yt-playlist-badge">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 10h11v2H3v-2zm0-4h11v2H3V6zm0 8h7v2H3v-2zm13-1v8l6-4-6-4z"/>
        </svg>
        <span>{{ content.itemCount || 0 }}</span>
      </div>
      <!-- Foreground info (overlaid at bottom) -->
      <div v-if="layout.showTitle || layout.showChannel" class="yt-fg">
        <p v-if="layout.showTitle" class="yt-title" :style="{ '-webkit-line-clamp': layout.titleLineClamp }">
          {{ content.title || 'Untitled Playlist' }}
        </p>
        <span v-if="layout.showChannel" class="yt-channel-name">
          {{ content.channelTitle || 'Unknown Channel' }}
        </span>
      </div>
    </div>

    <!-- Channel -->
    <div v-else-if="isChannel" class="yt-channel">
      <!-- Top bar: subscribe button (top-right, logo is already absolute) -->
      <div class="yt-channel-topbar">
        <button v-if="layout.showChannel" class="yt-subscribe-btn" @click="openYouTube">
          Subscribe<span v-if="content.channelData?.subscriberCount">&nbsp; {{ formatNumber(content.channelData.subscriberCount) }}</span>
        </button>
      </div>
      <!-- Channel name + video count -->
      <div class="yt-channel-meta">
        <p v-if="layout.showTitle" class="yt-title">{{ channelName }}</p>
        <span v-if="layout.showChannel && content.channelData?.videoCount" class="yt-channel-video-count">
          {{ formatNumber(content.channelData.videoCount) }} videos
        </span>
      </div>
      <!-- Recent videos grid (thumbnail-only, no titles) -->
      <div
        v-if="layout.tier !== 'mini' && layout.tier !== 'compact' && content.recentVideos?.length"
        class="yt-recent-videos"
      >
        <div class="yt-video-grid">
          <div
            v-for="video in displayRecentVideos"
            :key="video.videoId"
            class="yt-video-card"
            @click.stop="openVideo(video.videoId)"
          >
            <div class="yt-video-thumb">
              <img :src="video.thumbnails?.medium?.url || video.thumbnails?.default?.url" :alt="video.title" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, inject, onMounted } from "vue";
import { type YouTubeContent } from "@/types/TileContent";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import { useLayoutStore } from "@/stores/layout";
import { useTileLayout } from "@/composables/useTileLayout";

export default defineComponent({
  props: {
    content: {
      type: Object as () => YouTubeContent,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const layout = useTileLayout();
    const tileId = inject<string | null>("tileId", null);

    const isLoading = ref(false);
    const hasError = ref(false);

    // Content type checks
    const isVideo = computed(() => props.content.youtubeType === "video");
    const isShort = computed(() => props.content.youtubeType === "short");
    const isPlaylist = computed(() => props.content.youtubeType === "playlist");
    const isChannel = computed(() => props.content.youtubeType === "channel");

    const contentTypeClass = computed(() => `yt-type-${props.content.youtubeType}`);

    // Thumbnail selection driven by layout quality hint
    const thumbnailUrl = computed(() => {
      const thumbs = props.content.thumbnails;
      if (!thumbs) return "";
      const q = layout.value.thumbnailQuality;
      if (q === "high") return thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url || "";
      if (q === "medium") return thumbs.medium?.url || thumbs.default?.url || "";
      return thumbs.default?.url || thumbs.medium?.url || "";
    });

    // Channel avatar
    const channelAvatar = computed(() => {
      if (isChannel.value && props.content.channelData?.thumbnails) {
        return props.content.channelData.thumbnails.medium?.url || 
               props.content.channelData.thumbnails.default?.url || "";
      }
      return "";
    });

    const channelName = computed(() => {
      return props.content.channelData?.title || props.content.title || "Unknown Channel";
    });

    // Format duration from ISO 8601 (PT1H2M10S) to readable format
    const formattedDuration = computed(() => {
      if (!props.content.duration) return "";
      
      const match = props.content.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!match) return "";
      
      const hours = parseInt(match[1] || "0");
      const minutes = parseInt(match[2] || "0");
      const seconds = parseInt(match[3] || "0");
      
      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
      }
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    });

    // Format view count
    const formatViews = (count: string) => {
      const num = parseInt(count);
      if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M`;
      } else if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K`;
      }
      return num.toString();
    };

    // Format any number
    const formatNumber = (count: string) => {
      const num = parseInt(count);
      if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M`;
      } else if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K`;
      }
      return num.toString();
    };

    // Format date
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    };

    // Truncate description
    const truncateDescription = (desc: string, maxLength: number = 150) => {
      if (!desc) return "";
      if (desc.length <= maxLength) return desc;
      return desc.substring(0, maxLength) + "...";
    };

    // Display limited playlist items based on tile size
    const displayPlaylistItems = computed(() => {
      if (!props.content.playlistItems) return [];
      const maxItems = Math.max(3, Math.floor((layout.value.h - 1) * 2));
      return props.content.playlistItems.slice(0, maxItems);
    });

    // Display limited recent videos based on tile size
    const displayRecentVideos = computed(() => {
      if (!props.content.recentVideos) return [];
      const { w, h } = layout.value;
      const maxVideos = Math.min(12, Math.floor(w * h / 2));
      return props.content.recentVideos.slice(0, maxVideos);
    });

    // Open YouTube link
    const openYouTube = () => {
      window.open(props.content.youtubeUrl, "_blank");
    };

    // Open specific video
    const openVideo = (videoId: string) => {
      window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank");
    };

    // Fetch metadata from YouTube API
    const fetchMetadata = async () => {
      if (props.content.title) {
        console.log("YouTube metadata already loaded:", props.content.title);
        return; // Already has metadata
      }
      
      console.log("Fetching YouTube metadata for:", {
        type: props.content.youtubeType,
        id: props.content.youtubeId,
        url: props.content.youtubeUrl,
      });
      
      isLoading.value = true;
      hasError.value = false;
      
      try {
        const getYouTubeMetadata = httpsCallable(functions, "getYouTubeMetadata");
        const result = await getYouTubeMetadata({
          youtubeType: props.content.youtubeType,
          youtubeId: props.content.youtubeId,
        });
        
        const data = result.data as any;
        
        console.log("YouTube metadata received:", data);
        
        // Update tile content with fetched metadata
        if (tileId) {
          console.log("Patching tile content for tile:", tileId);
          layoutStore.patchTileContent(tileId, data);
        } else {
          console.warn("No tileId available to patch content");
        }
      } catch (error) {
        console.error("Failed to fetch YouTube metadata:", error);
        hasError.value = true;
      } finally {
        isLoading.value = false;
      }
    };

    onMounted(() => {
      fetchMetadata();
    });

    return {
      layout,
      isLoading,
      hasError,
      contentTypeClass,
      isVideo,
      isShort,
      isPlaylist,
      isChannel,
      thumbnailUrl,
      channelAvatar,
      channelName,
      formattedDuration,
      formatViews,
      formatNumber,
      formatDate,
      truncateDescription,
      displayPlaylistItems,
      displayRecentVideos,
      openYouTube,
      openVideo,
      fetchMetadata,
    };
  },
});
</script>

<style scoped lang="scss">
/* ─── Root ─────────────────────────────────────────────── */
.youtube-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-tile-background);
  border-radius: var(--tile-border-radius);
  overflow: hidden;
  color: var(--color-text-primary);
}

/* ─── YouTube logo badge (top-left, matches link tile favicon) ── */
.yt-logo {
  position: absolute;
  top: var(--tile-padding, 21.5px);
  left: var(--tile-padding, 21.5px);
  width: var(--tile-logo-size, 32px);
  height: var(--tile-logo-size, 32px);
  z-index: 3;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 24px;
    height: 17px;
    display: block;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.4));
  }
}

/* ─── Loading / Error ──────────────────────────────────── */
.youtube-loading,
.youtube-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  gap: 12px;
  color: var(--color-content-high);
  font-size: 14px;
}

.youtube-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-content-low);
  border-top-color: #ff0000;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.retry-btn {
  padding: 8px 16px;
  background: var(--color-content-low);
  border: none;
  border-radius: 6px;
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;

  &:hover {
    background: var(--color-content-high);
  }
}

/* ─── Edge-to-edge background thumbnail ───────────────── */
.yt-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
}

.yt-bg-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(
      180deg,
      transparent 30%,
      color-mix(in srgb, var(--color-tile-background) 70%, transparent) 70%,
      var(--color-tile-background) 100%
    ),
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--color-tile-background) 20%, transparent) 0%,
      color-mix(in srgb, var(--color-tile-background) 20%, transparent) 100%
    );
}

/* ─── Badges ──────────────────────────────────────────── */
.yt-duration {
  position: absolute;
  bottom: var(--tile-padding, 21.5px);
  right: var(--tile-padding, 21.5px);
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  z-index: 2;
}

.yt-shorts-badge {
  position: absolute;
  top: var(--tile-padding, 21.5px);
  right: var(--tile-padding, 21.5px);
  background: linear-gradient(135deg, #ff0000, #ff4444);
  color: #fff;
  padding: 3px 7px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 3px;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 4px rgba(255, 0, 0, 0.3);
  z-index: 2;
}

.yt-playlist-badge {
  position: absolute;
  bottom: var(--tile-padding, 21.5px);
  right: var(--tile-padding, 21.5px);
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 2;
}

/* ─── Foreground info (overlaid at bottom of thumbnail) ── */
.yt-fg {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--tile-padding, 21.5px);
  padding-top: 24px;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* ─── Shared text styles ──────────────────────────────── */
.yt-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.yt-channel-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.yt-channel-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
}

.yt-channel-name {
  font-size: 12px;
  color: var(--color-content-high);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.yt-stats {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--color-content-high);
  flex-wrap: wrap;
}

.yt-description {
  font-size: 12px;
  line-height: 1.4;
  color: var(--color-content-high);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
}

/* ─── Video / Playlist layout ─────────────────────────── */
.yt-video,
.yt-playlist {
  position: relative;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

/* ─── Channel layout ──────────────────────────────────── */
.yt-channel {
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
  padding: var(--tile-padding, 21.5px);
}

.yt-channel-topbar {
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  min-height: 32px;
}

.yt-subscribe-btn {
  display: inline-flex;
  align-items: center;
  gap: 0;
  background: #ff0000;
  color: #fff;
  border: none;
  border-radius: 18px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;
  white-space: nowrap;

  &:hover {
    background: #cc0000;
    transform: scale(1.02);
  }
}

.yt-channel-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.yt-channel-video-count {
  font-size: 12px;
  color: var(--color-content-high);
}

/* ─── Recent videos (channel) ─────────────────────────── */
.yt-recent-videos {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin-top: 8px;
}

.yt-video-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  overflow: hidden;
}

.yt-video-card {
  cursor: pointer;
  transition: transform 0.15s;

  &:hover {
    transform: scale(1.03);
  }
}

.yt-video-thumb {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  overflow: hidden;
  background: var(--color-content-low);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

/* ─── Tier: mini (1×1) ────────────────────────────────── */
.tier-mini {
  /* Center the logo in the tile */
  .yt-logo {
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  /* Hide foreground info and badges */
  .yt-fg,
  .yt-duration,
  .yt-shorts-badge,
  .yt-playlist-badge {
    display: none;
  }

  /* Tone down overlay so thumbnail is more visible */
  .yt-bg-overlay {
    background-image:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--color-tile-background) 15%, transparent) 0%,
        color-mix(in srgb, var(--color-tile-background) 15%, transparent) 100%
      );
  }

  /* Channel: hide everything, just show centered logo */
  .yt-channel {
    padding: 0;
  }

  .yt-channel-topbar,
  .yt-channel-meta,
  .yt-recent-videos {
    display: none;
  }
}

/* ─── Tier: compact (area ≤ 4) ────────────────────────── */
.tier-compact {
  .yt-title {
    font-size: 12px;
  }

  .yt-channel-name {
    font-size: 11px;
  }

  .yt-channel {
    gap: 4px;
  }

  .yt-subscribe-btn {
    font-size: 11px;
    padding: 4px 10px;
  }

  .yt-recent-videos {
    display: none;
  }
}

/* Center logo horizontally for any tile with w=1 (except mini, which is fully centered) */
.dim-w1:not(.tier-mini) .yt-logo {
  left: 50%;
  transform: translateX(-50%);
}

/* Center logo vertically for any tile with h=1 (except mini, which is fully centered) */
.dim-h1:not(.tier-mini) .yt-logo {
  top: 50%;
  transform: translateY(-50%);
}

/* ─── Tier: medium (area ≤ 9) ─────────────────────────── */
.tier-medium {
  .yt-title {
    font-size: 14px;
  }

  .yt-channel-avatar {
    width: 22px;
    height: 22px;
  }

  .yt-channel .yt-title {
    font-size: 18px;
    font-weight: 700;
  }

  .yt-subscribe-btn {
    font-size: 13px;
    padding: 8px 16px;
    border-radius: 20px;
  }

  .yt-channel-video-count {
    font-size: 13px;
  }
}

/* ─── Tier: large (area > 9) ──────────────────────────── */
.tier-large {
  .yt-title {
    font-size: 16px;
    font-weight: 700;
  }

  .yt-channel-avatar {
    width: 26px;
    height: 26px;
  }

  .yt-channel-name {
    font-size: 13px;
    font-weight: 500;
  }

  .yt-fg {
    gap: 4px;
  }

  .yt-channel .yt-title {
    font-size: 22px;
    font-weight: 700;
  }

  .yt-subscribe-btn {
    font-size: 14px;
    padding: 10px 20px;
    border-radius: 22px;
  }

  .yt-channel-video-count {
    font-size: 14px;
  }

  .yt-video-thumb {
    border-radius: 14px;
  }
}
</style>
