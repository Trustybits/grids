// Unit tests for GridService — all DAOs, DbUtils, and utility imports are mocked.
// console.error / console.warn are spied on so error-path logging is silenced
// during the test run and can be asserted on.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerDaoFactory } from '@/dao/DaoFactorySingleton'
import { registerDbUtils } from '@/dao/DbUtilsSingleton'
import type { GridDao } from '@grids/contracts/dao'
import type { UserDao } from '@grids/contracts/dao'
import type { DbUtils } from '@grids/contracts/dao'
import type { DaoFactory } from '@grids/contracts/dao'
import type { Grid, Tile } from '@grids/contracts/types'
import { ContentType } from '@grids/contracts/types'
import type { ChatContent, SuggestionContent } from '@grids/contracts/types'

// ── Mocks for external modules ───────────────────────────────────────────

let uuidCounter = 0
vi.mock('uuid', () => ({
  v4: () => `uuid-${++uuidCounter}`,
}))

vi.mock('@/assets/images/hero.gif', () => ({ default: 'hero.gif' }))

vi.mock('@/utils/GridUtils', () => ({
  createDefaultGrid: (userId: string, name: string): Grid => ({
    id: '',
    userId,
    name,
    colNum: 12,
    verticalCompact: true,
    tiles: [],
    backgroundImageSrc: '',
    backgroundEmbed: false,
    duplicatable: false,
  }),
}))

vi.mock('@/utils/TileUtils', () => ({
  createTile: (
    type: ContentType,
    i: string,
    x: number,
    y: number,
    w: number,
    h: number,
    contentData: Record<string, unknown>,
    caption: string,
  ): Tile => ({
    i,
    x,
    y,
    w,
    h,
    borderEnabled: true,
    content: { type, ...contentData },
    caption,
  }) as Tile,
  createTileContent: (type: ContentType, data: Record<string, unknown> = {}) => ({
    type,
    ...data,
  }),
}))

// ── Mock DAOs ─────────────────────────────────────────────────────────────

let mockGridDao: Record<string, ReturnType<typeof vi.fn>>
let mockUserDao: Record<string, ReturnType<typeof vi.fn>>
let mockDbUtils: Record<string, ReturnType<typeof vi.fn>>
let consoleErrorSpy: ReturnType<typeof vi.spyOn>
let consoleWarnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  uuidCounter = 0

  mockGridDao = {
    getById: vi.fn(),
    findByUserId: vi.fn(),
    generateId: vi.fn(() => 'generated-id'),
    save: vi.fn(),
    update: vi.fn(),
    updateLastOpenedAt: vi.fn(),
    delete: vi.fn(),
  }

  mockUserDao = {
    getById: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    subscribe: vi.fn(),
  }

  mockDbUtils = {
    sanitizeValue: vi.fn((v) => v),
    serverTimestamp: vi.fn(() => 'SERVER_TS'),
  }

  registerDaoFactory({
    getUserDao: () => mockUserDao as unknown as UserDao,
    getGridDao: () => mockGridDao as unknown as GridDao,
    getSlugDao: () => null,
    getUserGameDataDao: () => null,
    getChatDao: () => null,
    getUpvoteDao: () => null,
    getCustomerDao: () => null,
    getStorageDao: () => null,
  } as unknown as DaoFactory)

  registerDbUtils(mockDbUtils as unknown as DbUtils)

  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
  consoleWarnSpy.mockRestore()
})

// ── Helpers ───────────────────────────────────────────────────────────────

function makeGrid(overrides: Partial<Grid> = {}): Grid {
  return {
    id: 'grid-1',
    userId: 'user-1',
    name: 'Test Grid',
    colNum: 12,
    verticalCompact: true,
    tiles: [],
    backgroundImageSrc: '',
    backgroundEmbed: false,
    ...overrides,
  }
}

function makeTile(overrides: Partial<Tile> = {}): Tile {
  return {
    i: 'tile-1',
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    borderEnabled: true,
    caption: '',
    content: { type: ContentType.TEXT },
    ...overrides,
  } as Tile
}

// ── Dynamic import (after mocks are in place) ─────────────────────────────

async function getService() {
  const { GridService } = await import('@/services/GridService')
  return new GridService()
}

// ══════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════

// ── fetchGrid ──────────────────────────────────────────────────────────

