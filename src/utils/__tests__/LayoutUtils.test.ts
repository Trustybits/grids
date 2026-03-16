import { describe, it, expect } from 'vitest'
import { findTileById, updateTilePosition } from '../LayoutUtils'
import type { Tile } from '@/types/Tile'
import { ContentType } from '@/types/TileContent'

const makeTile = (id: string, x = 0, y = 0): Tile => ({
  i: id,
  x,
  y,
  w: 2,
  h: 2,
  borderEnabled: true,
  caption: '',
  content: { type: ContentType.TEXT, text: '', font: 'Arial', fontSize: 14, isBold: false, isItalic: false, textType: '', color: '#ffffff' },
})

describe('LayoutUtils', () => {
  describe('findTileById', () => {
    it('finds an existing tile by id', () => {
      const tiles = [makeTile('a'), makeTile('b'), makeTile('c')]
      const found = findTileById(tiles, 'b')
      expect(found).toBeDefined()
      expect(found!.i).toBe('b')
    })

    it('returns undefined for non-existent id', () => {
      const tiles = [makeTile('a'), makeTile('b')]
      expect(findTileById(tiles, 'z')).toBeUndefined()
    })

    it('returns undefined for empty array', () => {
      expect(findTileById([], 'a')).toBeUndefined()
    })
  })

  describe('updateTilePosition', () => {
    it('updates the position of the correct tile', () => {
      const tiles = [makeTile('a', 0, 0), makeTile('b', 1, 1)]
      const result = updateTilePosition(tiles, 'a', 5, 10)
      const updated = result.find(t => t.i === 'a')
      expect((updated as any).position).toEqual({ x: 5, y: 10 })
    })

    it('does not mutate the original array', () => {
      const tiles = [makeTile('a', 0, 0)]
      const result = updateTilePosition(tiles, 'a', 5, 10)
      expect(result).not.toBe(tiles)
    })

    it('leaves other tiles untouched', () => {
      const tiles = [makeTile('a', 0, 0), makeTile('b', 1, 1)]
      const result = updateTilePosition(tiles, 'a', 5, 10)
      const other = result.find(t => t.i === 'b')
      expect(other!.x).toBe(1)
      expect(other!.y).toBe(1)
    })
  })
})
