<!-- src/views/HomePage.vue -->
<template>
  <div class="home-landing">
    <div class="home-landing__background" aria-hidden="true">
      <GriddleAnimation />
    </div>

    <main class="home-landing__content">
      <div class="home-landing__hero">
        <h1 class="home-landing__title">Grids</h1>
        <h3 class="home-landing__subtitle">
          <br />
          The Future of Showcasing Your Work
          <br />
          <br />
          <span class="home-landing__subtitle--small">A home for the links, notes, and ideas you want to share.</span>
        </h3>
      </div>

      <div class="home-landing__hero-image">
        <img src="@/assets/images/hero.gif" alt="" />
      </div>

      <div class="home-landing__beta">
        <p class="home-landing__beta-text">We’re in beta. Join to start building your first grid.</p>

        <router-link class="home-landing__cta" to="/login">
          Join the Beta
        </router-link>

        <router-link class="home-landing__cta--ghost" to="/login">
          Log in
        </router-link>


      </div>
    </main>

    <footer class="home-landing__footer">
      <a 
        href="https://discord.gg/DBscN5NUN6" 
        target="_blank" 
        rel="noopener noreferrer"
        class="home-landing__discord-link"
      >
        <DiscordIcon />
        <span>Join our Discord</span>
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
import GriddleAnimation from '@/components/GriddleAnimation.vue';
import DiscordIcon from '@/components/icons/DiscordIcon.vue';
import { usePageTitle } from '@/composables/usePageTitle';

const pageTitle = ref('Home');
usePageTitle(pageTitle);
</script>

<style scoped>
.home-landing {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  background: var(--color-content-background);
  color: var(--color-text-primary);
  display: flex;
  flex-direction: column;
}

.home-landing__background {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.home-landing__background::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  /*
    Center mask: hide the animation behind the hero content.
    The oval gradient keeps edges visible while the center is darker.
  */
  background:
    radial-gradient(
      ellipse at 50% 50%,
      rgba(0, 0, 0, 1) 0%,
      rgba(0, 0, 0, 0.96) 89%,
      rgba(0, 0, 0, 0.55) 100%
    );
}

.home-landing__content {
  position: relative;
  z-index: 1;
  flex: 1;
  display: grid;
  place-items: center;
  padding: clamp(var(--spacing-xl), 6vw, 90px) var(--spacing-lg);
}

.home-landing__hero {
  width: 100%;
  max-width: 860px;
  text-align: center;
}

.home-landing__title {
  font-size: clamp(2.25rem, 6vw, 3.5rem);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.02em;
  margin-bottom: var(--spacing-md);
}

.home-landing__subtitle {
  font-size: clamp(1.05rem, 2.2vw, 1.25rem);
  color: var(--color-content-default);
  margin: 0 auto;
  max-width: 56ch;
}

.home-landing__hero-image {
  display: flex;
  justify-content: center;
  width: 100%;
  max-width: 512px;
  clip-path: inset(5%);
  border-radius: var(--radius-lg);
}

.home-landing__beta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.home-landing__beta-text {
  color: var(--color-content-high);
  font-size: var(--font-size-base);
}

.home-landing__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: 12px 18px;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-light-100);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  box-shadow: var(--shadow-md);
  transition:
    transform var(--duration-fast) var(--easing-smooth),
    box-shadow var(--duration-fast) var(--easing-smooth),
    filter var(--duration-fast) var(--easing-smooth),
    background-color var(--duration-normal) var(--easing-smooth);
}

.home-landing__cta:hover {
  /* transform: translateY(-1px); */
  background-color: var(--color-base-34);
  box-shadow: var(--shadow-lg);
  filter: brightness(1.02);
}

.home-landing__cta:active {
  transform: translateY(0);
  box-shadow: var(--shadow-md);
}

.home-landing__cta--ghost {
  box-shadow: none;
  color: var(--color-content-high);
  background: transparent;
  text-decoration: none;
}

.home-landing__cta--ghost:hover {
  text-decoration: underline;
}

.home-landing__discord-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  /* padding: 10px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md); */
  color: var(--color-content-high);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-base);
  text-decoration: none;
  transition:
    transform var(--duration-fast) var(--easing-smooth),
    border-color var(--duration-fast) var(--easing-smooth),
    color var(--duration-fast) var(--easing-smooth);

  svg {
    width: 20px;
    height: 20px;
  }

  &:hover {
    transform: translateY(-1px);
    color: #5865F2;
    border-color: #5865F2;
  }

  &:active {
    transform: translateY(0);
  }
}

.home-landing__footer {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  color: var(--color-content-low);
}

.home-landing__footer-link {
  color: var(--color-content-low);
  text-decoration: none;
  transition: color var(--duration-fast) var(--easing-smooth);
}

.home-landing__footer-link:hover {
  color: var(--color-content-high);
}

.home-landing__footer-sep {
  color: var(--color-content-low);
}
</style>
