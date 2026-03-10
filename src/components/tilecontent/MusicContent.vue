<template>
  <div
    class="music-player"
    :class="[`tile-${effectiveTileSize}`, { 'tile-4x4--compact': compact4x4 }]"
    :style="{
      '--bg-base': bgBase,
      '--bg-tinted': bgTinted,
      '--text-subdued': txtSubdued,
      backgroundImage: `linear-gradient(138deg, ${bgBase} 4%, ${bgTinted} 95%)`,
    }"
  >
    <!-- Loading state -->
    <div v-if="isLoading" class="music-loading">
      <div class="music-spinner"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="hasError" class="music-error">
      <p>Failed to load track</p>
      <button @click="fetchMetadata" class="retry-btn">Retry</button>
    </div>

    <!-- Persistent audio + waveform canvas — never destroyed across layout changes -->
    <audio
      ref="audioEl"
      :src="content.previewUrl"
      crossorigin="anonymous"
      @ended="onEnded"
      @error="onAudioError"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
    />
    <div
      ref="canvasWrapEl"
      class="canvas-wrap canvas-wrap--hoisted"
      v-show="showWaveform"
    >
      <canvas ref="canvasEl" class="wave-canvas" />
    </div>

    <!-- ══════════════════════════════════════════════════════════
         1×1 layout: just the platform logo
         ══════════════════════════════════════════════════════════ -->
    <template v-if="!isLoading && !hasError && effectiveTileSize === '1x1'">
      <div class="header-row">
        <a :href="content.trackUrl" target="_blank" rel="noopener" class="platform-logo platform-logo--fill" :title="platformTitle">
          <!-- Spotify logo -->
          <svg v-if="content.platform === 'spotify'" viewBox="0 0 24 24" fill="white" width="100%" height="100%">
            <path d="M12.438 1.009C6.368.769 1.251 5.494 1.008 11.565c-.24 6.07 4.485 11.186 10.556 11.426 6.07.242 11.185-4.484 11.427-10.554S18.507 1.251 12.438 1.009m4.644 16.114a.657.657 0 0 1-.897.246 13.2 13.2 0 0 0-4.71-1.602 13.2 13.2 0 0 0-4.968.242.658.658 0 0 1-.31-1.278 14.5 14.5 0 0 1 5.46-.265c1.837.257 3.579.851 5.177 1.76.315.178.425.58.246.896zm1.445-2.887a.853.853 0 0 1-1.158.344 16.2 16.2 0 0 0-5.475-1.797 16.2 16.2 0 0 0-5.758.219.855.855 0 0 1-1.018-.65.85.85 0 0 1 .65-1.018 17.9 17.9 0 0 1 6.362-.241 17.9 17.9 0 0 1 6.049 1.985c.415.224.57.743.344 1.158zm1.602-3.255a1.05 1.05 0 0 1-1.418.448 19.7 19.7 0 0 0-6.341-2.025 19.6 19.6 0 0 0-6.655.199 1.05 1.05 0 1 1-.417-2.06 21.7 21.7 0 0 1 7.364-.22 21.7 21.7 0 0 1 7.019 2.24c.515.268.715.903.448 1.418" />
          </svg>
          <!-- Apple Music logo -->
          <svg v-else viewBox="0 0 24 24" fill="white" width="100%" height="100%">
            <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.073-.005-.146-.01-.22-.015H5.988c-.076.005-.152.01-.228.015-.5.032-1 .1-1.492.198-1.283.3-2.326 1.017-3.093 2.1A5.005 5.005 0 0 0 .5 4.07a9.23 9.23 0 0 0-.165 1.833c-.006.073-.01.147-.015.22v11.693c.005.076.01.152.015.228.032.5.1 1 .198 1.492.3 1.283 1.017 2.326 2.1 3.093.554.394 1.17.66 1.833.83.652.167 1.32.24 1.993.265.18.007.36.013.54.015h11.693c.076-.002.152-.008.228-.015.5-.032 1-.1 1.492-.198 1.283-.3 2.326-1.017 3.093-2.1.394-.554.66-1.17.83-1.833.167-.652.24-1.32.265-1.993.006-.073.01-.147.015-.22V6.344c-.005-.076-.01-.152-.015-.22zM17.52 17.9c0 .254-.065.404-.247.49-.03.015-.135.037-.198.037-.107 0-.216-.035-.352-.106a8.586 8.586 0 0 1-.905-.554 8.94 8.94 0 0 1-1.474-1.333 7.396 7.396 0 0 1-1.073-1.636 5.347 5.347 0 0 1-.4-1.136c-.07-.342-.1-.575-.1-.872v-5.04c0-.323.055-.6.19-.83a.72.72 0 0 1 .325-.29c.102-.05.23-.088.413-.12a6.274 6.274 0 0 1 .867-.083c.212-.007.382.005.57.052.155.04.275.113.37.222.1.112.16.244.19.405.023.127.032.247.032.38v4.31c0 .34.07.687.21 1.023.158.38.39.72.677 1.012.35.36.71.578 1.033.718.248.107.336.167.48.256.077.047.135.113.16.2.024.066.032.14.032.224v2.47zm-2.4-8.054c0 .287-.095.473-.262.578a1.08 1.08 0 0 1-.322.144l-.058.012c-.193.036-.392.057-.65.057a2.98 2.98 0 0 1-.452-.038 1.108 1.108 0 0 1-.415-.16.56.56 0 0 1-.203-.255c-.045-.114-.068-.247-.068-.402V5.59c0-.27.036-.493.118-.667.082-.175.206-.31.38-.404.144-.08.313-.138.508-.175.236-.046.485-.07.747-.07.142 0 .28.008.415.024.185.022.33.072.438.155a.55.55 0 0 1 .195.29c.03.098.046.216.046.355v4.75z"/>
          </svg>
        </a>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════
         2×2 layout: vinyl centered + play/mute at bottom
         ══════════════════════════════════════════════════════════ -->
    <template v-else-if="effectiveTileSize === '2x2'">
      <div class="header-row header-row--2x2">
        <div class="turntable-arm" :style="{ transform: `rotate(${armRotation}deg)` }">
          <img src="/assets/music/turntableArm.png" alt="" />
        </div>
        <div class="header-content header-content--2x2">
          <div class="record-inline">
            <img class="record-img" src="/assets/music/vinylRecord.png" alt="vinyl record" />
            <img class="record-label" :class="vinylPhase" :src="content.albumArt" :alt="content.trackName" />
            <img class="record-shimmer" :class="vinylPhase" src="/assets/music/vinylHighlightShimmer.png" alt="" />
          </div>
          <canvas ref="noteCanvasEl" class="note-canvas" />
          <a :href="content.trackUrl" target="_blank" rel="noopener" class="platform-logo platform-logo--corner" :title="platformTitle">
            <svg v-if="content.platform === 'spotify'" viewBox="0 0 24 24" width="24" height="24" fill="white">
              <path d="M12.438 1.009C6.368.769 1.251 5.494 1.008 11.565c-.24 6.07 4.485 11.186 10.556 11.426 6.07.242 11.185-4.484 11.427-10.554S18.507 1.251 12.438 1.009m4.644 16.114a.657.657 0 0 1-.897.246 13.2 13.2 0 0 0-4.71-1.602 13.2 13.2 0 0 0-4.968.242.658.658 0 0 1-.31-1.278 14.5 14.5 0 0 1 5.46-.265c1.837.257 3.579.851 5.177 1.76.315.178.425.58.246.896zm1.445-2.887a.853.853 0 0 1-1.158.344 16.2 16.2 0 0 0-5.475-1.797 16.2 16.2 0 0 0-5.758.219.855.855 0 0 1-1.018-.65.85.85 0 0 1 .65-1.018 17.9 17.9 0 0 1 6.362-.241 17.9 17.9 0 0 1 6.049 1.985c.415.224.57.743.344 1.158zm1.602-3.255a1.05 1.05 0 0 1-1.418.448 19.7 19.7 0 0 0-6.341-2.025 19.6 19.6 0 0 0-6.655.199 1.05 1.05 0 1 1-.417-2.06 21.7 21.7 0 0 1 7.364-.22 21.7 21.7 0 0 1 7.019 2.24c.515.268.715.903.448 1.418" />
            </svg>
            <svg v-else viewBox="0 0 24 24" width="24" height="24" fill="white">
              <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.073-.005-.146-.01-.22-.015H5.988c-.076.005-.152.01-.228.015-.5.032-1 .1-1.492.198-1.283.3-2.326 1.017-3.093 2.1A5.005 5.005 0 0 0 .5 4.07a9.23 9.23 0 0 0-.165 1.833c-.006.073-.01.147-.015.22v11.693c.005.076.01.152.015.228.032.5.1 1 .198 1.492.3 1.283 1.017 2.326 2.1 3.093.554.394 1.17.66 1.833.83.652.167 1.32.24 1.993.265.18.007.36.013.54.015h11.693c.076-.002.152-.008.228-.015.5-.032 1-.1 1.492-.198 1.283-.3 2.326-1.017 3.093-2.1.394-.554.66-1.17.83-1.833.167-.652.24-1.32.265-1.993.006-.073.01-.147.015-.22V6.344c-.005-.076-.01-.152-.015-.22zM17.52 17.9c0 .254-.065.404-.247.49-.03.015-.135.037-.198.037-.107 0-.216-.035-.352-.106a8.586 8.586 0 0 1-.905-.554 8.94 8.94 0 0 1-1.474-1.333 7.396 7.396 0 0 1-1.073-1.636 5.347 5.347 0 0 1-.4-1.136c-.07-.342-.1-.575-.1-.872v-5.04c0-.323.055-.6.19-.83a.72.72 0 0 1 .325-.29c.102-.05.23-.088.413-.12a6.274 6.274 0 0 1 .867-.083c.212-.007.382.005.57.052.155.04.275.113.37.222.1.112.16.244.19.405.023.127.032.247.032.38v4.31c0 .34.07.687.21 1.023.158.38.39.72.677 1.012.35.36.71.578 1.033.718.248.107.336.167.48.256.077.047.135.113.16.2.024.066.032.14.032.224v2.47zm-2.4-8.054c0 .287-.095.473-.262.578a1.08 1.08 0 0 1-.322.144l-.058.012c-.193.036-.392.057-.65.057a2.98 2.98 0 0 1-.452-.038 1.108 1.108 0 0 1-.415-.16.56.56 0 0 1-.203-.255c-.045-.114-.068-.247-.068-.402V5.59c0-.27.036-.493.118-.667.082-.175.206-.31.38-.404.144-.08.313-.138.508-.175.236-.046.485-.07.747-.07.142 0 .28.008.415.024.185.022.33.072.438.155a.55.55 0 0 1 .195.29c.03.098.046.216.046.355v4.75z"/>
            </svg>
          </a>
        </div>
      </div>

      <div class="controls-bar controls-bar--2x2">
        <button
          class="play-btn play-btn--small"
          :class="{ 'play-btn--disabled': !content.previewUrl }"
          :aria-label="isPlaying ? 'Pause' : 'Play'"
          :disabled="!content.previewUrl"
          @click="togglePlay"
        >
          <svg v-if="!isPlaying" viewBox="0 0 19 18.13" width="16" height="16" fill="currentColor">
            <path d="M17.4086 6.66543C19.5305 7.71151 19.5305 10.4194 17.4086 11.4654L4.59662 17.7814C2.53435 18.7981 0 17.4748 0 15.3814V2.74945C0 0.656047 2.53435 -0.667198 4.59661 0.349454L17.4086 6.66543Z"/>
          </svg>
          <svg v-else viewBox="0 0 18.56 18.2" width="16" height="16" fill="currentColor">
            <path d="M0 3.64C0 1.92 0 1.07.53.53 1.07 0 1.92 0 3.64 0s2.57 0 3.1.53c.54.54.54 1.39.54 3.11v10.92c0 1.71 0 2.57-.53 3.1-.53.53-1.39.53-3.1.53-1.72 0-2.58 0-3.11-.53C0 17.13 0 16.27 0 14.56V3.64z"/>
            <path d="M11.28 3.64c0-1.72 0-2.57.53-3.11C12.35 0 13.2 0 14.92 0c1.72 0 2.57 0 3.11.53.53.54.53 1.39.53 3.11v10.92c0 1.71 0 2.57-.53 3.1-.54.53-1.39.53-3.11.53-1.71 0-2.57 0-3.1-.53-.54-.53-.54-1.39-.54-3.1V3.64z"/>
          </svg>
        </button>
        <div class="volume-ctl-2x2" @mouseenter="onVolumeEnter" @mouseleave="onVolumeLeave">
          <div v-show="showVolume" class="vol-slider-vertical" @mouseenter="onVolumeEnter" @mouseleave="onVolumeLeave">
            <input type="range" class="volume-slider volume-slider--vertical" min="0" max="1" step="0.02"
              :value="isMuted ? 0 : volume" :style="{ '--fill': `${(isMuted ? 0 : volume) * 100}%` }"
              aria-label="Volume" @input="onVolumeInput"
              @pointerdown.stop @mousedown.stop @touchstart.stop />
          </div>
          <button class="icon-btn" :aria-label="isMuted ? 'Unmute' : 'Mute'" @click="toggleMute">
            <svg v-if="volumeIcon === 'mute'" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.00397 11.7232C1.05352 9.88098 1.07829 9.42378 1.8904 8.17135C2.03863 7.94274 2.25612 7.67114 2.4384 7.48695C3.43709 6.47784 3.83215 6.47784 5.34839 6.47784C6.39822 6.47784 6.8924 6.51928 7.46364 6.42767C7.63565 6.40008 7.73323 6.36417 7.83478 6.32423C8.52497 6.11734 8.50539 5.77614 9.48654 5.02461C12.0984 3.024 14.2065 2.72923 15.4347 3.19847C15.6286 3.27257 15.8078 3.37138 15.9636 3.5489C16.7768 4.47484 16.8386 6.49447 16.9621 9.45309C17.0079 10.5486 17.0391 11.4862 17.0391 12.0077C17.0391 12.5292 17.0079 13.4668 16.9621 14.5623C16.8386 17.5209 16.7848 19.5153 15.9636 20.4414C15.7994 20.6267 15.6375 20.699 15.4458 20.7764C14.2065 21.2764 12.1123 21.0195 9.50043 19.0033C8.53038 18.2545 8.5233 17.8833 7.83329 17.5905C7.73004 17.5467 7.631 17.4923 7.46489 17.477C6.90758 17.4256 6.39822 17.477 5.34839 17.477C3.83215 17.477 3.52734 17.4727 2.43359 16.5039C2.21765 16.3126 2.03557 16.0764 1.8904 15.8441C1.04297 14.4883 1.05352 14.1344 1.00397 12.2922C1.00136 12.1955 1 12.1005 1 12.0077C1 11.9149 1.00136 11.8199 1.00397 11.7232Z"/>
              <path d="M22.2583 9.38876L18.4326 14.5975M18.4328 9.38869L22.2583 14.5975" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
            </svg>
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.00397 11.7232C1.05352 9.88098 1.07829 9.42378 1.8904 8.17135C2.03863 7.94274 2.25612 7.67114 2.4384 7.48695C3.43709 6.47784 3.83215 6.47784 5.34839 6.47784C6.39822 6.47784 6.8924 6.51928 7.46364 6.42767C7.63565 6.40008 7.73323 6.36417 7.83478 6.32423C8.52497 6.11734 8.50539 5.77614 9.48654 5.02461C12.0984 3.024 14.2065 2.72923 15.4347 3.19847C15.6286 3.27257 15.8078 3.37138 15.9636 3.5489C16.7768 4.47484 16.8386 6.49447 16.9621 9.45309C17.0079 10.5486 17.0391 11.4862 17.0391 12.0077C17.0391 12.5292 17.0079 13.4668 16.9621 14.5623C16.8386 17.5209 16.7848 19.5153 15.9636 20.4414C15.7994 20.6267 15.6375 20.699 15.4458 20.7764C14.2065 21.2764 12.1123 21.0195 9.50043 19.0033C8.53038 18.2545 8.5233 17.8833 7.83329 17.5905C7.73004 17.5467 7.631 17.4923 7.46489 17.477C6.90758 17.4256 6.39822 17.477 5.34839 17.477C3.83215 17.477 3.52734 17.4727 2.43359 16.5039C2.21765 16.3126 2.03557 16.0764 1.8904 15.8441C1.04297 14.4883 1.05352 14.1344 1.00397 12.2922C1.00136 12.1955 1 12.1005 1 12.0077C1 11.9149 1.00136 11.8199 1.00397 11.7232Z"/>
            </svg>
          </button>
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════
         2×N layout: vertical vinyl player (height-adaptive)
         ══════════════════════════════════════════════════════════ -->
    <template v-else-if="effectiveTileSize === '2xN'">
      <div class="header-row header-row--2x2">
        <div class="turntable-arm" :style="{ transform: `rotate(${armRotation}deg)` }">
          <img src="/assets/music/turntableArm.png" alt="" />
        </div>
        <div class="header-content header-content--2x2">
          <div class="record-inline">
            <img class="record-img" src="/assets/music/vinylRecord.png" alt="vinyl record" />
            <img class="record-label" :class="vinylPhase" :src="content.albumArt" :alt="content.trackName" />
            <img class="record-shimmer" :class="vinylPhase" src="/assets/music/vinylHighlightShimmer.png" alt="" />
          </div>
          <canvas ref="noteCanvasEl" class="note-canvas" />
          <a :href="content.trackUrl" target="_blank" rel="noopener" class="platform-logo platform-logo--corner" :title="platformTitle">
            <svg v-if="content.platform === 'spotify'" viewBox="0 0 24 24" width="24" height="24" fill="white">
              <path d="M12.438 1.009C6.368.769 1.251 5.494 1.008 11.565c-.24 6.07 4.485 11.186 10.556 11.426 6.07.242 11.185-4.484 11.427-10.554S18.507 1.251 12.438 1.009m4.644 16.114a.657.657 0 0 1-.897.246 13.2 13.2 0 0 0-4.71-1.602 13.2 13.2 0 0 0-4.968.242.658.658 0 0 1-.31-1.278 14.5 14.5 0 0 1 5.46-.265c1.837.257 3.579.851 5.177 1.76.315.178.425.58.246.896zm1.445-2.887a.853.853 0 0 1-1.158.344 16.2 16.2 0 0 0-5.475-1.797 16.2 16.2 0 0 0-5.758.219.855.855 0 0 1-1.018-.65.85.85 0 0 1 .65-1.018 17.9 17.9 0 0 1 6.362-.241 17.9 17.9 0 0 1 6.049 1.985c.415.224.57.743.344 1.158zm1.602-3.255a1.05 1.05 0 0 1-1.418.448 19.7 19.7 0 0 0-6.341-2.025 19.6 19.6 0 0 0-6.655.199 1.05 1.05 0 1 1-.417-2.06 21.7 21.7 0 0 1 7.364-.22 21.7 21.7 0 0 1 7.019 2.24c.515.268.715.903.448 1.418" />
            </svg>
            <svg v-else viewBox="0 0 24 24" width="24" height="24" fill="white">
              <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.073-.005-.146-.01-.22-.015H5.988c-.076.005-.152.01-.228.015-.5.032-1 .1-1.492.198-1.283.3-2.326 1.017-3.093 2.1A5.005 5.005 0 0 0 .5 4.07a9.23 9.23 0 0 0-.165 1.833c-.006.073-.01.147-.015.22v11.693c.005.076.01.152.015.228.032.5.1 1 .198 1.492.3 1.283 1.017 2.326 2.1 3.093.554.394 1.17.66 1.833.83.652.167 1.32.24 1.993.265.18.007.36.013.54.015h11.693c.076-.002.152-.008.228-.015.5-.032 1-.1 1.492-.198 1.283-.3 2.326-1.017 3.093-2.1.394-.554.66-1.17.83-1.833.167-.652.24-1.32.265-1.993.006-.073.01-.147.015-.22V6.344c-.005-.076-.01-.152-.015-.22zM17.52 17.9c0 .254-.065.404-.247.49-.03.015-.135.037-.198.037-.107 0-.216-.035-.352-.106a8.586 8.586 0 0 1-.905-.554 8.94 8.94 0 0 1-1.474-1.333 7.396 7.396 0 0 1-1.073-1.636 5.347 5.347 0 0 1-.4-1.136c-.07-.342-.1-.575-.1-.872v-5.04c0-.323.055-.6.19-.83a.72.72 0 0 1 .325-.29c.102-.05.23-.088.413-.12a6.274 6.274 0 0 1 .867-.083c.212-.007.382.005.57.052.155.04.275.113.37.222.1.112.16.244.19.405.023.127.032.247.032.38v4.31c0 .34.07.687.21 1.023.158.38.39.72.677 1.012.35.36.71.578 1.033.718.248.107.336.167.48.256.077.047.135.113.16.2.024.066.032.14.032.224v2.47zm-2.4-8.054c0 .287-.095.473-.262.578a1.08 1.08 0 0 1-.322.144l-.058.012c-.193.036-.392.057-.65.057a2.98 2.98 0 0 1-.452-.038 1.108 1.108 0 0 1-.415-.16.56.56 0 0 1-.203-.255c-.045-.114-.068-.247-.068-.402V5.59c0-.27.036-.493.118-.667.082-.175.206-.31.38-.404.144-.08.313-.138.508-.175.236-.046.485-.07.747-.07.142 0 .28.008.415.024.185.022.33.072.438.155a.55.55 0 0 1 .195.29c.03.098.046.216.046.355v4.75z"/>
            </svg>
          </a>
        </div>
        <div v-if="show2xNExtras" class="song-info-2xN">
          <h1 class="track-name">
            <a :href="content.trackUrl" target="_blank" rel="noopener">{{ content.trackName }}</a>
          </h1>
          <p class="artist-name">
            <a :href="content.artistUrl" target="_blank" rel="noopener">{{ content.artistName }}</a>
          </p>
        </div>
      </div>

      <div class="controls-bar controls-bar--2x2">
        <button
          class="play-btn play-btn--small"
          :class="{ 'play-btn--disabled': !content.previewUrl }"
          :aria-label="isPlaying ? 'Pause' : 'Play'"
          :disabled="!content.previewUrl"
          @click="togglePlay"
        >
          <svg v-if="!isPlaying" viewBox="0 0 19 18.13" width="16" height="16" fill="currentColor">
            <path d="M17.4086 6.66543C19.5305 7.71151 19.5305 10.4194 17.4086 11.4654L4.59662 17.7814C2.53435 18.7981 0 17.4748 0 15.3814V2.74945C0 0.656047 2.53435 -0.667198 4.59661 0.349454L17.4086 6.66543Z"/>
          </svg>
          <svg v-else viewBox="0 0 18.56 18.2" width="16" height="16" fill="currentColor">
            <path d="M0 3.64C0 1.92 0 1.07.53.53 1.07 0 1.92 0 3.64 0s2.57 0 3.1.53c.54.54.54 1.39.54 3.11v10.92c0 1.71 0 2.57-.53 3.1-.53.53-1.39.53-3.1.53-1.72 0-2.58 0-3.11-.53C0 17.13 0 16.27 0 14.56V3.64z"/>
            <path d="M11.28 3.64c0-1.72 0-2.57.53-3.11C12.35 0 13.2 0 14.92 0c1.72 0 2.57 0 3.11.53.53.54.53 1.39.53 3.11v10.92c0 1.71 0 2.57-.53 3.1-.54.53-1.39.53-3.11.53-1.71 0-2.57 0-3.1-.53-.54-.53-.54-1.39-.54-3.1V3.64z"/>
          </svg>
        </button>
        <div class="volume-ctl-2x2" @mouseenter="onVolumeEnter" @mouseleave="onVolumeLeave">
          <div v-show="showVolume" class="vol-slider-vertical" @mouseenter="onVolumeEnter" @mouseleave="onVolumeLeave">
            <input type="range" class="volume-slider volume-slider--vertical" min="0" max="1" step="0.02"
              :value="isMuted ? 0 : volume" :style="{ '--fill': `${(isMuted ? 0 : volume) * 100}%` }"
              aria-label="Volume" @input="onVolumeInput"
              @pointerdown.stop @mousedown.stop @touchstart.stop />
          </div>
          <button class="icon-btn" :aria-label="isMuted ? 'Unmute' : 'Mute'" @click="toggleMute">
            <svg v-if="volumeIcon === 'mute'" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.00397 11.7232C1.05352 9.88098 1.07829 9.42378 1.8904 8.17135C2.03863 7.94274 2.25612 7.67114 2.4384 7.48695C3.43709 6.47784 3.83215 6.47784 5.34839 6.47784C6.39822 6.47784 6.8924 6.51928 7.46364 6.42767C7.63565 6.40008 7.73323 6.36417 7.83478 6.32423C8.52497 6.11734 8.50539 5.77614 9.48654 5.02461C12.0984 3.024 14.2065 2.72923 15.4347 3.19847C15.6286 3.27257 15.8078 3.37138 15.9636 3.5489C16.7768 4.47484 16.8386 6.49447 16.9621 9.45309C17.0079 10.5486 17.0391 11.4862 17.0391 12.0077C17.0391 12.5292 17.0079 13.4668 16.9621 14.5623C16.8386 17.5209 16.7848 19.5153 15.9636 20.4414C15.7994 20.6267 15.6375 20.699 15.4458 20.7764C14.2065 21.2764 12.1123 21.0195 9.50043 19.0033C8.53038 18.2545 8.5233 17.8833 7.83329 17.5905C7.73004 17.5467 7.631 17.4923 7.46489 17.477C6.90758 17.4256 6.39822 17.477 5.34839 17.477C3.83215 17.477 3.52734 17.4727 2.43359 16.5039C2.21765 16.3126 2.03557 16.0764 1.8904 15.8441C1.04297 14.4883 1.05352 14.1344 1.00397 12.2922C1.00136 12.1955 1 12.1005 1 12.0077C1 11.9149 1.00136 11.8199 1.00397 11.7232Z"/>
              <path d="M22.2583 9.38876L18.4326 14.5975M18.4328 9.38869L22.2583 14.5975" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
            </svg>
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.00397 11.7232C1.05352 9.88098 1.07829 9.42378 1.8904 8.17135C2.03863 7.94274 2.25612 7.67114 2.4384 7.48695C3.43709 6.47784 3.83215 6.47784 5.34839 6.47784C6.39822 6.47784 6.8924 6.51928 7.46364 6.42767C7.63565 6.40008 7.73323 6.36417 7.83478 6.32423C8.52497 6.11734 8.50539 5.77614 9.48654 5.02461C12.0984 3.024 14.2065 2.72923 15.4347 3.19847C15.6286 3.27257 15.8078 3.37138 15.9636 3.5489C16.7768 4.47484 16.8386 6.49447 16.9621 9.45309C17.0079 10.5486 17.0391 11.4862 17.0391 12.0077C17.0391 12.5292 17.0079 13.4668 16.9621 14.5623C16.8386 17.5209 16.7848 19.5153 15.9636 20.4414C15.7994 20.6267 15.6375 20.699 15.4458 20.7764C14.2065 21.2764 12.1123 21.0195 9.50043 19.0033C8.53038 18.2545 8.5233 17.8833 7.83329 17.5905C7.73004 17.5467 7.631 17.4923 7.46489 17.477C6.90758 17.4256 6.39822 17.477 5.34839 17.477C3.83215 17.477 3.52734 17.4727 2.43359 16.5039C2.21765 16.3126 2.03557 16.0764 1.8904 15.8441C1.04297 14.4883 1.05352 14.1344 1.00397 12.2922C1.00136 12.1955 1 12.1005 1 12.0077C1 11.9149 1.00136 11.8199 1.00397 11.7232Z"/>
            </svg>
          </button>
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════
         4×4 layout: full player (header + waveform + controls)
         ══════════════════════════════════════════════════════════ -->
    <template v-else>
      <div class="header-row">
        <div class="header-content">
          <div class="vinyl-overlay">
            <img
              v-if="vinylPhase === 'slide-out' || vinylPhase === 'toss-cover'"
              class="cover-clone"
              :class="vinylPhase"
              :src="content.albumArt"
              :alt="content.trackName"
            />
            <div class="record-wrap" :class="vinylPhase">
              <img class="record-img" src="/assets/music/vinylRecord.png" alt="vinyl record" />
              <img class="record-label" :class="vinylPhase" :src="content.albumArt" :alt="content.trackName" />
              <img class="record-shimmer" :class="vinylPhase" src="/assets/music/vinylHighlightShimmer.png" alt="" />
            </div>
            <div class="cover-art" :style="{ opacity: (vinylPhase === 'toss-cover' || vinylPhase === 'slide-back' || vinylPhase === 'spinning' || vinylPhase === 'spinning-paused') ? 0 : 1, transition: 'opacity 0.15s' }">
              <img :src="content.albumArt" :alt="content.trackName" />
            </div>
            <canvas ref="noteCanvasEl" class="note-canvas" />
          </div>
          <div class="metadata">
            <h1 class="track-name">
              <a :href="content.trackUrl" target="_blank" rel="noopener">{{ content.trackName }}</a>
            </h1>
            <p class="artist-name">
              <a :href="content.artistUrl" target="_blank" rel="noopener">{{ content.artistName }}</a>
            </p>
          </div>
        </div>
        <a :href="content.trackUrl" target="_blank" rel="noopener" class="platform-logo" :title="platformTitle">
          <svg v-if="content.platform === 'spotify'" viewBox="0 0 24 24" width="24" height="24" fill="white">
            <path d="M12.438 1.009C6.368.769 1.251 5.494 1.008 11.565c-.24 6.07 4.485 11.186 10.556 11.426 6.07.242 11.185-4.484 11.427-10.554S18.507 1.251 12.438 1.009m4.644 16.114a.657.657 0 0 1-.897.246 13.2 13.2 0 0 0-4.71-1.602 13.2 13.2 0 0 0-4.968.242.658.658 0 0 1-.31-1.278 14.5 14.5 0 0 1 5.46-.265c1.837.257 3.579.851 5.177 1.76.315.178.425.58.246.896zm1.445-2.887a.853.853 0 0 1-1.158.344 16.2 16.2 0 0 0-5.475-1.797 16.2 16.2 0 0 0-5.758.219.855.855 0 0 1-1.018-.65.85.85 0 0 1 .65-1.018 17.9 17.9 0 0 1 6.362-.241 17.9 17.9 0 0 1 6.049 1.985c.415.224.57.743.344 1.158zm1.602-3.255a1.05 1.05 0 0 1-1.418.448 19.7 19.7 0 0 0-6.341-2.025 19.6 19.6 0 0 0-6.655.199 1.05 1.05 0 1 1-.417-2.06 21.7 21.7 0 0 1 7.364-.22 21.7 21.7 0 0 1 7.019 2.24c.515.268.715.903.448 1.418" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="24" height="24" fill="white">
            <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.073-.005-.146-.01-.22-.015H5.988c-.076.005-.152.01-.228.015-.5.032-1 .1-1.492.198-1.283.3-2.326 1.017-3.093 2.1A5.005 5.005 0 0 0 .5 4.07a9.23 9.23 0 0 0-.165 1.833c-.006.073-.01.147-.015.22v11.693c.005.076.01.152.015.228.032.5.1 1 .198 1.492.3 1.283 1.017 2.326 2.1 3.093.554.394 1.17.66 1.833.83.652.167 1.32.24 1.993.265.18.007.36.013.54.015h11.693c.076-.002.152-.008.228-.015.5-.032 1-.1 1.492-.198 1.283-.3 2.326-1.017 3.093-2.1.394-.554.66-1.17.83-1.833.167-.652.24-1.32.265-1.993.006-.073.01-.147.015-.22V6.344c-.005-.076-.01-.152-.015-.22zM17.52 17.9c0 .254-.065.404-.247.49-.03.015-.135.037-.198.037-.107 0-.216-.035-.352-.106a8.586 8.586 0 0 1-.905-.554 8.94 8.94 0 0 1-1.474-1.333 7.396 7.396 0 0 1-1.073-1.636 5.347 5.347 0 0 1-.4-1.136c-.07-.342-.1-.575-.1-.872v-5.04c0-.323.055-.6.19-.83a.72.72 0 0 1 .325-.29c.102-.05.23-.088.413-.12a6.274 6.274 0 0 1 .867-.083c.212-.007.382.005.57.052.155.04.275.113.37.222.1.112.16.244.19.405.023.127.032.247.032.38v4.31c0 .34.07.687.21 1.023.158.38.39.72.677 1.012.35.36.71.578 1.033.718.248.107.336.167.48.256.077.047.135.113.16.2.024.066.032.14.032.224v2.47zm-2.4-8.054c0 .287-.095.473-.262.578a1.08 1.08 0 0 1-.322.144l-.058.012c-.193.036-.392.057-.65.057a2.98 2.98 0 0 1-.452-.038 1.108 1.108 0 0 1-.415-.16.56.56 0 0 1-.203-.255c-.045-.114-.068-.247-.068-.402V5.59c0-.27.036-.493.118-.667.082-.175.206-.31.38-.404.144-.08.313-.138.508-.175.236-.046.485-.07.747-.07.142 0 .28.008.415.024.185.022.33.072.438.155a.55.55 0 0 1 .195.29c.03.098.046.216.046.355v4.75z"/>
          </svg>
        </a>
      </div>

      <div class="controls-bar">
        <button
          class="play-btn play-btn--small"
          :class="{ 'play-btn--disabled': !content.previewUrl }"
          :aria-label="isPlaying ? 'Pause' : 'Play'"
          :disabled="!content.previewUrl"
          @click="togglePlay"
        >
          <svg v-if="!isPlaying" viewBox="0 0 19 18.13" width="16" height="16" fill="currentColor">
            <path d="M17.4086 6.66543C19.5305 7.71151 19.5305 10.4194 17.4086 11.4654L4.59662 17.7814C2.53435 18.7981 0 17.4748 0 15.3814V2.74945C0 0.656047 2.53435 -0.667198 4.59661 0.349454L17.4086 6.66543Z"/>
          </svg>
          <svg v-else viewBox="0 0 18.56 18.2" width="16" height="16" fill="currentColor">
            <path d="M0 3.64C0 1.92 0 1.07.53.53 1.07 0 1.92 0 3.64 0s2.57 0 3.1.53c.54.54.54 1.39.54 3.11v10.92c0 1.71 0 2.57-.53 3.1-.53.53-1.39.53-3.1.53-1.72 0-2.58 0-3.11-.53C0 17.13 0 16.27 0 14.56V3.64z"/>
            <path d="M11.28 3.64c0-1.72 0-2.57.53-3.11C12.35 0 13.2 0 14.92 0c1.72 0 2.57 0 3.11.53.53.54.53 1.39.53 3.11v10.92c0 1.71 0 2.57-.53 3.1-.54.53-1.39.53-3.11.53-1.71 0-2.57 0-3.1-.53-.54-.53-.54-1.39-.54-3.1V3.64z"/>
          </svg>
        </button>

        <div class="volume-ctl" @mouseenter="onVolumeEnter" @mouseleave="onVolumeLeave">
          <button class="icon-btn" :aria-label="isMuted ? 'Unmute' : 'Mute'" @click="toggleMute">
            <svg v-if="volumeIcon === 'mute'" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.00397 11.7232C1.05352 9.88098 1.07829 9.42378 1.8904 8.17135C2.03863 7.94274 2.25612 7.67114 2.4384 7.48695C3.43709 6.47784 3.83215 6.47784 5.34839 6.47784C6.39822 6.47784 6.8924 6.51928 7.46364 6.42767C7.63565 6.40008 7.73323 6.36417 7.83478 6.32423C8.52497 6.11734 8.50539 5.77614 9.48654 5.02461C12.0984 3.024 14.2065 2.72923 15.4347 3.19847C15.6286 3.27257 15.8078 3.37138 15.9636 3.5489C16.7768 4.47484 16.8386 6.49447 16.9621 9.45309C17.0079 10.5486 17.0391 11.4862 17.0391 12.0077C17.0391 12.5292 17.0079 13.4668 16.9621 14.5623C16.8386 17.5209 16.7848 19.5153 15.9636 20.4414C15.7994 20.6267 15.6375 20.699 15.4458 20.7764C14.2065 21.2764 12.1123 21.0195 9.50043 19.0033C8.53038 18.2545 8.5233 17.8833 7.83329 17.5905C7.73004 17.5467 7.631 17.4923 7.46489 17.477C6.90758 17.4256 6.39822 17.477 5.34839 17.477C3.83215 17.477 3.52734 17.4727 2.43359 16.5039C2.21765 16.3126 2.03557 16.0764 1.8904 15.8441C1.04297 14.4883 1.05352 14.1344 1.00397 12.2922C1.00136 12.1955 1 12.1005 1 12.0077C1 11.9149 1.00136 11.8199 1.00397 11.7232Z"/>
              <path d="M22.2583 9.38876L18.4326 14.5975M18.4328 9.38869L22.2583 14.5975" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
            </svg>
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.00397 11.7232C1.05352 9.88098 1.07829 9.42378 1.8904 8.17135C2.03863 7.94274 2.25612 7.67114 2.4384 7.48695C3.43709 6.47784 3.83215 6.47784 5.34839 6.47784C6.39822 6.47784 6.8924 6.51928 7.46364 6.42767C7.63565 6.40008 7.73323 6.36417 7.83478 6.32423C8.52497 6.11734 8.50539 5.77614 9.48654 5.02461C12.0984 3.024 14.2065 2.72923 15.4347 3.19847C15.6286 3.27257 15.8078 3.37138 15.9636 3.5489C16.7768 4.47484 16.8386 6.49447 16.9621 9.45309C17.0079 10.5486 17.0391 11.4862 17.0391 12.0077C17.0391 12.5292 17.0079 13.4668 16.9621 14.5623C16.8386 17.5209 16.7848 19.5153 15.9636 20.4414C15.7994 20.6267 15.6375 20.699 15.4458 20.7764C14.2065 21.2764 12.1123 21.0195 9.50043 19.0033C8.53038 18.2545 8.5233 17.8833 7.83329 17.5905C7.73004 17.5467 7.631 17.4923 7.46489 17.477C6.90758 17.4256 6.39822 17.477 5.34839 17.477C3.83215 17.477 3.52734 17.4727 2.43359 16.5039C2.21765 16.3126 2.03557 16.0764 1.8904 15.8441C1.04297 14.4883 1.05352 14.1344 1.00397 12.2922C1.00136 12.1955 1 12.1005 1 12.0077C1 11.9149 1.00136 11.8199 1.00397 11.7232Z"/>
            </svg>
          </button>
          <div class="slider-tag-slot">
            <div class="vol-slider-wrap" :class="{ 'vol-slider-wrap--expanded': showVolume }" @mouseenter="onVolumeEnter" @mouseleave="onVolumeLeave">
              <input type="range" class="volume-slider" min="0" max="1" step="0.02"
                :value="isMuted ? 0 : volume" :style="{ '--fill': `${(isMuted ? 0 : volume) * 100}%` }"
                aria-label="Volume" @input="onVolumeInput"
                @pointerdown.stop @mousedown.stop @touchstart.stop />
            </div>
            <div class="tag-clip">
              <span class="tag">PREVIEW</span>
            </div>
          </div>
        </div>

        <div class="track-progress" @click="seekTo">
          <div class="track-bar">
            <div class="track-fill" :style="{ width: duration ? (currentTime / duration * 100) + '%' : '0%' }"></div>
          </div>
        </div>

        <span class="track-time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
      </div>

    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, inject, onMounted, onBeforeUnmount, nextTick, watch, type ComputedRef } from "vue";
