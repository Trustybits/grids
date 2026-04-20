<template>
  <div class="mkt">
    <header class="mkt__nav">
      <button class="mkt__brand" @click="nav('home')">grids</button>
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
        <router-link to="/login" class="mkt__text-btn">Sign in</router-link>
        <router-link to="/login" class="mkt__cta-btn">Make your grid</router-link>
      </div>
    </header>

    <section v-if="currentPage === 'home'" class="mkt__hero">
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
        <button>Claim url →</button>
      </div>

      <div class="mkt__hero-grid">
        <div class="tile tile--2x2">
          <div class="tile__meta">
            <strong>Taylor Reid</strong>
            <small>Designer · Lisbon</small>
          </div>
        </div>
        <div class="tile"><div class="tile__meta"><small>Listening to</small><strong>In bloom</strong></div></div>
        <div class="tile"><div class="tile__meta"><strong>Read the blog</strong><small>taylor.site</small></div></div>
        <div class="tile tile--2x1"><div class="tile__meta"><strong>Morning in Lisbon</strong><small>Photo</small></div></div>
        <div class="tile"><div class="tile__meta"><em>"Simple, but significant."</em></div></div>
        <div class="tile"><div class="tile__meta"><strong>Shop the print</strong><small>$48 · prints.taylor.site</small></div></div>
      </div>

      <section class="mkt__feature">
        <div>
          <div class="mkt__kicker">Drag · drop · done</div>
          <h2>A canvas that snaps.</h2>
          <p>Tiles snap to a flexible grid. Drag one, and everything else finds its place. No layout headaches.</p>
        </div>
        <div class="mkt__feature-demo"></div>
      </section>

      <section class="mkt__feature mkt__feature--rev">
        <div>
          <div class="mkt__kicker">Make it yours</div>
          <h2>Every tile, a statement.</h2>
          <p>Pick a palette. Set a vibe. Tiles fill themselves with the color and shape of your work.</p>
        </div>
        <div class="mkt__feature-demo mkt__feature-demo--theme"></div>
      </section>

      <section class="mkt__feature">
        <div>
          <div class="mkt__kicker">One link, everything</div>
          <h2>Share one url.</h2>
          <p>Your grids.so url is the only link you'll need. Send it once — it stays in sync forever.</p>
        </div>
        <div class="mkt__feature-demo mkt__feature-demo--share"></div>
      </section>

      <section class="mkt__own">
        <div>
          <div class="mkt__pill">Open source</div>
          <h2>Your page is <span>yours forever.</span></h2>
          <p>
            We watched too many favourite link-in-bio and portfolio sites quietly shut down — taking their users'
            pages with them. We've been on the other side of that. So we open-sourced the whole thing.
          </p>
          <p>
            Export your grid any time. Self-host it. Fork it. If grids.so ever disappears, your page doesn't.
          </p>
        </div>
        <div class="mkt__terminal">
          <div>$ git clone grids-so/grids</div>
          <div>$ cd grids && pnpm i</div>
          <div>$ pnpm dev</div>
          <div class="mkt__ok">✓ ready on localhost:3000</div>
          <div class="mkt__faint"># your grid. your server. forever.</div>
        </div>
      </section>

      <section class="mkt__cta">
        <h2>Ready to <span>show off?</span></h2>
        <p>Free to start. Your first grid takes about four minutes.</p>
        <router-link to="/login" class="mkt__cta-btn">Make your grid →</router-link>
      </section>
    </section>

    <section v-else-if="currentPage === 'templates'" class="mkt__page">
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

    <section v-else-if="currentPage === 'pricing'" class="mkt__page">
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

    <section v-else class="mkt__placeholder">
      <div class="mkt__kicker">{{ currentPage }}</div>
      <h1>Coming soon.</h1>
      <p>We haven't built this page yet.</p>
    </section>

    <footer class="mkt__footer">
      <div>
        <strong>grids</strong>
        <p>Showcase simplified. Your page, your work, your links.</p>
      </div>
      <div class="mkt__footer-col">
        <h4>Product</h4>
        <a>Templates</a><a>Showcase</a><a>Pricing</a><a>What's new</a>
      </div>
      <div class="mkt__footer-col">
        <h4>Company</h4>
        <a>About</a><a>Careers</a><a>Press</a>
      </div>
      <div class="mkt__footer-col">
        <h4>Connect</h4>
        <a>Twitter</a><a>Instagram</a><a>Contact</a>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { usePageTitle } from '@/composables/usePageTitle';

