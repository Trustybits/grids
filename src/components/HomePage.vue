<template>
  <div class="home-landing">
    <div class="home-landing__grid-overlay" aria-hidden="true"></div>

    <header class="home-landing__topbar">
      <div class="home-landing__brand home-landing__topbar-reveal">Grids</div>
      <div class="home-landing__intro-tile" aria-hidden="true">
        <GridMenuIcon class="home-landing__intro-logo" />
      </div>
      <div class="home-landing__topbar-actions home-landing__topbar-reveal">
        <router-link class="home-landing__text-link" to="/pricing">Pricing</router-link>
        <router-link class="home-landing__btn home-landing__btn--ghost" to="/login">Log in</router-link>
      </div>
    </header>

    <main class="home-landing__content">
      <section class="home-landing__hero">
        <div class="home-landing__hero-copy">
          <p class="home-landing__eyebrow">Structured freedom for your internet presence</p>
          <h1 class="home-landing__title">Anyone can build and share a page.</h1>
          <p class="home-landing__subtitle">
            But how fast can you make something people will remember?
          </p>
          <div class="home-landing__hero-actions">
            <router-link class="home-landing__btn home-landing__btn--primary" to="/login">Start building free</router-link>
            <router-link class="home-landing__btn home-landing__btn--soft" to="/pricing">See plans</router-link>
          </div>
          <p class="home-landing__meta">No code. No blank-canvas overwhelm. Build and share quickly. Evolve it as you grow.</p>
        </div>
      </section>

      <section class="home-landing__section home-landing__section--demo">
        <p class="home-landing__section-kicker">Product demo</p>
        <h2 class="home-landing__section-title">From first tile to polished page in minutes</h2>
        <p class="home-landing__section-intro">
          Place your core message, stack your links, add media, then keep iterating as your projects evolve.
        </p>
        <div class="home-landing__demo-video">
          <div class="home-landing__demo-video-inner">
            <p class="home-landing__demo-video-label">App Walkthrough Video</p>
            <p class="home-landing__demo-video-note">
              Replace this block with your product demo embed (Loom, YouTube, or hosted video).
            </p>
          </div>
        </div>
      </section>

      <section class="home-landing__section">
        <p class="home-landing__section-kicker">Benefits</p>
        <h2 class="home-landing__section-title">Structure that keeps you fast, depth that keeps you growing</h2>
        <div class="home-landing__feature-grid">
          <article class="feature-card">
            <h3>Structured freedom by design</h3>
            <p>
              Not a full freeform web design tool and that is the advantage. Tiles keep things clear and
              coherent while still giving you room to create.
            </p>
          </article>
          <article class="feature-card">
            <h3>Powerful tile building blocks</h3>
            <p>
              Mix links, media, profile content, project highlights, notes, and more in one system that feels
              fast to use and strong enough for serious pages.
            </p>
          </article>
          <article class="feature-card">
            <h3>Built for anyone with something to share</h3>
            <p>
              Bring your work, ideas, followers, and traffic into one destination, whether you are a creator,
              founder, student, or team.
            </p>
          </article>
        </div>
      </section>

      <section class="home-landing__section">
        <p class="home-landing__section-kicker">Use cases</p>
        <h2 class="home-landing__section-title">One system, many kinds of pages</h2>
        <div class="home-landing__use-cases">
          <article class="use-case">
            <h3>Link in bio</h3>
            <p>Turn followers into deeper engagement with a clean, high-converting destination.</p>
          </article>
          <article class="use-case">
            <h3>Portfolio</h3>
            <p>Show projects, process, and contact routes without spending days on custom design.</p>
          </article>
          <article class="use-case">
            <h3>Digital garden</h3>
            <p>Publish notes, resources, and ideas in a layout that can evolve over time.</p>
          </article>
          <article class="use-case">
            <h3>Product or creator hub</h3>
            <p>Bring updates, media, social links, and community actions into one shareable page.</p>
          </article>
        </div>
      </section>

      <section class="home-landing__section">
        <p class="home-landing__section-kicker">Social proof</p>
        <h2 class="home-landing__section-title">Built for people who need to ship pages quickly</h2>
        <div class="home-landing__proof-grid">
          <article class="proof-card">
            <p class="proof-card__metric">Minutes, not days</p>
            <p>Get live fast and keep refining as your audience grows.</p>
          </article>
          <article class="proof-card">
            <p class="proof-card__metric">Built for iteration</p>
            <p>Tiles make updates painless, so your page stays current.</p>
          </article>
          <article class="proof-card">
            <p class="proof-card__metric">All-in-one destination</p>
            <p>Bring links, media, projects, and followers together in one place.</p>
          </article>
        </div>
      </section>

      <section class="home-landing__section home-landing__section--cta">
        <p class="home-landing__section-kicker">Pricing / CTA</p>
        <h2>Bring your links, media, projects, and audience into one grid.</h2>
        <p>Grids is built on tiles, simple building blocks that make page creation easy and fun while staying
            incredibly flexible. Create a polished link-in-bio, portfolio, digital garden, or project page
            without spending forever designing from scratch.</p>
        <router-link class="home-landing__btn home-landing__btn--primary" to="/login">Start building</router-link>
      </section>
    </main>

    <footer class="home-landing__footer">
      <a
        href="https://discord.gg/DBscN5NUN6"
        target="_blank"
        rel="noopener noreferrer"
        class="home-landing__discord-link"
      >
        <DiscordIcon />
        <span>Join Discord</span>
      </a>
      <span class="home-landing__footer-sep">·</span>
      <router-link class="home-landing__footer-link" to="/privacy">Privacy</router-link>
      <span class="home-landing__footer-sep">·</span>
      <router-link class="home-landing__footer-link" to="/terms">Terms</router-link>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import DiscordIcon from '@/components/icons/DiscordIcon.vue';