import { type MusicContent } from "@/types/TileContent";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import { useLayoutStore } from "@/stores/layout";

export default defineComponent({
  props: {
    content: {
      type: Object as () => MusicContent,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const tileId = inject<string | null>("tileId", null);
    const gridTileW = inject<ComputedRef<number> | null>("gridTileW", null);
    const gridTileH = inject<ComputedRef<number> | null>("gridTileH", null);

    const isLoading = ref(false);
    const hasError = ref(false);

    const w = computed(() => gridTileW?.value ?? 2);
    const h = computed(() => gridTileH?.value ?? 2);

    const effectiveTileSize = computed(() => {
      const cw = w.value;
      const ch = h.value;
      if (cw <= 1 && ch <= 1) return "1x1";
      if (cw <= 2 && ch <= 2) return "2x2";
      if (cw <= 2 && ch > 2) return "2xN";
      if (cw >= 3 && ch >= 3) return "4x4";
      if (cw >= 3 && ch <= 2) return "4x4";
      return "2x2";
    });

    const tilePxHeight = computed(() => {
      return h.value * 123 - 48;
    });

    const show2xNExtras = computed(() => {
      if (effectiveTileSize.value !== "2xN") return false;
      return tilePxHeight.value > 198;
    });

    const compact4x4 = computed(() => {
      if (effectiveTileSize.value !== "4x4") return false;
      return tilePxHeight.value < 321;
    });

    const bgBase = computed(() => props.content.backgroundColor || "rgba(30, 30, 30, 1)");
    const bgTinted = computed(() => props.content.backgroundTinted || "rgba(50, 50, 50, 1)");
    const txtSubdued = computed(() => props.content.textSubdued || "rgba(180, 180, 180, 1)");
    const platformTitle = computed(() =>
      props.content.platform === "spotify" ? "Play on Spotify" : "Play on Apple Music"
    );

    const ARM_REST_DEG = 0;
    const ARM_START_DEG = -17;
    const ARM_END_DEG = -38;

    const audioEl = ref<HTMLAudioElement | null>(null);
    const canvasEl = ref<HTMLCanvasElement | null>(null);
    const canvasWrapEl = ref<HTMLElement | null>(null);
    const noteCanvasEl = ref<HTMLCanvasElement | null>(null);
    const isPlaying = ref(false);
    const volume = ref(0.10);
    const isMuted = ref(false);
    const showVolume = ref(false);
    const currentTime = ref(0);
    const duration = ref(0);
    const vinylPhase = ref("idle");
    const hasAnimated = ref(false);

    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let animFrameId: number | null = null;
    let sourceConnected = false;
    let hideVolumeTimer: ReturnType<typeof setTimeout> | null = null;
    let noteRafId: number | null = null;
    let vinylPhaseTimer: ReturnType<typeof setTimeout> | null = null;
    let canvasObserver: ResizeObserver | null = null;

    const armRotation = computed(() => {
      if (!isPlaying.value && vinylPhase.value !== "spinning-paused") return ARM_REST_DEG;
      if (vinylPhase.value === "spinning-paused") return ARM_REST_DEG;
      const progress = duration.value > 0 ? currentTime.value / duration.value : 0;
      return ARM_START_DEG + (ARM_END_DEG - ARM_START_DEG) * progress;
    });

    const showWaveform = computed(() => {
      if (effectiveTileSize.value === "4x4") return !compact4x4.value;
      if (effectiveTileSize.value === "2xN") return show2xNExtras.value;
      return false;
    });

    const volumeIcon = computed(() => {
      if (isMuted.value || volume.value === 0) return "mute";
      if (volume.value <= 0.33) return "low";
      if (volume.value <= 0.66) return "mid";
      return "high";
    });

    const NOTE_GLYPHS = ["♩", "♪", "♫", "♬", "𝅘𝅥𝅮"];
    let noteParticles: any[] = [];

    function getNoteCanvasDims() {
      const canvas = noteCanvasEl.value;
      if (!canvas) return { cx: 200, cy: 200, r: 90 };
      return { cx: canvas.width / 2, cy: canvas.height / 2, r: Math.min(canvas.width, canvas.height) * 0.225 };
    }

    function spawnNote() {
      const { cx, cy } = getNoteCanvasDims();
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 1.4;
      const size = 14 + Math.random() * 12;
      noteParticles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size, alpha: 1,
        glyph: NOTE_GLYPHS[Math.floor(Math.random() * NOTE_GLYPHS.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.06,
      });
    }

    function tickNotes() {
      const canvas = noteCanvasEl.value;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (isPlaying.value && Math.random() < 0.04) spawnNote();
      const { cx, cy, r } = getNoteCanvasDims();
      const fadeStart = r * 0.9;
      const fadeEnd = r * 2.4;
      noteParticles = noteParticles.filter(p => p.alpha > 0.01);
      for (const p of noteParticles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        const dist = Math.hypot(p.x - cx, p.y - cy);
        if (dist > fadeStart) {
          p.alpha = Math.max(0, 1 - (dist - fadeStart) / (fadeEnd - fadeStart));
        }
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.font = `${p.size}px serif`;
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.glyph, 0, 0);
        ctx.restore();
      }
      noteRafId = requestAnimationFrame(tickNotes);
    }

    function startNotes() {
      if (noteRafId) return;
      const canvas = noteCanvasEl.value;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
      noteRafId = requestAnimationFrame(tickNotes);
    }

    function stopNotes() {
      if (noteRafId) { cancelAnimationFrame(noteRafId); noteRafId = null; }
      const canvas = noteCanvasEl.value;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    function runVinylIntro() {
      hasAnimated.value = true;
      vinylPhase.value = "slide-out";
      vinylPhaseTimer = setTimeout(() => {
        vinylPhase.value = "toss-cover";
        vinylPhaseTimer = setTimeout(() => {
          vinylPhase.value = "slide-back";
          vinylPhaseTimer = setTimeout(() => {
            vinylPhase.value = "spinning";
            setupAnalyser();
            if (audioCtx?.state === "suspended") audioCtx.resume();
            audioEl.value?.play();
            drawWave();
            setTimeout(() => startNotes(), 50);
          }, 600);
        }, 700);
      }, 700);
    }

    function pauseVinyl() { vinylPhase.value = "spinning-paused"; }
    function resumeVinyl() { vinylPhase.value = "spinning"; startNotes(); }

    function resetVinyl() {
      if (vinylPhaseTimer) clearTimeout(vinylPhaseTimer);
      stopNotes();
      noteParticles = [];
      vinylPhase.value = "idle";
      hasAnimated.value = false;
    }

    function formatTime(secs: number) {
      if (!secs || isNaN(secs)) return "0:00";
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60).toString().padStart(2, "0");
      return `${m}:${s}`;
    }

    function onTimeUpdate() { if (audioEl.value) currentTime.value = audioEl.value.currentTime; }
    function onLoadedMetadata() { if (audioEl.value) duration.value = audioEl.value.duration; }

    function seekTo(e: MouseEvent) {
      if (!audioEl.value || !duration.value) return;
      const bar = (e.currentTarget as HTMLElement).querySelector(".track-bar");
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audioEl.value.currentTime = ratio * duration.value;
      currentTime.value = audioEl.value.currentTime;
    }

    function onVolumeEnter() {
      if (hideVolumeTimer) clearTimeout(hideVolumeTimer);
      showVolume.value = true;
    }
    function onVolumeLeave() {
      hideVolumeTimer = setTimeout(() => { showVolume.value = false; }, 200);
    }

    function setupAnalyser() {
      if (sourceConnected || !audioEl.value) return;
      audioCtx = new AudioContext();
      const source = audioCtx.createMediaElementSource(audioEl.value);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.minDecibels = -100;
      analyser.maxDecibels = -10;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      sourceConnected = true;
    }

    const NUM_BARS = 40;
    const MIN_FREQ = 60;
    const MAX_FREQ = 16000;

    function getLogBars(dataArray: Uint8Array) {
      if (!audioCtx) return [];
      const binHz = (audioCtx.sampleRate / 2) / dataArray.length;
      const bars: number[] = [];
      for (let i = 0; i < NUM_BARS; i++) {
        const freqLow = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, i / NUM_BARS);
        const freqHigh = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, (i + 1) / NUM_BARS);
        const binLow = Math.max(0, Math.floor(freqLow / binHz));
        const binHigh = Math.min(dataArray.length - 1, Math.floor(freqHigh / binHz));
        let peak = 0;
        for (let b = binLow; b <= binHigh; b++) {
          if (dataArray[b] > peak) peak = dataArray[b];
        }
        bars.push(peak / 255);
      }
      return bars;
    }

    function getSubduedRgb() {
      if (!canvasEl.value) return "180, 180, 180";
      const raw = getComputedStyle(canvasEl.value).getPropertyValue("--text-subdued").trim();
      const m = raw.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
      return m ? `${m[1]}, ${m[2]}, ${m[3]}` : "180, 180, 180";
    }

    function makeBarGradient(ctx: CanvasRenderingContext2D, top: number, height: number) {
      const g = ctx.createLinearGradient(0, top, 0, top + height);
      const c = getSubduedRgb();
      g.addColorStop(0.0, `rgba(255, 255, 255, 1)`);
      g.addColorStop(0.0865, `rgba(${c}, 1)`);
      g.addColorStop(0.0866, `rgba(${c}, 0.863)`);
      g.addColorStop(0.5048, `rgba(${c}, 0.15)`);
      g.addColorStop(0.91, `rgba(${c}, 0.86)`);
      g.addColorStop(0.9135, `rgba(${c}, 1)`);
      g.addColorStop(1.0, `rgba(255, 255, 255, 1)`);
      return g;
    }

    function drawWave() {
      if (!analyser) return;
      if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      function draw() {
        animFrameId = requestAnimationFrame(draw);
        const canvas = canvasEl.value;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        analyser!.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const bars = getLogBars(dataArray);
        const slotW = canvas.width / NUM_BARS;
        const barW = 1;
        const centerY = canvas.height / 2;
        for (let i = 0; i < NUM_BARS; i++) {
          const v = bars[i];
          const barH = Math.max(v * canvas.height * 1.5, 2);
          const x = i * slotW + (slotW - barW) / 2;
          const t = centerY - barH / 2;
          ctx.fillStyle = makeBarGradient(ctx, t, barH);
          ctx.fillRect(x, t, barW, barH);
        }
      }
      draw();
    }

    function drawIdle() {
      if (!canvasEl.value) return;
      const canvas = canvasEl.value;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const slotW = canvas.width / NUM_BARS;
      const barW = 1;
      const centerY = canvas.height / 2;
      for (let i = 0; i < NUM_BARS; i++) {
        const t = i / (NUM_BARS - 1);
        const v =
          0.45 * Math.abs(Math.sin(t * Math.PI * 4)) +
          0.30 * Math.abs(Math.sin(t * Math.PI * 9 + 1.2)) +
          0.25 * Math.abs(Math.sin(t * Math.PI * 17 + 2.5));
        const barH = Math.max(v * canvas.height * 1.5, 1);
        const x = i * slotW + (slotW - barW) / 2;
        const top = centerY - barH / 2;
        ctx.globalAlpha = 0.1 + v * 0.25;
        ctx.fillStyle = makeBarGradient(ctx, top, barH);
        ctx.fillRect(x, top, barW, barH);
      }
      ctx.globalAlpha = 1;
    }

    function stopWave() {
      if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
      drawIdle();
    }

    function onEnded() {
      isPlaying.value = false;
      stopWave();
      if (vinylPhase.value === "spinning") pauseVinyl();
    }

    function togglePlay() {
      if (!audioEl.value) return;
      if (isPlaying.value) {
        audioEl.value.pause();
        isPlaying.value = false;
        stopWave();
        if (vinylPhase.value === "spinning") pauseVinyl();
      } else {
        isPlaying.value = true;
        if (!hasAnimated.value) {
          if (effectiveTileSize.value === "2x2") {
            hasAnimated.value = true;
            vinylPhase.value = "spinning";
            setupAnalyser();
            if (audioCtx?.state === "suspended") audioCtx.resume();
            audioEl.value.play();
            drawWave();
            setTimeout(() => startNotes(), 50);
          } else {
            runVinylIntro();
          }
        } else if (vinylPhase.value === "spinning-paused") {
          setupAnalyser();
          if (audioCtx?.state === "suspended") audioCtx.resume();
          audioEl.value.play();
          drawWave();
          resumeVinyl();
        }
      }
    }

    function onAudioError() {
      isPlaying.value = false;
      stopWave();
      if (vinylPhase.value === "spinning") pauseVinyl();
    }

    function onVolumeInput(e: Event) {
      volume.value = parseFloat((e.target as HTMLInputElement).value);
      isMuted.value = false;
      if (audioEl.value) audioEl.value.volume = volume.value;
    }

    function toggleMute() {
      isMuted.value = !isMuted.value;
      if (audioEl.value) audioEl.value.volume = isMuted.value ? 0 : volume.value;
    }

    const fetchMetadata = async () => {
      if (props.content.trackName) return;

      isLoading.value = true;
      hasError.value = false;

      try {
        const getMusicTrackMetadata = httpsCallable(functions, "getMusicTrackMetadata");
        const result = await getMusicTrackMetadata({
          platform: props.content.platform,
          trackId: props.content.trackId,
        });

        const data = result.data as any;

        if (tileId) {
          layoutStore.patchTileContent(tileId, data);
        }
      } catch (error) {
        console.error("Failed to fetch music track metadata:", error);
        hasError.value = true;
      } finally {
        isLoading.value = false;
      }
    };

    function setupCanvasObserver() {
      if (canvasObserver) {
        canvasObserver.disconnect();
        canvasObserver = null;
      }
      const canvas = canvasEl.value;
      const wrap = canvasWrapEl.value;
      if (canvas && wrap) {
        canvas.width = wrap.clientWidth;
        canvas.height = wrap.clientHeight;
        canvasObserver = new ResizeObserver(() => {
          canvas.width = wrap.clientWidth;
          canvas.height = wrap.clientHeight;
          if (isPlaying.value) return;
          drawIdle();
        });
        canvasObserver.observe(wrap);
        if (isPlaying.value) {
          drawWave();
        } else {
          drawIdle();
        }
      }
    }

    onMounted(() => {
      fetchMetadata();
      nextTick(() => {
        if (audioEl.value) audioEl.value.volume = volume.value;
        setupCanvasObserver();
      });
    });

    onBeforeUnmount(() => {
      if (canvasObserver) { canvasObserver.disconnect(); canvasObserver = null; }
      if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
      stopNotes();
      if (vinylPhaseTimer) clearTimeout(vinylPhaseTimer);
      if (hideVolumeTimer) clearTimeout(hideVolumeTimer);
    });

    return {
      isLoading,
      hasError,
      effectiveTileSize,
      show2xNExtras,
      compact4x4,
      showWaveform,
      bgBase,
      bgTinted,
      txtSubdued,
      platformTitle,
      armRotation,
      volumeIcon,
      audioEl,
      canvasEl,
      canvasWrapEl,
      noteCanvasEl,
      isPlaying,
      volume,
      isMuted,
      showVolume,
      currentTime,
      duration,
      vinylPhase,
      togglePlay,
      toggleMute,
      onVolumeEnter,
      onVolumeLeave,
      onVolumeInput,
      onEnded,
      onAudioError,
      onTimeUpdate,
      onLoadedMetadata,
      seekTo,
      formatTime,
      fetchMetadata,
    };
  },
});
</script>

