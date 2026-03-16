import { describe, it, expect } from 'vitest'
import {
  getCurrentBoostTier,
  getNextBoostTier,
  calculatePassiveClicks,
  getProgressToNextTier,
  BOOST_MILESTONES,
} from '../PassiveBoostCalculator'

describe('PassiveBoostCalculator', () => {
  describe('getCurrentBoostTier', () => {
    it('returns Novice at 0 clicks', () => {
      expect(getCurrentBoostTier(0).name).toBe('Novice')
    })

    it('returns Apprentice at exactly 100 clicks', () => {
      expect(getCurrentBoostTier(100).name).toBe('Apprentice')
    })

    it('returns Apprentice at 99 clicks (still Novice)', () => {
      expect(getCurrentBoostTier(99).name).toBe('Novice')
    })

    it('returns Keeper at 2500 clicks', () => {
      expect(getCurrentBoostTier(2500).name).toBe('Keeper')
    })

    it('returns Guardian at 20000 clicks', () => {
      expect(getCurrentBoostTier(20000).name).toBe('Guardian')
    })

    it('returns Master at 100000 clicks', () => {
      expect(getCurrentBoostTier(100000).name).toBe('Master')
    })

    it('returns Legend at 250000 clicks', () => {
      expect(getCurrentBoostTier(250000).name).toBe('Legend')
    })

    it('returns Legend at very high click counts', () => {
      expect(getCurrentBoostTier(999999).name).toBe('Legend')
    })
  })

  describe('getNextBoostTier', () => {
    it('returns Apprentice as the next tier from 0 clicks', () => {
      expect(getNextBoostTier(0)?.name).toBe('Apprentice')
    })

    it('returns Keeper as the next tier from 100 clicks', () => {
      expect(getNextBoostTier(100)?.name).toBe('Keeper')
    })

    it('returns null when at max tier (250000+)', () => {
      expect(getNextBoostTier(250000)).toBeNull()
    })

    it('returns null at very high click counts', () => {
      expect(getNextBoostTier(999999)).toBeNull()
    })
  })

  describe('calculatePassiveClicks', () => {
    it('returns 0 for Novice tier (no passive generation)', () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      expect(calculatePassiveClicks(0, oneHourAgo, now)).toBe(0)
    })

    it('returns correct clicks for Apprentice tier over 24 hours', () => {
      const now = new Date()
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      // Apprentice: 1 dailyPassiveClick → 1 click per 24h
      expect(calculatePassiveClicks(100, oneDayAgo, now)).toBe(1)
    })

    it('returns correct clicks for Keeper tier over 24 hours', () => {
      const now = new Date()
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      // Keeper: 5 dailyPassiveClicks
      expect(calculatePassiveClicks(2500, oneDayAgo, now)).toBe(5)
    })

    it('returns correct clicks for Legend tier over 24 hours', () => {
      const now = new Date()
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      // Legend: 200 dailyPassiveClicks
      expect(calculatePassiveClicks(250000, oneDayAgo, now)).toBe(200)
    })

    it('floors partial clicks (no fractions)', () => {
      const now = new Date()
      const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000)
      // Apprentice: 1/24 clicks per hour → 0.5h → ~0.02 → floor to 0
      expect(calculatePassiveClicks(100, thirtyMinAgo, now)).toBe(0)
    })

    it('returns 0 when lastUpdateTime equals currentTime', () => {
      const now = new Date()
      expect(calculatePassiveClicks(250000, now, now)).toBe(0)
    })
  })

  describe('getProgressToNextTier', () => {
    it('returns 0% at the start of Novice tier', () => {
      expect(getProgressToNextTier(0)).toBe(0)
    })

    it('returns 50% when halfway between Novice and Apprentice', () => {
      expect(getProgressToNextTier(50)).toBe(50)
    })

    it('returns 100% when at max tier', () => {
      expect(getProgressToNextTier(250000)).toBe(100)
    })

    it('returns 100% when beyond max tier', () => {
      expect(getProgressToNextTier(999999)).toBe(100)
    })

    it('returns correct percentage mid-tier', () => {
      // Between Apprentice (100) and Keeper (2500), at 1300 clicks:
      // (1300 - 100) / (2500 - 100) = 1200 / 2400 = 50%
      expect(getProgressToNextTier(1300)).toBe(50)
    })
  })

  describe('BOOST_MILESTONES', () => {
    it('has milestones in ascending threshold order', () => {
      for (let i = 1; i < BOOST_MILESTONES.length; i++) {
        expect(BOOST_MILESTONES[i].threshold).toBeGreaterThan(
          BOOST_MILESTONES[i - 1].threshold,
        )
      }
    })

    it('has 6 milestones', () => {
      expect(BOOST_MILESTONES).toHaveLength(6)
    })
  })
})
