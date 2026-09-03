<template>
  <div class="og-modal-backdrop modal-overlay" @click.self="dismiss">
    <div class="og-tour-dialog" role="dialog" aria-modal="true" aria-label="OpenGraph Studio Quick Tour">
      <!-- Close button (floating top-right) -->
      <button type="button" class="og-dialog-close-btn og-tour-close" aria-label="Close" @click="dismiss">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>

      <!-- Hero Visual Banner -->
      <div class="og-tour-banner">
        <div class="og-tour-banner__glow" />

        <!-- Floating Share Platform Pills -->
        <div class="og-tour-banner__platform og-tour-banner__platform--left">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          <span>Twitter / X</span>
        </div>
        <div class="og-tour-banner__platform og-tour-banner__platform--right">
          <ChatIcon :size="12" />
          <span>iMessage</span>
        </div>

        <!-- Mini Preview Card Illustration -->
        <div class="og-tour-hero-card">
          <div class="og-tour-hero-card__stage">
            <!-- Central Avatar & Branding -->
            <div class="og-tour-hero-card__branding">
              <div class="og-tour-mini-avatar">OG</div>
              <div class="og-tour-mini-line og-tour-mini-line--title" />
              <div class="og-tour-mini-line og-tour-mini-line--sub" />
            </div>

            <!-- Floating Mini Tiles with tilt -->
            <div class="og-tour-float-tile og-tour-float-tile--1">
              <div class="float-tile-badge">Photo</div>
              <div class="float-tile-media" />
            </div>
            <div class="og-tour-float-tile og-tour-float-tile--2">
              <div class="float-tile-badge">Chart</div>
              <div class="float-tile-chart">
                <span style="height: 40%" />
                <span style="height: 80%" />
                <span style="height: 60%" />
                <span style="height: 100%" />
              </div>
            </div>
          </div>

          <div class="og-tour-hero-card__bottom">
            <span class="og-tour-domain">grids.so</span>
            <span class="og-tour-live-tag">LIVE PREVIEW</span>
          </div>
        </div>
      </div>

      <!-- Tour Content -->
      <div class="og-tour-body">
        <header class="og-tour-header">
          <div class="og-tour-badge">
            <span class="og-tour-badge__dot" />
            OpenGraph Studio
          </div>
          <h2 class="og-tour-title">Design Your Social Share Card</h2>
          <p class="og-tour-desc">
            Whenever your grid link is shared on <strong>Twitter, WhatsApp, iMessage, Discord,</strong> or <strong>Slack</strong>, this card is what people see first.
          </p>
        </header>

        <!-- 3 Feature Step Cards -->
        <div class="og-tour-grid">
          <div class="og-tour-card">
            <div class="og-tour-card__icon-wrap og-tour-card__icon-wrap--purple">
              <AddTileIcon :size="18" />
            </div>
            <div class="og-tour-card__content">
              <h4 class="og-tour-card__title">Real Grid Cards</h4>
              <p class="og-tour-card__text">
                Place, scale, tilt, and toggle light/dark modes on real tiles from your grid.
              </p>
            </div>
          </div>

          <div class="og-tour-card">
            <div class="og-tour-card__icon-wrap og-tour-card__icon-wrap--blue">
              <GridSquaresIcon :size="18" />
            </div>
            <div class="og-tour-card__content">
              <h4 class="og-tour-card__title">Curated Layouts</h4>
              <p class="og-tour-card__text">
                Switch instantly between Split, Hero, Gallery, and Orbiting layout presets.
              </p>
            </div>
          </div>

          <div class="og-tour-card">
            <div class="og-tour-card__icon-wrap og-tour-card__icon-wrap--green">
              <EyeIcon :size="18" />
            </div>
            <div class="og-tour-card__content">
              <h4 class="og-tour-card__title">Multi-Platform Preview</h4>
              <p class="og-tour-card__text">
                Test real-time mockups for Twitter, iMessage & WhatsApp before applying live.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="og-tour-dialog__footer">
        <label class="og-tour-checkbox-label">
          <input type="checkbox" v-model="dontShowAgain" />
          <span>Don't show this again</span>
        </label>
        <Button variant="primary" size="md" class="og-tour-start-btn" @click="dismiss">
          <span>Start Designing</span>
          <template #icon-right>
            <ArrowRightIcon :size="15" />
          </template>
        </Button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Button from "@/components/ui-elements/Button.vue";
import AddTileIcon from "@/components/icons/AddTileIcon.vue";
import GridSquaresIcon from "@/components/icons/GridSquaresIcon.vue";
import EyeIcon from "@/components/icons/EyeIcon.vue";
import ArrowRightIcon from "@/components/icons/ArrowRightIcon.vue";
import ChatIcon from "@/components/icons/ChatIcon.vue";

const emit = defineEmits<{
  close: [];
}>();

const dontShowAgain = ref(false);