<style scoped>
.music-player {
  display: flex;
  flex-direction: column;
  gap: 48px;
  align-items: stretch;
  justify-content: center;
  border-radius: 24px;
  padding: 24px;
  color: white;
  font-family: 'Inter', -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif;
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
}

.music-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.music-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.music-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 8px;
  color: rgba(255,255,255,0.7);
  font-size: 12px;
}

.retry-btn {
  background: rgba(255,255,255,0.15);
  border: none;
  border-radius: 6px;
  color: white;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 12px;
}

.retry-btn:hover {
  background: rgba(255,255,255,0.25);
}

.header-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  overflow: hidden;
  width: 100%;
}

.header-content {
  display: flex;
  flex: 1 0 0;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-end;
  min-width: 0;
  min-height: 1px;
}

.cover-art {
  position: absolute;
  inset: 0;
  z-index: 12;
}

.cover-art img {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  object-fit: cover;
  display: block;
}

.metadata {
  display: flex;
  flex-direction: column;
  flex: 1 0 0;
  min-width: 152px;
  min-height: 1px;
}

.track-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
}

.track-name a { color: white; text-decoration: none; }
.track-name a:hover { text-decoration: underline; }

.artist-name {
  margin: 0;
  font-size: 14px;
  font-weight: 400;
  color: white;
  letter-spacing: -0.28px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.artist-name a { color: white; text-decoration: none; }
.artist-name a:hover { text-decoration: underline; }

.platform-logo {
  position: absolute;
  top: 21px;
  right: 21px;
  display: flex;
  align-items: center;
  opacity: 0.9;
  transition: opacity 0.15s;
}

.platform-logo:hover { opacity: 1; }

.canvas-wrap {
  flex: 1 0 0;
  position: relative;
  min-height: 24px;
  min-width: 1px;
  width: 100%;
  overflow: hidden;
}

.canvas-wrap--hoisted {
  order: 1;
}

.wave-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.play-btn {
  background: none;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--bg-tinted);
  padding: 0;
  flex-shrink: 0;
  transition: transform 0.1s;
}

