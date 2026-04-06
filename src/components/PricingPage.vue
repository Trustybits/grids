<template>
  <div class="pricing-page">
    <div class="pricing-header">
      <h1>Simple, honest pricing</h1>
      <p class="pricing-subtitle">
        Grids is free to build with. Pay what you want to support the project,
        or go Pro for advanced features.
      </p>

      <!-- Monthly / Annual toggle -->
      <div class="billing-toggle" role="group" aria-label="Billing interval">
        <button
          class="toggle-btn"
          :class="{ active: billingInterval === 'month' }"
          @click="billingInterval = 'month'"
        >
          Monthly
        </button>
        <button
          class="toggle-btn"
          :class="{ active: billingInterval === 'year' }"
          @click="billingInterval = 'year'"
        >
          Annual
          <span class="save-badge">Save 25%</span>
        </button>
      </div>
    </div>

    <!-- Pricing cards -->
    <div class="pricing-grid">
      <!-- ── Community (free) ────────────────────────────────────────── -->
      <div class="pricing-card">
        <div class="card-header">
          <h2>Community</h2>
          <div class="price">
            <span class="amount">Free</span>
          </div>
          <p class="card-tagline">Everything you need to build and share.</p>
        </div>

        <div class="card-cta">
          <template v-if="tier === 'free'">
            <router-link to="/signup" class="btn btn-outline-primary w-100">
              Get started free
            </router-link>
          </template>
          <template v-else>
            <div class="current-plan-badge">Your current plan</div>
          </template>
        </div>

        <ul class="feature-list">
          <li v-for="f in communityFeatures" :key="f">
            <span class="check">✓</span> {{ f }}
          </li>
        </ul>
      </div>

      <!-- ── Supporter (PWYW) ───────────────────────────────────────── -->
      <div
        class="pricing-card card-supporter"
        :class="{ 'is-current': hasSupporterBadge && tier !== 'pro' }"
      >
        <div class="card-badge">Support the project</div>
        <div class="card-header">
          <h2>Supporter</h2>
          <div class="price">
            <span class="amount">Pay what you want</span>
          </div>
          <p class="card-tagline">
            One-time. No subscription. Unlock the Supporter badge.
          </p>
        </div>

        <div class="card-cta">
          <template v-if="hasSupporterBadge">
            <div class="current-plan-badge">
              <span class="supporter-icon">🔥</span> You're a Supporter!
            </div>
          </template>
          <template v-else>
            <!-- Amount picker -->
            <div class="pwyw-picker">
              <div class="amount-presets">
                <button
                  v-for="preset in pwywPresets"
                  :key="preset"
                  class="preset-btn"
                  :class="{
                    active: selectedAmount === preset && !customAmountMode,
                  }"
                  @click="selectPreset(preset)"
                >
                  {{ preset === 0 ? "Free" : `$${preset}` }}
                </button>
                <button
                  class="preset-btn"
                  :class="{ active: customAmountMode }"
                  @click="customAmountMode = true"
                >
                  Custom
                </button>
              </div>

              <div v-if="customAmountMode" class="custom-amount-input">
                <span class="currency-symbol">$</span>
                <input
                  v-model.number="customAmount"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  class="amount-input"
                  @focus="($event.target as HTMLInputElement)?.select()"
                />
              </div>
            </div>

            <button
              class="btn btn-primary w-100 mt-2"
              :disabled="checkout.loading.value"
              @click="handleSupporterCheckout"
            >
              <span v-if="checkout.loading.value">Processing…</span>
              <span v-else-if="effectiveAmount === 0">Claim free badge</span>
              <span v-else>Support for ${{ effectiveAmount }}</span>
            </button>

            <p v-if="checkout.error.value" class="error-message">
              {{ checkout.error.value }}
            </p>
          </template>
        </div>

        <ul class="feature-list">
          <li class="feature-section-label">Everything in Community, plus:</li>
          <li v-for="f in supporterFeatures" :key="f">
            <span class="check check-fire">🔥</span> {{ f }}
          </li>
        </ul>
      </div>

      <!-- ── Pro ───────────────────────────────────────────────────── -->
      <div
        class="pricing-card card-pro"
        :class="{ 'is-current': isProOrAbove }"
      >
        <div class="card-badge card-badge-pro">Most powerful</div>
        <div class="card-header">
          <h2>Pro</h2>
          <div class="price">
            <span class="amount"
              >${{
                billingInterval === "month"
                  ? proMonthlyPrice
                  : proAnnualMonthlyPrice
              }}</span
            >
            <span class="period">/ mo</span>
          </div>
          <p v-if="billingInterval === 'year'" class="annual-note">
            Billed ${{ proAnnualPrice }} annually
          </p>
          <p class="card-tagline">For power users and professionals.</p>
        </div>

        <div class="card-cta">
          <template v-if="isProOrAbove">
            <div class="current-plan-badge">Your current plan</div>
            <button
              class="btn btn-outline-secondary w-100 mt-2"
              :disabled="checkout.loading.value"
              @click="checkout.openCustomerPortal()"
            >
              Manage billing
            </button>
          </template>
          <template v-else-if="tier === 'free'">
            <router-link
              to="/login?redirect=/pricing"
              class="btn btn-primary w-100"
            >
              Sign up for Pro
            </router-link>
          </template>
          <template v-else>
            <button
              class="btn btn-primary w-100"
              :disabled="checkout.loading.value"
              @click="checkout.checkoutPro(billingInterval)"
            >
              <span v-if="checkout.loading.value">Processing…</span>
              <span v-else>Upgrade to Pro</span>
            </button>
            <p v-if="checkout.error.value" class="error-message">
              {{ checkout.error.value }}
            </p>
          </template>
        </div>

        <ul class="feature-list">
          <li class="feature-section-label">Everything in Community, plus:</li>
          <li v-for="f in proFeatures" :key="f">
            <span class="check check-pro">★</span> {{ f }}
          </li>
        </ul>
      </div>
    </div>

    <!-- Feature comparison table (collapsible on mobile) -->
    <div class="comparison-section">
      <button
        class="comparison-toggle"
        @click="showComparison = !showComparison"
      >
        {{ showComparison ? "Hide" : "See full" }} feature comparison
        <span :class="{ rotated: showComparison }">▾</span>
      </button>

      <div v-if="showComparison" class="comparison-table-wrapper">
        <table class="comparison-table">
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
              <td>{{ row.feature }}</td>
              <td>
                <span :class="row.community ? 'check' : 'cross'">{{
                  row.community ? "✓" : "—"
                }}</span>
              </td>
              <td>
                <span :class="row.supporter ? 'check' : 'cross'">{{
                  row.supporter ? "✓" : "—"
                }}</span>
              </td>
              <td>
                <span :class="row.pro ? 'check' : 'cross'">{{
                  row.pro ? "✓" : "—"
                }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- FAQ -->
    <div class="faq-section">
      <h2>Common questions</h2>
      <div class="faq-grid">
        <div v-for="item in faqItems" :key="item.q" class="faq-item">
          <h3>{{ item.q }}</h3>
          <p>{{ item.a }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useSubscription } from "@/composables/useSubscription";
import { useStripeCheckout } from "@/composables/useStripeCheckout";

const { tier, hasSupporterBadge, isProOrAbove } = useSubscription();
const checkout = useStripeCheckout();

// ── Billing interval toggle ────────────────────────────────────────────────
const billingInterval = ref<"month" | "year">("month");

// ── Pricing (update once you've set prices in Stripe) ─────────────────────
const proMonthlyPrice = 8;
const proAnnualPrice = 72;
const proAnnualMonthlyPrice = computed(() => Math.round(proAnnualPrice / 12));

// ── PWYW picker ────────────────────────────────────────────────────────────
const pwywPresets = [0, 3, 5, 10];
const selectedAmount = ref(5);
const customAmountMode = ref(false);
const customAmount = ref(5);

function selectPreset(amount: number) {
  selectedAmount.value = amount;
  customAmountMode.value = false;
}

const effectiveAmount = computed(() =>
  customAmountMode.value ? customAmount.value || 0 : selectedAmount.value,
);

async function handleSupporterCheckout() {
  await checkout.checkoutSupporter(effectiveAmount.value);
}

// ── Feature lists ──────────────────────────────────────────────────────────
const communityFeatures = [
  "Unlimited grids",
  "All tile types (text, image, video, maps, music, YouTube, and more)",
  "Custom slug (yourname.grids.app)",
  "Templates library",
  "Drag-and-drop grid editor",
  "Mobile-responsive layouts",
  "Basic page analytics",
  "Notion roadmap integration",
];

const supporterFeatures = [
  "Remove Grids branding",
  "Supporter badge on your profile",
  "Early access to new features",
  "Warm fuzzy feeling",
];

const proFeatures = [
  "Custom domain",
  "Advanced analytics & export",
  "Password-protected grids",
  "AI content suggestions",
  "Priority support",
  "Everything in Supporter",
];

// ── Comparison table ───────────────────────────────────────────────────────
const showComparison = ref(false);
const comparisonRows = [
  { feature: "Unlimited grids", community: true, supporter: true, pro: true },
  { feature: "All tile types", community: true, supporter: true, pro: true },
  { feature: "Custom slug", community: true, supporter: true, pro: true },
  { feature: "Templates library", community: true, supporter: true, pro: true },
  { feature: "Basic analytics", community: true, supporter: true, pro: true },
  {
    feature: "Remove Grids branding",
    community: false,
    supporter: true,
    pro: true,
  },
  { feature: "Supporter badge", community: false, supporter: true, pro: true },
  { feature: "Custom domain", community: false, supporter: false, pro: true },
  {
    feature: "Advanced analytics",
    community: false,
    supporter: false,
    pro: true,
  },
  {
    feature: "Analytics export",
    community: false,
    supporter: false,
    pro: true,
  },
  {
    feature: "Password protection",
    community: false,
    supporter: false,
    pro: true,
  },
  { feature: "AI suggestions", community: false, supporter: false, pro: true },
  {
    feature: "Priority support",
    community: false,
    supporter: false,
    pro: true,
  },
];

// ── FAQ ────────────────────────────────────────────────────────────────────
const faqItems = [
  {
    q: "Is Grids really free?",
    a: "Yes — the Community tier is free forever. No credit card required, no trial period. We make money from Pro subscriptions and supporter contributions.",
  },
  {
    q: 'What does "pay what you want" mean?',
    a: "You choose the amount, including $0. Any amount (even free) grants the Supporter badge and removes Grids branding from your published pages.",
  },
  {
    q: "Can I cancel my Pro subscription?",
    a: "Yes, any time from your billing dashboard. You keep Pro access until the end of the billing period.",
  },
  {
    q: "What payment methods do you accept?",
    a: "All major credit and debit cards via Stripe. No PayPal at this time.",
  },
  {
    q: "Do you offer refunds?",
    a: "For Pro subscriptions, we offer a full refund within 7 days of purchase if you're not satisfied. Supporter payments are non-refundable.",
  },
  {
    q: "Is my billing information secure?",
    a: "Yes — Grids never stores your card details. All payments are processed by Stripe, which is PCI DSS Level 1 certified.",
  },
];
</script>

<style scoped lang="scss">
.pricing-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 3rem 1.5rem;
}

