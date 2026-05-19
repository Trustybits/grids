/**
 * Tests for checkRateLimit — the rate-limiter state machine in api/og.ts.
 *
 * This is security-critical code: a bug could either block legitimate social
 * crawlers (bad UX) or fail to stop a spammer (runaway Firebase costs).
 *
 * We use fake timers so the tests run instantly and full-hour block windows
 * can be simulated without sleeping.
 */

import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest'

// Fake timers must be installed before importing the module so the
// module-level setInterval is captured by vitest's fake clock.
vi.useFakeTimers()

import { checkRateLimit, store } from '../og'

// ── Constants mirrored from api/og.ts ────────────────────────────────────────
// If these change in production, update here too — divergence is a test smell.
const SOFT_LIMIT        = 10
const HARD_LIMIT        = 25
const WINDOW_MS         = 60_000
const BLOCK_DURATION_MS = 3_600_000

afterAll(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  // Fresh store and frozen clock for every test
  store.clear()
  vi.setSystemTime(0)
})

// ── Basic allow path ──────────────────────────────────────────────────────────

describe('allow', () => {
  it('allows the very first request from a new IP', () => {
    expect(checkRateLimit('1.2.3.4')).toBe('allow')
  })

  it(`allows up to ${SOFT_LIMIT} requests within the window`, () => {
    for (let i = 0; i < SOFT_LIMIT; i++) {
      expect(checkRateLimit('1.2.3.4')).toBe('allow')
    }
  })

  it('treats each IP independently', () => {
    for (let i = 0; i < SOFT_LIMIT; i++) checkRateLimit('1.1.1.1')
    // 1.1.1.1 is at the soft limit, but 2.2.2.2 is fresh
    expect(checkRateLimit('2.2.2.2')).toBe('allow')
  })
})

// ── Soft throttle ─────────────────────────────────────────────────────────────

describe('throttle', () => {
  it(`throttles on request ${SOFT_LIMIT + 1}`, () => {
    for (let i = 0; i < SOFT_LIMIT; i++) checkRateLimit('1.2.3.4')
    expect(checkRateLimit('1.2.3.4')).toBe('throttle')
  })

  it('continues throttling on subsequent requests before the hard limit', () => {
    for (let i = 0; i < SOFT_LIMIT + 1; i++) checkRateLimit('1.2.3.4')
    // Still below HARD_LIMIT — should keep throttling, not blocking
    expect(checkRateLimit('1.2.3.4')).toBe('throttle')
  })
})

// ── Hard block ────────────────────────────────────────────────────────────────

describe('block', () => {
  it(`blocks on request ${HARD_LIMIT + 1}`, () => {
    for (let i = 0; i < HARD_LIMIT; i++) checkRateLimit('1.2.3.4')
    expect(checkRateLimit('1.2.3.4')).toBe('block')
  })

  it('continues blocking on every subsequent request while block is active', () => {
    for (let i = 0; i <= HARD_LIMIT; i++) checkRateLimit('1.2.3.4')
    // Many more requests — all should stay blocked
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit('1.2.3.4')).toBe('block')
    }
  })

  it('stays blocked until exactly the block duration has elapsed', () => {
    for (let i = 0; i <= HARD_LIMIT; i++) checkRateLimit('1.2.3.4')

    // 1 ms before expiry — still blocked
    vi.setSystemTime(BLOCK_DURATION_MS - 1)
    expect(checkRateLimit('1.2.3.4')).toBe('block')
  })
})

// ── Block expiry ──────────────────────────────────────────────────────────────

describe('block expiry', () => {
  it('unblocks after the block duration and allows again', () => {
    for (let i = 0; i <= HARD_LIMIT; i++) checkRateLimit('1.2.3.4')

    // Advance past block window — timestamps also expire with the window
    vi.setSystemTime(BLOCK_DURATION_MS + WINDOW_MS + 1)
    expect(checkRateLimit('1.2.3.4')).toBe('allow')
  })

  it('resets the timestamp window after unblocking', () => {
    for (let i = 0; i <= HARD_LIMIT; i++) checkRateLimit('1.2.3.4')

    vi.setSystemTime(BLOCK_DURATION_MS + WINDOW_MS + 1)
    // First request after expiry: allow
    expect(checkRateLimit('1.2.3.4')).toBe('allow')
    // Can make SOFT_LIMIT total requests before throttling again
    for (let i = 1; i < SOFT_LIMIT; i++) checkRateLimit('1.2.3.4')
    expect(checkRateLimit('1.2.3.4')).toBe('throttle')
  })
})

// ── Sliding window ────────────────────────────────────────────────────────────

describe('sliding window', () => {
  it('allows a new burst after old timestamps slide out of the window', () => {
    // Fill to the soft limit
    for (let i = 0; i < SOFT_LIMIT; i++) checkRateLimit('1.2.3.4')

    // Advance past the window so all previous timestamps expire
    vi.setSystemTime(WINDOW_MS + 1)

    // Should allow again since the old timestamps are pruned
    expect(checkRateLimit('1.2.3.4')).toBe('allow')
  })

  it('only counts requests within the current window toward the limit', () => {
    // Make SOFT_LIMIT - 1 requests early in the window
    for (let i = 0; i < SOFT_LIMIT - 1; i++) checkRateLimit('1.2.3.4')

    // Jump forward so those timestamps expire
    vi.setSystemTime(WINDOW_MS + 1)

    // Make SOFT_LIMIT more requests — all should be allowed (fresh window)
    for (let i = 0; i < SOFT_LIMIT; i++) {
      expect(checkRateLimit('1.2.3.4')).toBe('allow')
    }
    // The (SOFT_LIMIT + 1)th in the new window → throttle
    expect(checkRateLimit('1.2.3.4')).toBe('throttle')
  })
})
