/**
 * Global test setup — runs before every test file.
 *
 * Responsibilities:
 *  1. Provide a minimal Pinia instance so stores can be used in tests —
 *     installed both as the active Pinia (for composables called outside a
 *     component) and as a global plugin on mounted components (so store
 *     injection resolves instead of warning "injection Symbol(pinia) not found")
 *  2. Mock Vue Router and PostHog so composables that depend on them work
 *     in isolation, and stub <router-link> so components that render it don't
 *     warn "Failed to resolve component: router-link"
 *  3. Silence noisy console output that isn't relevant to test results
 *
 * Firebase mocks live in @grids/pro's own test setup — the Firestore and
 * Firebase Auth implementations were moved into that package, and no source
 * file under apps/web/src imports `firebase/*` or `@/infrastructure/firebase`
 * anymore, so mocking those here would be dead configuration.
 */

import { vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { config } from '@vue/test-utils'
import '@/registries/tiles'

// ── Vue Router mock ────────────────────────────────────────────────────────
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    currentRoute: { value: { path: '/', query: {}, params: {} } },
  })),
  useRoute: vi.fn(() => ({ path: '/', query: {}, params: {} })),
  createRouter: vi.fn(),
  createWebHistory: vi.fn(),
}))

// ── PostHog mock ───────────────────────────────────────────────────────────
vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    setPersonProperties: vi.fn(),
    init: vi.fn(),
  },
}))

// ── Vue Test Utils global config ───────────────────────────────────────────
// `router-link` is provided by Vue Router, which we mock above without
// registering its components. Stub it globally so components that render
// `<router-link>` resolve it instead of warning. The compiled render function
// resolves every component referenced in the template up front (even ones
// behind a falsy `v-if`), so this is needed even when the link is not shown.
config.global.stubs = {
  ...config.global.stubs,
  RouterLink: true,
}

// ── Pinia setup ────────────────────────────────────────────────────────────
// Fresh Pinia instance for every test — prevents state from leaking between
// tests. It is set as the active Pinia (for stores used outside a component)
// and installed as a global plugin so components mounted via Vue Test Utils
// have Pinia injected (otherwise store access warns and falls back).
beforeEach(() => {
  const pinia = createPinia()
  setActivePinia(pinia)
  config.global.plugins = [pinia]
})

// ── Silence expected console noise ────────────────────────────────────────
const originalConsoleError = console.error
beforeEach(() => {
  console.error = (...args: any[]) => {
    // Suppress Vue warning noise in test output
    if (typeof args[0] === 'string' && args[0].includes('[Vue warn]')) return
    originalConsoleError(...args)
  }
})

afterEach(() => {
  console.error = originalConsoleError
  vi.clearAllMocks()
})