.play-btn:hover { color: white; }

.play-btn--disabled { opacity: 0.35; cursor: not-allowed; }
.play-btn--disabled:hover { transform: none; }

.play-btn--small {
  width: 16px;
  height: 16px;
  color: var(--text-subdued);
  background: none;
}

.play-btn--small:hover { color: white; }

.controls-bar {
  order: 2;
  display: flex;
  gap: 11px;
  align-items: center;
  width: 100%;
}

.icon-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--text-subdued);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  transition: color 0.15s;
}

.icon-btn:hover { color: white; }

.volume-ctl {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.slider-tag-slot {
  display: flex;
  align-items: center;
  width: 63px;
  flex-shrink: 0;
}

.vol-slider-wrap {
  display: flex;
  align-items: center;
  width: 0;
  min-width: 0;
  flex-shrink: 0;
  overflow: visible;
  transition: width 0.25s ease;
}

.vol-slider-wrap--expanded { width: 98px; }

.tag-clip {
  flex: 1 0 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  overflow: hidden;
}

.tag {
  background-color: white;
  color: var(--bg-tinted);
  font-size: 10px;
  font-weight: 700;
  font-family: 'Inter', sans-serif;
  padding: 1px 6px;
  border-radius: 2px;
  letter-spacing: 1px;
  flex-shrink: 0;
  white-space: nowrap;
}

.track-progress {
  flex: 1 0 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 1px;
  min-height: 1px;
  cursor: pointer;
}

.track-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.21);
  border-radius: 2px;
  position: relative;
  width: 100%;
}

