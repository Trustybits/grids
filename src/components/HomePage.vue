<template>
  <div class="mkt">
    <header class="mkt__nav">
      <button class="mkt__brand" @click="nav('home')">
        <span class="mkt__brand-mark" aria-hidden="true">
          <img src="/grids_logo.png" alt="" />
        </span>
        <span class="mkt__brand-word">grids</span>
      </button>
      <nav class="mkt__menu">
        <button
          v-for="item in navItems"
          :key="item.id"
          :class="['mkt__menu-item', { 'is-active': currentPage === item.id }]"
          @click="nav(item.id)"
        >
          {{ item.label }}
        </button>
      </nav>
      <div class="mkt__actions">
        <a
          href="https://discord.gg/DBscN5NUN6"
          target="_blank"
          rel="noopener noreferrer"
          class="mkt__text-btn mkt__discord-link"
          aria-label="Join our Discord"
          title="Join our Discord"
        >
          <DiscordIcon />
        </a>
        <router-link to="/login" class="mkt__text-btn">Sign in</router-link>
        <router-link to="/login" class="mkt__cta-btn">Start your grid</router-link>
      </div>
    </header>

    <section v-if="currentPage === 'home'" class="mkt__hero">
      <div class="mkt__hero-container mkt__section">
        <div class="mkt__eyebrow">Showcase simplified</div>
        <h1 class="mkt__hero-title">
          Your page.<br />
          Your work. <span>Your grid.</span>
        </h1>
        <p class="mkt__hero-sub">
          Drop tiles on a canvas. Rearrange until it feels right. Share one link — no building from scratch.
        </p>
        <div class="mkt__url-pill">
          <span>grids.so/</span>
          <input v-model="urlSlug" aria-label="slug input" />
          <button>Claim handle →</button>
        </div>
      </div>

      <HomePageGridEmbed v-if="useLiveGridPreview" />
      <div v-else class="mkt__hero-grid">
        <div class="tile tile--2x2 tile--variant-a">
          <div class="tile__meta">
            <strong>Taylor Reid</strong>
            <small>Designer · Lisbon</small>
          </div>
        </div>
        <div class="tile tile--variant-b"><div class="tile__meta"><small>Listening to</small><strong>In bloom</strong></div></div>
        <div class="tile tile--variant-c"><div class="tile__meta"><strong>Read the blog</strong><small>taylor.site</small></div></div>
        <div class="tile tile--2x1 tile--variant-d"><div class="tile__meta"><strong>Morning in Lisbon</strong><small>Photo</small></div></div>
        <div class="tile tile--variant-e"><div class="tile__meta"><em>"Simple, but significant."</em></div></div>
        <div class="tile tile--variant-f"><div class="tile__meta"><strong>Shop the print</strong><small>$48 · prints.taylor.site</small></div></div>
      </div>

      <section class="mkt__section mkt__feature">
        <div>
          <div class="mkt__kicker">Drag · drop · done</div>
          <h2>A canvas that snaps.</h2>
          <p>Tiles snap to a flexible grid. Drag one, and everything else finds its place. No layout headaches.</p>
        </div>
        <div class="mkt__feature-demo mkt__feature-demo--snap">
          <div class="mkt__mini-tiles">
            <div class="mkt__mini-tile mkt__mini-tile--a"></div>
            <div class="mkt__mini-tile mkt__mini-tile--b"></div>
            <div class="mkt__mini-tile mkt__mini-tile--c mkt__mini-tile--floating"></div>
            <div class="mkt__mini-tile mkt__mini-tile--d mkt__mini-tile--wide"></div>
            <div class="mkt__mini-tile mkt__mini-tile--e"></div>
          </div>
        </div>
      </section>

      <section class="mkt__section mkt__feature mkt__feature--rev">
        <div>
          <div class="mkt__kicker">Make it yours</div>
          <h2>Every tile, a statement.</h2>
          <p>Pick a palette. Set a vibe. Tiles fill themselves with the color and shape of your work.</p>
        </div>
        <div class="mkt__feature-demo mkt__feature-demo--theme">
          <div class="mkt__palette-row">
            <span class="dot dot--cyan"></span>
            <span class="dot dot--blue"></span>
            <span class="dot dot--indigo"></span>
            <span class="dot dot--violet"></span>
            <span class="dot dot--magenta"></span>
            <span class="dot dot--green"></span>
          </div>
          <div class="mkt__theme-card">
            <div class="mkt__theme-card-plasma"></div>
          </div>
        </div>
      </section>

      <section class="mkt__section mkt__feature">
        <div>
          <div class="mkt__kicker">One link, everything</div>
          <h2>Share one url.</h2>
          <p>Your grids.so url is the only link you'll need. Send it once — it stays in sync forever.</p>
        </div>
        <div class="mkt__feature-demo mkt__feature-demo--share">
          <div class="mkt__share-pill">
            <span>grids.so/</span>
            <strong>taylor</strong>
          </div>
        </div>
      </section>

      <section class="mkt__section mkt__own">
        <div>
          <div class="mkt__pill">
            <i class="fab fa-github" aria-hidden="true"></i>
            <span>Open source</span>
          </div>
          <h2>Your page is <span>yours forever.</span></h2>
          <p>
            We watched too many favourite link-in-bio and portfolio sites quietly shut down — taking their users'
            pages with them. We've felt that pain personally. So we open-sourced the whole thing.
          </p>
          <p>
            Export your grid any time. Self-host it. Fork it. If grids.so ever disappears, your page doesn't.
          </p>
          <a
            class="mkt__repo-btn"
            href="https://github.com/TrustyDev-76/grids1"
            target="_blank"
            rel="noopener noreferrer"
          >
            <i class="fab fa-github" aria-hidden="true"></i>
            <span>Star our public repo on GitHub</span>
          </a>
        </div>
        <div class="mkt__terminal">
          <div class="mkt__terminal-top">
            <div class="mkt__terminal-dots">
              <span class="terminal-dot terminal-dot--red"></span>
              <span class="terminal-dot terminal-dot--yellow"></span>
              <span class="terminal-dot terminal-dot--green"></span>
            </div>
            <span class="mkt__terminal-path">~/grids</span>
          </div>
          <div class="mkt__terminal-body">
            <div><span class="mkt__terminal-prompt">$</span> git clone grids-so/grids</div>
            <div><span class="mkt__terminal-prompt">$</span> cd grids && pnpm i</div>
            <div><span class="mkt__terminal-prompt">$</span> pnpm dev</div>
          </div>
          <div class="mkt__ok">✓ ready on localhost:3000</div>
          <div class="mkt__faint"># your grid. your server. forever.</div>
        </div>
      </section>

      <section class="mkt__section mkt__cta">
        <h2>Ready to <span>show off?</span></h2>
        <p>Free to start. Your first grid takes about four minutes.</p>
        <router-link to="/login" class="mkt__cta-btn">Make your grid →</router-link>
      </section>
    </section>

    <section v-else-if="currentPage === 'templates'" class="mkt__section mkt__page">
      <div class="mkt__kicker">Templates</div>
      <h1>Start with a grid that already works.</h1>
      <p>Handmade by people whose pages you'd actually click on.</p>
      <div class="mkt__cards">
        <article v-for="template in templates" :key="template.name" class="mkt__card">
          <div class="mkt__mini-grid"></div>
          <h3>{{ template.name }}</h3>
          <small>by {{ template.by }}</small>
          </article>
        </div>
      </section>

    <section v-else-if="currentPage === 'pricing'" class="mkt__section mkt__page">
      <div class="mkt__kicker">Pricing</div>
      <h1>Simple, like your grid.</h1>
      <p>Start free. Upgrade when you need more tiles — or a team.</p>
      <div class="mkt__pricing">
        <article
          v-for="plan in plans"
          :key="plan.tier"
          :class="['mkt__plan', { 'mkt__plan--featured': plan.featured }]"
        >
          <header>
            <h3>{{ plan.tier }}</h3>
            <span v-if="plan.featured">Most picked</span>
          </header>
          <h4>{{ plan.price }} <small>{{ plan.cadence }}</small></h4>
          <p>{{ plan.blurb }}</p>
          <button>{{ plan.cta }}</button>
          <ul>
            <li v-for="feature in plan.features" :key="feature">{{ feature }}</li>
          </ul>
          </article>
        </div>
      </section>

    <section v-else class="mkt__section mkt__placeholder">
      <div class="mkt__kicker">{{ currentPage }}</div>
      <h1>Coming soon.</h1>
      <p>We haven't built this page yet.</p>
      </section>

    <footer class="mkt__footer">
      <div>
        <strong class="mkt__footer-brand">
          <span class="mkt__brand-mark" aria-hidden="true">
            <img src="/grids_logo.png" alt="" />
          </span>
          <span class="mkt__brand-word">grids</span>
        </strong>
        <p>Showcase simplified. Your page, your work, your links.</p>
      </div>
      <div class="mkt__footer-col">
        <h4>Product</h4>
        <a href="#" @click.prevent="nav('showcase')">Showcase</a>
        <a href="#" @click.prevent="nav('pricing')">Pricing</a>
        <a href="https://discord.com/channels/1452087541548191940/1464413220549955768" target="_blank" rel="noopener noreferrer">What's New</a>
      </div>
      <div class="mkt__footer-col">
        <h4>Company</h4>
        <router-link to="/privacy">Privacy Policy</router-link>
        <router-link to="/terms">Terms</router-link>
        <a href="mailto:support@grids.so">support@grids.so</a>
        <a href="https://discord.gg/DBscN5NUN6" target="_blank" rel="noopener noreferrer">Discord Server</a>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { usePageTitle } from '@/composables/usePageTitle';