import GridMenuIcon from '@/components/icons/GridMenuIcon.vue';
import { usePageTitle } from '@/composables/usePageTitle';

const pageTitle = ref('Home');
usePageTitle(pageTitle);
</script>

<style scoped>
.home-landing {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--color-text-primary);
  background:
    radial-gradient(circle at 10% 15%, rgba(168, 218, 255, 0.16), transparent 40%),
    radial-gradient(circle at 85% 18%, rgba(211, 189, 255, 0.2), transparent 32%),
    linear-gradient(180deg, var(--color-content-background), var(--color-base-0, #111));
}

.home-landing__grid-overlay {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 36px 36px;
  mask-image: radial-gradient(circle at 50% 35%, black 30%, transparent 80%);
}

.home-landing__intro-tile {
  --intro-size: clamp(40px, 4vw, 96px);
  --intro-center-offset: calc(50vh - 82px);
  width: var(--intro-size);
  height: var(--intro-size);
  border-radius: var(--radius-sm);
  border: 2px solid rgba(255, 255, 255, 0.18);
  background:
    linear-gradient(145deg, rgba(168, 218, 255, 0.2), rgba(255, 255, 255, 0.04));
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  font-size: clamp(0.9rem, 1.5vw, 1.08rem);
  font-weight: var(--font-weight-semibold);
  transform: translateY(var(--intro-center-offset)) scale(0.15);
  opacity: 0;
  animation: intro-tile-sequence 2200ms var(--easing-smooth) forwards;
  pointer-events: none;
}

.home-landing__intro-logo {
  width: clamp(22px, 3vw, 28px);
  height: clamp(22px, 3vw, 28px);
}

.home-landing__topbar {
  position: relative;
  z-index: 1;
  width: min(1120px, 100%);
  margin: 0 auto;
  padding: var(--spacing-lg) var(--spacing-lg);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
}

.home-landing__topbar-reveal {
  opacity: 0;
  transform: translateY(22px);
  animation: home-content-enter 680ms var(--easing-smooth) forwards;
  animation-delay: 2050ms;
}

.home-landing__brand {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.02em;
}

.home-landing__topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  justify-self: end;
}

