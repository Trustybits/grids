<template>
  <MarketingLayout>
    <section class="mkt__hero" @pointermove="onDotsPointerMove">
      <div class="mkt__hero-dots" aria-hidden="true"></div>
      <div class="mkt__hero-stage">
        <LandingHeroTiles />
      <div class="mkt__hero-container mkt__section">
        <h1 class="mkt__hero-title">
          Your page.<br />
          Your work.<br />
          <span>Your success.</span>
        </h1>
        <p class="mkt__hero-sub">
          Drop tiles on a canvas. Rearrange until it feels right. Share one link — no building from scratch.
        </p>
        <div
          ref="pillRef"
          class="mkt__url-pill"
          :class="{
            'is-checking': checkingLive,
            'is-available': available === true,
            'is-taken': available === false,
          }"
        >
          <span class="mkt__url-pill-prefix">grids.so/</span>
          <input
            ref="inputRef"
            v-model="handle"
            class="mkt__url-pill-input"
            type="text"
            :placeholder="animatedSlug"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="none"
            maxlength="30"
            aria-label="Choose your grids.so handle"
            @focus="onHandleFocus"
            @blur="onHandleBlur"
            @input="onHandleInput"
            @keydown.enter.prevent="onClaim"
          />
          <span class="mkt__url-mark" aria-hidden="true">
            <span v-if="checkingLive" class="mkt__url-spinner mkt__url-spinner--sm"></span>
            <span v-else-if="available === true" class="mkt__url-mark-ok">✓</span>
            <span v-else-if="available === false" class="mkt__url-mark-bad">✕</span>
          </span>
          <span ref="beamRef" class="mkt__url-beam" aria-hidden="true"></span>
          <button
            ref="btnRef"
            type="button"
            class="mkt__url-pill-btn"
            @click="onClaim"
          >
            <span>Claim handle</span>
          </button>
          <span
            v-if="available !== null && !checkingLive"
            class="mkt__url-status"
            :class="available ? 'mkt__url-status--ok' : 'mkt__url-status--bad'"
            aria-live="polite"
          >{{ available ? 'available!' : "that handle's taken — try another" }}</span>
        </div>
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

      <LandingShowcaseMarquee />

      <LandingFeatureAssembly />

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
            href="https://github.com/trustybits/grids"
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
            <div><span class="mkt__terminal-prompt">$</span> git clone trustybits/grids</div>
            <div><span class="mkt__terminal-prompt">$</span> cd grids && pnpm i</div>
            <div><span class="mkt__terminal-prompt">$</span> pnpm dev</div>
          </div>
          <div class="mkt__ok">✓ ready on localhost:3000</div>
          <div class="mkt__faint"># your grid. your server. forever.</div>
        </div>
      </section>

      <section class="mkt__section mkt__cta" @pointermove="onCtaPointerMove">
        <div class="mkt__cta-grid" aria-hidden="true"></div>
        <div class="mkt__cta-spot" aria-hidden="true"></div>
        <div class="mkt__cta-inner">
          <h2>Ready to <span>show off?</span></h2>
          <p>Free to start. Your first grid takes about four minutes.</p>
          <Button variant="brand" to="/login" size="lg" class="mkt__cta-btn">Make your grid →</Button>
        </div>
      </section>
    </section>
  </MarketingLayout>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { usePageTitle } from '@/composables/usePageTitle';
import { SHOWCASE_GRIDS } from '@/data/showcaseGrids';
import LandingHeroTiles from '@/components/marketing/LandingHeroTiles.vue';
import LandingPageGridEmbed from '@/components/marketing/LandingPageGridEmbed.vue';
import LandingFeatureAssembly from '@/components/marketing/LandingFeatureAssembly.vue';
import LandingShowcaseMarquee from '@/components/marketing/LandingShowcaseMarquee.vue';
import MarketingLayout from '@/components/marketing/MarketingLayout.vue';
import Button from '@/components/ui-elements/Button.vue';

// Toggle between the real <Grid>-powered preview and the legacy CSS mock.
// Flip to `false` to fall back to the static tile mock (useful while
// iterating on the demo layout or if the embed regresses).
const useLiveGridPreview = true;

const pageTitle = ref('Home');
usePageTitle(pageTitle);

const router = useRouter();

const sampleSlugs = SHOWCASE_GRIDS.map((entry) => entry.slug);
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

// Move the CTA spotlight to follow the cursor. Writes CSS vars the
// `.mkt__cta-spot` layer reads; no reactive state so it stays cheap.
function onCtaPointerMove(event: PointerEvent) {
  const el = event.currentTarget as HTMLElement;
  const rect = el.getBoundingClientRect();
  el.style.setProperty('--cta-mx', `${event.clientX - rect.left}px`);
  el.style.setProperty('--cta-my', `${event.clientY - rect.top}px`);
}

