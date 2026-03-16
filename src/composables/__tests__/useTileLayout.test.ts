import { describe, it, expect } from 'vitest'
import {
  resolveTier,
  resolveOrientation,
  resolveLayout,
} from '../useTileLayout'

describe('useTileLayout', () => {
  // ── resolveTier ───────────────────────────────────────────
  describe('resolveTier', () => {
    it('returns mini for 1×1', () => {
      expect(resolveTier(1, 1)).toBe('mini')
    })

    it('returns compact for 2×1 (area 2)', () => {
      expect(resolveTier(2, 1)).toBe('compact')
    })

    it('returns compact for 1×2 (area 2)', () => {
      expect(resolveTier(1, 2)).toBe('compact')
    })

    it('returns compact for 2×2 (area 4)', () => {
      expect(resolveTier(2, 2)).toBe('compact')
    })

    it('returns medium for 3×2 (area 6)', () => {
      expect(resolveTier(3, 2)).toBe('medium')
    })

    it('returns medium for 3×3 (area 9)', () => {
      expect(resolveTier(3, 3)).toBe('medium')
    })

    it('returns large for 4×3 (area 12)', () => {
      expect(resolveTier(4, 3)).toBe('large')
    })

    it('returns large for 4×4 (area 16)', () => {
      expect(resolveTier(4, 4)).toBe('large')
    })
  })

  // ── resolveOrientation ────────────────────────────────────
  describe('resolveOrientation', () => {
    it('returns square for equal w and h', () => {
      expect(resolveOrientation(2, 2)).toBe('square')
      expect(resolveOrientation(4, 4)).toBe('square')
    })

    it('returns landscape for w > h', () => {
      expect(resolveOrientation(3, 1)).toBe('landscape')
      expect(resolveOrientation(4, 2)).toBe('landscape')
    })

    it('returns portrait for h > w', () => {
      expect(resolveOrientation(1, 3)).toBe('portrait')
      expect(resolveOrientation(2, 4)).toBe('portrait')
    })
  })

  // ── resolveLayout flags ───────────────────────────────────
  describe('resolveLayout', () => {
    // Mini tier
    it('1×1 (mini): thumbnail only, default quality', () => {
      const layout = resolveLayout(1, 1)
      expect(layout.tier).toBe('mini')
      expect(layout.showThumbnail).toBe(true)
      expect(layout.showTitle).toBe(false)
      expect(layout.showChannel).toBe(false)
      expect(layout.thumbnailQuality).toBe('default')
    })

    // Compact tier
    it('2×2 (compact): shows title when h >= 2', () => {
      const layout = resolveLayout(2, 2)
      expect(layout.tier).toBe('compact')
      expect(layout.showTitle).toBe(true)
      expect(layout.showChannel).toBe(false)
      expect(layout.thumbnailQuality).toBe('default')
    })

    it('2×1 (compact): no title when h < 2 and w < 3', () => {
      const layout = resolveLayout(2, 1)
      expect(layout.tier).toBe('compact')
      expect(layout.showTitle).toBe(false)
    })

    it('3×1 (compact): row layout for wide banner shape', () => {
      const layout = resolveLayout(3, 1)
      expect(layout.tier).toBe('compact')
      expect(layout.useRowLayout).toBe(true)
      expect(layout.showTitle).toBe(true)
    })

    it('4×1 (compact): row layout for wide banner shape', () => {
      const layout = resolveLayout(4, 1)
      expect(layout.tier).toBe('compact')
      expect(layout.useRowLayout).toBe(true)
    })

    // Medium tier
    it('3×2 (medium): wide medium uses row layout', () => {
      const layout = resolveLayout(3, 2)
      expect(layout.tier).toBe('medium')
      expect(layout.useRowLayout).toBe(true)
      expect(layout.showTitle).toBe(true)
      expect(layout.showChannel).toBe(true)
      expect(layout.showDuration).toBe(true)
      expect(layout.titleLineClamp).toBe(1)
    })

    it('3×3 (medium): stacked layout', () => {
      const layout = resolveLayout(3, 3)
      expect(layout.tier).toBe('medium')
      expect(layout.useRowLayout).toBe(false)
      expect(layout.titleLineClamp).toBe(2)
      expect(layout.thumbnailQuality).toBe('medium')
    })

    it('2×4 (medium): stacked layout, not row', () => {
      const layout = resolveLayout(2, 4)
      expect(layout.tier).toBe('medium')
      expect(layout.useRowLayout).toBe(false)
    })

    // Large tier
    it('4×4 (large): shows channel avatar, high quality', () => {
      const layout = resolveLayout(4, 4)
      expect(layout.tier).toBe('large')
      expect(layout.showTitle).toBe(true)
      expect(layout.showChannel).toBe(true)
      expect(layout.showChannelAvatar).toBe(true)
      expect(layout.showDuration).toBe(true)
      expect(layout.showStats).toBe(true)
      expect(layout.thumbnailQuality).toBe('high')
    })

    it('4×3 (large): no stats when h < 4', () => {
      const layout = resolveLayout(4, 3)
      expect(layout.tier).toBe('large')
      expect(layout.showStats).toBe(false)
      expect(layout.showDescription).toBe(false)
    })

    it('4×5 (large): shows description when h >= 5', () => {
      const layout = resolveLayout(4, 5)
      expect(layout.tier).toBe('large')
      expect(layout.showStats).toBe(true)
      expect(layout.showDescription).toBe(true)
    })

    // Verify w/h are passed through
    it('passes through w and h values', () => {
      const layout = resolveLayout(3, 7)
      expect(layout.w).toBe(3)
      expect(layout.h).toBe(7)
    })
  })
})