import DiscordIcon from '@/components/icons/DiscordIcon.vue';
import HomePageGridEmbed from '@/components/HomePageGridEmbed.vue';

// Toggle between the real <Grid>-powered preview and the legacy CSS mock.
// Flip to `false` to fall back to the static tile mock (useful while
// iterating on the demo layout or if the embed regresses).
const useLiveGridPreview = true;

type Page = 'home' | 'templates' | 'pricing' | 'showcase' | 'blog';

const pageTitle = ref('Home');
usePageTitle(pageTitle);

const navItems = [
  { id: 'home', label: 'Home' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'showcase', label: 'Showcase' },
] as const;

const currentPage = ref<Page>('home');
const urlSlug = ref('taylor');

const nav = (page: Page) => {
  currentPage.value = page;
  pageTitle.value = page[0].toUpperCase() + page.slice(1);
  localStorage.setItem('grids-mkt-page', page);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

onMounted(() => {
  const saved = localStorage.getItem('grids-mkt-page') as Page | null;
  if (saved && navItems.some((item) => item.id === saved)) {
    currentPage.value = saved;
    pageTitle.value = saved[0].toUpperCase() + saved.slice(1);
  }
});

const templates = [
  { name: 'Photographer', by: 'Mira Okafor' },
  { name: 'Writer', by: 'Sam Haines' },
  { name: 'Musician', by: 'June' },
  { name: 'Designer', by: 'Paulo S.' },
  { name: 'Developer', by: 'kei.dev' },
  { name: 'Link in bio', by: 'grids team' },
];

const plans = [
  {
    tier: 'Free',
    price: '$0',
    cadence: 'forever',
    blurb: 'For getting started. Enough to share.',
    features: ['1 grid', 'grids.so/you url', 'Core tile types', 'Public page'],
    cta: 'Start for free',
    featured: false,
  },
  {
    tier: 'Pro',
    price: '$6',
    cadence: '/month',
    blurb: 'For people serious about how their work lives online.',
    features: ['Unlimited grids', 'Custom domain', 'All tile types + embeds', 'Analytics', 'No grids watermark'],
    cta: 'Go Pro',
    featured: true,
  },
  {
    tier: 'Team',
    price: '$18',
    cadence: '/month',
    blurb: 'For collaborators who share one canvas.',
    features: ['Everything in Pro', 'Up to 10 seats', 'Shared templates', 'Priority support'],
    cta: 'Start team',
    featured: false,
  },
];
</script>

<style scoped>
.mkt {
  --mkt-section-max: 1120px;
  --mkt-section-x: 40px;
  --mkt-section-y: 128px;
  min-height: 100vh;
  color: var(--mkt-fg-1);
  background: var(--mkt-bg-0);
  font-family: var(--mkt-font-sans);
  position: relative;
}
.mkt::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 45% 24% at 50% 14%, rgba(131, 139, 251, 0.2), transparent 70%),
    radial-gradient(ellipse 55% 26% at 50% 96%, rgba(131, 139, 251, 0.16), transparent 72%);
  z-index: 0;
}
.mkt__nav {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  padding: 18px var(--mkt-section-x);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  max-width: var(--mkt-section-max);
  margin: 0 auto;
}
.mkt__brand {
  border: 0;
  background: transparent;
  color: var(--mkt-fg-1);
  font: 800 20px/1 var(--mkt-font-sans);
  letter-spacing: -0.04em;
  cursor: pointer;
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.mkt__brand-word {
  font-family: var(--mkt-font-brand);
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: lowercase;
}
.mkt__brand-mark {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* background: var(--mkt-brand-gradient); */
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.mkt__brand-mark :deep(svg) {
  width: 18px;
  height: 18px;
  color: #ffffff;
}
.mkt__brand-mark img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
  display: block;
}
.mkt__menu {
  display: flex;
  gap: 2px;
  justify-self: center;
}
.mkt__menu-item {
  border: 0;
  background: transparent;
  color: var(--mkt-fg-3);
  font: 500 14px/1 var(--mkt-font-sans);
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 10px;
}
.mkt__menu-item.is-active {
  color: var(--mkt-fg-1);
}
.mkt__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-self: end;
}
.mkt__text-btn {
  color: var(--mkt-fg-2);
  text-decoration: none;
  font: 500 14px/1 var(--mkt-font-sans);
}
.mkt__discord-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  /* border: 1px solid rgba(255, 255, 255, 0.18); */
  padding: 0;
}
.mkt__discord-link :deep(svg) {
  width: 16px;
  height: 16px;
}
.mkt__cta-btn {
  font: 600 13px/1 var(--mkt-font-sans);
  letter-spacing: -0.01em;
  padding: 9px 14px;
  border: 0;
  border-radius: var(--mkt-radius-md);
  background: var(--mkt-brand-gradient);
  color: #000;
  text-decoration: none;
}
.mkt__hero {
  position: relative;
  z-index: 1;
  padding: 56px var(--mkt-section-x) 40px;
  text-align: center;
  max-width: var(--mkt-section-max);
  margin: 0 auto;
}
.mkt__section {
  max-width: var(--mkt-section-max);
  margin: 0 auto;
  padding: var(--mkt-section-y) var(--mkt-section-x);
}
.mkt__eyebrow, .mkt__kicker {
  font: 500 12px/1 var(--mkt-font-sans);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--mkt-fg-3);
}
.mkt__hero-title {
  font: 800 clamp(3rem, 7.2vw, 5rem) / .98 var(--mkt-font-sans);
  letter-spacing: -0.045em;
  margin: 18px auto 0;
  max-width: 960px;
}
.mkt__hero-title span {
  font: 800 clamp(3rem, 7.2vw, 5rem) / .98 var(--mkt-font-sans);
  letter-spacing: -0.045em;
  background: var(--mkt-brand-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.mkt__cta h2 span, .mkt__own h2 span {
  background: var(--mkt-brand-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.mkt__hero-sub {
  font: 400 20px/1.45 var(--mkt-font-sans);
  color: color-mix(in srgb, var(--mkt-fg-2) 86%, transparent);
  max-width: 560px;
  margin: 22px auto 30px;
}
.mkt__url-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--mkt-bg-2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  padding: 5px 10px 5px 16px;
  margin-bottom: 52px;
}
.mkt__url-pill span {
  color: var(--mkt-fg-4);
  font: 400 15px/1 var(--mkt-font-mono);
}
.mkt__url-pill input {
  background: transparent;
  border: 0;
  outline: 0;
  color: var(--mkt-fg-1);
  font: 600 15px/1 var(--mkt-font-sans);
  width: 120px;
}
.mkt__url-pill button {
  border: 0;
  border-radius: 999px;
  background: var(--mkt-brand-gradient);
  padding: 11px 18px;
  font: 600 14px/1 var(--mkt-font-sans);
  color: #000;
}
.mkt__hero-grid {
  max-width: 610px;
  margin: 0 auto 44px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 1fr;
  gap: 12px;
  aspect-ratio: 4 / 3;
}
.tile {
  border-radius: var(--mkt-radius-lg);
  overflow: hidden;
  border: 1px solid var(--mkt-glass-tile-border);
  background: var(--mkt-glass-tile-bg);
  box-shadow: var(--mkt-glass-tile-shadow);
  position: relative;
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}
.tile:hover {
  transform: translateY(-2px);
}
.tile::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 25% 80%, var(--mkt-brand-pink), transparent 55%),
    radial-gradient(circle at 80% 25%, var(--mkt-brand-cyan), transparent 55%);
  filter: blur(18px);
  opacity: .9;
}
.tile--variant-a::before {
  background:
    radial-gradient(circle at 28% 72%, color-mix(in srgb, var(--mkt-brand-pink) 85%, white 15%), transparent 56%),
    radial-gradient(circle at 80% 28%, color-mix(in srgb, var(--mkt-brand-cyan) 85%, white 15%), transparent 56%);
}
.tile--variant-b::before {
  background: radial-gradient(circle at 45% 110%, var(--mkt-brand-violet) 0%, transparent 60%);
}
.tile--variant-c::before {
  background:
    radial-gradient(circle at 70% 22%, #ffc36b, transparent 50%),
    radial-gradient(circle at 12% 70%, var(--mkt-brand-magenta), transparent 55%);
}
.tile--variant-d::before {
  background: radial-gradient(circle at 52% 52%, var(--mkt-brand-cyan), transparent 58%);
}
.tile--variant-e::before {
  background:
    radial-gradient(circle at 22% 20%, var(--mkt-brand-blue), transparent 55%),
    radial-gradient(circle at 86% 80%, var(--mkt-brand-pink), transparent 55%);
}
.tile--variant-f::before {
  background:
    radial-gradient(circle at 36% 70%, #ffd6f0, transparent 56%),
    radial-gradient(circle at 78% 22%, #c9dcff, transparent 56%);
}
.tile--2x2 { grid-column: span 2; grid-row: span 2; }
.tile--2x1 { grid-column: span 2; }
.tile__meta {
  position: absolute;
  inset: auto 0 0 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  color: #0a0a0b;
}
.tile__meta strong { font-size: 14px; }
.tile__meta small { font-size: 11px; opacity: .6; }
.tile__meta em { font: 400 14px/1.2 "Instrument Serif", serif; }
.mkt__feature {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: center;
  text-align: left;
}
.mkt__feature--rev > :first-child { order: 2; }
.mkt__feature h2 { font: 700 44px/1.05 var(--mkt-font-sans); margin: 16px 0 0; }
.mkt__feature h2 {
  white-space: nowrap;
}
.mkt__feature p {
  margin-top: 20px;
  font: 400 18px/1.5 var(--mkt-font-sans);
  color: color-mix(in srgb, var(--mkt-fg-2) 82%, transparent);
  max-width: 420px;
}
.mkt__feature-demo {
  aspect-ratio: 1 / 1;
  border-radius: var(--mkt-radius-xl);
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, var(--mkt-bg-1), var(--mkt-bg-0));
  max-width: 360px;
  justify-self: center;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
}
.mkt__feature-demo--snap {
  background:
    radial-gradient(ellipse at 50% 40%, rgba(131, 139, 251, .15), transparent 70%),
    linear-gradient(180deg, var(--mkt-bg-1), var(--mkt-bg-0));
}
.mkt__feature-demo--theme {
  background: radial-gradient(ellipse at 50% 40%, rgba(131, 139, 251, .15), transparent 70%), #0a0a0b;
  flex-direction: column;
  gap: 14px;
}
.mkt__feature-demo--share { background: radial-gradient(ellipse 50% 40% at 50% 50%, rgba(131, 139, 251, .25), transparent 70%), #0a0a0b; }
.mkt__mini-tiles {
  width: 100%;
  aspect-ratio: 1 / 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: 1fr;
  gap: 10px;
}
.mkt__mini-tile {
  aspect-ratio: 1 / 1;
  border-radius: 14px;
  border: 1px solid var(--mkt-glass-tile-border);
  background: var(--mkt-glass-tile-bg);
  box-shadow: var(--mkt-glass-tile-shadow);
  position: relative;
}
.mkt__mini-tile::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(circle at 30% 70%, color-mix(in srgb, var(--mkt-brand-pink) 80%, white 20%), transparent 58%),
    radial-gradient(circle at 78% 30%, color-mix(in srgb, var(--mkt-brand-cyan) 80%, white 20%), transparent 58%);
  filter: blur(12px);
  opacity: .9;
}
.mkt__mini-tile--a::before {
  background:
    radial-gradient(circle at 30% 72%, var(--mkt-brand-pink), transparent 56%),
    radial-gradient(circle at 80% 28%, var(--mkt-brand-cyan), transparent 56%);
}
.mkt__mini-tile--b::before {
  background: radial-gradient(circle at 50% 108%, var(--mkt-brand-violet) 0%, transparent 60%);
}
.mkt__mini-tile--c::before {
  background:
    radial-gradient(circle at 70% 20%, #ffc36b, transparent 50%),
    radial-gradient(circle at 10% 70%, var(--mkt-brand-magenta), transparent 55%);
}
.mkt__mini-tile--d::before {
  background: radial-gradient(circle at 50% 50%, var(--mkt-brand-cyan), transparent 60%);
}
.mkt__mini-tile--e::before {
  background:
    radial-gradient(circle at 20% 20%, var(--mkt-brand-blue), transparent 55%),
    radial-gradient(circle at 85% 80%, var(--mkt-brand-pink), transparent 55%);
}
.mkt__mini-tile--wide { grid-column: span 2; }
.mkt__mini-tile--floating { transform: rotate(-4deg) translateY(4px); }
.mkt__palette-row {
  display: flex;
  gap: 10px;
}
.dot {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .55);
}
.dot--cyan { background: var(--mkt-brand-cyan); }
.dot--blue { background: var(--mkt-brand-blue); }
.dot--indigo { background: var(--mkt-brand-indigo); }
.dot--violet { background: var(--mkt-brand-violet); }
.dot--magenta { background: var(--mkt-brand-magenta); }
.dot--green { background: #58e0a3; }
.mkt__theme-card {
  width: 236px;
  height: 132px;
  border-radius: 18px;
  border: 1px solid var(--mkt-glass-tile-border);
  background: var(--mkt-glass-tile-bg);
  box-shadow: var(--mkt-glass-tile-shadow);
  overflow: hidden;
  position: relative;
}
.mkt__theme-card-plasma {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 28% 78%, var(--mkt-brand-pink), transparent 55%),
    radial-gradient(circle at 82% 25%, var(--mkt-brand-cyan), transparent 55%);
  filter: blur(18px);
  opacity: .9;
}
.mkt__share-pill {
  border-radius: var(--mkt-radius-pill);
  border: 1px solid rgba(255, 255, 255, .12);
  background: var(--mkt-bg-2);
  padding: 14px 22px;
  display: flex;
  gap: 8px;
  align-items: center;
  box-shadow: 0 14px 36px -12px rgba(131, 139, 251, .45);
}
.mkt__share-pill span {
  color: var(--mkt-fg-4);
  font: 400 17px/1 var(--mkt-font-mono);
}
.mkt__share-pill strong {
  color: var(--mkt-fg-1);
  font: 700 20px/1 var(--mkt-font-sans);
  letter-spacing: -0.02em;
}
.mkt__own {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 64px;
  position: relative;
  z-index: 1;
  text-align: left;
}
.mkt__pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font: 600 11px/1 var(--mkt-font-sans);
  text-transform: uppercase;
  letter-spacing: .04em;
  color: #58e0a3;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(88, 224, 163, .12);
  margin-bottom: 20px;
}
.mkt__own h2 { font: 700 48px/1.02 var(--mkt-font-sans); margin: 0; }
.mkt__own p { color: color-mix(in srgb, var(--mkt-fg-2) 85%, transparent); line-height: 1.55; }
.mkt__repo-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 24px;
  border-radius: var(--mkt-radius-md);
  padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: var(--mkt-bg-2);
  color: var(--mkt-fg-1);
  text-decoration: none;
  font: 600 13px/1 var(--mkt-font-sans);
}
.mkt__repo-btn:hover {
  background: color-mix(in srgb, var(--mkt-bg-2) 75%, var(--mkt-brand-indigo) 25%);
}
.mkt__terminal {
  border: 1px solid rgba(255, 255, 255, .1);
  border-radius: var(--mkt-radius-lg);
  background: var(--mkt-bg-0);
  overflow: hidden;
  font: 400 13px/1.9 var(--mkt-font-mono);
}
.mkt__terminal-top {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, .06);
  background: color-mix(in srgb, var(--mkt-bg-1) 90%, black 10%);
}
.mkt__terminal-dots {
  display: flex;
  gap: 6px;
}
.terminal-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.terminal-dot--red { background: #ff6b7a; }
.terminal-dot--yellow { background: #ffc36b; }
.terminal-dot--green { background: #58e0a3; }
.mkt__terminal-path {
  color: rgba(255, 255, 255, .45);
  font-size: 12px;
}
.mkt__terminal-body {
  padding: 16px 22px 0;
}
.mkt__terminal-prompt {
  color: rgba(255, 255, 255, .35);
}
.mkt__ok { color: #58e0a3; margin-top: 10px; padding-left: 22px; }
.mkt__faint { color: rgba(255, 255, 255, .35); margin-top: 14px; padding-left: 22px; padding-bottom: 20px; }
.mkt__cta {
  text-align: center;
  position: relative;
  z-index: 1;
}
.mkt__cta h2 {
  font: 800 64px/1 var(--mkt-font-sans);
  letter-spacing: -0.04em;
  margin: 0;
}
.mkt__cta p {
  font: 400 19px/1.4 var(--mkt-font-sans);
  color: rgba(255, 255, 255, .6);
  max-width: 500px;
  margin: 20px auto 30px;
}
.mkt__page, .mkt__placeholder {
  padding-top: 56px;
  padding-bottom: 40px;
}
.mkt__page h1 {
  font: 800 56px/1 var(--mkt-font-sans);
  letter-spacing: -0.04em;
  margin: 14px 0 10px;
}
.mkt__page p {
  font: 400 19px/1.4 var(--mkt-font-sans);
  color: rgba(255, 255, 255, .6);
}
.mkt__cards {
  margin-top: 40px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}
.mkt__card {
  padding: 16px;
  border-radius: 20px;
  background: #0a0a0b;
  border: 1px solid rgba(255, 255, 255, .06);
}
.mkt__mini-grid {
  aspect-ratio: 1/1;
  border-radius: 12px;
  margin-bottom: 12px;
  background: radial-gradient(
    circle at 20% 20%,
    var(--mkt-brand-cyan),
    var(--mkt-brand-indigo) 50%,
    var(--mkt-brand-magenta)
  );
}
.mkt__pricing {
  display: flex;
  gap: 18px;
  margin-top: 20px;
}
.mkt__plan {
  flex: 1;
  padding: 28px;
  border-radius: 24px;
  background: #0a0a0b;
  border: 1px solid rgba(255, 255, 255, .08);
}
.mkt__plan--featured {
  border-color: rgba(131, 139, 251, .45);
  background: linear-gradient(180deg, rgba(131, 139, 251, .08), rgba(239, 111, 196, .04)) #0a0a0b;
}
.mkt__plan header {
  display: flex;
  justify-content: space-between;
}
.mkt__plan header h3 { margin: 0; }
.mkt__plan header span {
  font: 700 10px/1 var(--mkt-font-sans);
  text-transform: uppercase;
  padding: 5px 8px;
  border-radius: 6px;
  color: #000;
  background: var(--mkt-brand-gradient);
}
.mkt__plan h4 {
  font: 800 48px/1 var(--mkt-font-sans);
  margin: 18px 0 0;
}
.mkt__plan h4 small {
  font: 500 16px/1 var(--mkt-font-sans);
  color: rgba(255, 255, 255, .45);
}
.mkt__plan p {
  color: rgba(255, 255, 255, .55);
  font-size: 14px;
}
.mkt__plan button {
  width: 100%;
  margin-top: 6px;
  border: 0;
  border-radius: 14px;
  padding: 12px 16px;
  background: #1c1c20;
  color: #fff;
}
.mkt__plan--featured button {
  color: #000;
  background: var(--mkt-brand-gradient);
}
.mkt__plan ul {
  list-style: none;
  padding: 0;
  margin: 18px 0 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: rgba(255, 255, 255, .75);
  font-size: 14px;
}
.mkt__plan li::before {
  content: "✓";
  color: var(--mkt-brand-indigo);
  margin-right: 10px;
}
.mkt__placeholder {
  text-align: center;
  max-width: 720px;
  padding-top: 120px;
}
.mkt__placeholder h1 {
  font: 700 40px/1 var(--mkt-font-sans);
  letter-spacing: -0.03em;
  margin: 14px 0 10px;
}
.mkt__placeholder p {
  color: rgba(255, 255, 255, .55);
}
.mkt__footer {
  border-top: 1px solid rgba(255, 255, 255, .06);
  padding: 52px var(--mkt-section-x) 32px;
  margin: 64px auto 0;
  max-width: var(--mkt-section-max);
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 40px;
  justify-items: start;
  text-align: left;
}
.mkt__footer-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  letter-spacing: -0.04em;
  margin-bottom: 10px;
}
.mkt__footer p {
  color: rgba(255, 255, 255, .5);
  max-width: 280px;
}
.mkt__footer-col h4 {
  margin: 0 0 14px;
  font: 600 12px/1 var(--mkt-font-sans);
  letter-spacing: .08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, .45);
}
.mkt__footer-col a {
  display: block;
  color: rgba(255, 255, 255, .75);
  margin-bottom: 10px;
  text-decoration: none;
}
.mkt__footer-col a:hover {
  color: var(--mkt-fg-1);
}
@media (max-width: 1000px) {
  .mkt {
    --mkt-section-y: 72px;
  }
  .mkt__hero-title { font-size: 56px; }
  .mkt__feature, .mkt__own { grid-template-columns: 1fr; }
  .mkt__feature--rev > :first-child { order: initial; }
  .mkt__feature h2 { white-space: normal; }
  .mkt__cards { grid-template-columns: repeat(2, 1fr); }
  .mkt__pricing { flex-direction: column; }
  .mkt__footer { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 720px) {
  .mkt {
    --mkt-section-x: 14px;
    --mkt-section-y: 52px;
  }
  .mkt__nav {
    grid-template-columns: 1fr;
    justify-items: center;
    padding: 14px;
  }
  .mkt__brand,
  .mkt__menu,
  .mkt__actions {
    justify-self: center;
  }
  .mkt__hero { padding: 40px 14px; }
  .mkt__hero-title { font-size: 44px; }
  .mkt__hero-grid { grid-template-columns: repeat(2, 1fr); aspect-ratio: auto; }
  .mkt__feature, .mkt__page, .mkt__cta, .mkt__footer, .mkt__own { padding-left: 14px; padding-right: 14px; }
  .mkt__cards, .mkt__footer { grid-template-columns: 1fr; }
}
</style>
