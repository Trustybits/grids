<template>
  <!-- Zoom Slider -->
  <div v-if="layoutStore.isOwner && isEditing" class="zoom-slider">
    <input type="range" min="1" max="2" step="0.1" v-model.number="content.zoom" @input="saveLayout" />
  </div>

  <div class="video-container" :class="{ editing: isEditing }" ref="videoWrapper">
    <div v-if="!content.src" class="spinner"></div>
    <div v-else class="video-wrapper" ref="videoWrapper">
      <video
        ref="videoElement"
        :src="content.src"
        class="video contained-video"
        :style="videoStyle"
        draggable="false"
        @mousedown="startDragging"
        @mouseup="stopDragging"
        @mouseleave="stopDragging"
        @mousemove="dragVideo"
        @loadedmetadata="onVideoLoaded"
        @timeupdate="onTimeUpdate"
        @click="togglePlayPause"
      ></video>
      
      <!-- Custom Video Controls -->
      <div class="custom-controls" v-if="!isEditing">
        <button class="control-btn play-pause" @click.stop="togglePlayPause">
          <span v-if="isPlaying">⏸</span>
          <span v-else>▶</span>
        </button>
        
        <div class="progress-container" @click="seek">
          <div class="progress-bar">
            <div class="progress-filled" :style="{ width: progressPercent + '%' }"></div>
          </div>
        </div>
        
        <span class="time-display">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
        
        <button class="control-btn volume" @click.stop="toggleMute">
          <span v-if="isMuted || volume === 0">🔇</span>
          <span v-else-if="volume < 0.5">🔉</span>
          <span v-else>🔊</span>
        </button>
        
        <input 
          type="range" 
          class="volume-slider" 
          min="0" 
          max="1" 
          step="0.01" 
          v-model.number="volume"
          @input="updateVolume"
        />
        
        <button class="control-btn fullscreen" @click.stop="toggleFullscreen">
          <span v-if="isFullscreen">⛶</span>
          <span v-else>⛶</span>
        </button>
      </div>
    </div>
    
    <video
      v-if="isEditing"
      :src="content.src"
      class="video full-video"
      :style="videoStyle"
      draggable="false"
    ></video>

    <!-- Edit Mode Button -->
    <button 
      v-if="layoutStore.isOwner"
      class="edit-button hover-display" 
      :style="{ display: isEditing ? 'flex' : '' }"
      @click="toggleEditMode"
    >
      {{ isEditing ? 'Done' : 'Edit' }}
    </button>
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
    const offset = ref({ x: props.content.offsetX || 0, y: props.content.offsetY || 0 });

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

    // Toggle edit mode
    const toggleEditMode = () => {
      if (!layoutStore.isOwner) {
        return;
      }

      isEditing.value = !isEditing.value;

      if (!isEditing.value) {
        props.content.offsetX = offset.value.x;
        props.content.offsetY = offset.value.y;
        layoutStore.saveLayout();
      }
    };

    // Save layout on zoom change
    const saveLayout = () => {
      const wrapper = videoWrapper.value;
      if (!wrapper) return;

      const containerWidth = wrapper.clientWidth;
      const containerHeight = wrapper.clientHeight;
      const zoomFactor = props.content.zoom || 1;
      const videoWidth = containerWidth * zoomFactor;
      const videoHeight = containerHeight * zoomFactor;

      // Calculate bounds for dragging
      const minX = Math.min(0, containerWidth - videoWidth);
      const maxX = 0;
      const minY = Math.min(0, containerHeight - videoHeight);
      const maxY = 0;

      offset.value.x = Math.min(maxX, Math.max(minX, offset.value.x) / 1.4);
      offset.value.y = Math.min(maxY, Math.max(minY, offset.value.y) / 1.4);

      props.content.offsetX = offset.value.x;
      props.content.offsetY = offset.value.y;
    };

    // Start dragging
    const startDragging = (event: MouseEvent) => {
      if (!isEditing.value) return;
      isDragging.value = true;
      dragStart.value = { x: event.clientX, y: event.clientY };
    };

    // Stop dragging
    const stopDragging = () => {
      isDragging.value = false;
    };

    // Drag the video
    const dragVideo = (event: MouseEvent) => {
      if (!isDragging.value || !isEditing.value) return;

      const deltaX = event.clientX - dragStart.value.x;
      const deltaY = event.clientY - dragStart.value.y;

      const wrapper = videoWrapper.value;
      if (!wrapper) return;

      const containerWidth = wrapper.clientWidth;
      const containerHeight = wrapper.clientHeight;
      const zoomFactor = props.content.zoom || 1;
      const videoWidth = containerWidth * zoomFactor;
      const videoHeight = containerHeight * zoomFactor;

      const minX = Math.min(0, containerWidth - videoWidth) / 2;
      const maxX = 0 - minX;
      const minY = Math.min(0, containerHeight - videoHeight) / 2;
      const maxY = 0 - minY;

      offset.value.x = Math.min(maxX, Math.max(minX, offset.value.x + deltaX));
      offset.value.y = Math.min(maxY, Math.max(minY, offset.value.y + deltaY));

      dragStart.value = { x: event.clientX, y: event.clientY };
    };

    // Computed style for the video
    const videoStyle = computed(() => ({
      transform: `translate(${offset.value.x}px, ${offset.value.y}px) scale(${props.content.zoom || 1})`,
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
      saveLayout,
      videoStyle,
      videoWrapper,
      videoElement,
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
.video-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.full-video {
  z-index: -1; 
  filter: brightness(50%);
  pointer-events: none;
}

.contained-video {
  z-index: 0;
}

.video-wrapper {
  border-radius: 8px;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.video {
  position: absolute;
  top: 0;
  left: 0;
  object-fit: cover;
  max-width: none;
  max-height: none;
  user-select: none;
}

.zoom-slider {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

.edit-button {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
}

/* Custom Video Controls */
.custom-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 10;
}

.video-wrapper:hover .custom-controls {
  opacity: 1;
}

.control-btn {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
  user-select: none;
}

.control-btn:hover {
  transform: scale(1.1);
}

.control-btn:active {
  transform: scale(0.95);
}

.progress-container {
  flex: 1;
  cursor: pointer;
  padding: 8px 0;
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

.time-display {
  color: white;
  font-size: 13px;
  font-family: monospace;
  white-space: nowrap;
  user-select: none;
}

.volume-slider {
  width: 80px;
  cursor: pointer;
  accent-color: white;
}

.volume-slider::-webkit-slider-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: white;
  cursor: pointer;
}

.volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: white;
  cursor: pointer;
  border: none;
}
</style>
