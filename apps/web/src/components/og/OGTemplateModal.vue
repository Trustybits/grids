<template>
  <div class="og-modal-backdrop modal-overlay" @click.self="$emit('close')">
    <div class="og-template-dialog" role="dialog" aria-modal="true" aria-label="Choose Layout Template">
      <header class="og-template-dialog__header">
        <div>
          <h3 class="og-template-dialog__title">Layout Templates</h3>
          <p class="og-template-dialog__desc">
            Choose a curated layout style for your cards and branding. You can freely customize or switch back anytime.
          </p>
        </div>
        <button type="button" class="og-dialog-close-btn" @click="$emit('close')">
          <CloseXIcon :size="18" />
        </button>
      </header>

      <div class="og-template-grid">
        <div
          v-for="tpl in TEMPLATES"
          :key="tpl.id"
          class="og-template-card"
          :class="{ 'is-active': activeTemplate === tpl.id }"
          @click="selectTemplate(tpl.id)"
        >
          <!-- Thumbnail diagram -->
          <div class="og-template-card__preview">
            <!-- Center Stage -->
            <div v-if="tpl.id === 'center'" class="tpl-center-diagram">
              <div class="tpl-col tpl-col--tiles">
                <div class="tpl-mini-tile" />
                <div class="tpl-mini-tile" />
              </div>
              <div class="tpl-col tpl-col--center">
                <div class="tpl-mini-avatar" />
                <div class="tpl-mini-line tpl-mini-line--name" />
                <div class="tpl-mini-line tpl-mini-line--sub" />
              </div>
              <div class="tpl-col tpl-col--tiles">
                <div class="tpl-mini-tile" />
                <div class="tpl-mini-tile" />
              </div>
            </div>

            <!-- Split Minimalist -->
            <div v-else-if="tpl.id === 'split'" class="tpl-split-diagram">
              <div class="tpl-split-left">
                <div class="tpl-mini-avatar tpl-mini-avatar--lg" />
                <div class="tpl-mini-line tpl-mini-line--name" />
                <div class="tpl-mini-line tpl-mini-line--sub" />
                <div class="tpl-mini-line tpl-mini-line--handle" />
              </div>
              <div class="tpl-split-right">
                <div class="tpl-mini-tile" />
                <div class="tpl-mini-tile" />
                <div class="tpl-mini-tile" />
                <div class="tpl-mini-tile" />
              </div>
            </div>

            <!-- Hero Showcase -->
            <div v-else-if="tpl.id === 'hero'" class="tpl-hero-diagram">
              <div class="tpl-hero-left">
                <div class="tpl-mini-avatar" />
                <div class="tpl-mini-line tpl-mini-line--name" />
              </div>
              <div class="tpl-hero-main">
                <div class="tpl-mini-tile tpl-mini-tile--hero" />
              </div>
              <div class="tpl-hero-right">
                <div class="tpl-mini-tile" />
                <div class="tpl-mini-tile" />
              </div>
            </div>

            <!-- Bottom Gallery -->
            <div v-else-if="tpl.id === 'gallery'" class="tpl-gallery-diagram">
              <div class="tpl-gallery-top">
                <div class="tpl-mini-tile" />
                <div class="tpl-mini-tile" />
                <div class="tpl-mini-tile" />
              </div>
              <div class="tpl-gallery-bottom">
                <div class="tpl-mini-avatar tpl-mini-avatar--sm" />
                <div class="tpl-mini-line tpl-mini-line--name" />
                <div class="tpl-mini-line tpl-mini-line--handle" />
              </div>
            </div>

            <!-- Orbiting Cascade -->
            <div v-else class="tpl-orbit-diagram">
              <div class="tpl-mini-avatar" />
              <div class="tpl-mini-tile tpl-orbit-1" />
              <div class="tpl-mini-tile tpl-orbit-2" />
              <div class="tpl-mini-tile tpl-orbit-3" />
              <div class="tpl-mini-tile tpl-orbit-4" />
            </div>
          </div>

          <div class="og-template-card__info">
            <div class="og-template-card__header-row">
              <h4 class="og-template-card__name">{{ tpl.name }}</h4>
              <span v-if="activeTemplate === tpl.id" class="og-template-card__active-badge">Active</span>
            </div>
            <p class="og-template-card__desc">{{ tpl.desc }}</p>
          </div>
        </div>
      </div>

      <footer class="og-template-dialog__footer">
        <Button variant="secondary" size="md" @click="$emit('close')">
          Cancel
        </Button>
        <Button variant="primary" size="md" @click="confirmTemplate">
          Apply Template
        </Button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Button from "@/components/ui-elements/Button.vue";