.track-fill {
  height: 100%;
  background: var(--text-subdued);
  border-radius: 2px;
  transition: width 0.25s linear;
}

.track-time {
  font-size: 10px;
  font-family: 'Inter', sans-serif;
  font-weight: 400;
  color: var(--text-subdued);
  white-space: nowrap;
  user-select: none;
  flex-shrink: 0;
}

.volume-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 60px;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(to right, white var(--fill, 100%), rgba(255, 255, 255, 0.25) var(--fill, 100%));
  cursor: pointer;
  outline: none;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: white;
  cursor: pointer;
  transition: transform 0.1s;
}

.volume-slider:hover::-webkit-slider-thumb { transform: scale(1.3); }

.volume-slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border: none;
  border-radius: 50%;
  background: white;
  cursor: pointer;
}

.volume-ctl-2x2 {
  position: relative;
  display: flex;
  align-items: center;
}

.vol-slider-vertical {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 0;
}

.volume-slider--vertical {
  writing-mode: vertical-lr;
  direction: rtl;
  width: 4px;
  height: 51px;
  background: linear-gradient(to top, white var(--fill, 100%), rgba(255, 255, 255, 0.21) var(--fill, 100%));
  border-radius: 4px;
}

.volume-slider--vertical::-webkit-slider-thumb {
  width: 8px;
  height: 8px;
  border-radius: 4px;
  box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
}

