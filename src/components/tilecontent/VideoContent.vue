<template>
  <!-- Crop Mode Overlay -->
  <div v-if="isEditing" class="crop-overlay" @click.stop="toggleEditMode"></div>
  
  <div class="video-container" :class="{ 'crop-mode': isEditing }" ref="videoWrapper">
    <div v-if="!content.src" class="spinner"></div>
    <div v-else class="video-wrapper">
      <video
        ref="videoElement"
        :src="content.src"
        class="video"
        :style="videoStyle"
        draggable="false"
        @mousedown="startDragging"
        @mouseup="stopDragging"
        @mouseleave="stopDragging"
        @mousemove="dragVideo"
        @wheel.prevent="handleWheel"
        @loadedmetadata="onVideoLoaded"
        @timeupdate="onTimeUpdate"
        @click="togglePlayPause"
      ></video>
      
      <!-- Center Play Button -->
      <div class="center-controls" v-if="!isEditing">
        <button class="center-play-btn" @click.stop="togglePlayPause">
          <svg v-if="isPlaying" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
      </div>
      
      <!-- Bottom Control Bar -->
      <div class="bottom-controls" v-if="!isEditing">
        <div class="time-bar">
          <span class="time-display">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
        </div>
        
        <div class="progress-container" @click="seek">
          <div class="progress-bar">
            <div class="progress-filled" :style="{ width: progressPercent + '%' }"></div>
          </div>
        </div>
        
        <div class="control-row">
          <div class="right-controls">
            <div class="volume-control">
              <div class="volume-slider-container">
                <input 
                  type="range" 
                  class="volume-slider" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  v-model.number="volume"
                  @input="updateVolume"
                  orient="vertical"
                />
              </div>
              <button class="control-btn volume" @click.stop="toggleMute">
                <svg v-if="isMuted || volume === 0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
                <svg v-else-if="volume < 0.1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 9v6h4l5 5V4l-5 5H7z"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              </button>
            </div>
            
            <button class="control-btn fullscreen" @click.stop="toggleFullscreen">
              <svg v-if="isFullscreen" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Crop Mode Controls -->
    <div v-if="isEditing" class="crop-controls" @mousedown.stop>
      <div class="crop-controls-content">
        <input 
          type="range" 
          min="1" 
          max="3" 
          step="0.1" 
          v-model.number="zoom"
          @input="updateZoom"
        />
        <span>{{ Math.round(zoom * 100) }}%</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from "vue";
import { type VideoContent } from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";