import CloseXIcon from "@/components/icons/CloseXIcon.vue";

const props = defineProps<{
  currentTemplate?: string;
}>();

const emit = defineEmits<{
  close: [];
  "select-template": [templateId: string];
}>();

const TEMPLATES = [
  {
    id: "center",
    name: "Center Stage (Classic)",
    desc: "Avatar & profile centered in the safe zone with cards symmetrically arranged in the wings.",
  },
  {
    id: "split",
    name: "Split Minimalist",
    desc: "Bold branding column on the left with a 2×2 showcase card grid on the right.",
  },
  {
    id: "hero",
    name: "Hero Showcase",
    desc: "Large featured hero tile with author badge on top-left and auxiliary accent cards.",
  },
  {
    id: "gallery",
    name: "Bottom Gallery Strip",
    desc: "Horizontal row of featured cards with sleek branding bar anchored along the bottom.",
  },
  {
    id: "orbits",
    name: "Orbiting Fan",
    desc: "Dynamic tilted cards orbiting around the central author profile.",
  },
];

const activeTemplate = ref(props.currentTemplate || "center");

const selectTemplate = (id: string) => {
  activeTemplate.value = id;
};

const confirmTemplate = () => {
  emit("select-template", activeTemplate.value);
  emit("close");
};
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

.og-template-dialog {
  width: 100%;
  max-width: 760px;
  max-height: 90vh;
  background: #141417;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 18px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #ffffff;
}

.og-template-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.og-template-dialog__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.og-template-dialog__desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: #a1a1aa;
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

.og-template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
}

.og-template-card {
  background: #0d0d10;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
  }

  &.is-active {
    border-color: var(--color-figma-purple, #a855f7);
    background: rgba(168, 85, 247, 0.06);
    box-shadow: 0 0 0 1px var(--color-figma-purple, #a855f7);
  }
}

.og-template-card__preview {
  width: 100%;
  aspect-ratio: 1.91 / 1;
  background: #18181c;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.og-template-card__header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.og-template-card__name {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
}

.og-template-card__active-badge {
  font-size: 9px;
  font-weight: 700;
  color: var(--color-figma-purple, #a855f7);
  background: rgba(168, 85, 247, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
}

.og-template-card__desc {
  margin: 2px 0 0;
  font-size: 11px;
  color: #71717a;
  line-height: 1.35;
}

/* ── Diagrams ────────────────────────────────────────────────────────────── */
.tpl-mini-tile {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: rgba(168, 85, 247, 0.4);
  border: 1px solid rgba(168, 85, 247, 0.6);

  &--hero {
    width: 46px;
    height: 46px;
  }
}

.tpl-mini-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;

  &--lg {
    width: 24px;
    height: 24px;
  }

  &--sm {
    width: 14px;
    height: 14px;
  }
}

.tpl-mini-line {
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.4);

  &--name {
    width: 32px;
  }

  &--sub {
    width: 22px;
  }

  &--handle {
    width: 28px;
  }
}

.tpl-center-diagram {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.tpl-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.tpl-split-diagram {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
}

.tpl-split-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tpl-split-right {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.tpl-hero-diagram {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.tpl-hero-left,
.tpl-hero-right {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tpl-gallery-diagram {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.tpl-gallery-top {
  display: flex;
  gap: 6px;
}

.tpl-gallery-bottom {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tpl-orbit-diagram {
  position: relative;
  width: 70px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;

  .tpl-mini-tile {
    position: absolute;
    width: 18px;
    height: 18px;
  }

  .tpl-orbit-1 { top: 0; left: 6px; transform: rotate(-8deg); }
  .tpl-orbit-2 { top: 6px; right: 0; transform: rotate(12deg); }
  .tpl-orbit-3 { bottom: 0; right: 6px; transform: rotate(-6deg); }
  .tpl-orbit-4 { bottom: 6px; left: 0; transform: rotate(10deg); }
}

.og-template-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: #0e0e11;
}
</style>
