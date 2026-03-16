import { describe, it, expect, vi } from 'vitest'

// Mock all Vue component imports used by toolbarRegistry
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...(actual as any),
    markRaw: (v: any) => v,
  }
})

import { getToolbarItems, BORDER_TOGGLE, MAP_PAN, MAP_SEARCH, MAP_RECENTER, TEXT_MORE_MENU } from '../toolbarRegistry'
import { ContentType } from '@/types/TileContent'

describe('toolbarRegistry', () => {
  describe('getToolbarItems', () => {
    it('returns items for IMAGE type', () => {
      const items = getToolbarItems(ContentType.IMAGE)
      expect(items.length).toBeGreaterThan(0)
      expect(items.some(i => i.id === 'border-toggle')).toBe(true)
      expect(items.some(i => i.id === 'crop')).toBe(true)
    })

    it('returns items for VIDEO type', () => {
      const items = getToolbarItems(ContentType.VIDEO)
      expect(items.some(i => i.id === 'border-toggle')).toBe(true)
      expect(items.some(i => i.id === 'crop')).toBe(true)
    })

    it('returns items for TEXT type with more menu', () => {
      const items = getToolbarItems(ContentType.TEXT)
      expect(items.some(i => i.id === 'border-toggle')).toBe(true)
      expect(items.some(i => i.id === 'text-align')).toBe(true)
      expect(items.some(i => i.id === 'more-menu')).toBe(true)
    })

    it('TEXT more-menu has bold, italic, and link sub-items', () => {
      const menuItems = TEXT_MORE_MENU.menuItems!
      expect(menuItems.some(i => i.id === 'bold-toggle')).toBe(true)
      expect(menuItems.some(i => i.id === 'italic-toggle')).toBe(true)
      expect(menuItems.some(i => i.id === 'text-link')).toBe(true)
    })

    it('returns items for LINK type with more menu', () => {
      const items = getToolbarItems(ContentType.LINK)
      expect(items.some(i => i.id === 'border-toggle')).toBe(true)
      expect(items.some(i => i.id === 'more-menu')).toBe(true)
    })

    it('returns items for MAP type with map-specific controls', () => {
      const items = getToolbarItems(ContentType.MAP)
      expect(items.some(i => i.id === 'map-pan')).toBe(true)
      expect(items.some(i => i.id === 'map-search')).toBe(true)
      expect(items.some(i => i.id === 'map-recenter')).toBe(true)
      expect(items.some(i => i.id === 'map-default')).toBe(true)
    })

    it('MAP type does NOT have border-toggle', () => {
      const items = getToolbarItems(ContentType.MAP)
      expect(items.some(i => i.id === 'border-toggle')).toBe(false)
    })

    it('returns items for CHAT type', () => {
      const items = getToolbarItems(ContentType.CHAT)
      expect(items.some(i => i.id === 'border-toggle')).toBe(true)
    })

    it('returns items for EMBED type', () => {
      const items = getToolbarItems(ContentType.EMBED)
      expect(items.some(i => i.id === 'border-toggle')).toBe(true)
    })

    it('returns items for CAMPFIRE type', () => {
      const items = getToolbarItems(ContentType.CAMPFIRE)
      expect(items.some(i => i.id === 'border-toggle')).toBe(true)
    })

    it('returns items for RPG type', () => {
      const items = getToolbarItems(ContentType.RPG)
      expect(items.some(i => i.id === 'border-toggle')).toBe(true)
    })

    it('returns items for CLICKER type', () => {
      const items = getToolbarItems(ContentType.CLICKER)
      expect(items.some(i => i.id === 'border-toggle')).toBe(true)
    })

    it('returns items for PROFILE type', () => {
      const items = getToolbarItems(ContentType.PROFILE)
      expect(items.some(i => i.id === 'border-toggle')).toBe(true)
      expect(items.some(i => i.id === 'color')).toBe(true)
    })

    it('returns items for ROADMAP_FEED type', () => {
      const items = getToolbarItems(ContentType.ROADMAP_FEED)
      expect(items.some(i => i.id === 'border-toggle')).toBe(true)
    })

    it('returns default items (border + color) for unknown types', () => {
      const items = getToolbarItems('UNKNOWN' as ContentType)
      expect(items).toHaveLength(2)
      expect(items.some(i => i.id === 'border-toggle')).toBe(true)
      expect(items.some(i => i.id === 'color')).toBe(true)
    })
  })
})