describe('fetchGrid', () => {
  it('returns the grid when it exists', async () => {
    const grid = makeGrid()
    mockGridDao.getById.mockResolvedValueOnce(grid)

    const service = await getService()
    const result = await service.fetchGrid('grid-1')

    expect(result).toEqual(grid)
    expect(mockGridDao.getById).toHaveBeenCalledWith('grid-1')
  })

  it('throws when the grid does not exist', async () => {
    mockGridDao.getById.mockResolvedValueOnce(null)

    const service = await getService()
    await expect(service.fetchGrid('missing')).rejects.toThrow(
      'Grid with ID missing does not exist'
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error fetching grid with ID missing:',
      expect.any(Error),
    )
  })

  it('throws when the DAO throws', async () => {
    mockGridDao.getById.mockRejectedValueOnce(new Error('DB error'))

    const service = await getService()
    await expect(service.fetchGrid('grid-1')).rejects.toThrow('DB error')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error fetching grid with ID grid-1:',
      expect.any(Error),
    )
  })

  it('does not log on the happy path', async () => {
    mockGridDao.getById.mockResolvedValueOnce(makeGrid())

    const service = await getService()
    await service.fetchGrid('grid-1')

    expect(consoleErrorSpy).not.toHaveBeenCalled()
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })
})

// ── saveGrid ───────────────────────────────────────────────────────────

describe('saveGrid', () => {
  it('sanitizes and persists the grid with expected fields', async () => {
    const grid = makeGrid({ themeId: 'dark', duplicatable: true })
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveGrid(grid)

    expect(mockDbUtils.sanitizeValue).toHaveBeenCalled()
    expect(mockGridDao.save).toHaveBeenCalledWith(
      'grid-1',
      expect.objectContaining({
        userId: 'user-1',
        name: 'Test Grid',
        colNum: 12,
        verticalCompact: true,
        tiles: [],
        themeId: 'dark',
        duplicatable: true,
        updatedAt: 'SERVER_TS',
      })
    )
  })

  it('defaults themeId to "dark" when not set', async () => {
    const grid = makeGrid({ themeId: undefined })
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveGrid(grid)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    expect(payload.themeId).toBe('dark')
  })

  it('defaults overrides to empty object when not set', async () => {
    const grid = makeGrid({ overrides: undefined })
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveGrid(grid)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    expect(payload.overrides).toEqual({})
  })

  it('defaults duplicatable to false when not set', async () => {
    const grid = makeGrid({ duplicatable: undefined })
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveGrid(grid)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    expect(payload.duplicatable).toBe(false)
  })

  it('uses server timestamp for createdAt when not set', async () => {
    const grid = makeGrid()
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveGrid(grid)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    expect(payload.createdAt).toBe('SERVER_TS')
  })

  it('preserves existing createdAt', async () => {
    const existingDate = new Date('2024-01-01')
    const grid = makeGrid({ createdAt: existingDate })
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveGrid(grid)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    expect(payload.createdAt).toBe(existingDate)
  })

  it('strips blob: URLs from tile content src fields', async () => {
    const tile = makeTile({
      content: { type: ContentType.IMAGE, src: 'blob:http://localhost/abc' } as never,
    })
    const grid = makeGrid({ tiles: [tile] })
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveGrid(grid)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    const savedTiles = payload.tiles as Array<{ content: { src: string } }>
    expect(savedTiles[0].content.src).toBe('')
  })

  it('preserves non-blob URLs in tile content', async () => {
    const tile = makeTile({
      content: { type: ContentType.IMAGE, src: 'https://example.com/photo.jpg' } as never,
    })
    const grid = makeGrid({ tiles: [tile] })
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveGrid(grid)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    const savedTiles = payload.tiles as Array<{ content: { src: string } }>
    expect(savedTiles[0].content.src).toBe('https://example.com/photo.jpg')
  })

  it('throws when the DAO save fails', async () => {
    mockGridDao.save.mockRejectedValueOnce(new Error('Write error'))

    const service = await getService()
    await expect(service.saveGrid(makeGrid())).rejects.toThrow('Write error')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error saving grid with ID grid-1:',
      expect.any(Error),
    )
  })
})

// ── updateGrid ─────────────────────────────────────────────────────────