.home-landing__text-link {
  color: var(--color-content-high);
  text-decoration: none;
}

.home-landing__text-link:hover {
  color: var(--color-text-primary);
}

.home-landing__content {
  position: relative;
  z-index: 1;
  width: min(1120px, 100%);
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-xl) var(--spacing-4xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4xl);
  opacity: 0;
  transform: translateY(28px);
  animation: home-content-enter 760ms var(--easing-smooth) forwards;
  animation-delay: 2140ms;
}

.home-landing__hero {
  display: flex;
  justify-content: center;
  text-align: center;
  padding: var(--spacing-xl) 0 var(--spacing-lg);
}

.home-landing__hero-copy {
  max-width: 760px;
}

.home-landing__eyebrow {
  margin: 0 0 var(--spacing-sm);
  color: var(--color-content-high);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.home-landing__title {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3.7rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-weight: var(--font-weight-bold);
}

.home-landing__subtitle {
  margin: var(--spacing-lg) 0 0;
  max-width: 52ch;
  margin-left: auto;
  margin-right: auto;
  color: var(--color-content-default);
  font-size: var(--font-size-lg);
  line-height: 1.55;
}

.home-landing__hero-actions {
  margin-top: var(--spacing-xl);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--spacing-sm);
}

.home-landing__meta {
  margin-top: var(--spacing-md);
  color: var(--color-content-high);
  font-size: var(--font-size-sm);
}

.home-landing__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 11px 16px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  transition:
    transform var(--duration-fast) var(--easing-smooth),
    border-color var(--duration-fast) var(--easing-smooth),
    box-shadow var(--duration-fast) var(--easing-smooth),
    background-color var(--duration-fast) var(--easing-smooth);
}

.home-landing__btn:hover {
  transform: translateY(-1px);
}

.home-landing__btn--primary {
  color: var(--color-dark-0);
  background: linear-gradient(135deg, var(--color-cyan), var(--color-blue));
  box-shadow: var(--shadow-lg);
}

.home-landing__btn--soft {
  border-color: var(--color-border);
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.04);
}

.home-landing__btn--ghost {
  border-color: var(--color-border);
  color: var(--color-content-high);
  background: transparent;
}

.hero-tile__label {
  margin: 0 0 var(--spacing-sm);
  color: var(--color-content-high);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.hero-tile h3 {
  margin: 0;
  font-size: var(--font-size-lg);
}

.hero-tile p {
  margin: var(--spacing-sm) 0 0;
  color: var(--color-content-default);
  font-size: var(--font-size-md);
}

.home-landing__section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  padding: var(--spacing-xl) 0;
}

.home-landing__section-title {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 2rem);
}

.home-landing__section-kicker {
  margin: 0;
  color: var(--color-content-high);
  font-size: 0.76rem;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.home-landing__section-intro {
  margin: 0;
  color: var(--color-content-default);
  max-width: 62ch;
}

.home-landing__section--demo {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-xl);
  padding: var(--spacing-2xl);
  background: rgba(255, 255, 255, 0.02);
}

.home-landing__demo-video {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.04);
  padding: var(--spacing-sm);
}

.home-landing__demo-video-inner {
  aspect-ratio: 16 / 9;
  border-radius: calc(var(--radius-lg) - 4px);
  border: 1px dashed rgba(255, 255, 255, 0.24);
  background:
    radial-gradient(circle at 50% 20%, rgba(168, 218, 255, 0.18), transparent 48%),
    rgba(0, 0, 0, 0.16);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xl);
}

