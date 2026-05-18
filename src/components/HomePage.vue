<template>
  <div class="mkt">
    <MarketingNavBar
      :nav-items="navItems"
      :current-page="currentPage"
      :is-authenticated="isAuthenticated"
      @navigate="(page: string) => nav(page as Page)"
    />

    <main class="mkt__body">
    <section v-if="currentPage === 'home'" class="mkt__hero">
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

    <section v-else-if="currentPage === 'pricing'" class="mkt__section mkt__page mkt__pricing-page">
      <div class="mkt__kicker">Pricing</div>
      <h1>Simple, <span>honest pricing.</span></h1>
      <p>Grids is free to build with. Pay what you want to support the project, or go Pro for advanced features.</p>

      <!-- Temporarily disabled for now until we have pro tier ready -->
      <!-- <div class="mkt__billing-toggle" role="group" aria-label="Billing interval">
        <button
          :class="['mkt__billing-btn', { 'is-active': billingInterval === 'month' }]"
          @click="billingInterval = 'month'"
        >
          Monthly
        </button>
        <button
          :class="['mkt__billing-btn', { 'is-active': billingInterval === 'year' }]"
          @click="billingInterval = 'year'"
        >
          Annual
          <span class="mkt__save-badge">Save 25%</span>
        </button>
      </div> -->

      <div class="mkt__pricing mkt__pricing--duo">
        <!-- Supporter (Pay what you want) -->
        <article
          :class="[
            'mkt__plan',
            'mkt__plan--supporter',
            { 'is-current': hasSupporterBadge && tier !== 'pro' },
          ]"
        >
          <div class="mkt__ribbon mkt__ribbon--supporter">Support the project</div>
          <header>
            <h3>Supporter</h3>
          </header>
          <h4 class="mkt__plan-title--supporter">Pay what you want</h4>
          <p>One-time. No subscription. Unlock the Supporter badge.</p>

          <div class="mkt__plan-cta">
            <div v-if="hasSupporterBadge" class="mkt__current">
              <span aria-hidden="true">🔥</span> You're a Supporter!
            </div>
            <p v-if="totalPaidCents > 0" class="mkt__contribution-total">
              Contributed to date: {{ formattedTotalContributed }}
            </p>
            <div class="mkt__pwyw">
              <div class="mkt__pwyw-row">
                <button
                  v-for="preset in pwywPresets"
                  :key="preset"
                  :class="[
                    'mkt__pwyw-btn',
                    {
                      'is-active':
                        selectedAmount === preset && !customAmountMode,
                    },
                  ]"
                  @click="selectPreset(preset)"
                >
                  ${{ preset }}
                </button>
                <button
                  :class="['mkt__pwyw-btn', { 'is-active': customAmountMode }]"
                  @click="customAmountMode = true"
                >
                  Custom
                </button>
              </div>
              <div v-if="customAmountMode" class="mkt__pwyw-custom">
                <span aria-hidden="true">$</span>
                <input
                  :value="customAmount"
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  placeholder="5"
                  @keydown="onCustomAmountKeydown"
                  @input="onCustomAmountInput"
                  @blur="normalizeCustomAmount"
                  @focus="($event.target as HTMLInputElement)?.select()"
                />
                <div class="mkt__stepper" aria-hidden="true">
                  <button
                    type="button"
                    class="mkt__stepper-btn"
                    @click="incrementCustomAmount"
                  >
                    ˄
                  </button>
                  <button
                    type="button"
                    class="mkt__stepper-btn"
                    @click="decrementCustomAmount"
                  >
                    ˅
                  </button>
                </div>
              </div>
            </div>

            <button
              class="mkt__plan-btn mkt__plan-btn--brand"
              :disabled="checkout.loading.value"
              @click="handleSupporterCheckout"
            >
              <span v-if="checkout.loading.value">Processing...</span>
              <span v-else-if="effectiveAmount === 0">Continue for Free</span>
              <span v-else-if="hasSupporterBadge">Contribute Again (${{ effectiveAmount }})</span>
              <span v-else>Support for ${{ effectiveAmount }}</span>
            </button>
            <p v-if="checkout.error.value" class="mkt__plan-error">
              {{ checkout.error.value }}
            </p>
          </div>

          <div class="mkt__unlocks">
            <div
              v-for="group in supporterUnlocks"
              :key="group.label"
              class="mkt__unlock-group"
            >
              <div class="mkt__plan-section">{{ group.label }}</div>
              <ul>
                <li v-for="item in group.items" :key="item">{{ item }}</li>
              </ul>
            </div>
          </div>
        </article>

        <!-- Pro -->
        <article
          :class="['mkt__plan', 'mkt__plan--pro', { 'is-current': isProOrAbove }]"
        >
          <div class="mkt__ribbon mkt__ribbon--pro">Premium Features</div>
          <header>
            <h3>Pro</h3>
          </header>
          <h4>
            ${{
              billingInterval === 'month'
                ? proMonthlyPrice
                : proAnnualMonthlyPrice
            }}
            <small>/ mo</small>
          </h4>
          <p v-if="billingInterval === 'year'" class="mkt__annual-note">
            Billed ${{ proAnnualPrice }} annually
          </p>
          <p>For power users and professionals.</p>

          <div class="mkt__plan-cta">
            <button class="mkt__plan-btn mkt__plan-btn--outline" disabled>
              Coming Soon
            </button>
          </div>

          <ul>
            <li class="mkt__plan-section">Everything in Supporter, plus:</li>
            <li v-for="f in proFeatures" :key="f">{{ f }}</li>
          </ul>
        </article>
      </div>

      <!-- Community / Free / Open source — horizontal, outlined -->
      <article
        :class="[
          'mkt__plan',
          'mkt__plan--community',
          { 'is-current': tier === 'community' && !hasSupporterBadge },
        ]"
      >
        <div class="mkt__community-head">
          <div class="mkt__pill mkt__pill--sm">
            <i class="fab fa-github" aria-hidden="true"></i>
            <span>Open source · Free forever</span>
          </div>
          <h3>Community</h3>
          <p>
            Everything you need to build and share. Self-host, fork, or export
            your grid any time — your page is yours.
          </p>
        </div>

        <ul class="mkt__community-features">
          <li v-for="f in communityFeatures" :key="f">{{ f }}</li>
        </ul>

        <div class="mkt__community-cta">
          <a
            class="mkt__plan-btn mkt__plan-btn--outline"
            href="https://github.com/trustybits/grids"
            target="_blank"
            rel="noopener noreferrer"
          >
            <i class="fab fa-github" aria-hidden="true"></i>
            <span>View public repo on GitHub</span>
          </a>
        </div>
      </article>

      <!-- Feature comparison -->
      <div class="mkt__comparison">
        <button
          class="mkt__comparison-toggle"
          @click="showComparison = !showComparison"
        >
          {{ showComparison ? 'Hide' : 'See full' }} feature comparison
          <span :class="{ 'is-rotated': showComparison }">▾</span>
        </button>
        <div v-if="showComparison" class="mkt__comparison-wrap">
          <table class="mkt__comparison-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Community</th>
                <th>Supporter</th>
                <th>Pro</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in comparisonRows" :key="row.feature">
                <td>
                  <span>{{ row.feature }}</span>
                  <span v-if="row.comingSoon" class="mkt__coming-soon-chip">
                    Coming soon
                  </span>
                </td>
                <td :class="comparisonCellClass(row.community)">
                  {{ comparisonCellLabel(row.community) }}
                </td>
                <td :class="comparisonCellClass(row.supporter)">
                  {{ comparisonCellLabel(row.supporter) }}
                </td>
                <td :class="comparisonCellClass(row.pro)">
                  {{ comparisonCellLabel(row.pro) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- FAQ -->
      <div class="mkt__faq">
        <h2>Common questions</h2>
        <div class="mkt__faq-grid">
          <div v-for="item in faqItems" :key="item.q" class="mkt__faq-item">
            <h3>{{ item.q }}</h3>
            <p>{{ item.a }}</p>
          </div>
        </div>
      </div>
    </section>

    <section v-else class="mkt__section mkt__placeholder">
      <div class="mkt__kicker">{{ currentPage }}</div>
      <h1>Coming soon.</h1>
      <p>We haven't built this page yet.</p>
      </section>
    </main>

    <MarketingFooter @navigate="(page: string) => nav(page as Page)" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePageTitle } from '@/composables/usePageTitle';
import { useTier } from '@/composables/useTier';
import { useBadges } from '@/composables/useBadges';
import { useContributions } from '@/composables/useContributions';
import { useStripeCheckout } from '@/composables/useStripeCheckout';
import { getAuthProvider } from '@/auth/AuthProviderSingleton';
import type { AuthUser } from '@/auth/AuthProvider';
import HomePageGridEmbed from '@/components/HomePageGridEmbed.vue';
import MarketingNavBar from '@/components/MarketingNavBar.vue';
import MarketingFooter from '@/components/MarketingFooter.vue';

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

const route = useRoute();
const router = useRouter();

const currentPage = ref<Page>('home');
const user = ref<AuthUser | null>(null);
const isAuthenticated = computed(() => !!user.value);
let unsubscribeAuthState: (() => void) | null = null;

// Animated marketing pill — types/backspaces through sample handles
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
  unsubscribeAuthState = getAuthProvider().onAuthStateChanged((currentUser) => {
    user.value = currentUser;
  });
  startSlugAnimation();
});

