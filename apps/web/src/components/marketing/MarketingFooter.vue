<template>
  <footer class="mkt__footer">
    <!-- Receding perspective grid "shader" — pure CSS, sits behind content. -->
    <div class="mkt__footer-shader" aria-hidden="true">
      <div class="mkt__footer-grid"></div>
      <div class="mkt__footer-glow"></div>
    </div>

    <div class="mkt__footer-inner">
      <div class="mkt__footer-top">
        <div class="mkt__footer-lead">
          <strong class="mkt__footer-brand">
            <span class="mkt__brand-mark" aria-hidden="true">
              <GridsMark />
            </span>
            <span class="mkt__brand-word">grids</span>
          </strong>
          <p>The open-source grid builder. Your page, in one link.</p>
        </div>

        <div class="mkt__footer-links">
          <div class="mkt__footer-col">
            <h4>Product</h4>
            <router-link to="/pricing">Pricing</router-link>
            <a
              href="https://discord.com/channels/1452087541548191940/1464413220549955768"
              target="_blank"
              rel="noopener noreferrer"
            >What's New</a>
          </div>
          <div class="mkt__footer-col">
            <h4>Company</h4>
            <router-link to="/privacy">Privacy Policy</router-link>
            <router-link to="/terms">Terms</router-link>
            <a href="https://discord.gg/DBscN5NUN6" target="_blank" rel="noopener noreferrer">Discord Server</a>
          </div>
        </div>
      </div>

      <!-- Oversized ghost wordmark for a bolder footer presence. -->
      <div class="mkt__footer-wordmark" aria-hidden="true">grids</div>

      <div class="mkt__footer-base">
        <span>© {{ year }} grids</span>
        <span>Made for makers.</span>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import GridsMark from '@/components/icons/GridsMark.vue';

const year = computed(() => new Date().getFullYear());
</script>

<style scoped>
.mkt__footer {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  width: 100%;
  margin: 96px auto 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: var(--mkt-bg-0);
}

/* ── Grid shader ──────────────────────────────────────────────────────── */
.mkt__footer-shader {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
}
/*
  A neon-purple grid floor drawn in 3D perspective and slowly scrolling
  towards the viewer, faded out towards the top so it dissolves into the
  page. This is the "grid layout shader" behind the footer.
*/
.mkt__footer-grid {
  position: absolute;
  left: 50%;
  bottom: -12%;
  width: 320%;
  height: 165%;
  transform: translateX(-50%) perspective(500px) rotateX(60deg);
  transform-origin: 50% 100%;
  background-image:
    linear-gradient(to right, color-mix(in srgb, var(--mkt-brand-400) 70%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, var(--mkt-brand-400) 70%, transparent) 1px, transparent 1px);
  background-size: 48px 48px;
  animation: mkt-grid-flow 5.5s linear infinite;
  -webkit-mask-image: linear-gradient(to top, #000 6%, transparent 86%);
  mask-image: linear-gradient(to top, #000 6%, transparent 86%);
  opacity: 0.6;
}
/* Soft brand glow sitting on the horizon line. */
.mkt__footer-glow {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 90%;
  height: 240px;
  transform: translateX(-50%);
  background: radial-gradient(
    ellipse 60% 100% at 50% 100%,
    color-mix(in srgb, var(--mkt-brand-500) 35%, transparent),
    transparent 70%
  );
  pointer-events: none;
}
@keyframes mkt-grid-flow {
  to { background-position: 0 46px; }
}
@media (prefers-reduced-motion: reduce) {
  .mkt__footer-grid { animation: none; }
}

/* ── Content ──────────────────────────────────────────────────────────── */
.mkt__footer-inner {
  position: relative;
  width: 100%;
  /* Match the page content column so the footer lines up with the sections
     above it (rather than the wider nav/chrome width). */
  max-width: var(--mkt-section-max);
  margin: 0 auto;
  padding: 88px var(--mkt-section-x) 36px;
  box-sizing: border-box;
}
.mkt__footer-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 48px;
  text-align: left;
}
.mkt__footer-links {
  display: flex;
  gap: 72px;
}
.mkt__footer-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-size: 26px;
  letter-spacing: -0.04em;
  margin-bottom: 14px;
}
.mkt__brand-word {
  font-family: var(--mkt-font-brand);
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: lowercase;
}
.mkt__brand-mark {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--mkt-fg-1);
}
.mkt__brand-mark :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
.mkt__footer-lead p {
  color: rgba(255, 255, 255, 0.55);
  max-width: 300px;
  font: 400 15px/1.55 var(--mkt-font-sans);
}
.mkt__footer-col h4 {
  margin: 0 0 16px;
  font: 600 12px/1 var(--mkt-font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
}
.mkt__footer-col a {
  display: block;
  color: rgba(255, 255, 255, 0.75);
  margin-bottom: 12px;
  text-decoration: none;
  font-size: 15px;
  transition: color 160ms ease;
}
.mkt__footer-col a:hover {
  color: var(--mkt-fg-1);
}

/* Oversized ghost wordmark. */
.mkt__footer-wordmark {
  font-family: var(--mkt-font-brand);
  font-weight: 900;
  text-transform: lowercase;
  line-height: 0.9;
  font-size: clamp(5rem, 20vw, 15rem);
  letter-spacing: -0.02em;
  margin: 40px 0 8px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.32),
    rgba(255, 255, 255, 0.04)
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  user-select: none;
  pointer-events: none;
}

.mkt__footer-base {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.4);
  font: 400 13px/1 var(--mkt-font-mono);
}

@media (max-width: 800px) {
  .mkt__footer-top {
    flex-direction: column;
    gap: 40px;
  }
  .mkt__footer-links {
    gap: 48px;
  }
  .mkt__footer-inner {
    padding-left: 14px;
    padding-right: 14px;
  }
  .mkt__footer-base {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
