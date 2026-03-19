<template>
  <div
    class="video-container"
    ref="videoWrapper"
    @mouseenter="onTileMouseEnter"
    @mouseleave="onTileMouseLeave"
  >
    <div v-if="!content.src" class="spinner"></div>
    <div
      v-else
      class="video-wrapper"
      :class="{
        'crop-active': isEditing,
        'is-narrow': isNarrow,
        'is-medium': isMedium,
        'is-tiny': isTiny,
      }"
      @mousedown="startDragging"
      @mouseup="stopDragging"
      @mouseleave="stopDragging"
      @mousemove="dragVideo"
    >
      <!-- Dimmed overflow layer - full video at reduced opacity -->
      <video
        v-if="isEditing"
        ref="videoOverflowElement"
        :src="content.src"
        class="video video-overflow"
        :style="videoStyle"
        draggable="false"
        muted
      ></video>

      <!-- Main layer - full opacity, clipped to tile boundaries -->
      <div class="video-clip-container">
        <video
          ref="videoElement"
          :src="content.src"
          class="video video-main"
          :style="videoStyle"
          draggable="false"
          muted
          playsinline
          @loadedmetadata="onVideoLoaded"
          @timeupdate="onTimeUpdate"
          @ended="onVideoEnded"
          @click="onVideoClick"
        ></video>
        <div
          v-if="overlayColor"
          class="video-color-overlay"
          :style="{ backgroundColor: overlayColor }"
          aria-hidden="true"
        />
      </div>

      <!-- Center Play / Replay Button -->
      <div class="center-controls" v-if="!isEditing">
        <button
          class="center-play-btn"
          :class="{ 'show-replay': videoEnded }"
          @click.stop="onVideoClick"
        >
          <svg v-if="videoEnded" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
            />
          </svg>
          <svg
            v-else-if="!isPlaying && playbackMode === 'playing'"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        </button>
      </div>

      <!-- Upload progress overlay - shown while file is uploading to Firebase -->
      <div v-if="isUploading" class="upload-overlay">
        <div class="upload-progress-track">
          <div
            class="upload-progress-fill"
            :style="{ width: `${uploadPercent}%` }"
          ></div>
        </div>
      </div>

      <!-- Link indicator -->
      <div
        v-if="tileLinkExists && !isFullscreen"
        class="tile-link-indicator"
        aria-hidden="true"
        @click.stop="handleFollowLink"
      >
        <LinkIndicatorIcon class="tile-link-indicator-icon" />
      </div>

      <!-- Bottom Control Bar -->
      <div class="bottom-controls" v-if="!isEditing">
        <div class="controls-row">
          <!-- Mute/Unmute (hidden in 1x1) -->
          <div
            v-if="!isTiny"
            class="volume-control"
            @mouseleave="onVolumeMouseLeave"
          >
            <button class="control-btn mute-btn" @click.stop="toggleMute">
              <svg
                v-if="isMuted || volume === 0"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"
                />
              </svg>
              <svg
                v-else-if="volume < 0.1"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M7 9v6h4l5 5V4l-5 5H7z" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
                />
              </svg>
            </button>

            <!-- Volume slider — shown on mute hover, replaces time -->
            <div class="volume-slider-container">
              <input
                type="range"
                class="volume-slider"
                min="0"
                max="1"
                step="0.01"
                :value="volume"
                @input="onVolumeInput"
                @mousedown.stop
                @pointerdown.stop
              />
            </div>
          </div>

          <!-- Time display — hidden when volume slider is showing, hidden in 1x1 -->
          <div v-if="!isTiny" class="time-display">
            <span class="time-current">{{ formatTime(currentTime) }}</span>
            <span class="time-sep">/</span>
            <span class="time-total">{{ formatTime(duration) }}</span>
          </div>

          <!-- Fullscreen -->
          <button class="control-btn fullscreen" @click.stop="toggleFullscreen">
            <svg v-if="isFullscreen" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"
              />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"
              />
            </svg>
          </button>
        </div>
        <div v-if="!isTiny" class="progress-container" @click="seek">
          <div class="progress-bar">
            <div
              class="progress-filled"
              :style="{ width: progressPercent + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <AddLinkModal
    :show="showLinkModal"
    @close="closeLinkModal"
    @add="handleAddLink"
  />
