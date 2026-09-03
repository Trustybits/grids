<template>
  <div class="og-modal-backdrop modal-overlay" @click.self="$emit('close')">
    <div class="og-preview-dialog" role="dialog" aria-modal="true" aria-label="Social Share Preview">
      <header class="og-preview-dialog__header">
        <div>
          <h3 class="og-preview-dialog__title">Social Share Preview</h3>
          <p class="og-preview-dialog__desc">
            See how your grid appears when links are shared across messaging apps and social platforms.
          </p>
        </div>
        <div class="og-preview-dialog__header-actions">
          <button
            type="button"
            class="og-preview-refresh-btn"
            :disabled="refreshing"
            title="Refresh preview snapshot from canvas"
            @click="$emit('refresh')"
          >
            <RefreshIcon :size="13" class="og-preview-refresh-btn__icon" :class="{ 'is-spinning': refreshing }" />
            <span>{{ refreshing ? 'Refreshing…' : 'Refresh' }}</span>
          </button>
          <button type="button" class="og-dialog-close-btn" aria-label="Close" @click="$emit('close')">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <!-- Platform Tabs -->
      <div class="og-platform-tabs">
        <button
          v-for="platform in platforms"
          :key="platform.id"
          type="button"
          class="og-platform-tab"
          :class="{ 'is-active': activePlatform === platform.id }"
          @click="activePlatform = platform.id"
        >
          <span class="og-platform-tab__icon">
            <svg v-if="platform.id === 'twitter'" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <ChatIcon v-else-if="platform.id === 'imessage'" :size="14" />
            <DiscordIcon v-else-if="platform.id === 'discord'" style="width: 14px; height: 14px;" />
            <svg v-else-if="platform.id === 'whatsapp'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
          </span>
          <span>{{ platform.label }}</span>
        </button>
      </div>

      <!-- Preview Stage Container -->
      <div class="og-preview-stage">
        <!-- 1. Twitter / X Mockup -->
        <div v-if="activePlatform === 'twitter'" class="og-mockup-twitter">
          <div class="og-mockup-twitter__tweet">
            <div class="og-mockup-twitter__user-row">
              <div class="og-mockup-avatar">{{ authorInitials }}</div>
              <div class="og-mockup-twitter__names">
                <span class="og-mockup-twitter__name">{{ authorName }}</span>
                <span class="og-mockup-twitter__handle">@{{ authorHandle }} · 1m</span>
              </div>
            </div>
            <div class="og-mockup-twitter__text">
              Check out my grid! Links, media, and stories curated in one place:
              <span class="og-mockup-link">https://grids.so/{{ authorHandle }}</span>
            </div>

            <!-- Twitter Large Card -->
            <div class="og-twitter-card">
              <div class="og-twitter-card__img-wrap">
                <img v-if="previewImageSrc" :src="previewImageSrc" alt="OG Preview" class="og-twitter-card__img" />
                <div v-else class="og-twitter-card__img-placeholder">
                  <span>Generating preview…</span>
                </div>
              </div>
              <div class="og-twitter-card__info">
                <span class="og-twitter-card__domain">grids.so</span>
                <h4 class="og-twitter-card__title">{{ title }}</h4>
                <p class="og-twitter-card__desc">{{ subtitle }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. iMessage Mockup -->
        <div v-else-if="activePlatform === 'imessage'" class="og-mockup-imessage">
          <div class="og-imessage-bubble">
            <div class="og-imessage-bubble__img-wrap">
              <img v-if="previewImageSrc" :src="previewImageSrc" alt="OG Preview" class="og-imessage-bubble__img" />
              <div v-else class="og-imessage-bubble__placeholder">Preview Image</div>
            </div>
            <div class="og-imessage-bubble__meta">
              <span class="og-imessage-bubble__domain">GRIDS.SO</span>
              <h4 class="og-imessage-bubble__title">{{ title }}</h4>
              <span class="og-imessage-bubble__sub">{{ subtitle }}</span>
            </div>
          </div>
        </div>

        <!-- 3. Discord Embed Mockup -->
        <div v-else-if="activePlatform === 'discord'" class="og-mockup-discord">
          <div class="og-discord-msg">
            <div class="og-discord-msg__avatar">{{ authorInitials }}</div>
            <div class="og-discord-msg__content">
              <div class="og-discord-msg__header">
                <span class="og-discord-msg__username">{{ authorName }}</span>
                <span class="og-discord-msg__time">Today at 12:45 PM</span>
              </div>
              <div class="og-discord-msg__text">https://grids.so/{{ authorHandle }}</div>

              <!-- Discord Rich Embed -->
              <div class="og-discord-embed">
                <div class="og-discord-embed__domain">Grids</div>
                <h4 class="og-discord-embed__title">{{ title }}</h4>
                <p class="og-discord-embed__desc">{{ subtitle }}</p>
                <div class="og-discord-embed__img-wrap">
                  <img v-if="previewImageSrc" :src="previewImageSrc" alt="OG Preview" class="og-discord-embed__img" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. WhatsApp Mockup -->
        <div v-else-if="activePlatform === 'whatsapp'" class="og-mockup-whatsapp">
          <div class="og-wa-bubble">
            <div class="og-wa-card">
              <div class="og-wa-card__img-wrap">
                <img v-if="previewImageSrc" :src="previewImageSrc" alt="OG Preview" class="og-wa-card__img" />
              </div>
              <div class="og-wa-card__meta">
                <h4 class="og-wa-card__title">{{ title }}</h4>
                <p class="og-wa-card__desc">{{ subtitle }}</p>
                <span class="og-wa-card__domain">grids.so</span>
              </div>
            </div>
            <div class="og-wa-bubble__link">
              https://grids.so/{{ authorHandle }}
              <span class="og-wa-bubble__time">12:45 PM</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <footer class="og-preview-dialog__footer">
        <Button variant="secondary" size="md" @click="$emit('close')">
          Close Preview
        </Button>
        <Button
          variant="primary"
          size="md"
          :loading="isApplying"
          @click="$emit('apply')"
        >
          <template #icon-left>
            <CheckIcon :size="16" />
          </template>
          Apply to Grid
        </Button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Button from "@/components/ui-elements/Button.vue";
import CheckIcon from "@/components/icons/CheckIcon.vue";
import RefreshIcon from "@/components/icons/RefreshIcon.vue";
import ChatIcon from "@/components/icons/ChatIcon.vue";
import DiscordIcon from "@/components/icons/DiscordIcon.vue";

defineProps<{
  previewImageSrc?: string;
  title: string;
  subtitle: string;
  authorName: string;
  authorHandle: string;
  authorInitials: string;
  isApplying?: boolean;
  refreshing?: boolean;
}>();

defineEmits<{
  close: [];
  apply: [];
  refresh: [];
}>();

const platforms = [
  { id: "twitter", label: "Twitter / X" },
  { id: "imessage", label: "iMessage" },
  { id: "discord", label: "Discord" },
  { id: "whatsapp", label: "WhatsApp" },
];

const activePlatform = ref("twitter");
</script>

<style lang="scss" scoped>
.og-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(10px);
  z-index: calc(var(--z-topbar, 2000) + 150);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md);
}