onBeforeUnmount(() => {
  if (unsubscribeAuthState) unsubscribeAuthState();
  if (slugTimer) clearTimeout(slugTimer);
});

const pageRoutes: Record<Page, string> = {
  home: '/',
  pricing: '/pricing',
  showcase: '/showcase',
  templates: '/templates',
  blog: '/blog',
};

const routeToPage: Record<string, Page> = Object.fromEntries(
  Object.entries(pageRoutes).map(([page, path]) => [path, page as Page]),
) as Record<string, Page>;

const pageFromRoute = (path: string): Page | null => {
  return routeToPage[path] ?? null;
};

const nav = (page: Page) => {
  currentPage.value = page;
  pageTitle.value = page[0].toUpperCase() + page.slice(1);
  localStorage.setItem('grids-mkt-page', page);

  const targetPath = pageRoutes[page];
  if (route.path !== targetPath) {
    router.push(targetPath);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

onMounted(() => {
  const routePage = pageFromRoute(route.path);
  if (routePage) {
    currentPage.value = routePage;
    pageTitle.value = routePage[0].toUpperCase() + routePage.slice(1);
    return;
  }
  const saved = localStorage.getItem('grids-mkt-page') as Page | null;
  if (saved && navItems.some((item) => item.id === saved)) {
    currentPage.value = saved;
    pageTitle.value = saved[0].toUpperCase() + saved.slice(1);
  }
});

watch(
  () => route.path,
  (path) => {
    const routePage = pageFromRoute(path);
    if (routePage && routePage !== currentPage.value) {
      currentPage.value = routePage;
      pageTitle.value = routePage[0].toUpperCase() + routePage.slice(1);
    }
  },
);

const templates = [
  { name: 'Photographer', by: 'Mira Okafor' },
  { name: 'Writer', by: 'Sam Haines' },
  { name: 'Musician', by: 'June' },
  { name: 'Designer', by: 'Paulo S.' },
  { name: 'Developer', by: 'kei.dev' },
  { name: 'Link in bio', by: 'grids team' },
];

// ── Pricing ────────────────────────────────────────────────────────────────
const { tier, isProOrAbove } = useTier();
const userId = computed(() => user.value?.uid ?? null);
const { hasBadge } = useBadges(userId);
const hasSupporterBadge = computed(() => hasBadge('supporter'));
const { totalPaidCents } = useContributions();
const checkout = useStripeCheckout();

const billingInterval = ref<'month' | 'year'>('month');

const proMonthlyPrice = 12;
const proAnnualPrice = 120;
const proAnnualMonthlyPrice = computed(() => Math.round(proAnnualPrice / 12));

const pwywPresets = [1, 5, 20, 50];
const selectedAmount = ref(5);
const customAmountMode = ref(false);
const customAmount = ref(5);

function selectPreset(amount: number) {
  selectedAmount.value = amount;
  customAmountMode.value = false;
}

const effectiveAmount = computed(() =>
  customAmountMode.value
    ? Math.max(0, Math.floor(customAmount.value || 0))
    : selectedAmount.value,
);

const formattedTotalContributed = computed(() =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    totalPaidCents.value / 100,
  ),
);

async function handleSupporterCheckout() {
  if (effectiveAmount.value === 0) {
    router.push('/');
    return;
  }
  await checkout.checkoutSupporter(effectiveAmount.value);
}

const communityFeatures = [
  'Unlimited grids',
  'Unlimited tiles',
  'Drag-and-drop editor',
  'Mobile-responsive layouts',
  'Basic page analytics (coming soon)',
];

const supporterUnlocks = [
  {
    label: 'Any amount unlocks',
    items: [
      'Two grid pages',
      'Unlimited tiles',
      'Custom handle URL (grids.so/yourhandle)',
    ],
  },
  {
    label: '$1+ unlocks',
    items: [
      'Supporter badge on your profile',
      'Early access to new features',
      'Warm fuzzy feeling of supporting an amazing open-source product',
    ],
  },
  {
    label: '$10+ unlocks',
    items: ['Remove Grids branding'],
  },
];

function onCustomAmountInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const digitsOnly = target.value.replace(/[^\d]/g, '');
  const parsed = Number.parseInt(digitsOnly || '0', 10);
  customAmount.value = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
}