describe('updateGrid', () => {
  it('sanitizes and updates with expected fields (no userId or createdAt)', async () => {
    const grid = makeGrid()
    mockGridDao.update.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.updateGrid(grid)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('userId')
    expect(payload).not.toHaveProperty('createdAt')
    expect(payload.updatedAt).toBe('SERVER_TS')
    expect(mockGridDao.update).toHaveBeenCalledWith('grid-1', expect.any(Object))
  })

  it('strips blob: URLs from tiles', async () => {
    const tile = makeTile({
      content: { type: ContentType.VIDEO, src: 'blob:http://localhost/vid' } as never,
    })
    const grid = makeGrid({ tiles: [tile] })
    mockGridDao.update.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.updateGrid(grid)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    const savedTiles = payload.tiles as Array<{ content: { src: string } }>
    expect(savedTiles[0].content.src).toBe('')
  })

  it('throws when the DAO update fails', async () => {
    mockGridDao.update.mockRejectedValueOnce(new Error('Update error'))

    const service = await getService()
    await expect(service.updateGrid(makeGrid())).rejects.toThrow('Update error')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error updating grid with ID grid-1:',
      expect.any(Error),
    )
  })
})

// ── deleteGrid ─────────────────────────────────────────────────────────

describe('deleteGrid', () => {
  it('deletes by ID', async () => {
    mockGridDao.delete.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.deleteGrid('grid-1')

    expect(mockGridDao.delete).toHaveBeenCalledWith('grid-1')
  })

  it('throws when the DAO delete fails', async () => {
    mockGridDao.delete.mockRejectedValueOnce(new Error('Delete error'))

    const service = await getService()
    await expect(service.deleteGrid('grid-1')).rejects.toThrow('Delete error')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error deleting grid with ID grid-1:',
      expect.any(Error),
    )
  })
})

// ── fetchGridsByUserId ─────────────────────────────────────────────────

describe('fetchGridsByUserId', () => {
  it('returns grids for the user', async () => {
    const grids = [makeGrid(), makeGrid({ id: 'grid-2' })]
    mockGridDao.findByUserId.mockResolvedValueOnce(grids)

    const service = await getService()
    const result = await service.fetchGridsByUserId('user-1')

    expect(result).toEqual(grids)
    expect(mockGridDao.findByUserId).toHaveBeenCalledWith('user-1')
  })

  it('returns empty array when user has no grids', async () => {
    mockGridDao.findByUserId.mockResolvedValueOnce([])

    const service = await getService()
    const result = await service.fetchGridsByUserId('user-1')

    expect(result).toEqual([])
  })

  it('throws when the DAO throws', async () => {
    mockGridDao.findByUserId.mockRejectedValueOnce(new Error('Query error'))

    const service = await getService()
    await expect(service.fetchGridsByUserId('user-1')).rejects.toThrow('Query error')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error fetching grids for user user-1:',
      expect.any(Error),
    )
  })
})

// ── generateId ───────────────────────────────────────────────────────────

describe('generateId', () => {
  it('delegates to layoutDao.generateId', async () => {
    const service = await getService()
    const id = service.generateId()

    expect(id).toBe('generated-id')
    expect(mockGridDao.generateId).toHaveBeenCalled()
  })
})

// ── createGrid ─────────────────────────────────────────────────────────

describe('createGrid', () => {
  it('creates a grid with starter tiles and generated ID', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const tiles = [makeTile()]
    const service = await getService()
    const result = await service.createGrid('user-1', 'My Grid', tiles)

    expect(result.id).toBe('generated-id')
    expect(result.userId).toBe('user-1')
    expect(result.name).toBe('My Grid')
    expect(result.tiles).toEqual(tiles)
    expect(mockGridDao.save).toHaveBeenCalled()
  })

  it('defaults to empty tiles when none are provided', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    const result = await service.createGrid('user-1', 'Empty Grid')

    expect(result.tiles).toEqual([])
  })

  it('returns a copy (not a reference to the internal object)', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    const result = await service.createGrid('user-1', 'Grid')

    result.name = 'Mutated'
    // Mutation should not affect what was saved
    const savedPayload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    expect(savedPayload.name).toBe('Grid')
  })

  it('throws when save fails', async () => {
    mockGridDao.save.mockRejectedValueOnce(new Error('Save failed'))

    const service = await getService()
    await expect(service.createGrid('user-1', 'Grid')).rejects.toThrow('Save failed')
    // saveGrid logs first, then createGrid logs its own message before rethrowing
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error creating grid:',
      expect.any(Error),
    )
  })
})