/* ── Vinyl animation overlay ─────────────────────────────── */
.vinyl-overlay {
  position: relative;
  flex: 1 0 0;
  min-width: 114px;
  max-width: 164px;
  min-height: 114px;
  max-height: 164px;
  aspect-ratio: 1;
  overflow: visible;
}

.cover-clone {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 4px;
  object-fit: cover;
  z-index: 12;
}

.cover-clone.toss-cover {
  animation: toss-cover 0.8s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
}

@keyframes toss-cover {
  0%   { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate(-30px, -360px) rotate(-0.1turn); opacity: 0; }
}

.record-wrap {
  position: absolute;
  inset: 0;
  z-index: 11;
  overflow: visible;
}

.record-wrap.slide-out {
  animation: record-slide-out 0.65s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

@keyframes record-slide-out {
  0%   { transform: translateX(0); }
  100% { transform: translateX(100%); }
}

.record-wrap.toss-cover { transform: translateX(100%); }

.record-wrap.slide-back {
  animation: record-slide-back 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

@keyframes record-slide-back {
  0%   { transform: translateX(100%); }
  100% { transform: translateX(0); }
}

.record-wrap.spinning { transform: translateX(0); }
.record-wrap.spinning-paused { transform: translateX(0); }

.record-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: block;
  user-select: none;
  -webkit-user-drag: none;
}

.record-label {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40%;
  height: 40%;
  border-radius: 50%;
  object-fit: cover;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.record-label.spinning { animation: label-spin 2.4s linear infinite; }
.record-label.spinning-paused { animation: label-spin 2.4s linear infinite paused; }

@keyframes label-spin {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to   { transform: translate(-50%, -50%) rotate(360deg); }
}

.record-shimmer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  pointer-events: none;
  object-fit: contain;
}

.record-shimmer.spinning { animation: shimmer-rock 1.6s ease-in-out infinite; }
.record-shimmer.spinning-paused { animation: shimmer-rock 1.6s ease-in-out infinite paused; }

@keyframes shimmer-rock {
  0%   { transform: rotate(-3deg); }
  50%  { transform: rotate(0deg); }
  100% { transform: rotate(-3deg); }
}

.note-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 14;
  pointer-events: none;
}

