/**
 * useFeatureFlags — PostHog-backed feature flag composable
 *
 * Usage:
 *   const { isEnabled, getPayload } = useFeatureFlags()
 *   if (isEnabled('new-editor-toolbar')) { ... }
 *
 * How to create a flag:
 *   1. Go to PostHog → Feature Flags → New feature flag
 *   2. Add the key to FEATURE_FLAGS below
 *   3. Use isEnabled(FEATURE_FLAGS.YOUR_FLAG) in components
 *
 * Flag naming convention:
 *   - kebab-case
 *   - Prefix with area: "editor-", "marketplace-", "pro-", "beta-"
 *   - Examples: "editor-rich-embeds", "marketplace-publish", "pro-custom-domain"
 */

import { ref, readonly } from 'vue'
import posthog from 'posthog-js'

// ── Registered flag names ──────────────────────────────────────────────────
// Add every flag here before using it anywhere in the app.
// This gives you a single source of truth and enables IDE autocomplete.

export const FEATURE_FLAGS = {
  // ── Beta / early access features ────────────────────────────────────────
  BETA_MARKETPLACE: 'beta-marketplace',
  BETA_ROADMAP_FEED: 'beta-roadmap-feed',
  BETA_ANALYTICS_DASHBOARD: 'beta-analytics-dashboard',

  // ── Editor features ──────────────────────────────────────────────────────
  EDITOR_AI_SUGGESTIONS: 'editor-ai-suggestions',
  EDITOR_CUSTOM_CSS: 'editor-custom-css',

  // ── Marketplace ──────────────────────────────────────────────────────────
  MARKETPLACE_PUBLISH: 'marketplace-publish',
  MARKETPLACE_FEATURED_PLACEMENT: 'marketplace-featured-placement',

  // ── Pro-tier features (will be gated by subscription in Phase 2) ────────
  // These flags let you gradually roll out Pro features and A/B test
  // the paywall before Stripe is fully wired up.
  PRO_CUSTOM_DOMAIN: 'pro-custom-domain',
  PRO_ANALYTICS_EXPORT: 'pro-analytics-export',
  PRO_REMOVE_BRANDING: 'pro-remove-branding',
  PRO_PASSWORD_PROTECTION: 'pro-password-protection',

  // ── Gamification ────────────────────────────────────────────────────────
  GAMIFICATION_ACHIEVEMENTS: 'gamification-achievements',
  GAMIFICATION_LEADERBOARD: 'gamification-leaderboard',
} as const

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS]

// ── State ──────────────────────────────────────────────────────────────────
// Flags are loaded once and cached. Components re-render reactively when
// flags update (e.g. after identify() sets user context).

const _flagsLoaded = ref(false)
const _flagOverrides = ref<Partial<Record<FeatureFlagKey, boolean>>>({})

// ── Composable ────────────────────────────────────────────────────────────

export function useFeatureFlags() {
  /**
   * Returns true if the flag is enabled for the current user.
   * Falls back to false while flags are loading.
   *
   * Accepts both registered flag keys (type-safe) and raw strings
   * (for dynamic use cases).
   */
  function isEnabled(flag: FeatureFlagKey | string): boolean {
    // Dev override takes priority — useful for local testing without PostHog
    if (flag in _flagOverrides.value) {
      return _flagOverrides.value[flag as FeatureFlagKey] ?? false
    }

    if (!import.meta.env.VITE_POSTHOG_KEY) {
      // No PostHog key in this environment (e.g. local dev without .env)
      // Default all flags to enabled in development for easier local work
      return import.meta.env.DEV
    }

    return posthog.isFeatureEnabled(flag) ?? false
  }

  /**
   * Returns the flag's JSON payload (for multivariate flags).
   * Useful for flags that carry configuration, not just on/off state.
   */
  function getPayload<T = unknown>(flag: FeatureFlagKey | string): T | undefined {
    if (!import.meta.env.VITE_POSTHOG_KEY) return undefined
    return posthog.getFeatureFlagPayload(flag) as T | undefined
  }

  /**
   * Manually override a flag value — intended for testing and Storybook.
   * Call resetOverrides() to clear.
   */
  function override(flag: FeatureFlagKey, value: boolean): void {
    _flagOverrides.value[flag] = value
  }

  /**
   * Clear all manual overrides.
   */
  function resetOverrides(): void {
    _flagOverrides.value = {}
  }

  /**
   * Reload flags from PostHog (e.g. after login when user context changes).
   * The router's afterEach hook calls this automatically on navigation.
   */
  async function reloadFlags(): Promise<void> {
    if (!import.meta.env.VITE_POSTHOG_KEY) return

    await new Promise<void>((resolve) => {
      posthog.reloadFeatureFlags()
      posthog.onFeatureFlags(() => {
        _flagsLoaded.value = true
        resolve()
      })
    })
  }

  return {
    isEnabled,
    getPayload,
    override,
    resetOverrides,
    reloadFlags,
    flagsLoaded: readonly(_flagsLoaded),
    FEATURE_FLAGS,
  }
}