</template>

<script lang="ts">
import {
  defineComponent,
  ref,
  computed,
  onMounted,
  onUnmounted,
  watch,
  inject,
  type ComputedRef,
} from "vue";
import { type VideoContent } from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";
import { useVideoFocus } from "@/composables/useVideoFocus";
import { useColorPicker } from "@/composables/useColorPicker";
import { useTileLink } from "@/composables/useTileLink";
import AddLinkModal from "../AddLinkModal.vue";
import LinkIndicatorIcon from "../icons/LinkIndicatorIcon.vue";

const PREVIEW_DURATION = 3;
const DEFAULT_VOLUME = 0.15;

export default defineComponent({
  components: {
    AddLinkModal,
    LinkIndicatorIcon,
  },
  emits: ["background-color-change", "text-color-change"],
  props: {
    content: {
      type: Object as () => VideoContent,
      required: true,
    },
  },
  setup(props, { emit }) {
    const layoutStore = useLayoutStore();
    const videoFocus = useVideoFocus();

    // Injected tile position and size from GridTile
    const tileId = inject<string>("tileId", "");
    const tileX = inject<ComputedRef<number>>(
      "tileX",
      computed(() => 0),
    );
    const tileY = inject<ComputedRef<number>>(
      "tileY",
      computed(() => 0),
    );
    const gridTileW = inject<ComputedRef<number>>(
      "gridTileW",
      computed(() => 2),
    );
    const gridTileH = inject<ComputedRef<number>>(
      "gridTileH",
      computed(() => 2),
    );

    // Tile is 1 column wide — use stacked/narrow layout
    const isNarrow = computed(() => gridTileW.value === 1);
    // Tile is 2 columns wide — time hides fully on volume hover
    const isMedium = computed(() => gridTileW.value === 2);
    // Tile is 1x1 — minimal controls only (pause + fullscreen)
    const isTiny = computed(
      () => gridTileW.value === 1 && gridTileH.value === 1,
    );

    // Upload progress tracking — injected tile ID lets us look up our upload state
    const isUploading = computed(() => {
      return (
        tileId != null && tileId !== "" && tileId in layoutStore.uploadingTiles
      );
    });
    const uploadPercent = computed(() => {
      if (!tileId) return 0;
      const progress = layoutStore.uploadingTiles[tileId] ?? 0;
      return Math.round(progress * 100);
    });

    const isEditing = ref(false);
    const isDragging = ref(false);
    const dragStart = ref({ x: 0, y: 0 });
    const offsetX = ref(props.content.offsetX || 0);
    const offsetY = ref(props.content.offsetY || 0);

    const videoWrapper = ref<HTMLDivElement | null>(null);
    const videoElement = ref<HTMLVideoElement | null>(null);
    const videoOverflowElement = ref<HTMLVideoElement | null>(null);

    // Track dimensions for future features
    const videoDimensions = ref({ width: 0, height: 0, aspectRatio: 0 });
    const tileDimensions = ref({ width: 0, height: 0, aspectRatio: 0 });
    const resizeObserver = ref<ResizeObserver | null>(null);

    const updateTileDimensions = () => {
      if (!videoWrapper.value) return;
      const width = videoWrapper.value.clientWidth;
      const height = videoWrapper.value.clientHeight;
      tileDimensions.value = {
        width,
        height,
        aspectRatio: width && height ? width / height : 0,
      };
    };

    // Video control state
    const isPlaying = ref(false);
    const currentTime = ref(0);
    const duration = ref(0);
    const volume = ref(DEFAULT_VOLUME);
    const isMuted = ref(true);
    const isFullscreen = ref(false);
    const progressPercent = ref(0);
    const playbackMode = ref<"idle" | "preview" | "playing">("idle");
    const savedVolume = ref(DEFAULT_VOLUME);
    const videoEnded = ref(false);

    // Toggle crop mode
    const toggleEditMode = () => {
      if (!layoutStore.canEdit) return;

      isEditing.value = !isEditing.value;

      // Prevent horizontal scrolling when in crop mode
      if (isEditing.value) {
        document.body.style.overflowX = "hidden";
      } else {
        document.body.style.overflowX = "";
      }

      // Save when exiting crop mode
      if (!isEditing.value) {
        // Use patchTileContent to properly persist the offset changes to Firestore
        if (tileId && tileId !== "") {
          layoutStore.patchTileContent(tileId, {
            offsetX: offsetX.value,
            offsetY: offsetY.value,
          });
        }
      }
    };

    const constrainOffset = (force = false) => {
      const wrapper = videoWrapper.value;
      if (!wrapper || (!isEditing.value && !force)) return;

      // Don't constrain until video dimensions are loaded - prevents resetting saved offsets to 0
      if (
        videoDimensions.value.aspectRatio === 0 ||
        tileDimensions.value.aspectRatio === 0
      ) {
        return;
      }

      const containerWidth = wrapper.clientWidth;
      const containerHeight = wrapper.clientHeight;

      // Calculate actual rendered dimensions based on aspect ratio comparison
      let renderedWidth: number;
      let renderedHeight: number;

      if (
        videoDimensions.value.aspectRatio > tileDimensions.value.aspectRatio
      ) {
        // Video is wider - constrained by height
        renderedHeight = containerHeight;
        renderedWidth = renderedHeight * videoDimensions.value.aspectRatio;
      } else {
        // Video is taller - constrained by width
        renderedWidth = containerWidth;
        renderedHeight = renderedWidth / videoDimensions.value.aspectRatio;
      }

      // Max offset is half the difference between rendered video and container
      const maxX = Math.max(0, (renderedWidth - containerWidth) / 2);
      const maxY = Math.max(0, (renderedHeight - containerHeight) / 2);

      offsetX.value = Math.min(maxX, Math.max(-maxX, offsetX.value));
      offsetY.value = Math.min(maxY, Math.max(-maxY, offsetY.value));
    };

    const startDragging = (event: MouseEvent) => {
      if (!isEditing.value) return;
      isDragging.value = true;
      dragStart.value = { x: event.clientX, y: event.clientY };
    };

    const stopDragging = () => {
      isDragging.value = false;
    };

    const dragVideo = (event: MouseEvent) => {
      if (!isDragging.value || !isEditing.value) return;

      const deltaX = event.clientX - dragStart.value.x;
      const deltaY = event.clientY - dragStart.value.y;

      offsetX.value += deltaX;
      offsetY.value += deltaY;

      constrainOffset();

      dragStart.value = { x: event.clientX, y: event.clientY };
    };

    const videoStyle = computed(() => {
      const cursor = isEditing.value ? "grab" : "default";
      const baseTransform = `translate(-50%, -50%) translate(${offsetX.value}px, ${offsetY.value}px)`;

      if (
        videoDimensions.value.aspectRatio > 0 &&
        tileDimensions.value.aspectRatio > 0
      ) {
        if (
          videoDimensions.value.aspectRatio > tileDimensions.value.aspectRatio
        ) {
          return {
            transform: baseTransform,
            cursor,
            width: "auto",
            height: "100%",
          };
        }
        return {
          transform: baseTransform,
          cursor,
          width: "100%",
          height: "auto",
        };
      }

      return {
        transform: baseTransform,
        cursor,
        width: "100%",
        height: "100%",
      };
    });

    // ── Playback helpers ──

    const startPreview = () => {
      const vid = videoElement.value;
      if (!vid) return;
      playbackMode.value = "preview";
      vid.muted = true;
      isMuted.value = true;
      vid.currentTime = 0;
      vid.play().catch(() => {});
      isPlaying.value = true;
    };

    const enterPlayingMode = () => {
      const vid = videoElement.value;
      if (!vid) return;
      playbackMode.value = "playing";
      // Unmute and set to default volume
      vid.muted = false;
      vid.volume = savedVolume.value;
      volume.value = savedVolume.value;
      isMuted.value = false;
      // Continue from current position (don't restart)
      if (vid.paused) {
        vid.play().catch(() => {});
      }
      isPlaying.value = true;
    };

    const pauseVideo = () => {
      const vid = videoElement.value;
      if (!vid) return;
      vid.pause();
      isPlaying.value = false;
    };

    const onVideoClick = () => {
      if (isEditing.value) return;
      const vid = videoElement.value;
      if (!vid) return;

      // Replay from start
      if (videoEnded.value) {
        videoEnded.value = false;
        vid.currentTime = 0;
        vid.play().catch(() => {});
        isPlaying.value = true;
        return;
      }

      if (playbackMode.value === "playing") {
        // Normal toggle play/pause
        if (isPlaying.value) {
          pauseVideo();
        } else {
          vid.play().catch(() => {});
          isPlaying.value = true;
        }
      } else {
        // Preview or idle → pause (default action is pause)
        pauseVideo();
        playbackMode.value = "playing";
      }
    };

    // ── Focus handling (hover + scroll) ──

    const onTileMouseEnter = () => {
      if (tileId) videoFocus.setHovered(tileId);
    };

    const onTileMouseLeave = () => {
      videoFocus.setHovered(null);
    };

    // Watch the shared activeVideoId to start/stop preview
    watch(
      () => videoFocus.activeVideoId.value,
      (newActiveId) => {
        const isActive = newActiveId === tileId;

        if (isActive) {
          // Gained focus
          if (playbackMode.value === "playing") {
            // Resume user-initiated playback from where we paused
            const vid = videoElement.value;
            if (vid && vid.paused) {
              vid.play().catch(() => {});
              isPlaying.value = true;
            }
          } else {
            // Start or restart preview
            startPreview();
          }
        } else {
          // Lost focus — pause regardless of mode
          if (isPlaying.value) {
            pauseVideo();
          }
        }
      },
    );

    const onVideoLoaded = () => {
      if (videoElement.value) {
        duration.value = videoElement.value.duration;
        // Keep video muted on load
        videoElement.value.muted = true;
        videoElement.value.volume = DEFAULT_VOLUME;

        // Track video dimensions
        videoDimensions.value = {
          width: videoElement.value.videoWidth,
          height: videoElement.value.videoHeight,
          aspectRatio:
            videoElement.value.videoWidth / videoElement.value.videoHeight,
        };
      }
    };

    onMounted(() => {
      updateTileDimensions();

      if (videoWrapper.value && typeof ResizeObserver !== "undefined") {
        resizeObserver.value = new ResizeObserver(() => {
          updateTileDimensions();
          constrainOffset(true);
        });
        resizeObserver.value.observe(videoWrapper.value);
      }

      // Register with the video focus system
      if (tileId && videoWrapper.value) {
        videoFocus.register(
          tileId,
          tileX.value,
          tileY.value,
          videoWrapper.value,
        );
      }
    });

    onUnmounted(() => {
      resizeObserver.value?.disconnect();
      if (tileId) videoFocus.unregister(tileId);
    });

    // Keep focus system in sync if tile is repositioned
    watch([tileX, tileY], ([x, y]) => {
      if (tileId) videoFocus.updatePosition(tileId, x, y);
    });

    watch(videoDimensions, () => {
      constrainOffset(true);
    });

    const onTimeUpdate = () => {
      if (!videoElement.value) return;
      currentTime.value = videoElement.value.currentTime;
      progressPercent.value =
        duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0;

      // Preview loop: for videos longer than the preview window, loop back at PREVIEW_DURATION
      if (
        playbackMode.value === "preview" &&
        duration.value > PREVIEW_DURATION &&
        currentTime.value >= PREVIEW_DURATION
      ) {
        videoElement.value.currentTime = 0;
      }
    };

    const onVideoEnded = () => {
      if (playbackMode.value === "preview") {
        // Short videos (< PREVIEW_DURATION) reach their natural end – loop in preview mode
        const vid = videoElement.value;
        if (vid) {
          vid.currentTime = 0;
          vid.play().catch(() => {});
        }
      } else if (playbackMode.value === "playing") {
        // User-initiated playback finished — show replay icon
        isPlaying.value = false;
        videoEnded.value = true;
      }
    };

    const seek = (event: MouseEvent) => {
      if (!videoElement.value) return;

      const progressBar = event.currentTarget as HTMLElement;
      const rect = progressBar.getBoundingClientRect();
      const percent = (event.clientX - rect.left) / rect.width;
      const newTime = percent * duration.value;

      videoElement.value.currentTime = newTime;
      currentTime.value = newTime;

      // Seeking implies user intent — enter playing mode
      if (playbackMode.value !== "playing") {
        enterPlayingMode();
      }
    };

    const onVolumeInput = (event: Event) => {
      const target = event.target as HTMLInputElement;
      const val = parseFloat(target.value);
      volume.value = val;
      savedVolume.value = val > 0 ? val : DEFAULT_VOLUME;
      if (videoElement.value) {
        videoElement.value.volume = val;
        videoElement.value.muted = val === 0;
        isMuted.value = val === 0;
      }
    };

    const onVolumeMouseLeave = () => {
      // Blur the slider so :focus-within no longer keeps it visible
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };

    const toggleMute = () => {
      if (!videoElement.value) return;

      if (isMuted.value) {
        const vol = savedVolume.value > 0 ? savedVolume.value : DEFAULT_VOLUME;
        videoElement.value.muted = false;
        videoElement.value.volume = vol;
        volume.value = vol;
        isMuted.value = false;
      } else {
        savedVolume.value = volume.value > 0 ? volume.value : DEFAULT_VOLUME;
        videoElement.value.muted = true;
        videoElement.value.volume = 0;
        isMuted.value = true;
      }
    };

    const toggleFullscreen = () => {
      const container = videoWrapper.value;
      if (!container) return;

      if (!document.fullscreenElement) {
        container.requestFullscreen();
        isFullscreen.value = true;
      } else {
        document.exitFullscreen();
        isFullscreen.value = false;
      }
    };

    const formatTime = (seconds: number): string => {
      if (isNaN(seconds)) return "0:00";

      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    // Sync overflow video with main video
    watch([currentTime, isPlaying], () => {
      if (videoOverflowElement.value && videoElement.value) {
        videoOverflowElement.value.currentTime = videoElement.value.currentTime;

        if (isPlaying.value && videoOverflowElement.value.paused) {
          videoOverflowElement.value.play().catch(() => {});
        } else if (!isPlaying.value && !videoOverflowElement.value.paused) {
          videoOverflowElement.value.pause();
        }
      }
    });

    const { overlayColor, handleBackgroundColorChange } = useColorPicker(
      tileId,
      props.content,
      emit,
      "overlay",
    );

    const {
      showLinkModal,
      tileLinkExists,
      openUrlInput,
      closeLinkModal,
      handleAddLink,
      handleFollowLink,
      clearLink,
    } = useTileLink(tileId || null, props.content);

    return {
      layoutStore,
      isEditing,
      isUploading,
      uploadPercent,
      toggleEditMode,
      startDragging,
      stopDragging,
      dragVideo,
      videoStyle,
      videoWrapper,
      videoElement,
      videoOverflowElement,
      overlayColor,
      handleBackgroundColorChange,
      // Tile size
      isNarrow,
      isMedium,
      isTiny,
      // Video controls
      isPlaying,
      currentTime,
      duration,
      volume,
      isMuted,
      isFullscreen,
      progressPercent,
      playbackMode,
      videoEnded,
      onVideoClick,
      onVideoLoaded,
      onVideoEnded,
      onTimeUpdate,
      seek,
      onVolumeInput,
      onVolumeMouseLeave,
      toggleMute,
      toggleFullscreen,
      formatTime,
      onTileMouseEnter,
      onTileMouseLeave,
      videoDimensions,
      tileDimensions,
      showLinkModal,
      tileLinkExists,
      openUrlInput,
      closeLinkModal,
      handleAddLink,
      handleFollowLink,
      clearLink,
    };
  },
});
</script>

<style scoped lang="scss">
.video-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.video-wrapper {
  border-radius: 8px;
  position: relative;
  width: 100%;
  height: 100%;
}

.video {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--tile-border-radius);
  user-select: none;
  transform-origin: center;
}

