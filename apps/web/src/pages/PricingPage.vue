<template>
  <MarketingLayout>
    <section class="mkt__section mkt__page mkt__pricing-page">
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
          <h4 class="mkt__plan-title--supporter">Donate to Support</h4>
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

            <Button
              variant="brand"
              :disabled="checkout.loading.value"
              block
              size="lg"
              @click="handleSupporterCheckout"
            >
              <span v-if="checkout.loading.value">Processing...</span>
              <span v-else-if="effectiveAmount === 0">Continue for Free</span>
              <span v-else-if="hasSupporterBadge">Contribute Again (${{ effectiveAmount }})</span>
              <span v-else>Support for ${{ effectiveAmount }}</span>
            </Button>
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
            <Button variant="outline" disabled block size="lg">
              Coming Soon
            </Button>
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
          <Button
            variant="outline"
            href="https://github.com/trustybits/grids"
            size="lg"
            block
          >
            <template #icon-left>
              <i class="fab fa-github" aria-hidden="true"></i>
            </template>
            View public repo on GitHub
          </Button>
        </div>
      </article>

      <p class="mkt__pricing-footnote">
        Basic page analytics and remove Grids branding are launching soon.
        <button
          type="button"
          class="mkt__pricing-footnote-link"
          @click="showComparison = true"
        >
          See feature comparison
        </button>
        for details.
      </p>

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
  </MarketingLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { usePageTitle } from '@/composables/usePageTitle';
import { useTier } from '@/composables/useTier';
import { useBadges } from '@/composables/useBadges';
import { useContributions } from '@/composables/useContributions';
import { useStripeCheckout } from '@/composables/useStripeCheckout';
import { getAuthProvider } from '@/auth/AuthProviderSingleton';
import type { AuthUser } from '@grids/contracts/auth';
import MarketingLayout from '@/components/marketing/MarketingLayout.vue';
import Button from '@/components/ui-elements/Button.vue';

const pageTitle = ref('Pricing');
usePageTitle(pageTitle);

const router = useRouter();
const user = ref<AuthUser | null>(null);
const userId = computed(() => user.value?.uid ?? null);
let unsubscribeAuthState: (() => void) | null = null;

onMounted(() => {
  unsubscribeAuthState = getAuthProvider().onAuthStateChanged((currentUser) => {
    user.value = currentUser;
  });
});

onBeforeUnmount(() => {
  if (unsubscribeAuthState) unsubscribeAuthState();
});

const { tier, isProOrAbove } = useTier();
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
  'Basic page analytics',
];

const supporterUnlocks = [
  {
    label: 'Always Free',
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
  customAmount.value = Math.max(0, Math.floor(customAmount.value || 0)) - 1;
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
  { feature: 'Remove Grids branding ($10+ supporter)', community: false, supporter: true, pro: true, comingSoon: true },
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
