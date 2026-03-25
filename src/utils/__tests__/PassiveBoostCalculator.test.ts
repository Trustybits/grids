/**
 * Tests for PassiveBoostCalculator.ts
 *
 * These are pure functions with no external dependencies — no mocking needed.
 * They form the backbone of the gamification system, so correctness here
 * directly affects user trust in the product.
 */

import { describe, it, expect } from 'vitest'
import {
  getCurrentBoostTier,
  getNextBoostTier,
  calculatePassiveClicks,
  getProgressToNextTier,
  BOOST_MILESTONES,
} from '@/utils/PassiveBoostCalculator'

// ── getCurrentBoostTier ────────────────────────────────────────────────────

describe('getCurrentBoostTier', () => {
  it('returns Novice tier at 0 clicks', () => {
    const tier = getCurrentBoostTier(0)
    expect(tier.name).toBe('Novice')
    expect(tier.threshold).toBe(0)
    expect(tier.dailyPassiveClicks).toBe(0)
  })

  it('returns Novice tier just below Apprentice threshold', () => {
    expect(getCurrentBoostTier(99).name).toBe('Novice')
  })

  it('returns Apprentice tier at exactly 100 clicks', () => {
    const tier = getCurrentBoostTier(100)
    expect(tier.name).toBe('Apprentice')
    expect(tier.dailyPassiveClicks).toBe(1)
  })

  it('returns Apprentice tier in the middle of its range', () => {
    expect(getCurrentBoostTier(1500).name).toBe('Apprentice')
  })

  it('returns Keeper tier at exactly 2500 clicks', () => {
    expect(getCurrentBoostTier(2500).name).toBe('Keeper')
  })

  it('returns Guardian tier at exactly 20000 clicks', () => {
    expect(getCurrentBoostTier(20000).name).toBe('Guardian')
  })

  it('returns Master tier at exactly 100000 clicks', () => {
    expect(getCurrentBoostTier(100000).name).toBe('Master')
  })

  it('returns Legend tier at exactly 250000 clicks', () => {
    const tier = getCurrentBoostTier(250000)
    expect(tier.name).toBe('Legend')
    expect(tier.dailyPassiveClicks).toBe(200)
  })

  it('returns Legend tier well above the max threshold', () => {
    expect(getCurrentBoostTier(999999).name).toBe('Legend')
  })

  it('all milestones are reachable via threshold values', () => {
    BOOST_MILESTONES.forEach(milestone => {
      const tier = getCurrentBoostTier(milestone.threshold)
      expect(tier.name).toBe(milestone.name)
    })
  })
})

// ── getNextBoostTier ───────────────────────────────────────────────────────

describe('getNextBoostTier', () => {
  it('returns Apprentice as next tier from 0 clicks', () => {
    const next = getNextBoostTier(0)
    expect(next?.name).toBe('Apprentice')
    expect(next?.threshold).toBe(100)
  })

  it('returns Keeper as next tier from Apprentice range', () => {
    expect(getNextBoostTier(500)?.name).toBe('Keeper')
  })

  it('returns null when at max (Legend) tier', () => {
    expect(getNextBoostTier(250000)).toBeNull()
  })

  it('returns null when well above max tier', () => {
    expect(getNextBoostTier(1000000)).toBeNull()
  })

  it('returns the correct next tier at each boundary', () => {
    // At 99 clicks, next tier is Apprentice (100)
    expect(getNextBoostTier(99)?.threshold).toBe(100)
    // At 100 clicks, next tier is Keeper (2500)
    expect(getNextBoostTier(100)?.threshold).toBe(2500)
    // At 2499, next tier is still Keeper
    expect(getNextBoostTier(2499)?.threshold).toBe(2500)
  })
})

// ── calculatePassiveClicks ─────────────────────────────────────────────────