/* Overflow layer - dimmed, shown only in crop mode */
.video-overflow {
  opacity: 0.4;
  z-index: 0;
}

/* Clipping container - constrains main video to tile boundaries */
.video-clip-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: var(--tile-border-radius);
  z-index: 2;
}

/* Color blend overlay - applied on top of video when a chromatic color is selected */
.video-color-overlay {
  position: absolute;
  inset: 0;
  mix-blend-mode: color;
  pointer-events: none;
  border-radius: var(--tile-border-radius);
}

/* Upload progress overlay — sits on top of the video preview during background upload */
.upload-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 0px;
  pointer-events: none;
  /* Subtle darkening so the progress bar is visible over any video */
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.35) 0%,
    transparent 40%
  );
  border-radius: var(--tile-border-radius);
}

.upload-progress-track {
  width: 100%;
  max-width: 200px;
  height: 4px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 2px;
  overflow: hidden;
}

.upload-progress-fill {
  height: 100%;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 2px;
  transition: width 0.2s ease-out;
}

/* Center Play Button */
.center-controls {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 5;
  pointer-events: none;
}

.center-play-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  pointer-events: all;
  user-select: none;
  opacity: 0;
}

.center-play-btn svg {
  width: 80px;
  height: 80px;
}

/* Smaller center button for narrow tiles */
.is-narrow .center-play-btn svg {
  width: 48px;
  height: 48px;
}