export default defineComponent({
  props: {
    content: {
      type: Object as () => VideoContent,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const isEditing = ref(false);
    const isDragging = ref(false);
    const dragStart = ref({ x: 0, y: 0 });
    const offsetX = ref(props.content.offsetX || 0);
    const offsetY = ref(props.content.offsetY || 0);
    const zoom = ref(props.content.zoom || 1);

    const videoWrapper = ref<HTMLDivElement | null>(null);
    const videoElement = ref<HTMLVideoElement | null>(null);
    
    // Video control state
    const isPlaying = ref(false);
    const currentTime = ref(0);
    const duration = ref(0);
    const volume = ref(1);
    const isMuted = ref(false);
    const isFullscreen = ref(false);
    const progressPercent = ref(0);

    // Toggle crop mode
    const toggleEditMode = () => {
      if (!layoutStore.isOwner) return;

      isEditing.value = !isEditing.value;

      // Save when exiting crop mode
      if (!isEditing.value) {
        props.content.offsetX = offsetX.value;
        props.content.offsetY = offsetY.value;
        props.content.zoom = zoom.value;
        layoutStore.saveLayout();
      }
    };

    const updateZoom = () => {
      constrainOffset();
    };

    const constrainOffset = () => {
      const wrapper = videoWrapper.value;
      if (!wrapper) return;

      const containerWidth = wrapper.clientWidth;
      const containerHeight = wrapper.clientHeight;
      const videoWidth = containerWidth * zoom.value;
      const videoHeight = containerHeight * zoom.value;

      const maxX = Math.max(0, (videoWidth - containerWidth) / 2);
      const maxY = Math.max(0, (videoHeight - containerHeight) / 2);

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

    const handleWheel = (event: WheelEvent) => {
      if (!isEditing.value) return;
      
      const delta = -event.deltaY * 0.001;
      zoom.value = Math.min(3, Math.max(1, zoom.value + delta));
      constrainOffset();
    };

    const videoStyle = computed(() => ({
      transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${zoom.value})`,
      width: "100%",
      height: "100%",
      cursor: isEditing.value ? "grab" : "default",
    }));
    
    // Video control methods
    const togglePlayPause = () => {
      if (!videoElement.value) return;
      
      if (isPlaying.value) {
        videoElement.value.pause();
        isPlaying.value = false;
      } else {
        videoElement.value.play();
        isPlaying.value = true;
      }
    };
    
    const onVideoLoaded = () => {
      if (videoElement.value) {
        duration.value = videoElement.value.duration;
        volume.value = videoElement.value.volume;
      }
    };
    
    const onTimeUpdate = () => {
      if (videoElement.value) {
        currentTime.value = videoElement.value.currentTime;
        progressPercent.value = (currentTime.value / duration.value) * 100;
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
    };
    
    const updateVolume = () => {
      if (videoElement.value) {
        videoElement.value.volume = volume.value;
        isMuted.value = volume.value === 0;
      }
    };
    
    const toggleMute = () => {
      if (!videoElement.value) return;
      
      if (isMuted.value) {
        videoElement.value.volume = volume.value > 0 ? volume.value : 0.5;
        volume.value = videoElement.value.volume;
        isMuted.value = false;
      } else {
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
      if (isNaN(seconds)) return '0:00';
      
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return {
      layoutStore,
      isEditing,
      toggleEditMode,
      startDragging,
      stopDragging,
      dragVideo,
      handleWheel,
      videoStyle,
      videoWrapper,
      videoElement,
      zoom,
      updateZoom,
      // Video controls
      isPlaying,
      currentTime,
      duration,
      volume,
      isMuted,
      isFullscreen,
      progressPercent,
      togglePlayPause,
      onVideoLoaded,
      onTimeUpdate,
      seek,
      updateVolume,
      toggleMute,
      toggleFullscreen,
      formatTime,
    };
  },
});
</script>

<style scoped lang="scss">
.crop-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  z-index: 998;
  cursor: pointer;
}

.video-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  
  &.crop-mode {
    position: fixed;
    inset: 0;
    z-index: 999;
    width: auto;
    height: auto;
    overflow: visible;
  }
}

.video-wrapper {
  border-radius: 8px;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  
  .crop-mode & {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0;
  }
}

.video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  max-width: none;
  max-height: none;
  user-select: none;
  transform-origin: center;
  transition: transform 0.1s ease-out;
  
  .crop-mode & {
    position: relative;
    width: auto;
    height: 80vh;
    max-width: 90vw;
    object-fit: contain;
  }
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
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  padding: 12px 16px;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 10;
}

.video-wrapper:hover .bottom-controls {
  opacity: 1;
}

.time-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 4px;
}

.progress-container {
  width: 100%;
  cursor: pointer;
  padding: 8px 0;
  margin-bottom: 8px;
}

.progress-bar {
  width: 100%;
  height: 5px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.progress-filled {
  height: 100%;
  background: white;
  border-radius: 3px;
  transition: width 0.1s linear;
}

.control-row {
  display: flex;
  margin: 4px;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.time-display {
  color: white;
  font-size: 13px;
  font-family: monospace;
  white-space: nowrap;
  user-select: none;
}

.right-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
  user-select: none;
}

.control-btn svg {
  width: 18px;
  height: 18px;
}

.control-btn:hover {
  transform: scale(1.1);
}

.control-btn:active {
  transform: scale(0.95);
}

/* Volume Control */
.volume-control {
  position: relative;
  display: flex;
  align-items: center;
}

.volume-slider-container {
  position: absolute;
  bottom: calc(100% - 8px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-tile-background);
  border: 2px solid var(--color-tile-stroke);
  border-radius: 8px;
  padding: 4px 8px;
  width: 24px;
  height: 100px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.volume-control:hover .volume-slider-container,
.volume-slider-container:hover {
  opacity: 1;
  pointer-events: all;
}

.volume-slider {
  width: 80px;
  height: 20px;
  cursor: pointer;
  accent-color: var(--color-text-primary);
  transform: rotate(-90deg);
  transform-origin: center;
  background: transparent;
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
  padding: 0;
}

.volume-slider::-webkit-slider-track {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-text-primary);
  cursor: pointer;
}

.volume-slider::-moz-range-track {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.volume-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: white;
  cursor: pointer;
  border: none;
}

/* Crop Mode Controls */
.crop-controls {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background: var(--color-tile-background);
  border: 2px solid var(--color-tile-stroke);
  border-radius: 12px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 20px;
  backdrop-filter: blur(20px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.crop-controls-content {
  display: flex;
  align-items: center;
  gap: 12px;
  
  label {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-primary);
    margin: 0;
  }
  
  input[type="range"] {
    width: 200px;
    height: 6px;
    border-radius: 3px;
    background: var(--color-content-low);
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    
    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--color-text-primary);
      cursor: pointer;
    }
    
    &::-moz-range-thumb {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--color-text-primary);
      cursor: pointer;
      border: none;
    }
  }
  
  span {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
  }
}

.crop-done-btn {
  background: var(--color-text-primary);
  color: var(--color-tile-background);
  border: none;
  border-radius: 8px;
  padding: 8px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease;
  
  &:hover {
    transform: scale(1.05);
    opacity: 0.9;
  }
  
  &:active {
    transform: scale(0.98);
  }
}
</style>