const dismiss = () => {
  if (dontShowAgain.value) {
    try {
      localStorage.setItem("grids_og_tour_seen", "true");
    } catch {
      // ignore
    }
  }
  emit("close");
};
</script>

<style lang="scss" scoped>
.og-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(14px);
  z-index: calc(var(--z-topbar, 2000) + 160);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.og-tour-dialog {
  width: 100%;
  max-width: 580px;
  background: #131317;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 20px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  color: #ffffff;
  animation: og-dialog-pop 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes og-dialog-pop {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(6px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.og-tour-close {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 10;
}

.og-dialog-close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(8px);
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

.og-tour-banner {
  height: 180px;
  background: radial-gradient(circle at 50% 30%, #251d3b 0%, #101014 90%);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.og-tour-banner__glow {
  position: absolute;
  width: 280px;
  height: 120px;
  background: radial-gradient(ellipse, rgba(168, 85, 247, 0.35) 0%, rgba(99, 102, 241, 0) 70%);
  filter: blur(28px);
  pointer-events: none;
}

.og-tour-banner__platform {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 9999px;
  background: rgba(18, 18, 24, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
  font-size: 11px;
  font-weight: 600;
  color: #ffffff;
  backdrop-filter: blur(8px);
  animation: og-float 3.5s ease-in-out infinite alternate;

  &--left {
    top: 24px;
    left: 24px;
  }

  &--right {
    bottom: 24px;
    right: 24px;
    animation-delay: -1.75s;
  }
}

@keyframes og-float {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-5px);
  }
}

.og-tour-hero-card {
  width: 280px;
  background: #1c1a24;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.65), 0 0 20px rgba(168, 85, 247, 0.15);
  position: relative;
}

.og-tour-hero-card__stage {
  height: 110px;
  background: linear-gradient(135deg, #2b1f48 0%, #161224 100%);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
}

.og-tour-hero-card__branding {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.og-tour-mini-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #a855f7, #6366f1);
  border: 1.5px solid #ffffff;
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
}

.og-tour-mini-line {
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.4);

  &--title {
    width: 48px;
    background: #ffffff;
  }

  &--sub {
    width: 32px;
  }
}

.og-tour-float-tile {
  position: absolute;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 4px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);

  &--1 {
    top: 14px;
    left: 14px;
    width: 54px;
    height: 48px;
    transform: rotate(-7deg);

    .float-tile-media {
      width: 100%;
      height: 26px;
      border-radius: 3px;
      background: linear-gradient(135deg, rgba(236, 72, 153, 0.5), rgba(168, 85, 247, 0.5));
      margin-top: 3px;
    }
  }

  &--2 {
    bottom: 12px;
    right: 14px;
    width: 56px;
    height: 48px;
    transform: rotate(8deg);

    .float-tile-chart {
      display: flex;
      align-items: flex-end;
      gap: 3px;
      height: 26px;
      margin-top: 3px;

      span {
        flex: 1;
        background: var(--color-figma-purple, #a855f7);
        border-radius: 2px;
      }
    }
  }
}

.float-tile-badge {
  font-size: 7px;
  font-weight: 700;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.05em;
}

.og-tour-hero-card__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #111114;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.og-tour-domain {
  font-size: 10px;
  color: #a1a1aa;
  font-weight: 500;
}

.og-tour-live-tag {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.12);
  padding: 2px 6px;
  border-radius: 4px;
}

.og-tour-body {
  padding: 22px 26px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.og-tour-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.og-tour-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-figma-purple, #a855f7);
  width: fit-content;

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-figma-purple, #a855f7);
    box-shadow: 0 0 8px var(--color-figma-purple, #a855f7);
  }
}

.og-tour-title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.02em;
}

.og-tour-desc {
  margin: 0;
  font-size: 13px;
  color: #a1a1aa;
  line-height: 1.5;

  strong {
    color: #ffffff;
  }
}

.og-tour-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.og-tour-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.15);
  }
}

.og-tour-card__icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &--purple {
    background: rgba(168, 85, 247, 0.15);
    border: 1px solid rgba(168, 85, 247, 0.3);
    color: #c084fc;
  }

  &--blue {
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #60a5fa;
  }

  &--green {
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #4ade80;
  }
}

.og-tour-card__content {
  flex: 1;
}

.og-tour-card__title {
  margin: 0 0 2px;
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
}

.og-tour-card__text {
  margin: 0;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.4;
}

.og-tour-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 26px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: #0d0d10;
}

.og-tour-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #71717a;
  cursor: pointer;
  user-select: none;

  input {
    accent-color: var(--color-figma-purple, #a855f7);
    cursor: pointer;
    width: 15px;
    height: 15px;
  }

  &:hover {
    color: #a1a1aa;
  }
}

.og-tour-start-btn {
  min-width: 140px;
  font-weight: 700;
}
</style>