function onCustomAmountKeydown(event: KeyboardEvent) {
  if (event.key === '.' || event.key === ',') {
    event.preventDefault();
  }
}

function normalizeCustomAmount() {
  customAmount.value = Math.max(0, Math.floor(customAmount.value || 0));
}

function incrementCustomAmount() {
  customAmount.value = Math.max(0, Math.floor(customAmount.value || 0)) + 1;
}

function decrementCustomAmount() {
  customAmount.value = Math.max(0, Math.floor(customAmount.value || 0) - 1);
}

const proFeatures = [
  'Unlimited grids',
  'All tile types',
  'Custom domain',
  'Advanced theming',
  'Higher storage and upload limits',
  'Shared grid edit access',
  'Advanced analytics & export',
  'Password-protected grids',
  'Subpages',
  'Visitor heatmaps',
  'Scheduled grid publishing',
  'Priority support',
];

const showComparison = ref(false);
type ComparisonCell = boolean | string;

function comparisonCellLabel(value: ComparisonCell) {
  if (typeof value === 'boolean') {
    return value ? '✓' : '—';
  }
  return value;
}

function comparisonCellClass(value: ComparisonCell) {
  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no';
  }
  if (value.trim() === '—') {
    return 'no';
  }
  return 'text';
}

const comparisonRows = [
  { feature: 'Grid Pages', community: true, supporter: '2', pro: 'Unlimited' },
  { feature: 'Unlimited tiles', community: true, supporter: true, pro: true },
  { feature: 'Drag-and-drop editor', community: true, supporter: true, pro: true },
  { feature: 'Mobile-responsive layouts', community: true, supporter: true, pro: true },
  { feature: 'Basic page analytics', community: true, supporter: true, pro: true, comingSoon: true },
  { feature: 'Storage and uploads', community: '—', supporter: 'Normal Limits', pro: 'Higher Limits' },
  { feature: 'Custom handle URL', community: false, supporter: true, pro: true },
  { feature: 'Early access to new features', community: false, supporter: true, pro: true },
  { feature: 'Remove Grids branding ($10+ supporter)', community: false, supporter: true, pro: true },
  { feature: 'Supporter badge', community: false, supporter: true, pro: true },
  { feature: 'Custom domain', community: false, supporter: false, pro: true, comingSoon: true },
  { feature: 'Advanced theming', community: false, supporter: false, pro: true, comingSoon: true },
  { feature: 'Shared grid edit access', community: false, supporter: false, pro: true, comingSoon: true },
  { feature: 'Advanced analytics & export', community: false, supporter: false, pro: true, comingSoon: true },
  { feature: 'Password-protected grids', community: false, supporter: false, pro: true, comingSoon: true },
  { feature: 'Subpages', community: false, supporter: false, pro: true, comingSoon: true },
  { feature: 'Visitor heatmaps', community: false, supporter: false, pro: true, comingSoon: true },
  { feature: 'Scheduled grid publishing', community: false, supporter: false, pro: true, comingSoon: true },
  { feature: 'Priority support', community: false, supporter: false, pro: true, comingSoon: true },
];