/* ── 1×1 tile ─────────────────────────────────────────────── */
.tile-1x1 {
  padding: 16px;
  border-radius: 20px;
  gap: 24px;
  min-height: unset;
}

.platform-logo--fill {
  flex: 1 0 0;
  aspect-ratio: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.9;
  transition: opacity 0.15s;
}

.platform-logo--fill:hover { opacity: 1; }

/* ── 2×2 tile ─────────────────────────────────────────────── */
.tile-2x2 {
  padding: 16px;
  border-radius: 20px;
  gap: 0px;
  min-height: unset;
}

.header-row--2x2 {
  flex: 1 0 auto;
  flex-wrap: wrap;
  gap: 0px;
  justify-content: flex-end;
  align-items: flex-start;
  min-height: 0;
  isolation: isolate;
  overflow: visible;
  max-height: 240px;
}

.turntable-arm {
  position: absolute;
  left: 12px;
  top: 12px;
  width: 21.5px;
  z-index: 100;
  pointer-events: none;
  transform-origin: 70% 14%;
  transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.turntable-arm img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: top;
  display: block;
}

.header-content--2x2 {
  aspect-ratio: 1;
  flex: 1 0 0;
  min-width: 115px;
  min-height: 115px;
  align-items: center;
  justify-content: center;
  padding: 0px 14px 0 14px;
  position: relative;
}