// ── duplicateGrid ──────────────────────────────────────────────────────

describe('duplicateGrid', () => {
  it('creates a copy with "Copy of" prefix and new ID', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)
    const source = makeGrid({ name: 'Original', backgroundImageSrc: 'bg.jpg' })

    const service = await getService()
    const result = await service.duplicateGrid('user-2', source, [], {})

    expect(result.id).toBe('generated-id')
    expect(result.userId).toBe('user-2')
    expect(result.name).toBe('Copy of Original')
    expect(result.backgroundImageSrc).toBe('bg.jpg')
    // Provenance marker so the assign-default trigger skips duplicates.
    expect(result.clonedFrom).toBe('grid-1')
  })

  it('uses "Untitled" when source name is empty', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)
    const source = makeGrid({ name: '' })

    const service = await getService()
    const result = await service.duplicateGrid('user-2', source, [], {})

    expect(result.name).toBe('Copy of Untitled')
  })

  it('preserves cloned tiles and overrides', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)
    const tiles = [makeTile({ i: 'new-tile' })]
    const overrides = { lg: { 'new-tile': { x: 1, y: 1, w: 3, h: 3 } } } as Grid['overrides']
    const source = makeGrid()

    const service = await getService()
    const result = await service.duplicateGrid('user-2', source, tiles, overrides)

    expect(result.tiles).toEqual(tiles)
    expect(result.overrides).toEqual(overrides)
  })

  it('defaults backgroundImageSrc to empty string when falsy', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)
    const source = makeGrid({ backgroundImageSrc: '' })

    const service = await getService()
    const result = await service.duplicateGrid('user-2', source, [], {})

    expect(result.backgroundImageSrc).toBe('')
  })

  it('throws when save fails', async () => {
    mockGridDao.save.mockRejectedValueOnce(new Error('Save failed'))
    const source = makeGrid()

    const service = await getService()
    await expect(service.duplicateGrid('user-2', source, [], {})).rejects.toThrow('Save failed')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error duplicating grid:',
      expect.any(Error),
    )
  })
})

// ── touchLastOpenedAt ────────────────────────────────────────────────────

describe('touchLastOpenedAt', () => {
  it('delegates to layoutDao.updateLastOpenedAt', async () => {
    mockGridDao.updateLastOpenedAt.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.touchLastOpenedAt('grid-1')

    expect(mockGridDao.updateLastOpenedAt).toHaveBeenCalledWith('grid-1')
  })

  it('swallows errors (non-critical operation)', async () => {
    mockGridDao.updateLastOpenedAt.mockRejectedValueOnce(new Error('Fail'))

    const service = await getService()
    // Should not throw
    await expect(service.touchLastOpenedAt('grid-1')).resolves.toBeUndefined()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to update lastOpenedAt:',
      expect.any(Error),
    )
  })
})

// ── loadRecentGridIds ──────────────────────────────────────────────────

describe('loadRecentGridIds', () => {
  it('returns recent grid IDs from user document', async () => {
    mockUserDao.getById.mockResolvedValueOnce({ recentGridIds: ['a', 'b', 'c'] })

    const service = await getService()
    const result = await service.loadRecentGridIds('user-1')

    expect(result).toEqual(['a', 'b', 'c'])
  })

  it('truncates to 3 IDs', async () => {
    mockUserDao.getById.mockResolvedValueOnce({
      recentGridIds: ['a', 'b', 'c', 'd', 'e'],
    })

    const service = await getService()
    const result = await service.loadRecentGridIds('user-1')

    expect(result).toEqual(['a', 'b', 'c'])
  })

  it('filters out non-string values', async () => {
    mockUserDao.getById.mockResolvedValueOnce({
      recentGridIds: ['a', 123, null, 'b'],
    })

    const service = await getService()
    const result = await service.loadRecentGridIds('user-1')

    expect(result).toEqual(['a', 'b'])
  })

  it('returns empty array when user document does not exist', async () => {
    mockUserDao.getById.mockResolvedValueOnce(null)

    const service = await getService()
    const result = await service.loadRecentGridIds('user-1')

    expect(result).toEqual([])
  })

  it('returns empty array when recentGridIds is not an array', async () => {
    mockUserDao.getById.mockResolvedValueOnce({ recentGridIds: 'not-an-array' })

    const service = await getService()
    const result = await service.loadRecentGridIds('user-1')

    expect(result).toEqual([])
  })

  it('returns empty array when recentGridIds is missing', async () => {
    mockUserDao.getById.mockResolvedValueOnce({})

    const service = await getService()
    const result = await service.loadRecentGridIds('user-1')

    expect(result).toEqual([])
  })

  it('swallows errors and returns empty array', async () => {
    mockUserDao.getById.mockRejectedValueOnce(new Error('DB error'))

    const service = await getService()
    const result = await service.loadRecentGridIds('user-1')

    expect(result).toEqual([])
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load recent grids:',
      expect.any(Error),
    )
  })
})