/* Even smaller for tiny tiles */
.is-tiny .center-play-btn svg {
  width: 36px;
  height: 36px;
}

/* Narrow (1xN): hide center button when volume control is hovered */
.is-narrow:has(.volume-control:hover) .center-play-btn {
  opacity: 0 !important;
  pointer-events: none;
}

/* Replay icon stays visible without hover */
.center-play-btn.show-replay {
  opacity: 1;
}

.video-wrapper:hover .center-play-btn {
  opacity: 1;
}

.center-play-btn:hover {
  color: rgba(255, 255, 255, 0.9);
  transform: scale(1.1);
}

.center-play-btn:active {
  transform: scale(0.95);
}

/* Bottom Control Bar */
.bottom-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  pointer-events: none;
}

.controls-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  padding: 2px 6px;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

/* Narrow (1xN): stack controls vertically, centered */
.is-narrow .controls-row {
  flex-direction: column;
  justify-content: center;
  gap: 0;
  padding: 2px 4px;
}

.video-wrapper:hover .controls-row {
  opacity: 1;
  pointer-events: all;
}

.progress-container {
  width: 100%;
  cursor: pointer;
  padding: 4px 0 0;
  pointer-events: all;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.video-wrapper:hover .progress-container {
  opacity: 1;
}

.progress-bar {
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
  transition: height 0.15s ease;
}

.video-wrapper:hover .progress-bar {
  height: 5px;
}

.progress-filled {
  height: 100%;
  background: white;
  border-radius: 2px;
  transition: width 0.1s linear;
}

/* Time display — fills middle, hidden when volume slider is open */
.time-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
  min-width: 59px;
  max-width: 73px;
  flex: 1 1 auto;
  color: white;
  font-size: 11px;
  font-family: monospace;
  white-space: nowrap;
  user-select: none;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  transition: opacity 0.2s ease;
}

