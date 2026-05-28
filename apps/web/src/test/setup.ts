/**
 * Global test setup — runs before every test file.
 *
 * Responsibilities:
 *  1. Provide a minimal Pinia instance so stores can be used in tests
 *  2. Mock Vue Router and PostHog so composables that depend on them work
 *     in isolation
 *  3. Silence noisy console output that isn't relevant to test results
 *
 * Firebase mocks live in @grids/pro's own test setup — the Firestore and
 * Firebase Auth implementations were moved into that package, and no source
 * file under apps/web/src imports `firebase/*` or `@/infrastructure/firebase`
 * anymore, so mocking those here would be dead configuration.
 */

import { vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
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

// ── Pinia setup ────────────────────────────────────────────────────────────
// Fresh Pinia instance for every test — prevents state from leaking between tests
beforeEach(() => {
  setActivePinia(createPinia())
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