// ── saveRecentGridIds ──────────────────────────────────────────────────

describe('saveRecentGridIds', () => {
  it('saves truncated IDs to user document', async () => {
    mockUserDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveRecentGridIds('user-1', ['a', 'b', 'c', 'd'])

    expect(mockUserDao.save).toHaveBeenCalledWith('user-1', {
      recentGridIds: ['a', 'b', 'c'],
    })
  })

  it('saves fewer than 3 IDs without padding', async () => {
    mockUserDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveRecentGridIds('user-1', ['a'])

    expect(mockUserDao.save).toHaveBeenCalledWith('user-1', {
      recentGridIds: ['a'],
    })
  })

  it('swallows errors (non-critical operation)', async () => {
    mockUserDao.save.mockRejectedValueOnce(new Error('Fail'))

    const service = await getService()
    await expect(service.saveRecentGridIds('user-1', ['a'])).resolves.toBeUndefined()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to save recent grids:',
      expect.any(Error),
    )
  })
})

// ── createGridWithStarterTiles ─────────────────────────────────────────

describe('createGridWithStarterTiles', () => {
  it('creates a grid with starter tiles', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    const result = await service.createGridWithStarterTiles('user-1', 'Starter')

    expect(result.name).toBe('Starter')
    expect(result.userId).toBe('user-1')
    expect(result.tiles.length).toBeGreaterThan(0)
    expect(mockGridDao.save).toHaveBeenCalled()
  })
})

// ── cloneAndPersistGrid ────────────────────────────────────────────────

