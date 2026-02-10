<template>
  <div class="youtube-content" :class="[sizeClass, contentTypeClass]">
    <!-- Loading state -->
    <div v-if="isLoading" class="youtube-loading">
      <div class="youtube-spinner"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="hasError" class="youtube-error">
      <p>Failed to load YouTube content</p>
      <button @click="fetchMetadata" class="retry-btn">Retry</button>
    </div>

    <!-- Video/Short view -->
    <div v-else-if="isVideo || isShort" class="youtube-video-layout">
      <!-- Compact view (1x1, 2x1, 1x2) -->
      <div v-if="isCompact" class="youtube-compact">
        <div class="youtube-thumbnail-container" @click="openYouTube">
          <img 
            v-if="thumbnailUrl" 
            :src="thumbnailUrl" 
            :alt="content.title || 'YouTube video'" 
            class="youtube-thumbnail" 
          />
          <div class="youtube-play-overlay">
            <svg width="48" height="48" viewBox="0 0 68 48" fill="none">
              <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00"/>
              <path d="M 45,24 27,14 27,34" fill="#fff"/>
            </svg>
          </div>
          <div v-if="isShort" class="youtube-shorts-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 14.65v-5.3L15 12l-5 2.65zm7.77-4.33c-.77-.32-1.2-.5-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25.03.01 1.2.5 1.2.5L6 14.93c-1.83.97-2.53 3.24-1.56 5.07.97 1.83 3.24 2.53 5.07 1.56l8.5-4.5c1.29-.68 2.06-2.04 1.99-3.49-.07-1.42-.94-2.68-2.23-3.25z"/>
            </svg>
            SHORT
          </div>
          <div v-else-if="formattedDuration" class="youtube-duration-badge">
            {{ formattedDuration }}
          </div>
        </div>
        <div class="youtube-info-compact">
          <p class="youtube-title">{{ content.title || 'Untitled' }}</p>
          <p class="youtube-channel">{{ content.channelTitle || 'Unknown Channel' }}</p>
        </div>
      </div>

      <!-- Medium view (2x2, 3x2, 2x3) -->
      <div v-else-if="isMedium" class="youtube-medium">
        <div class="youtube-thumbnail-container" @click="openYouTube">
          <img 
            v-if="thumbnailUrl" 
            :src="thumbnailUrl" 
            :alt="content.title || 'YouTube video'" 
            class="youtube-thumbnail" 
          />
          <div class="youtube-play-overlay">
            <svg width="68" height="48" viewBox="0 0 68 48" fill="none">
              <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00"/>
              <path d="M 45,24 27,14 27,34" fill="#fff"/>
            </svg>
          </div>
          <div v-if="isShort" class="youtube-shorts-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 14.65v-5.3L15 12l-5 2.65zm7.77-4.33c-.77-.32-1.2-.5-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25.03.01 1.2.5 1.2.5L6 14.93c-1.83.97-2.53 3.24-1.56 5.07.97 1.83 3.24 2.53 5.07 1.56l8.5-4.5c1.29-.68 2.06-2.04 1.99-3.49-.07-1.42-.94-2.68-2.23-3.25z"/>
            </svg>
            SHORT
          </div>
          <div v-else-if="formattedDuration" class="youtube-duration-badge">
            {{ formattedDuration }}
          </div>
        </div>
        <div class="youtube-info-medium">
          <p class="youtube-title">{{ content.title || 'Untitled' }}</p>
          <div class="youtube-meta">
            <div class="youtube-channel-row">
              <img 
                v-if="content.channelThumbnail" 
                :src="content.channelThumbnail" 
                :alt="content.channelTitle" 
                class="youtube-channel-avatar"
              />
              <span class="youtube-channel">{{ content.channelTitle || 'Unknown Channel' }}</span>
            </div>
            <div class="youtube-stats">
              <span v-if="content.viewCount">{{ formatViews(content.viewCount) }} views</span>
              <span v-if="content.publishedAt">{{ formatDate(content.publishedAt) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Large view (3x3+) -->
      <div v-else class="youtube-large">
        <div class="youtube-thumbnail-container" @click="openYouTube">
          <img 
            v-if="thumbnailUrl" 
            :src="thumbnailUrl" 
            :alt="content.title || 'YouTube video'" 
            class="youtube-thumbnail" 
          />
          <div class="youtube-play-overlay">
            <svg width="88" height="62" viewBox="0 0 68 48" fill="none">
              <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00"/>
              <path d="M 45,24 27,14 27,34" fill="#fff"/>
            </svg>
          </div>
          <div v-if="isShort" class="youtube-shorts-badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 14.65v-5.3L15 12l-5 2.65zm7.77-4.33c-.77-.32-1.2-.5-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25.03.01 1.2.5 1.2.5L6 14.93c-1.83.97-2.53 3.24-1.56 5.07.97 1.83 3.24 2.53 5.07 1.56l8.5-4.5c1.29-.68 2.06-2.04 1.99-3.49-.07-1.42-.94-2.68-2.23-3.25z"/>
            </svg>
            SHORT
          </div>
          <div v-else-if="formattedDuration" class="youtube-duration-badge">
            {{ formattedDuration }}
          </div>
        </div>
        <div class="youtube-info-large">
          <h3 class="youtube-title-large">{{ content.title || 'Untitled' }}</h3>
          <div class="youtube-channel-row">
            <img 
              v-if="content.channelThumbnail" 
              :src="content.channelThumbnail" 
              :alt="content.channelTitle" 
              class="youtube-channel-avatar"
            />
            <div class="youtube-channel-info">
              <span class="youtube-channel-name">{{ content.channelTitle || 'Unknown Channel' }}</span>
            </div>
          </div>
          <div class="youtube-stats-row">
            <span v-if="content.viewCount" class="youtube-stat">{{ formatViews(content.viewCount) }} views</span>
            <span v-if="content.likeCount" class="youtube-stat">{{ formatNumber(content.likeCount) }} likes</span>
            <span v-if="content.publishedAt" class="youtube-stat">{{ formatDate(content.publishedAt) }}</span>
          </div>
          <p v-if="content.description" class="youtube-description">
            {{ truncateDescription(content.description) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Playlist view -->
    <div v-else-if="isPlaylist" class="youtube-playlist-layout">
      <!-- Compact view -->
      <div v-if="isCompact" class="youtube-compact">
        <div class="youtube-thumbnail-container" @click="openYouTube">
          <img 
            v-if="thumbnailUrl" 
            :src="thumbnailUrl" 
            :alt="content.title || 'YouTube playlist'" 
            class="youtube-thumbnail" 
          />
          <div class="youtube-playlist-badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 10h11v2H3v-2zm0-4h11v2H3V6zm0 8h7v2H3v-2zm13-1v8l6-4-6-4z"/>
            </svg>
            <span>{{ content.itemCount || 0 }}</span>
          </div>
        </div>
        <div class="youtube-info-compact">
          <p class="youtube-title">{{ content.title || 'Untitled Playlist' }}</p>
          <p class="youtube-channel">{{ content.channelTitle || 'Unknown Channel' }}</p>
        </div>
      </div>

      <!-- Medium/Large view with video list -->
      <div v-else class="youtube-playlist-expanded">
        <div class="youtube-playlist-header">
          <div class="youtube-thumbnail-container" @click="openYouTube">
            <img 
              v-if="thumbnailUrl" 
              :src="thumbnailUrl" 
              :alt="content.title || 'YouTube playlist'" 
              class="youtube-thumbnail" 
            />
            <div class="youtube-playlist-badge">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 10h11v2H3v-2zm0-4h11v2H3V6zm0 8h7v2H3v-2zm13-1v8l6-4-6-4z"/>
              </svg>
              <span>{{ content.itemCount || 0 }}</span>
            </div>
          </div>
          <div class="youtube-playlist-info">
            <h3 class="youtube-title">{{ content.title || 'Untitled Playlist' }}</h3>
            <p class="youtube-channel">{{ content.channelTitle || 'Unknown Channel' }}</p>
          </div>
        </div>
        
        <div v-if="content.playlistItems && content.playlistItems.length > 0" class="youtube-playlist-items">
          <div
            v-for="(item, index) in displayPlaylistItems"
            :key="item.videoId"
            class="youtube-playlist-item"
            @click="openVideo(item.videoId)"
          >
            <div class="youtube-item-thumbnail">
              <img 
                :src="item.thumbnails?.default?.url || item.thumbnails?.medium?.url" 
                :alt="item.title"
              />
              <span class="youtube-item-number">{{ index + 1 }}</span>
            </div>
            <div class="youtube-item-info">
              <p class="youtube-item-title">{{ item.title }}</p>
              <p class="youtube-item-channel">{{ item.channelTitle }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Channel view -->
    <div v-else-if="isChannel" class="youtube-channel-layout">
      <!-- Compact view -->
      <div v-if="isCompact" class="youtube-compact">
        <div class="youtube-channel-avatar-container" @click="openYouTube">
          <img 
            v-if="channelAvatar" 
            :src="channelAvatar" 
            :alt="channelName" 
            class="youtube-channel-avatar-large" 
          />
        </div>
        <div class="youtube-info-compact">
          <p class="youtube-title">{{ channelName }}</p>
          <p class="youtube-channel" v-if="content.channelData?.subscriberCount">
            {{ formatNumber(content.channelData.subscriberCount) }} subscribers
          </p>
        </div>
      </div>

      <!-- Medium/Large view with recent videos -->
      <div v-else class="youtube-channel-expanded">
        <div class="youtube-channel-header">
          <img 
            v-if="channelAvatar" 
            :src="channelAvatar" 
            :alt="channelName" 
            class="youtube-channel-avatar-large" 
          />
          <div class="youtube-channel-info">
            <h3 class="youtube-channel-name">{{ channelName }}</h3>
            <div class="youtube-channel-stats">
              <span v-if="content.channelData?.subscriberCount">
                {{ formatNumber(content.channelData.subscriberCount) }} subscribers
              </span>
              <span v-if="content.channelData?.videoCount">
                {{ formatNumber(content.channelData.videoCount) }} videos
              </span>
            </div>
            <p v-if="content.channelData?.description" class="youtube-channel-description">
              {{ truncateDescription(content.channelData.description, 100) }}
            </p>
          </div>
        </div>

        <div v-if="content.recentVideos && content.recentVideos.length > 0" class="youtube-recent-videos">
          <h4 class="youtube-section-title">Recent uploads</h4>
          <div class="youtube-video-grid">
            <div
              v-for="video in displayRecentVideos"
              :key="video.videoId"
              class="youtube-video-card"
              @click="openVideo(video.videoId)"
            >
              <div class="youtube-video-thumbnail">
                <img 
                  :src="video.thumbnails?.medium?.url || video.thumbnails?.default?.url" 
                  :alt="video.title"
                />
              </div>
              <p class="youtube-video-title">{{ video.title }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, inject, onMounted, type ComputedRef } from "vue";
import { type YouTubeContent } from "@/types/TileContent";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import { useLayoutStore } from "@/stores/layout";

export default defineComponent({
  props: {
    content: {
      type: Object as () => YouTubeContent,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const gridTileH = inject<ComputedRef<number> | null>("gridTileH", null);
    const gridTileW = inject<ComputedRef<number> | null>("gridTileW", null);
    const tileId = inject<ComputedRef<string> | null>("tileId", null);

    const isLoading = ref(false);
    const hasError = ref(false);

    // Tile size detection for responsive layouts
    const isCompact = computed(() => {
      const w = gridTileW?.value ?? 2;
      const h = gridTileH?.value ?? 2;
      return (w <= 2 && h <= 2);
    });

    const isMedium = computed(() => {
      const w = gridTileW?.value ?? 2;
      const h = gridTileH?.value ?? 2;
      return !isCompact.value && (w < 4 || h < 4);
    });

    const sizeClass = computed(() => {
      if (isCompact.value) return "size-compact";
      if (isMedium.value) return "size-medium";
      return "size-large";
    });

    // Content type checks
    const isVideo = computed(() => props.content.youtubeType === "video");
    const isShort = computed(() => props.content.youtubeType === "short");
    const isPlaylist = computed(() => props.content.youtubeType === "playlist");
    const isChannel = computed(() => props.content.youtubeType === "channel");

    // Apply different styling classes based on content type
    const contentTypeClass = computed(() => {
      return `youtube-type-${props.content.youtubeType}`;
    });

    // Thumbnail selection based on tile size
    const thumbnailUrl = computed(() => {
      const thumbs = props.content.thumbnails;
      if (!thumbs) return "";
      
      const w = gridTileW?.value ?? 2;
      const h = gridTileH?.value ?? 2;
      
      // Use higher quality for larger tiles
      if (w >= 3 && h >= 3) {
        return thumbs.high || thumbs.medium || thumbs.default;
      } else if (w >= 2 || h >= 2) {
        return thumbs.medium || thumbs.default;
      }
      return thumbs.default || thumbs.medium;
    });

    // Channel avatar
    const channelAvatar = computed(() => {
      if (isChannel.value && props.content.channelData?.thumbnails) {
        return props.content.channelData.thumbnails.medium || 
               props.content.channelData.thumbnails.default;
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
      const h = gridTileH?.value ?? 3;
      const maxItems = Math.max(3, Math.floor((h - 1) * 2));
      return props.content.playlistItems.slice(0, maxItems);
    });

    // Display limited recent videos based on tile size
    const displayRecentVideos = computed(() => {
      if (!props.content.recentVideos) return [];
      const w = gridTileW?.value ?? 3;
      const h = gridTileH?.value ?? 3;
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
        if (tileId?.value) {
          console.log("Patching tile content for tile:", tileId.value);
          layoutStore.patchTileContent(tileId.value, data);
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
      isLoading,
      hasError,
      isCompact,
      isMedium,
      sizeClass,
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
.youtube-content {
  width: 100%;
  height: 100%;
  padding: var(--tile-padding);
  display: flex;
  flex-direction: column;
  background: var(--color-tile-background);
  border-radius: var(--tile-border-radius);
  overflow: hidden;
  color: var(--color-text-primary);
}

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
}

.retry-btn:hover {
  background: var(--color-content-high);
}

/* Thumbnail container */
.youtube-thumbnail-container {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-content-low);
  cursor: pointer;
  flex-shrink: 0;
}

.youtube-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.youtube-play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.9;
  transition: opacity 0.2s;
}

.youtube-thumbnail-container:hover .youtube-play-overlay {
  opacity: 1;
}

.youtube-duration-badge {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
}

.youtube-playlist-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Shorts badge - distinctive red/pink styling */
.youtube-shorts-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: linear-gradient(135deg, #ff0000, #ff4444);
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 4px rgba(255, 0, 0, 0.3);
}

/* Shorts - vertical aspect ratio for thumbnails */
.youtube-type-short .youtube-thumbnail-container {
  aspect-ratio: 9/16;
  max-width: 60%;
  margin: 0 auto;
}

.youtube-type-short.size-compact .youtube-thumbnail-container {
  max-width: 100%;
}

/* Playlist - distinctive border color */
.youtube-type-playlist .youtube-content {
  border-left: 3px solid #065fd4;
}

.youtube-type-playlist .youtube-playlist-badge {
  background: linear-gradient(135deg, #065fd4, #1c7ed6);
}

/* Channel - distinctive border color */
.youtube-type-channel .youtube-content {
  border-left: 3px solid #ff6b00;
}

/* Compact layout */
.youtube-compact {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

.youtube-info-compact {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.youtube-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.youtube-channel {
  font-size: 11px;
  color: var(--color-content-high);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Medium layout */
.youtube-medium {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.youtube-info-medium {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.youtube-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.youtube-channel-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.youtube-channel-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex-shrink: 0;
}

.youtube-stats {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--color-content-high);
}

/* Large layout */
.youtube-large {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.youtube-info-large {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.youtube-title-large {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.youtube-channel-info {
  display: flex;
  flex-direction: column;
}

.youtube-channel-name {
  font-size: 13px;
  font-weight: 600;
}

.youtube-stats-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.youtube-stat {
  font-size: 12px;
  color: var(--color-content-high);
}

.youtube-description {
  font-size: 12px;
  line-height: 1.4;
  color: var(--color-content-high);
  margin: 0;
}

/* Playlist layouts */
.youtube-playlist-expanded {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.youtube-playlist-header {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.size-medium .youtube-playlist-header,
.size-large .youtube-playlist-header {
  .youtube-thumbnail-container {
    width: 160px;
    flex-shrink: 0;
  }
}

.youtube-playlist-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.youtube-playlist-items {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.youtube-playlist-item {
  display: flex;
  gap: 10px;
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.youtube-playlist-item:hover {
  background: var(--color-content-low);
}

.youtube-item-thumbnail {
  position: relative;
  width: 120px;
  aspect-ratio: 16/9;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-content-low);
}

.youtube-item-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.youtube-item-number {
  position: absolute;
  top: 4px;
  left: 4px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
}

.youtube-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.youtube-item-title {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.youtube-item-channel {
  font-size: 11px;
  color: var(--color-content-high);
  margin: 0;
}

/* Channel layouts */
.youtube-channel-avatar-container {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.youtube-channel-avatar-large {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
}

.youtube-channel-expanded {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.youtube-channel-header {
  display: flex;
  gap: 16px;
  flex-shrink: 0;
}

.youtube-channel-header .youtube-channel-avatar-large {
  width: 88px;
  height: 88px;
}

.youtube-channel-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--color-content-high);
  margin-top: 4px;
}

.youtube-channel-description {
  font-size: 12px;
  line-height: 1.4;
  color: var(--color-content-high);
  margin: 8px 0 0 0;
}

.youtube-recent-videos {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.youtube-section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
}

.youtube-video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  overflow-y: auto;
}

.youtube-video-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.youtube-video-card:hover {
  transform: translateY(-2px);
}

.youtube-video-thumbnail {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-content-low);
  margin-bottom: 6px;
}

.youtube-video-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.youtube-video-title {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