.record-inline {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 50%;
  overflow: hidden;
  z-index: 1;
}

.platform-logo--corner {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  opacity: 0.9;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.platform-logo--corner:hover { opacity: 1; }

.controls-bar--2x2 {
  order: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 162px;
  z-index: 10;
  position: absolute;
  bottom: 20px;
  left: 20px;
}

/* ── 2×N tile ─────────────────────────────────────────────── */
.tile-2xN {
  padding: 16px 16px 56px 16px;
  border-radius: 20px;
  gap: 16px;
  min-height: unset;
}

.song-info-2xN {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
}

/* ── 4×4 tile ─────────────────────────────────────────────── */
.tile-4x4 {
  padding: 24px;
  border-radius: 24px;
  gap: 32px;
}

.tile-4x4--compact {
  gap: 12px;
  min-height: 0;
  overflow: hidden;
  justify-content: flex-start;
}

.tile-4x4--compact .header-row {
  flex: 1 1 0;
  min-height: 0;
}

.tile-4x4--compact .header-content {
  flex-wrap: nowrap;
  align-items: stretch;
  min-height: 0;
}

.tile-4x4--compact .vinyl-overlay {
  min-width: 0;
  min-height: 0;
  max-width: none;
  max-height: 100%;
  flex: 0 0 auto;
  width: auto;
  height: 100%;
}

.tile-4x4--compact .metadata {
  min-width: 0;
  flex: 1 1 0;
  align-self: center;
}

.tile-4x4--compact .controls-bar {
  flex-shrink: 0;
}
</style>