describe('cloneAndPersistGrid', () => {
  it('full copy: clones tiles with new UUIDs', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const tile = makeTile({ i: 'old-tile', content: { type: ContentType.TEXT } as never })
    const source = makeGrid({ tiles: [tile] })

    const service = await getService()
    const result = await service.cloneAndPersistGrid('user-2', source, 'full')

    expect(result.tiles.length).toBe(1)
    expect(result.tiles[0].i).not.toBe('old-tile')
  })

  it('full copy: clears chat messages', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const chatTile = makeTile({
      i: 'chat-tile',
      content: {
        type: ContentType.CHAT,
        messages: [{ id: '1', text: 'hello', createdAt: 123 }],
      } as ChatContent,
    })
    const source = makeGrid({ tiles: [chatTile] })

    const service = await getService()
    const result = await service.cloneAndPersistGrid('user-2', source, 'full')

    const chatContent = result.tiles[0].content as ChatContent
    expect(chatContent.messages).toEqual([])
  })

  it('structure copy: replaces tiles with suggestion placeholders', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const imageTile = makeTile({
      i: 'img-tile',
      content: { type: ContentType.IMAGE, src: 'https://example.com/pic.jpg' } as never,
    })
    const source = makeGrid({ tiles: [imageTile] })

    const service = await getService()
    const result = await service.cloneAndPersistGrid('user-2', source, 'structure')

    const content = result.tiles[0].content as SuggestionContent
    expect(content.type).toBe(ContentType.SUGGESTION)
    expect(content.action).toBe('media')
  })

  it('structure copy: maps content types to correct suggestion actions', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const tiles = [
      makeTile({ i: 't1', content: { type: ContentType.TEXT } as never }),
      makeTile({ i: 't2', content: { type: ContentType.LINK } as never }),
      makeTile({ i: 't3', content: { type: ContentType.EMBED } as never }),
      makeTile({ i: 't4', content: { type: ContentType.PROFILE } as never }),
      makeTile({ i: 't5', content: { type: ContentType.YOUTUBE } as never }),
      makeTile({ i: 't6', content: { type: ContentType.VIDEO } as never }),
    ]
    const source = makeGrid({ tiles })

    const service = await getService()
    const result = await service.cloneAndPersistGrid('user-2', source, 'structure')

    const actions = result.tiles.map((t) => (t.content as SuggestionContent).action)
    expect(actions).toEqual(['text', 'link', 'embed', 'profile', 'embed', 'media'])
  })

  it('remaps breakpoint overrides to new tile IDs', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const tile = makeTile({ i: 'old-id' })
    const source = makeGrid({
      tiles: [tile],
      overrides: {
        md: { 'old-id': { x: 0, y: 0, w: 6, h: 3 } },
        sm: { 'old-id': { x: 0, y: 0, w: 12, h: 2 } },
      },
    })

    const service = await getService()
    const result = await service.cloneAndPersistGrid('user-2', source, 'full')

    const newTileId = result.tiles[0].i
    expect(newTileId).not.toBe('old-id')

    expect(result.overrides?.md?.[newTileId]).toEqual({ x: 0, y: 0, w: 6, h: 3 })
    expect(result.overrides?.sm?.[newTileId]).toEqual({ x: 0, y: 0, w: 12, h: 2 })
    expect(result.overrides?.md?.['old-id']).toBeUndefined()
  })

  it('handles source grid with no overrides', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const source = makeGrid({ tiles: [makeTile()], overrides: undefined })

    const service = await getService()
    const result = await service.cloneAndPersistGrid('user-2', source)

    expect(result.overrides).toBeUndefined()
  })

  it('defaults copyDepth to "full"', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const chatTile = makeTile({
      i: 'chat-tile',
      content: { type: ContentType.CHAT, messages: [{ id: '1', text: 'hi', createdAt: 1 }] } as ChatContent,
    })
    const source = makeGrid({ tiles: [chatTile] })

    const service = await getService()
    const result = await service.cloneAndPersistGrid('user-2', source)

    // Full copy clears chat messages (not replaced with suggestion)
    const content = result.tiles[0].content as ChatContent
    expect(content.type).toBe(ContentType.CHAT)
    expect(content.messages).toEqual([])
  })
})

// ── queueSave ────────────────────────────────────────────────────────────

describe('queueSave', () => {
  it('saves the grid immediately when no save is in flight', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)
    const grid = makeGrid()

    const service = await getService()
    await service.queueSave(grid)

    expect(mockGridDao.save).toHaveBeenCalledTimes(1)
  })

  it('substitutes blob URLs with resolved storage URLs', async () => {
    mockGridDao.save.mockResolvedValue(undefined)

    const tile = makeTile({
      i: 'tile-1',
      content: { type: ContentType.IMAGE, src: 'blob:http://localhost/abc' } as never,
    })
    const grid = makeGrid({ tiles: [tile] })

    const service = await getService()
    await service.queueSave(grid, { 'tile-1': 'https://storage.example.com/real.jpg' })

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    const savedTiles = payload.tiles as Array<{ content: { src: string } }>
    expect(savedTiles[0].content.src).toBe('https://storage.example.com/real.jpg')
  })

  it('queues a second save while one is in flight and flushes it after', async () => {
    let resolveFirst!: () => void
    const firstPromise = new Promise<void>((r) => { resolveFirst = r })
    mockGridDao.save.mockReturnValueOnce(firstPromise)
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const grid1 = makeGrid({ name: 'First' })
    const grid2 = makeGrid({ name: 'Second' })

    const service = await getService()
    const p1 = service.queueSave(grid1)
    // Queue a second while first is in flight
    const p2 = service.queueSave(grid2)

    // Only one save call so far
    expect(mockGridDao.save).toHaveBeenCalledTimes(1)

    resolveFirst()
    await p1
    await p2

    // The queued save should have flushed
    expect(mockGridDao.save).toHaveBeenCalledTimes(2)
  })

  it('does not throw when the save fails (logs error)', async () => {
    mockGridDao.save.mockRejectedValueOnce(new Error('Write error'))

    const service = await getService()
    await expect(service.queueSave(makeGrid())).resolves.toBeUndefined()
    // saveGrid's catch logs first, then queueSave's catch logs its own message
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error saving grid with ID grid-1:',
      expect.any(Error),
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to save grid.',
      expect.any(Error),
    )
  })
})