type Page = 'home' | 'templates' | 'pricing' | 'showcase' | 'blog';

const pageTitle = ref('Home');
usePageTitle(pageTitle);

const navItems = [
  { id: 'home', label: 'Home' },
  { id: 'templates', label: 'Templates' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'showcase', label: 'Showcase' },
  { id: 'blog', label: 'Blog' },
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
  min-height: 100vh;
  color: #fff;
  background: #000;
  font-family: Inter, sans-serif;
}
.mkt__nav {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 18px 40px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.mkt__brand {
  border: 0;
  background: transparent;
  color: #fff;
  font: 800 20px/1 Inter, sans-serif;
  letter-spacing: -0.04em;
  cursor: pointer;
}
.mkt__menu {
  display: flex;
  gap: 2px;
}
.mkt__menu-item {
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font: 500 14px/1 Inter, sans-serif;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 10px;
}
.mkt__menu-item.is-active {
  color: #fff;
}
.mkt__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.mkt__text-btn {
  color: rgba(255, 255, 255, 0.65);
  text-decoration: none;
  font: 500 14px/1 Inter, sans-serif;
}
.mkt__cta-btn {
  font: 600 13px/1 Inter, sans-serif;
  letter-spacing: -0.01em;
  padding: 9px 14px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #8dd8fc 0%, #838bfb 50%, #ef6fc4 100%);
  color: #000;
  text-decoration: none;
}
.mkt__hero {
  padding: 64px 40px 48px;
  text-align: center;
}
.mkt__eyebrow, .mkt__kicker {
  font: 500 12px/1 Inter, sans-serif;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
}
.mkt__hero-title {
  font: 800 80px/.98 Inter, sans-serif;
  letter-spacing: -0.045em;
  margin: 18px auto 0;
  max-width: 960px;
}
.mkt__hero-title span, .mkt__cta h2 span, .mkt__own h2 span {
  background: linear-gradient(135deg, #8dd8fc 0%, #838bfb 50%, #ef6fc4 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.mkt__hero-sub {
  font: 400 20px/1.45 Inter, sans-serif;
  color: rgba(255, 255, 255, 0.62);
  max-width: 560px;
  margin: 22px auto 30px;
}
.mkt__url-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #131315;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  padding: 5px 10px 5px 16px;
  margin-bottom: 52px;
}
.mkt__url-pill span {
  color: rgba(255, 255, 255, 0.45);
  font: 400 15px/1 "JetBrains Mono", monospace;
}
.mkt__url-pill input {
  background: transparent;
  border: 0;
  outline: 0;
  color: #fff;
  font: 600 15px/1 Inter, sans-serif;
  width: 120px;
}
.mkt__url-pill button {
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #8dd8fc 0%, #838bfb 50%, #ef6fc4 100%);
  padding: 11px 18px;
  font: 600 14px/1 Inter, sans-serif;
  color: #000;
}
.mkt__hero-grid {
  max-width: 720px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 1fr;
  gap: 12px;
  aspect-ratio: 4 / 3;
}
.tile {
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.55);
  background: linear-gradient(180deg, rgba(255, 255, 255, .97), rgba(212, 220, 232, .9));
  position: relative;
}
.tile::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 25% 80%, #ef4dbd, transparent 55%), radial-gradient(circle at 80% 25%, #8dd8fc, transparent 55%);
  filter: blur(18px);
  opacity: .9;
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
  max-width: 1120px;
  margin: 0 auto;
  padding: 80px 40px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: center;
  text-align: left;
}
.mkt__feature--rev > :first-child { order: 2; }
.mkt__feature h2 { font: 700 44px/1.05 Inter, sans-serif; margin: 16px 0 0; }
.mkt__feature p { font: 400 18px/1.5 Inter, sans-serif; color: rgba(255, 255, 255, .6); max-width: 420px; }
.mkt__feature-demo {
  aspect-ratio: 1 / 1;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, #0a0a0b, #000);
}
.mkt__feature-demo--theme { background: radial-gradient(ellipse at 50% 40%, rgba(131, 139, 251, .15), transparent 70%), #0a0a0b; }
.mkt__feature-demo--share { background: radial-gradient(ellipse 50% 40% at 50% 50%, rgba(131, 139, 251, .25), transparent 70%), #0a0a0b; }
.mkt__own {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 40px 40px;
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 56px;
}
.mkt__pill {
  display: inline-flex;
  font: 600 11px/1 Inter, sans-serif;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: #58e0a3;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(88, 224, 163, .12);
  margin-bottom: 20px;
}
.mkt__own h2 { font: 700 48px/1.02 Inter, sans-serif; margin: 0; }
.mkt__own p { color: rgba(255, 255, 255, .65); line-height: 1.55; }
.mkt__terminal {
  border: 1px solid rgba(255, 255, 255, .1);
  border-radius: 20px;
  background: #000;
  padding: 22px 24px;
  font: 400 13px/1.9 "JetBrains Mono", monospace;
}
.mkt__ok { color: #58e0a3; margin-top: 10px; }
.mkt__faint { color: rgba(255, 255, 255, .35); margin-top: 14px; }
.mkt__cta {
  text-align: center;
  padding: 96px 40px;
}
.mkt__cta h2 {
  font: 800 64px/1 Inter, sans-serif;
  letter-spacing: -0.04em;
  margin: 0;
}
.mkt__cta p {
  font: 400 19px/1.4 Inter, sans-serif;
  color: rgba(255, 255, 255, .6);
  max-width: 500px;
  margin: 20px auto 30px;
}
.mkt__page, .mkt__placeholder {
  max-width: 1120px;
  margin: 0 auto;
  padding: 56px 40px 40px;
}
.mkt__page h1 {
  font: 800 56px/1 Inter, sans-serif;
  letter-spacing: -0.04em;
  margin: 14px 0 10px;
}
.mkt__page p {
  font: 400 19px/1.4 Inter, sans-serif;
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
  background: radial-gradient(circle at 20% 20%, #8dd8fc, #838bfb 50%, #ef6fc4);
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
  font: 700 10px/1 Inter, sans-serif;
  text-transform: uppercase;
  padding: 5px 8px;
  border-radius: 6px;
  color: #000;
  background: linear-gradient(135deg, #8dd8fc, #838bfb 50%, #ef6fc4);
}
.mkt__plan h4 {
  font: 800 48px/1 Inter, sans-serif;
  margin: 18px 0 0;
}
.mkt__plan h4 small {
  font: 500 16px/1 Inter, sans-serif;
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
  background: linear-gradient(135deg, #8dd8fc 0%, #838bfb 50%, #ef6fc4 100%);
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
  color: #838bfb;
  margin-right: 10px;
}
.mkt__placeholder {
  text-align: center;
  max-width: 720px;
  padding-top: 120px;
}
.mkt__placeholder h1 {
  font: 700 40px/1 Inter, sans-serif;
  letter-spacing: -0.03em;
  margin: 14px 0 10px;
}
.mkt__placeholder p {
  color: rgba(255, 255, 255, .55);
}
.mkt__footer {
  border-top: 1px solid rgba(255, 255, 255, .06);
  padding: 48px 40px 32px;
  margin-top: 64px;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 40px;
}
.mkt__footer p {
  color: rgba(255, 255, 255, .5);
  max-width: 280px;
}
.mkt__footer-col h4 {
  margin: 0 0 14px;
  font: 600 12px/1 Inter, sans-serif;
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
@media (max-width: 1000px) {
  .mkt__hero-title { font-size: 56px; }
  .mkt__feature, .mkt__own { grid-template-columns: 1fr; }
  .mkt__feature--rev > :first-child { order: initial; }
  .mkt__cards { grid-template-columns: repeat(2, 1fr); }
  .mkt__pricing { flex-direction: column; }
  .mkt__footer { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 720px) {
  .mkt__nav {
    flex-wrap: wrap;
    justify-content: center;
    padding: 14px;
  }
  .mkt__hero { padding: 40px 14px; }
  .mkt__hero-title { font-size: 44px; }
  .mkt__hero-grid { grid-template-columns: repeat(2, 1fr); aspect-ratio: auto; }
  .mkt__feature, .mkt__page, .mkt__cta, .mkt__footer, .mkt__own { padding-left: 14px; padding-right: 14px; }
  .mkt__cards, .mkt__footer { grid-template-columns: 1fr; }
}
</style>
