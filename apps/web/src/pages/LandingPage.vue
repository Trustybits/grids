<template>
  <MarketingLayout>
    <section class="mkt__hero">
      <div class="mkt__hero-container mkt__section">
        <div class="mkt__eyebrow">Showcase simplified</div>
        <h1 class="mkt__hero-title">
          Your page.<br />
          Your work. <span>Your success.</span>
        </h1>
        <p class="mkt__hero-sub">
          Drop tiles on a canvas. Rearrange until it feels right. Share one link — no building from scratch.
        </p>
        <div class="mkt__url-pill">
          <span>grids.so/</span>
          <span class="mkt__url-pill-text" aria-label="slug input" role="textbox">
            <span class="mkt__url-pill-text-value">{{ animatedSlug }}</span>
            <span class="mkt__url-pill-caret" aria-hidden="true"></span>
          </span>
          <button @click="router.push('/login')">Claim handle</button>
        </div>
      </div>

      <LandingPageGridEmbed v-if="useLiveGridPreview" />
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
          <p>Pick a color. Set a vibe. Tiles fill themselves with the theme and shape of your work.</p>
        </div>
        <div class="mkt__feature-demo mkt__feature-demo--theme">
          <div class="mkt__palette-row">
            <span class="dot dot--cyan"></span>
            <span class="dot dot--blue"></span>
            <span class="dot dot--indigo"></span>
            <span class="dot dot--violet"></span>
            <span class="dot dot--magenta"></span>
            <span class="dot dot--yellow"></span>
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
          <div class="mkt__og-card">
            <div class="mkt__og-image">
              <img src="/og-preview-placeholder.png" alt="Grid preview" />
            </div>
            <div class="mkt__og-meta">
              <span class="mkt__og-site">matt's grid</span>
              <span class="mkt__og-title">https://grids.so/matt</span>
            </div>
          </div>
          <!-- <div class="mkt__share-pill">
            <span>grids.so/</span>
            <strong>taylor</strong>
          </div> -->
        </div>
      </section>

      <section class="mkt__section mkt__own">
        <div>
          <div class="mkt__pill">
            <i class="fab fa-github" aria-hidden="true"></i>
            <span>Open source</span>
          </div>
          <h2>Your page is yours. Forever.</h2>
          <p>
            We watched too many favorite link-in-bio and portfolio sites quietly shut down — taking their users'
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
        <Button variant="brand" to="/login" size="lg">Make your grid →</Button>
      </section>
    </section>
  </MarketingLayout>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { usePageTitle } from '@/composables/usePageTitle';
import LandingPageGridEmbed from '@/components/marketing/LandingPageGridEmbed.vue';
import MarketingLayout from '@/components/marketing/MarketingLayout.vue';
import Button from '@/components/ui-elements/Button.vue';

// Toggle between the real <Grid>-powered preview and the legacy CSS mock.
// Flip to `false` to fall back to the static tile mock (useful while
// iterating on the demo layout or if the embed regresses).
const useLiveGridPreview = true;

const pageTitle = ref('Home');
usePageTitle(pageTitle);

const router = useRouter();

const sampleSlugs = ['taylor', 'mira', 'jordan', 'kei', 'june', 'sam', 'paulo', 'liam', 'olivia', 'noah', 'mma', 'oliver', 'charlotte', 'elijah', 'amelia', 'james', 'ava', 'william', 'sophia', 'benjamin', 'isabella', 'lucas', 'mia', 'henry', 'evelyn', 'theodore', 'harper'];
const animatedSlug = ref(sampleSlugs[0]);
let slugTimer: ReturnType<typeof setTimeout> | null = null;

const TYPE_MS = 110;
const DELETE_MS = 55;
const HOLD_FULL_MS = 2400;
const HOLD_EMPTY_MS = 320;

function scheduleSlug(fn: () => void, delay: number) {
  slugTimer = setTimeout(fn, delay);
}

function startSlugAnimation() {
  let index = 0;

  const typeNext = () => {
    index = (index + 1) % sampleSlugs.length;
    const target = sampleSlugs[index];
    let i = 0;

    const typeChar = () => {
      i += 1;
      animatedSlug.value = target.slice(0, i);
      if (i < target.length) {
        scheduleSlug(typeChar, TYPE_MS);
      } else {
        scheduleSlug(deleteCurrent, HOLD_FULL_MS);
      }
    };

    scheduleSlug(typeChar, HOLD_EMPTY_MS);
  };

  const deleteCurrent = () => {
    const current = animatedSlug.value;
    if (current.length === 0) {
      typeNext();
      return;
    }
    animatedSlug.value = current.slice(0, -1);
    scheduleSlug(deleteCurrent, DELETE_MS);
  };

  scheduleSlug(deleteCurrent, HOLD_FULL_MS);
}

onMounted(() => {
  startSlugAnimation();
});

onBeforeUnmount(() => {
  if (slugTimer) clearTimeout(slugTimer);
});
</script>
