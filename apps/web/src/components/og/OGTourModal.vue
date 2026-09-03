<template>
  <div class="og-modal-backdrop modal-overlay" @click.self="dismiss">
    <div class="og-tour-dialog" role="dialog" aria-modal="true" aria-label="OpenGraph Studio Tour">
      <header class="og-tour-dialog__header">
        <div class="og-tour-badge">Quick Guide</div>
        <button type="button" class="og-dialog-close-btn" @click="dismiss">
          <CloseXIcon :size="18" />
        </button>
      </header>

      <div class="og-tour-slides">
        <div class="og-tour-slide">
          <div class="og-tour-icon-wrap">
            <span class="og-tour-hero-icon">🌐</span>
          </div>

          <h3 class="og-tour-title">Welcome to OpenGraph Editor</h3>
          <p class="og-tour-desc">
            OpenGraph is the universal protocol that generates visual preview cards whenever your grid link is shared on
            <strong>Twitter, WhatsApp, iMessage, Discord, Slack</strong>, and beyond.
          </p>

          <div class="og-tour-features">
            <div class="og-tour-feat-item">
              <span class="og-tour-feat-bullet">✨</span>
              <div>
                <strong>Authentic Grid Cards</strong>: Place, scale, and rotate cards from your actual grid directly on canvas.
              </div>
            </div>

            <div class="og-tour-feat-item">
              <span class="og-tour-feat-bullet">🎬</span>
              <div>
                <strong>Motion & Animations</strong>: Static PNGs work everywhere! If you add motion or export GIFs, platforms with rich animation support (like Discord) will play them, while static platforms cleanly display the first frame.
              </div>
            </div>

            <div class="og-tour-feat-item">
              <span class="og-tour-feat-bullet">🚀</span>
              <div>
                <strong>1-Click Instant Apply</strong>: When you're happy with your design, click <em>Apply to Grid</em> to instantly set it as your public social share card!
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer class="og-tour-dialog__footer">
        <label class="og-tour-checkbox-label">
          <input type="checkbox" v-model="dontShowAgain" />
          <span>Don't show this again</span>
        </label>
        <Button variant="primary" size="md" @click="dismiss">
          Got It, Let's Design!
        </Button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Button from "@/components/ui-elements/Button.vue";
import CloseXIcon from "@/components/icons/CloseXIcon.vue";

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
  background: rgba(0, 0, 0, 0.84);
  backdrop-filter: blur(12px);
  z-index: calc(var(--z-modal, 1050) + 60);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md);
}

.og-tour-dialog {
  width: 100%;
  max-width: 520px;
  background: #141417;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #ffffff;
}

.og-tour-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px 10px;
}

.og-tour-badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-figma-purple, #a855f7);
  background: rgba(168, 85, 247, 0.15);
  padding: 3px 10px;
  border-radius: 9999px;
}

.og-dialog-close-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: none;
  color: #a1a1aa;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
  }
}

.og-tour-slides {
  padding: 10px 24px 20px;
}

.og-tour-slide {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.og-tour-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(59, 130, 246, 0.25));
  border: 1px solid rgba(168, 85, 247, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.og-tour-hero-icon {
  font-size: 28px;
}

.og-tour-title {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
}

.og-tour-desc {
  margin: 0 0 18px;
  font-size: 13px;
  color: #a1a1aa;
  line-height: 1.5;
  max-width: 440px;

  strong {
    color: #ffffff;
  }
}

.og-tour-features {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
  width: 100%;
  background: #0a0a0c;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 14px 16px;
}

.og-tour-feat-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 12px;
  color: #d4d4d8;
  line-height: 1.45;

  strong {
    color: #ffffff;
  }
}

.og-tour-feat-bullet {
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 1px;
}

.og-tour-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: #0e0e11;
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
    cursor: pointer;
  }

  &:hover {
    color: #a1a1aa;
  }
}
</style>