.pricing-header {
  text-align: center;
  margin-bottom: 3rem;

  h1 {
    font-size: 2.25rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
  }
}

.pricing-subtitle {
  font-size: 1.1rem;
  opacity: 0.7;
  max-width: 520px;
  margin: 0 auto 2rem;
}

// ── Billing toggle ─────────────────────────────────────────────────────────
.billing-toggle {
  display: inline-flex;
  background: var(--bs-secondary-bg, #f1f3f5);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}

.toggle-btn {
  background: none;
  border: none;
  padding: 0.4rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  transition: background 0.15s;

  &.active {
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    font-weight: 600;
  }
}

.save-badge {
  background: #16a34a;
  color: white;
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 20px;
  font-weight: 600;
}

// ── Cards ──────────────────────────────────────────────────────────────────
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.pricing-card {
  border: 1px solid var(--bs-border-color, #dee2e6);
  border-radius: 12px;
  padding: 1.75rem;
  position: relative;

  &.card-supporter {
    border-color: #f97316;
  }

  &.card-pro {
    border-color: #6366f1;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.15);
  }

  &.is-current {
    background: var(--bs-secondary-bg, #f8f9fa);
  }
}

.card-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: #f97316;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 3px 12px;
  border-radius: 20px;
  white-space: nowrap;
}

.card-badge-pro {
  background: #6366f1;
}

.card-header {
  margin-bottom: 1.5rem;

  h2 {
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }
}

.price {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  margin-bottom: 0.4rem;
}

.amount {
  font-size: 1.75rem;
  font-weight: 800;
}

.period {
  opacity: 0.6;
  font-size: 0.9rem;
}

.annual-note {
  font-size: 0.8rem;
  opacity: 0.6;
  margin: 0;
}

.card-tagline {
  font-size: 0.875rem;
  opacity: 0.65;
  margin: 0;
}

.card-cta {
  margin-bottom: 1.5rem;
}

.current-plan-badge {
  text-align: center;
  padding: 0.6rem;
  background: var(--bs-success-bg-subtle, #d1fae5);
  color: var(--bs-success-text-emphasis, #166534);
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
}

// ── PWYW picker ────────────────────────────────────────────────────────────
.pwyw-picker {
  margin-bottom: 0.75rem;
}

.amount-presets {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.preset-btn {
  border: 1px solid var(--bs-border-color, #dee2e6);
  background: none;
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.15s;

  &.active {
    background: #f97316;
    border-color: #f97316;
    color: white;
    font-weight: 600;
  }

  &:hover:not(.active) {
    border-color: #f97316;
  }
}

.custom-amount-input {
  display: flex;
  align-items: center;
  border: 1px solid var(--bs-border-color, #dee2e6);
  border-radius: 6px;
  padding: 0 0.75rem;
  background: var(--bs-body-bg, white);

  .currency-symbol {
    opacity: 0.5;
    font-size: 0.9rem;
  }

  .amount-input {
    border: none;
    background: none;
    padding: 0.4rem 0.25rem;
    width: 100%;
    outline: none;
    font-size: 1rem;

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
    }
  }
}

.error-message {
  color: var(--bs-danger, #dc3545);
  font-size: 0.8rem;
  margin-top: 0.5rem;
  margin-bottom: 0;
}

// ── Feature list ───────────────────────────────────────────────────────────
.feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;

  li {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }
}

.feature-section-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.5;
  margin-top: 0.5rem;
}

.check {
  color: #16a34a;
  font-weight: 700;
  flex-shrink: 0;
}

.check-fire {
  flex-shrink: 0;
}
.check-pro {
  color: #6366f1;
  flex-shrink: 0;
}

// ── Comparison table ───────────────────────────────────────────────────────
.comparison-section {
  margin-bottom: 3rem;
  text-align: center;
}

.comparison-toggle {
  background: none;
  border: 1px solid var(--bs-border-color, #dee2e6);
  padding: 0.5rem 1.25rem;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.875rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 1.5rem;

  span {
    transition: transform 0.2s;
    &.rotated {
      transform: rotate(180deg);
    }
  }
}

.comparison-table-wrapper {
  overflow-x: auto;
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  text-align: left;

  th,
  td {
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var(--bs-border-color, #dee2e6);
  }

  th {
    font-weight: 700;
    background: var(--bs-secondary-bg, #f8f9fa);
  }

  td:not(:first-child) {
    text-align: center;
  }
}

.cross {
  opacity: 0.3;
}

// ── FAQ ────────────────────────────────────────────────────────────────────
.faq-section {
  h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
    text-align: center;
  }
}

.faq-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.faq-item {
  h3 {
    font-size: 0.95rem;
    font-weight: 700;
    margin-bottom: 0.4rem;
  }

  p {
    font-size: 0.875rem;
    opacity: 0.7;
    margin: 0;
    line-height: 1.6;
  }
}
</style>