.time-current,
.time-sep,
.time-total {
  line-height: 1;
}

.time-sep {
  opacity: 0.6;
  margin: 0 1px;
}

/* Narrow (1xN): stack time vertically, wrap current+sep on one line, total below */
.is-narrow .time-display {
  flex-wrap: wrap;
  justify-content: center;
  min-width: unset;
  max-width: unset;
  gap: 0;
  font-size: 11px;
}

/* In narrow mode, when volume is hovered: hide current time + separator completely (no space) */
.is-narrow .volume-control:hover ~ .time-display .time-current,
.is-narrow .volume-control:hover ~ .time-display .time-sep,
.is-narrow .volume-control:focus-within ~ .time-display .time-current,
.is-narrow .volume-control:focus-within ~ .time-display .time-sep {
  display: none;
}

/* In narrow mode, don't hide the entire time-display — only current+sep */
.is-narrow .volume-control:hover ~ .time-display,
.is-narrow .volume-control:focus-within ~ .time-display {
  opacity: 1;
  pointer-events: auto;
}

.control-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 2px 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
  user-select: none;
  flex-shrink: 0;
}

.control-btn svg {
  width: 16px;
  height: 16px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

/* Larger control icons for narrow tiles */
.is-narrow .control-btn svg {
  width: 24px;
  height: 24px;
}

.control-btn:hover {
  transform: scale(1.1);
}

.control-btn:active {
  transform: scale(0.95);
}

/* Volume Control — mute btn + inline horizontal slider */
.volume-control {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* Narrow: stack volume control vertically so slider appears below mute icon */
.is-narrow .volume-control {
  flex-direction: column;
}

.volume-slider-container {
  overflow: hidden;
  max-width: 0;
  opacity: 0;
  transition:
    max-width 0.25s ease,
    opacity 0.2s ease;
  display: flex;
  align-items: center;
}

/* Narrow: slider expands vertically (max-height instead of max-width) */
.is-narrow .volume-slider-container {
  max-width: unset;
  max-height: 0;
  width: 100%;
  transition:
    max-height 0.25s ease,
    opacity 0.2s ease;
}

.volume-control:hover .volume-slider-container,
.volume-control:focus-within .volume-slider-container {
  max-width: 73px;
  opacity: 1;
}

.is-narrow .volume-control:hover .volume-slider-container,
.is-narrow .volume-control:focus-within .volume-slider-container {
  max-width: unset;
  max-height: 40px;
  opacity: 1;
}

.volume-slider {
  width: 100%;
  min-width: 59px;
  max-width: 73px;
  height: 16px;
  cursor: pointer;
  background: transparent;
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
  padding: 0;
}

.is-narrow .volume-slider {
  min-width: unset;
  max-width: unset;
  width: 100%;
}

.volume-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  margin-top: -3.5px;
}

.volume-slider::-moz-range-track {
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.volume-slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  border: none;
}

/* Link indicator */
.tile-link-indicator {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 24px;
  height: 24px;
  color: white;
  opacity: 0.21;
  transition: opacity var(--duration-fast) var(--easing-ease-in-out);
  pointer-events: auto;
  z-index: 11;
}

.video-wrapper .tile-link-indicator:hover {
  opacity: 1;
}

.tile-link-indicator:hover {
  cursor: pointer;
}

.tile-link-indicator-icon {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