describe('calculatePassiveClicks', () => {
  it('returns 0 for Novice tier regardless of time elapsed', () => {
    const lastUpdate = new Date('2025-01-01T00:00:00Z')
    const now = new Date('2025-01-02T00:00:00Z') // 24 hours later
    expect(calculatePassiveClicks(0, lastUpdate, now)).toBe(0)
    expect(calculatePassiveClicks(99, lastUpdate, now)).toBe(0)
  })

  it('calculates correct passive clicks for Apprentice over 24 hours', () => {
    // Apprentice earns 1 click/day = ~0.0417/hr
    const lastUpdate = new Date('2025-01-01T00:00:00Z')
    const now = new Date('2025-01-02T00:00:00Z') // exactly 24 hours
    const result = calculatePassiveClicks(100, lastUpdate, now)
    expect(result).toBe(1) // Math.floor(1/24 * 24) = 1
  })

  it('calculates correct passive clicks for Legend over 24 hours', () => {
    // Legend earns 200 clicks/day
    const lastUpdate = new Date('2025-01-01T00:00:00Z')
    const now = new Date('2025-01-02T00:00:00Z')
    const result = calculatePassiveClicks(250000, lastUpdate, now)
    expect(result).toBe(200)
  })

  it('calculates partial hours correctly (floor, not round)', () => {
    // Master earns 50 clicks/day = ~2.083/hr
    // After 1 hour, should get Math.floor(50/24 * 1) = 2
    const lastUpdate = new Date('2025-01-01T00:00:00Z')
    const now = new Date('2025-01-01T01:00:00Z') // 1 hour later
    const result = calculatePassiveClicks(100000, lastUpdate, now)
    expect(result).toBe(2)
  })

  it('returns 0 when no time has elapsed', () => {
    const now = new Date()
    expect(calculatePassiveClicks(250000, now, now)).toBe(0)
  })

  it('returns 0 for very short time windows (sub-threshold)', () => {
    // Apprentice: 1 click/day means you need 24hrs for the first click
    // After 1 minute, Math.floor(1/24/60 * 1) = 0
    const lastUpdate = new Date('2025-01-01T00:00:00Z')
    const now = new Date('2025-01-01T00:01:00Z') // 1 minute
    expect(calculatePassiveClicks(100, lastUpdate, now)).toBe(0)
  })

  it('uses current time as default when currentTime is omitted', () => {
    // Just verify it doesn't throw and returns a number
    const lastUpdate = new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
    const result = calculatePassiveClicks(250000, lastUpdate)
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('calculates correctly across multiple days', () => {
    // Guardian earns 15 clicks/day, over 7 days = 105
    const lastUpdate = new Date('2025-01-01T00:00:00Z')
    const now = new Date('2025-01-08T00:00:00Z') // 7 days
    const result = calculatePassiveClicks(20000, lastUpdate, now)
    expect(result).toBe(105)
  })
})

// ── getProgressToNextTier ──────────────────────────────────────────────────

describe('getProgressToNextTier', () => {
  it('returns 0% at the start of Novice tier', () => {
    expect(getProgressToNextTier(0)).toBe(0)
  })

  it('returns 100% when at max tier (Legend)', () => {
    expect(getProgressToNextTier(250000)).toBe(100)
    expect(getProgressToNextTier(999999)).toBe(100)
  })

  it('returns 50% at exactly halfway to next tier', () => {
    // Novice (0) → Apprentice (100): halfway = 50 clicks
    const progress = getProgressToNextTier(50)
    expect(progress).toBeCloseTo(50, 1)
  })

  it('returns ~100% just before reaching next tier (capped at 100)', () => {
    // 99/100 = 99%
    const progress = getProgressToNextTier(99)
    expect(progress).toBeCloseTo(99, 1)
  })

  it('resets to near 0% immediately after crossing a tier boundary', () => {
    // Just hit Apprentice (100) — next tier is Keeper (2500)
    // Progress into Apprentice → Keeper range: 0 / 2400 = ~0%
    const progress = getProgressToNextTier(100)
    expect(progress).toBeCloseTo(0, 1)
  })

  it('never exceeds 100%', () => {
    BOOST_MILESTONES.forEach(milestone => {
      expect(getProgressToNextTier(milestone.threshold)).toBeLessThanOrEqual(100)
    })
  })

  it('is always non-negative', () => {
    const testValues = [0, 50, 100, 1000, 10000, 100000, 250000]
    testValues.forEach(clicks => {
      expect(getProgressToNextTier(clicks)).toBeGreaterThanOrEqual(0)
    })
  })
})