.og-preview-dialog {
  width: 100%;
  max-width: 680px;
  max-height: 90vh;
  background: #141417;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 18px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #ffffff;
}

.og-preview-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.og-preview-dialog__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
}

.og-preview-dialog__desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: #a1a1aa;
  line-height: 1.4;
}

.og-preview-dialog__header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.og-preview-refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(255, 255, 255, 0.25);
    color: #ffffff;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &__icon {
    flex-shrink: 0;
    color: var(--color-figma-purple, #a855f7);

    &.is-spinning {
      animation: og-spin 0.8s linear infinite;
    }
  }
}

@keyframes og-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.og-dialog-close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;

  svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    display: block;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.3);
  }
}

.og-platform-tabs {
  display: flex;
  gap: 6px;
  padding: 12px 24px;
  background: #0d0d10;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  overflow-x: auto;
}

.og-platform-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  color: #a1a1aa;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  &:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.04);
  }

  &.is-active {
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.4);
    color: #ffffff;
  }
}

.og-platform-tab__icon {
  font-size: 14px;
}

.og-preview-stage {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: #0a0a0c;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 340px;
}

/* ── Twitter Mockup ──────────────────────────────────────────────────────── */
.og-mockup-twitter {
  width: 100%;
  max-width: 500px;
}