.home-landing__demo-video-label {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.home-landing__demo-video-note {
  margin: 0;
  max-width: 44ch;
  color: var(--color-content-default);
}

.feature-card,
.use-case,
.proof-card {
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
}

.home-landing__feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.feature-card {
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.03);
}

.feature-card h3 {
  margin: 0;
  font-size: var(--font-size-lg);
}

.feature-card p {
  margin: var(--spacing-sm) 0 0;
  color: var(--color-content-default);
}

.home-landing__use-cases {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.use-case {
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.03);
}

.use-case h3 {
  margin: 0;
}

.use-case p {
  margin: var(--spacing-sm) 0 0;
  color: var(--color-content-default);
}

.home-landing__proof-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.proof-card {
  border: 1px solid var(--color-border);
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
}

.proof-card__metric {
  margin: 0;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.proof-card p {
  margin: var(--spacing-sm) 0 0;
  color: var(--color-content-default);
}

.home-landing__section--cta {
  align-items: center;
  text-align: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--spacing-3xl) var(--spacing-2xl);
  background:
    linear-gradient(145deg, rgba(168, 218, 255, 0.14), rgba(255, 255, 255, 0.04));
}

.home-landing__section--cta h2 {
  margin: 0;
  font-size: clamp(1.5rem, 3.2vw, 2.2rem);
}

.home-landing__section--cta p {
  margin: 0;
  color: var(--color-content-default);
  max-width: 52ch;
}

.home-landing__footer {
  position: relative;
  z-index: 1;
  margin-top: auto;
  padding: var(--spacing-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  color: var(--color-content-low);
  opacity: 0;
  transform: translateY(22px);
  animation: home-content-enter 760ms var(--easing-smooth) forwards;
  animation-delay: 2220ms;
}

.home-landing__discord-link {
  color: var(--color-content-high);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.home-landing__discord-link:hover {
  color: #5865f2;
}

.home-landing__discord-link :deep(svg) {
  width: 18px;
  height: 18px;
}

.home-landing__footer-link {
  color: var(--color-content-low);
  text-decoration: none;
}

.home-landing__footer-link:hover {
  color: var(--color-content-high);
}

@keyframes intro-tile-sequence {
  0% {
    opacity: 0;
    transform: translateY(var(--intro-center-offset)) scale(0.15);
  }
  26% {
    opacity: 1;
    transform: translateY(var(--intro-center-offset)) scale(2);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes home-content-enter {
  from {
    opacity: 0;
    transform: translateY(22px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 980px) {
  .home-landing__topbar {
    grid-template-columns: auto 1fr;
    grid-template-areas:
      "intro intro"
      "brand actions";
    row-gap: var(--spacing-md);
  }

  .home-landing__intro-tile {
    grid-area: intro;
    justify-self: center;
    --intro-center-offset: calc(50vh - 116px);
  }

  .home-landing__brand {
    grid-area: brand;
  }

  .home-landing__topbar-actions {
    grid-area: actions;
  }

  .home-landing__feature-grid,
  .home-landing__use-cases,
  .home-landing__proof-grid {
    grid-template-columns: 1fr;
  }

  .home-landing__feature-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .home-landing__topbar {
    padding-top: var(--spacing-md);
  }

  .home-landing__intro-tile {
    --intro-size: 92px;
    --intro-center-offset: calc(50vh - 148px);
  }

  .home-landing__content {
    padding: var(--spacing-lg) var(--spacing-md) var(--spacing-3xl);
    gap: var(--spacing-3xl);
  }

  .home-landing__section {
    padding: var(--spacing-lg) 0;
  }

  .home-landing__section--demo {
    padding: var(--spacing-lg);
  }

  .home-landing__section--cta {
    padding: var(--spacing-lg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-landing__topbar-reveal,
  .home-landing__content,
  .home-landing__footer {
    opacity: 1;
    transform: none;
    animation: none;
  }

  .home-landing__intro-tile {
    opacity: 1;
    transform: none;
    animation: none;
  }
}
</style>