const faqItems = [
  {
    q: 'Is Grids really free?',
    a: 'Yes — the Community tier is free forever. No credit card required, no trial period. We make money from Pro subscriptions and supporter contributions.',
  },
  {
    q: 'What does "pay what you want" mean?',
    a: 'You choose your supporter amount. At $1+ you unlock the supporter perks, and at $10+ you also unlock branding removal on published pages.',
  },
  {
    q: 'Can I cancel my Pro subscription?',
    a: 'Yes, any time from your billing dashboard. You keep Pro access until the end of the billing period.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'All major credit and debit cards via Stripe.',
  },
  {
    q: 'Do you offer refunds?',
    a: "For Pro subscriptions, we offer a full refund within 7 days of purchase if you're not satisfied. Supporter payments are non-refundable.",
  },
  {
    q: 'Is my billing information secure?',
    a: 'Yes — Grids never stores your card details. All payments are processed by Stripe, which is PCI DSS Level 1 certified.',
  },
];
</script>

<style scoped>
.mkt {
  --mkt-section-max: 1120px;
  --mkt-chrome-max: 1440px;
  --mkt-section-x: 40px;
  --mkt-section-y: 128px;
  --mkt-font-brand: 'Oxanium', var(--mkt-font-sans);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  color: var(--mkt-fg-1);
  background: var(--mkt-bg-0);
  font-family: var(--mkt-font-sans);
  position: relative;
}
.mkt__body {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.mkt__body > :first-child {
  margin-top: auto;
}
.mkt__body > :last-child {
  margin-bottom: auto;
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
/* .mkt__cta-btn is reused by the CTA section on the home page */
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

.mkt__cta h2 span {
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
  padding-right: 10px;
  width: 120px;
}
.mkt__url-pill-text {
  display: inline-flex;
  align-items: center;
  color: var(--mkt-fg-1);
  font: 600 15px/1 var(--mkt-font-sans);
  padding-right: 10px;
  min-width: 120px;
  white-space: pre;
}
.mkt__url-pill-text-value {
  display: inline-block;
}
.mkt__url-pill-caret {
  display: inline-block;
  width: 1.5px;
  height: 1em;
  background: currentColor;
  margin-left: 1px;
  vertical-align: -0.12em;
  animation: mkt-caret-blink 1.05s steps(1) infinite;
}
@keyframes mkt-caret-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
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
.mkt__feature-demo--share {
  background: radial-gradient(ellipse 50% 40% at 50% 50%, rgba(131, 139, 251, .25), transparent 70%), #0a0a0b;
  flex-direction: column;
  gap: 16px;
}
.mkt__og-card {
  width: 280px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, .10);
  background: var(--mkt-bg-2);
  overflow: hidden;
  box-shadow: 0 8px 24px -8px rgba(0, 0, 0, .5);
}
.mkt__og-image {
  width: 100%;
  aspect-ratio: 1.91 / 1;
  background: linear-gradient(135deg, rgba(131, 139, 251, .18), rgba(236, 72, 153, .12));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.mkt__og-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.mkt__og-meta {
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-top: 1px solid rgba(255, 255, 255, .06);
}
.mkt__og-site {
  font: 400 11px/1 var(--mkt-font-mono);
  color: var(--mkt-fg-4);
  text-transform: uppercase;
  letter-spacing: .03em;
}
.mkt__og-title {
  font: 600 14px/1.3 var(--mkt-font-sans);
  color: var(--mkt-fg-1);
}
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
.dot--yellow { background: var(--color-yellow); }
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
  color: var(--color-yellow);
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 226, 153, .12);
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
  font: 400 64px/1 var(--mkt-font-sans);
  letter-spacing: -0.04em;
  margin: 0;
}
.mkt__cta h2 span {
  font-weight: 800;
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
.mkt__pricing-page { text-align: center; }
.mkt__pricing-page h1 span {
  background: var(--mkt-brand-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.mkt__pricing-page > p {
  max-width: 560px;
  margin: 10px auto 0;
}

/* ── Billing interval toggle ──────────────────────────────────────────── */
.mkt__billing-toggle {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  margin: 28px auto 36px;
  background: var(--mkt-bg-2);
  border: 1px solid rgba(255, 255, 255, .08);
  border-radius: 999px;
}
.mkt__billing-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: var(--mkt-fg-3);
  padding: 8px 18px;
  border-radius: 999px;
  font: 500 13px/1 var(--mkt-font-sans);
  cursor: pointer;
  transition: color .15s, background .15s;
}
.mkt__billing-btn.is-active {
  color: #000;
  background: var(--mkt-brand-gradient);
  font-weight: 700;
}
.mkt__save-badge {
  font: 700 10px/1 var(--mkt-font-sans);
  padding: 3px 7px;
  border-radius: 999px;
  background: #58e0a3;
  color: #052e1f;
  text-transform: uppercase;
  letter-spacing: .04em;
}

/* ── Pricing grid ─────────────────────────────────────────────────────── */
.mkt__pricing {
  display: flex;
  gap: 18px;
  margin-top: 20px;
  text-align: left;
}
.mkt__pricing--duo {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-top: 0;
  padding: 96px 96px 0 96px;
}

.mkt__plan {
  flex: 1;
  position: relative;
  z-index: 1;
  padding: 32px;
  border-radius: 24px;
  background: #0a0a0b;
  border: 1px solid rgba(255, 255, 255, .08);
  display: flex;
  flex-direction: column;
}
.mkt__plan.is-current {
  box-shadow: inset 0 0 0 1px rgba(88, 224, 163, .35);
}
.mkt__plan--supporter {
  z-index: 3;
}
.mkt__plan header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.mkt__plan header h3 {
  margin: 0;
  font: 700 18px/1 var(--mkt-font-sans);
  color: var(--mkt-fg-1);
}
.mkt__plan h4 {
  font: 800 36px/1 var(--mkt-font-sans);
  letter-spacing: -0.03em;
  margin: 18px 0 0;
  color: var(--mkt-fg-1);
}
.mkt__plan h4.mkt__plan-title--supporter {
  font-size: 36px;
  line-height: 1.05;
}
.mkt__plan h4 small {
  font: 500 16px/1 var(--mkt-font-sans);
  color: rgba(255, 255, 255, .45);
}
.mkt__annual-note {
  color: rgba(255, 255, 255, .45) !important;
  font-size: 12px !important;
  margin: 6px 0 0 !important;
}
.mkt__plan p {
  color: rgba(255, 255, 255, .55);
  font-size: 14px;
  margin: 10px 0 0;
}
.mkt__plan ul {
  list-style: none;
  padding: 0;
  margin: 20px 0 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: rgba(255, 255, 255, .75);
  font-size: 14px;
}
.mkt__plan li {
  position: relative;
  padding-left: 22px;
}
.mkt__plan li::before {
  content: "✓";
  position: absolute;
  left: 0;
  top: 0;
  color: var(--mkt-brand-indigo);
}
.mkt__plan-section {
  font: 600 11px/1 var(--mkt-font-sans);
  text-transform: uppercase;
  letter-spacing: .08em;
  color: rgba(255, 255, 255, .45) !important;
  padding-left: 0 !important;
  margin-top: 4px;
}
.mkt__plan-section::before { content: none !important; }
.mkt__unlocks {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.mkt__unlock-group {
  border-top: 1px solid rgba(255, 255, 255, .08);
  padding-top: 12px;
}
.mkt__unlock-group ul {
  margin-top: 10px;
}

/* ── Ribbons ──────────────────────────────────────────────────────────── */
.mkt__ribbon {
  position: absolute;
  top: -11px;
  left: 50%;
  transform: translateX(-50%);
  font: 700 10px/1 var(--mkt-font-sans);
  text-transform: uppercase;
  letter-spacing: .08em;
  padding: 6px 12px;
  border-radius: 999px;
  color: #000;
  white-space: nowrap;
}
.mkt__ribbon--supporter {
  color: var(--mkt-fg-1);
  background:
    linear-gradient(var(--mkt-bg-0), var(--mkt-bg-0)) padding-box,
    var(--mkt-brand-gradient) border-box;
  border: 1px solid transparent;
}
.mkt__ribbon--pro {
  background: var(--mkt-brand-gradient);
}

/* ── Plan CTA buttons ─────────────────────────────────────────────────── */
.mkt__plan-cta {
  margin: 20px 0 4px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mkt__plan-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  border: 0;
  border-radius: 14px;
  padding: 12px 16px;
  font: 600 14px/1 var(--mkt-font-sans);
  cursor: pointer;
  text-decoration: none;
  transition: transform .15s, background .15s, border-color .15s;
}
.mkt__plan-btn:disabled { opacity: .6; cursor: not-allowed; }
.mkt__plan-btn--brand {
  color: #000;
  background: var(--mkt-brand-gradient);
}
.mkt__plan-btn--brand:hover:not(:disabled) { transform: translateY(-1px); }
.mkt__plan-btn--ghost {
  color: #fff;
  background: #1c1c20;
  border: 1px solid rgba(255, 255, 255, .08);
}
.mkt__plan-btn--outline {
  color: var(--mkt-fg-1);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, .18);
}
.mkt__plan-btn--outline:hover {
  border-color: rgba(255, 255, 255, .35);
  background: rgba(255, 255, 255, .03);
}
.mkt__plan-error {
  color: #ff8a94 !important;
  font-size: 12px !important;
  margin: 0 !important;
}
.mkt__current {
  text-align: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(88, 224, 163, .12);
  color: #7cf0c0;
  font: 600 13px/1 var(--mkt-font-sans);
  border: 1px solid rgba(88, 224, 163, .22);
}
.mkt__contribution-total {
  margin: 0;
  color: var(--mkt-fg-2);
  font: 500 12px/1.35 var(--mkt-font-sans);
  text-align: center;
}

/* ── PWYW picker ─────────────────────────────────────────────────────── */
.mkt__pwyw { display: flex; flex-direction: column; gap: 8px; }
.mkt__pwyw-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.mkt__pwyw-btn {
  flex: 1;
  /* min-width: 48px; */
  border: 1px solid transparent;
  background:
    linear-gradient(var(--mkt-bg-0), var(--mkt-bg-0)) padding-box,
    linear-gradient(
      120deg,
      color-mix(in srgb, #fff 22%, transparent),
      color-mix(in srgb, #fff 8%, transparent)
    )
      border-box;
  color: var(--mkt-fg-3);
  padding: 8px 10px;
  border-radius: 10px;
  font: 500 13px/1 var(--mkt-font-sans);
  cursor: pointer;
  transition: all .15s;
}
.mkt__pwyw-btn:hover:not(.is-active) {
  background:
    linear-gradient(var(--mkt-bg-0), var(--mkt-bg-0)) padding-box,
    var(--mkt-brand-gradient) border-box;
  color: var(--mkt-fg-1);
}
.mkt__pwyw-btn.is-active {
  background:
    linear-gradient(var(--mkt-bg-0), var(--mkt-bg-0)) padding-box,
    var(--mkt-brand-gradient) border-box;
  color: var(--mkt-fg-1);
  font-weight: 700;
}
.mkt__pwyw-custom {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid rgba(255, 255, 255, .1);
  border-radius: 10px;
  padding: 0 12px;
  background: var(--mkt-bg-2);
}
.mkt__pwyw-custom span {
  color: rgba(255, 255, 255, .5);
  font: 500 14px/1 var(--mkt-font-sans);
}
.mkt__pwyw-custom input {
  border: 0;
  background: transparent;
  outline: 0;
  color: var(--mkt-fg-1);
  font: 600 15px/1 var(--mkt-font-sans);
  padding: 10px 4px;
  width: 100%;
}
.mkt__stepper {
  display: inline-flex;
  flex-direction: column;
  margin-left: 2px;
}
.mkt__stepper-btn {
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, .55);
  font: 700 12px/1 var(--mkt-font-sans);
  padding: 0;
  width: 16px;
  height: 12px;
  cursor: pointer;
  line-height: 1;
}
.mkt__stepper-btn:hover {
  color: var(--mkt-fg-1);
}

/* ── Community / open source card (horizontal) ────────────────────────── */
.mkt__plan--community {
  margin-top: 20px;
  background: transparent;
  border: 1px dashed rgba(255, 255, 255, .18);
  display: grid;
  grid-template-columns: 1.2fr 1.4fr auto;
  gap: 36px;
  align-items: center;
  padding: 28px 32px;
}
.mkt__plan--community h3 {
  font: 700 20px/1 var(--mkt-font-sans);
  margin: 12px 0 0;
}
.mkt__plan--community > p { margin-top: 6px; }
.mkt__community-head { text-align: left; }
.mkt__pill--sm {
  font-size: 10px;
  padding: 4px 10px;
  margin-bottom: 0;
}
.mkt__community-features {
  list-style: none !important;
  padding: 0 !important;
  margin: 0 !important;
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 24px !important;
  color: rgba(255, 255, 255, .75);
  font-size: 13px;
}
.mkt__community-features li {
  position: relative;
  padding-left: 20px;
}
.mkt__community-features li::before {
  content: "✓";
  position: absolute;
  left: 0;
  top: 0;
  color: #58e0a3;
}
.mkt__community-cta {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 200px;
}

/* ── Feature comparison ───────────────────────────────────────────────── */
.mkt__comparison {
  margin-top: 40px;
  text-align: center;
}
.mkt__comparison-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(255, 255, 255, .12);
  background: var(--mkt-bg-2);
  color: var(--mkt-fg-2);
  padding: 8px 16px;
  border-radius: 999px;
  font: 500 13px/1 var(--mkt-font-sans);
  cursor: pointer;
}
.mkt__comparison-toggle span {
  transition: transform .2s;
}
.mkt__comparison-toggle span.is-rotated {
  transform: rotate(180deg);
}
.mkt__comparison-wrap {
  overflow-x: auto;
  margin-top: 20px;
}
.mkt__comparison-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 14px;
  color: rgba(255, 255, 255, .8);
}
.mkt__comparison-table th,
.mkt__comparison-table td {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, .06);
}
.mkt__comparison-table th {
  color: var(--mkt-fg-1);
  font: 700 13px/1 var(--mkt-font-sans);
  background: rgba(255, 255, 255, .02);
}
.mkt__comparison-table th:not(:first-child) { text-align: center; }
.mkt__comparison-table td:not(:first-child) { text-align: center; }
.mkt__comparison-table td.yes { color: #7cf0c0; font-weight: 700; }
.mkt__comparison-table td.no { color: rgba(255, 255, 255, .3); }
.mkt__comparison-table td.text { color: rgba(255, 255, 255, .88); font-weight: 600; }
.mkt__comparison-table td:first-child {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.mkt__coming-soon-chip {
  font: 700 10px/1 var(--mkt-font-sans);
  letter-spacing: .05em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, .75);
  border: 1px solid rgba(255, 255, 255, .2);
  border-radius: 999px;
  padding: 4px 8px;
  white-space: nowrap;
}

/* ── FAQ ──────────────────────────────────────────────────────────────── */
.mkt__faq {
  margin-top: 56px;
  text-align: left;
}
.mkt__faq h2 {
  font: 700 28px/1 var(--mkt-font-sans);
  margin: 0 0 20px;
  text-align: center;
}
.mkt__faq-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px 32px;
}
.mkt__faq-item h3 {
  font: 700 15px/1.2 var(--mkt-font-sans);
  margin: 0 0 8px;
  color: var(--mkt-fg-1);
}
.mkt__faq-item p {
  color: rgba(255, 255, 255, .6);
  font: 400 14px/1.6 var(--mkt-font-sans);
  margin: 0;
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
  .mkt__pricing--duo { grid-template-columns: 1fr; }
  .mkt__plan--community {
    grid-template-columns: 1fr;
    gap: 20px;
    text-align: left;
  }
  .mkt__community-cta { min-width: 0; }
  .mkt__faq-grid { grid-template-columns: 1fr; }
}
@media (max-width: 800px) {
  .mkt {
    --mkt-section-x: 14px;
    --mkt-section-y: 52px;
  }
  .mkt__hero { padding: 40px 14px; }
  .mkt__hero-title { font-size: 44px; }
  .mkt__hero-grid { grid-template-columns: repeat(2, 1fr); aspect-ratio: auto; }
  .mkt__feature, .mkt__page, .mkt__cta, .mkt__own { padding-left: 14px; padding-right: 14px; }
  .mkt__cards { grid-template-columns: 1fr; }
  .mkt__community-features { grid-template-columns: 1fr !important; }
  .mkt__plan { padding: 24px; }
}
</style>