.og-mockup-twitter__tweet {
  background: #000000;
  border: 1px solid #2f3336;
  border-radius: 16px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.og-mockup-twitter__user-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.og-mockup-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #7b61ff;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.og-mockup-twitter__names {
  display: flex;
  flex-direction: column;
}

.og-mockup-twitter__name {
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
}

.og-mockup-twitter__handle {
  font-size: 12px;
  color: #71767b;
}

.og-mockup-twitter__text {
  font-size: 14px;
  color: #e7e9ea;
  line-height: 1.4;
}

.og-mockup-link {
  color: #1d9bf0;
}

.og-twitter-card {
  border: 1px solid #2f3336;
  border-radius: 14px;
  overflow: hidden;
  background: #000000;
  transition: border-color 0.15s ease;
}

.og-twitter-card__img-wrap {
  width: 100%;
  aspect-ratio: 1.91 / 1;
  background: #18181b;
  overflow: hidden;
}

.og-twitter-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.og-twitter-card__img-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #71717a;
  font-size: 13px;
}

.og-twitter-card__info {
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.og-twitter-card__domain {
  font-size: 12px;
  color: #71767b;
}

.og-twitter-card__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #e7e9ea;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.og-twitter-card__desc {
  margin: 0;
  font-size: 12px;
  color: #71767b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── iMessage Mockup ─────────────────────────────────────────────────────── */
.og-mockup-imessage {
  width: 100%;
  max-width: 360px;
}

.og-imessage-bubble {
  background: #26252a;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.og-imessage-bubble__img-wrap {
  width: 100%;
  aspect-ratio: 1.91 / 1;
  background: #1c1b20;
}

.og-imessage-bubble__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.og-imessage-bubble__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8e8e93;
}

.og-imessage-bubble__meta {
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.og-imessage-bubble__domain {
  font-size: 10px;
  font-weight: 700;
  color: #8e8e93;
  letter-spacing: 0.04em;
}

.og-imessage-bubble__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.og-imessage-bubble__sub {
  font-size: 12px;
  color: #8e8e93;
}

/* ── Discord Mockup ──────────────────────────────────────────────────────── */
.og-mockup-discord {
  width: 100%;
  max-width: 460px;
}

.og-discord-msg {
  background: #313338;
  border-radius: 8px;
  padding: 14px;
  display: flex;
  gap: 12px;
}

.og-discord-msg__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #5865f2;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.og-discord-msg__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.og-discord-msg__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.og-discord-msg__username {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.og-discord-msg__time {
  font-size: 11px;
  color: #949ba4;
}

.og-discord-msg__text {
  font-size: 14px;
  color: #00a8fc;
}

.og-discord-embed {
  background: #2b2d31;
  border-left: 4px solid #5865f2;
  border-radius: 4px;
  padding: 12px;
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.og-discord-embed__domain {
  font-size: 11px;
  color: #949ba4;
}

.og-discord-embed__title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #00a8fc;
}

.og-discord-embed__desc {
  margin: 0;
  font-size: 12px;
  color: #dbdee1;
  line-height: 1.35;
}

.og-discord-embed__img-wrap {
  margin-top: 8px;
  border-radius: 4px;
  overflow: hidden;
  max-width: 380px;
}

.og-discord-embed__img {
  width: 100%;
  display: block;
  border-radius: 4px;
}

/* ── WhatsApp Mockup ─────────────────────────────────────────────────────── */
.og-mockup-whatsapp {
  width: 100%;
  max-width: 380px;
}

.og-wa-bubble {
  background: #005c4b;
  border-radius: 12px 12px 2px 12px;
  padding: 6px;
  color: #ffffff;
}

.og-wa-card {
  background: rgba(0, 0, 0, 0.25);
  border-radius: 8px;
  overflow: hidden;
}

.og-wa-card__img-wrap {
  width: 100%;
  aspect-ratio: 1.91 / 1;
}

.og-wa-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.og-wa-card__meta {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.og-wa-card__title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.og-wa-card__desc {
  margin: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.og-wa-card__domain {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
}

.og-wa-bubble__link {
  padding: 6px 4px 2px;
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.og-wa-bubble__time {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

.og-preview-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: #141417;
}
</style>