// Track the cursor over the whole page so the dot-grid backdrop shines a little
// near the pointer. Coords must be relative to the full-bleed `.mkt__hero-dots`
// layer (100vw) — not the narrower hero — or the spark drifts off the cursor on
// wide screens.
function onDotsPointerMove(event: PointerEvent) {
  const hero = event.currentTarget as HTMLElement;
  const dots = hero.querySelector('.mkt__hero-dots') as HTMLElement | null;
  if (!dots) return;
  const rect = dots.getBoundingClientRect();
  dots.style.setProperty('--dot-mx', `${event.clientX - rect.left}px`);
  dots.style.setProperty('--dot-my', `${event.clientY - rect.top}px`);
}

// ── Interactive handle claim ────────────────────────────────────────────
const handle = ref('');
const checkingLive = ref(false);
const available = ref<boolean | null>(null);
let checkTimer: ReturnType<typeof setTimeout> | null = null;
let checkSeq = 0;
const pillRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const btnRef = ref<HTMLButtonElement | null>(null);
const beamRef = ref<HTMLElement | null>(null);

// Simulated "already claimed" handles so the availability check feels real:
// the featured showcase grids plus a few reserved words are taken; anything
// else is available.
const TAKEN_HANDLES = new Set<string>([
  ...SHOWCASE_GRIDS.map((g) => g.slug),
  'admin', 'grids', 'app', 'api', 'login', 'signup', 'dashboard',
  'settings', 'about', 'help', 'support', 'pricing', 'blog', 'terms',
  'privacy', 'home', 'me', 'test',
]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function stopSlugAnimation() {
  if (slugTimer) {
    clearTimeout(slugTimer);
    slugTimer = null;
  }
}

function onHandleFocus() {
  // Freeze the cycling placeholder while the visitor is typing.
  stopSlugAnimation();
}

function onHandleBlur() {
  if (!handle.value) startSlugAnimation();
}

function onHandleInput() {
  // Keep it a valid slug: lowercase alphanumerics plus dash / underscore.
  handle.value = handle.value.toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 30);
  scheduleLiveCheck();
}

// Debounced, real-time availability check that runs as the visitor types:
// a spinner shows while checking, then it resolves to available / taken
// automatically without pressing the button.
function scheduleLiveCheck() {
  if (checkTimer) clearTimeout(checkTimer);
  available.value = null;
  const value = handle.value.trim();
  if (!value) {
    checkingLive.value = false;
    return;
  }
  checkingLive.value = true;
  const seq = ++checkSeq;
  checkTimer = setTimeout(() => {
    if (seq !== checkSeq) return; // a newer keystroke superseded this one
    checkingLive.value = false;
    available.value = !TAKEN_HANDLES.has(value);
  }, 500);
}

// Measures the rendered width of the typed handle so the beam launches from
// the end of the text rather than a fixed point.
let measureCanvas: HTMLCanvasElement | null = null;
function measureHandleWidth(input: HTMLInputElement, text: string): number {
  if (!text) return 8;
  const cs = getComputedStyle(input);
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  if (!ctx) return 40;
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return ctx.measureText(text).width;
}

// Shoots a glowing line from the handle text to the Claim button, then pulses
// the button when it lands.
function fireBeam() {
  const pill = pillRef.value;
  const input = inputRef.value;
  const btn = btnRef.value;
  const beam = beamRef.value;
  if (!pill || !input || !btn || !beam) return;
  const pr = pill.getBoundingClientRect();
  const ir = input.getBoundingClientRect();
  const br = btn.getBoundingClientRect();
  const textW = Math.min(measureHandleWidth(input, handle.value), ir.width - 6);
  const startX = ir.left - pr.left + Math.max(6, textW);
  const endX = br.left - pr.left + br.width / 2;
  beam.animate(
    [
      { transform: `translate(${startX}px, -50%) scaleX(0.3)`, opacity: 0 },
      { transform: `translate(${startX + 6}px, -50%) scaleX(1)`, opacity: 1, offset: 0.18 },
      { transform: `translate(${endX - 14}px, -50%) scaleX(1)`, opacity: 1, offset: 0.82 },
      { transform: `translate(${endX}px, -50%) scaleX(0.2)`, opacity: 0 },
    ],
    { duration: 1600, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  );
  window.setTimeout(() => btn.classList.add('is-hit'), 1380);
  window.setTimeout(() => btn.classList.remove('is-hit'), 2100);
}

async function onClaim() {
  const value = handle.value.trim();
  if (!value) {
    inputRef.value?.focus();
    return;
  }
  // If the live check hasn't settled yet (clicked mid-typing), resolve it now.
  if (available.value === null) {
    if (checkTimer) clearTimeout(checkTimer);
    checkingLive.value = false;
    available.value = !TAKEN_HANDLES.has(value);
  }
  if (available.value !== true) {
    // Taken → keep the red state; no beam, no navigation. Let them retry.
    inputRef.value?.focus();
    return;
  }
  await nextTick();
  fireBeam();
  await sleep(1900);
  router.push({ path: '/login', query: { handle: value } });
}

onMounted(() => {
  startSlugAnimation();
});

onBeforeUnmount(() => {
  if (slugTimer) clearTimeout(slugTimer);
  if (checkTimer) clearTimeout(checkTimer);
});
</script>
