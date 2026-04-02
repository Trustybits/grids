<template>
  <div class="home-landing">
    <div class="home-landing__grid-overlay" aria-hidden="true"></div>

    <header class="home-landing__topbar">
      <div class="home-landing__brand">Grids</div>
      <div class="home-landing__topbar-actions">
        <router-link class="home-landing__text-link" to="/pricing">Pricing</router-link>
        <router-link class="home-landing__btn home-landing__btn--ghost" to="/login">Log in</router-link>
      </div>
    </header>

    <main class="home-landing__content">
      <section class="home-landing__hero">
        <div class="home-landing__hero-copy">
          <p class="home-landing__eyebrow">A modern homepage for your internet presence</p>
          <h1 class="home-landing__title">Build a living homepage in a beautiful grid.</h1>
          <p class="home-landing__subtitle">
            Grids gives creators, founders, and teams a modular canvas for links, notes, profile highlights,
            media, and updates all in one shareable layout.
          </p>
          <div class="home-landing__hero-actions">
            <router-link class="home-landing__btn home-landing__btn--primary" to="/login">Start building free</router-link>
            <router-link class="home-landing__btn home-landing__btn--soft" to="/pricing">See plans</router-link>
          </div>
          <p class="home-landing__meta">No code required. Publish in minutes. Update anytime.</p>
        </div>

        <div class="home-landing__hero-grid" aria-hidden="true">
          <article class="hero-tile hero-tile--wide">
            <p class="hero-tile__label">Featured</p>
            <h3>Launch updates</h3>
            <p>Pin your latest post, roadmap note, or release.</p>
          </article>
          <article class="hero-tile">
            <p class="hero-tile__label">Profile</p>
            <h3>About</h3>
            <p>Bio, socials, and quick contact links.</p>
          </article>
          <article class="hero-tile">
            <p class="hero-tile__label">Link tile</p>
            <h3>Resources</h3>
            <p>Curate your best links with visual hierarchy.</p>
          </article>
          <article class="hero-tile hero-tile--accent">
            <p class="hero-tile__label">Engagement</p>
            <h3>Community</h3>
            <p>Drive visitors to Discord, X, or newsletter signups.</p>
          </article>
        </div>
      </section>

      <section class="home-landing__section">
        <h2 class="home-landing__section-title">Everything your SaaS-style homepage needs</h2>
        <div class="home-landing__feature-grid">
          <article class="feature-card">
            <h3>Clear value above the fold</h3>
            <p>Present one focused message, social proof, and a direct CTA the moment someone lands.</p>
          </article>
          <article class="feature-card">
            <h3>Drag-and-drop tile system</h3>
            <p>Arrange content blocks like interface components, with layout control that still feels playful.</p>
          </article>
          <article class="feature-card">
            <h3>Built for iteration</h3>
            <p>Swap tiles, change priorities, and ship updates fast as your work and audience evolve.</p>
          </article>
        </div>
      </section>

      <section class="home-landing__section home-landing__section--cta">
        <h2>Design your grid. Share your story.</h2>
        <p>Join the beta and turn your links, projects, and updates into a homepage people remember.</p>
        <router-link class="home-landing__btn home-landing__btn--primary" to="/login">Join the beta</router-link>
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

.home-landing__topbar {
  position: relative;
  z-index: 1;
  width: min(1120px, 100%);
  margin: 0 auto;
  padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-md);
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-3xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3xl);
}

.home-landing__hero {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: var(--spacing-2xl);
  align-items: center;
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
  max-width: 60ch;
  color: var(--color-content-default);
  font-size: var(--font-size-lg);
  line-height: 1.55;
}

.home-landing__hero-actions {
  margin-top: var(--spacing-xl);
  display: flex;
  flex-wrap: wrap;
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

.home-landing__hero-grid {
  display: grid;
  gap: var(--spacing-sm);
  grid-template-columns: 1fr 1fr;
}

.hero-tile {
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.05);
  box-shadow: var(--shadow-md);
}

.hero-tile--wide {
  grid-column: span 2;
}

.hero-tile--accent {
  background: linear-gradient(140deg, rgba(179, 239, 189, 0.18), rgba(179, 244, 239, 0.08));
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
  gap: var(--spacing-lg);
}

.home-landing__section-title {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 2rem);
}

.home-landing__feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.feature-card {
  padding: var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
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

.home-landing__section--cta {
  align-items: center;
  text-align: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--spacing-2xl);
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

@media (max-width: 980px) {
  .home-landing__hero {
    grid-template-columns: 1fr;
  }

  .home-landing__feature-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .home-landing__content {
    gap: var(--spacing-2xl);
  }

  .home-landing__section--cta {
    padding: var(--spacing-lg);
  }
}
</style>
