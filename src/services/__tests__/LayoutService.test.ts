// Unit tests for LayoutService — all DAOs, DbUtils, and utility imports are mocked.
// console.error / console.warn are spied on so error-path logging is silenced
// during the test run and can be asserted on.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerDaoFactory } from '@/dao/DaoFactorySingleton'
import { registerDbUtils } from '@/dao/DbUtilsSingleton'
import type { LayoutDao } from '@/dao/interfaces/LayoutDao'
import type { UserDao } from '@/dao/interfaces/UserDao'
import type { DbUtils } from '@/dao/interfaces/DbUtils'
import type { DaoFactory } from '@/dao/interfaces/factory/DaoFactory'
import type { Layout } from '@/types/Layout'
import type { Tile } from '@/types/Tile'
import { ContentType } from '@/types/TileContent'
import type { ChatContent, SuggestionContent } from '@/types/TileContent'

// ── Mocks for external modules ───────────────────────────────────────────

let uuidCounter = 0
vi.mock('uuid', () => ({
  v4: () => `uuid-${++uuidCounter}`,
}))

vi.mock('@/assets/images/hero.gif', () => ({ default: 'hero.gif' }))

vi.mock('@/utils/LayoutUtils', () => ({
  createDefaultLayout: (userId: string, name: string): Layout => ({
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

let mockLayoutDao: Record<string, ReturnType<typeof vi.fn>>
let mockUserDao: Record<string, ReturnType<typeof vi.fn>>
let mockDbUtils: Record<string, ReturnType<typeof vi.fn>>
let consoleErrorSpy: ReturnType<typeof vi.spyOn>
let consoleWarnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  uuidCounter = 0

  mockLayoutDao = {
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
    getLayoutDao: () => mockLayoutDao as unknown as LayoutDao,
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

function makeLayout(overrides: Partial<Layout> = {}): Layout {
  return {
    id: 'layout-1',
    userId: 'user-1',
    name: 'Test Layout',
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
  const { LayoutService } = await import('@/services/LayoutService')
  return new LayoutService()
}

// ══════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════

// ── fetchLayout ──────────────────────────────────────────────────────────

describe('fetchLayout', () => {
  it('returns the layout when it exists', async () => {
    const layout = makeLayout()
    mockLayoutDao.getById.mockResolvedValueOnce(layout)

    const service = await getService()
    const result = await service.fetchLayout('layout-1')

    expect(result).toEqual(layout)
    expect(mockLayoutDao.getById).toHaveBeenCalledWith('layout-1')
  })

  it('throws when the layout does not exist', async () => {
    mockLayoutDao.getById.mockResolvedValueOnce(null)

    const service = await getService()
    await expect(service.fetchLayout('missing')).rejects.toThrow(
      'Layout with ID missing does not exist'
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error fetching layout with ID missing:',
      expect.any(Error),
    )
  })

  it('throws when the DAO throws', async () => {
    mockLayoutDao.getById.mockRejectedValueOnce(new Error('DB error'))

    const service = await getService()
    await expect(service.fetchLayout('layout-1')).rejects.toThrow('DB error')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error fetching layout with ID layout-1:',
      expect.any(Error),
    )
  })

  it('does not log on the happy path', async () => {
    mockLayoutDao.getById.mockResolvedValueOnce(makeLayout())

    const service = await getService()
    await service.fetchLayout('layout-1')

    expect(consoleErrorSpy).not.toHaveBeenCalled()
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })
})

// ── saveLayout ───────────────────────────────────────────────────────────

describe('saveLayout', () => {
  it('sanitizes and persists the layout with expected fields', async () => {
    const layout = makeLayout({ themeId: 'dark', duplicatable: true })
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveLayout(layout)

    expect(mockDbUtils.sanitizeValue).toHaveBeenCalled()
    expect(mockLayoutDao.save).toHaveBeenCalledWith(
      'layout-1',
      expect.objectContaining({
        userId: 'user-1',
        name: 'Test Layout',
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
    const layout = makeLayout({ themeId: undefined })
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveLayout(layout)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    expect(payload.themeId).toBe('dark')
  })

  it('defaults overrides to empty object when not set', async () => {
    const layout = makeLayout({ overrides: undefined })
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveLayout(layout)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    expect(payload.overrides).toEqual({})
  })

  it('defaults duplicatable to false when not set', async () => {
    const layout = makeLayout({ duplicatable: undefined })
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveLayout(layout)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    expect(payload.duplicatable).toBe(false)
  })

  it('uses server timestamp for createdAt when not set', async () => {
    const layout = makeLayout()
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveLayout(layout)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    expect(payload.createdAt).toBe('SERVER_TS')
  })

  it('preserves existing createdAt', async () => {
    const existingDate = new Date('2024-01-01')
    const layout = makeLayout({ createdAt: existingDate })
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveLayout(layout)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    expect(payload.createdAt).toBe(existingDate)
  })

  it('strips blob: URLs from tile content src fields', async () => {
    const tile = makeTile({
      content: { type: ContentType.IMAGE, src: 'blob:http://localhost/abc' } as never,
    })
    const layout = makeLayout({ tiles: [tile] })
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveLayout(layout)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    const savedTiles = payload.tiles as Array<{ content: { src: string } }>
    expect(savedTiles[0].content.src).toBe('')
  })

  it('preserves non-blob URLs in tile content', async () => {
    const tile = makeTile({
      content: { type: ContentType.IMAGE, src: 'https://example.com/photo.jpg' } as never,
    })
    const layout = makeLayout({ tiles: [tile] })
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveLayout(layout)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    const savedTiles = payload.tiles as Array<{ content: { src: string } }>
    expect(savedTiles[0].content.src).toBe('https://example.com/photo.jpg')
  })

  it('throws when the DAO save fails', async () => {
    mockLayoutDao.save.mockRejectedValueOnce(new Error('Write error'))

    const service = await getService()
    await expect(service.saveLayout(makeLayout())).rejects.toThrow('Write error')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error saving layout with ID layout-1:',
      expect.any(Error),
    )
  })
})

// ── updateLayout ─────────────────────────────────────────────────────────

describe('updateLayout', () => {
  it('sanitizes and updates with expected fields (no userId or createdAt)', async () => {
    const layout = makeLayout()
    mockLayoutDao.update.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.updateLayout(layout)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('userId')
    expect(payload).not.toHaveProperty('createdAt')
    expect(payload.updatedAt).toBe('SERVER_TS')
    expect(mockLayoutDao.update).toHaveBeenCalledWith('layout-1', expect.any(Object))
  })

  it('strips blob: URLs from tiles', async () => {
    const tile = makeTile({
      content: { type: ContentType.VIDEO, src: 'blob:http://localhost/vid' } as never,
    })
    const layout = makeLayout({ tiles: [tile] })
    mockLayoutDao.update.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.updateLayout(layout)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    const savedTiles = payload.tiles as Array<{ content: { src: string } }>
    expect(savedTiles[0].content.src).toBe('')
  })

  it('throws when the DAO update fails', async () => {
    mockLayoutDao.update.mockRejectedValueOnce(new Error('Update error'))

    const service = await getService()
    await expect(service.updateLayout(makeLayout())).rejects.toThrow('Update error')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error updating layout with ID layout-1:',
      expect.any(Error),
    )
  })
})

// ── deleteLayout ─────────────────────────────────────────────────────────

describe('deleteLayout', () => {
  it('deletes by ID', async () => {
    mockLayoutDao.delete.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.deleteLayout('layout-1')

    expect(mockLayoutDao.delete).toHaveBeenCalledWith('layout-1')
  })

  it('throws when the DAO delete fails', async () => {
    mockLayoutDao.delete.mockRejectedValueOnce(new Error('Delete error'))

    const service = await getService()
    await expect(service.deleteLayout('layout-1')).rejects.toThrow('Delete error')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error deleting layout with ID layout-1:',
      expect.any(Error),
    )
  })
})

// ── fetchLayoutsByUserId ─────────────────────────────────────────────────

describe('fetchLayoutsByUserId', () => {
  it('returns layouts for the user', async () => {
    const layouts = [makeLayout(), makeLayout({ id: 'layout-2' })]
    mockLayoutDao.findByUserId.mockResolvedValueOnce(layouts)

    const service = await getService()
    const result = await service.fetchLayoutsByUserId('user-1')

    expect(result).toEqual(layouts)
    expect(mockLayoutDao.findByUserId).toHaveBeenCalledWith('user-1')
  })

  it('returns empty array when user has no layouts', async () => {
    mockLayoutDao.findByUserId.mockResolvedValueOnce([])

    const service = await getService()
    const result = await service.fetchLayoutsByUserId('user-1')

    expect(result).toEqual([])
  })

  it('throws when the DAO throws', async () => {
    mockLayoutDao.findByUserId.mockRejectedValueOnce(new Error('Query error'))

    const service = await getService()
    await expect(service.fetchLayoutsByUserId('user-1')).rejects.toThrow('Query error')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error fetching layouts for user user-1:',
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
    expect(mockLayoutDao.generateId).toHaveBeenCalled()
  })
})

// ── createLayout ─────────────────────────────────────────────────────────

describe('createLayout', () => {
  it('creates a layout with starter tiles and generated ID', async () => {
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const tiles = [makeTile()]
    const service = await getService()
    const result = await service.createLayout('user-1', 'My Grid', tiles)

    expect(result.id).toBe('generated-id')
    expect(result.userId).toBe('user-1')
    expect(result.name).toBe('My Grid')
    expect(result.tiles).toEqual(tiles)
    expect(mockLayoutDao.save).toHaveBeenCalled()
  })

  it('defaults to empty tiles when none are provided', async () => {
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    const result = await service.createLayout('user-1', 'Empty Grid')

    expect(result.tiles).toEqual([])
  })

  it('returns a copy (not a reference to the internal object)', async () => {
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    const result = await service.createLayout('user-1', 'Grid')

    result.name = 'Mutated'
    // Mutation should not affect what was saved
    const savedPayload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    expect(savedPayload.name).toBe('Grid')
  })

  it('throws when save fails', async () => {
    mockLayoutDao.save.mockRejectedValueOnce(new Error('Save failed'))

    const service = await getService()
    await expect(service.createLayout('user-1', 'Grid')).rejects.toThrow('Save failed')
    // saveLayout logs first, then createLayout logs its own message before rethrowing
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error creating layout:',
      expect.any(Error),
    )
  })
})

// ── duplicateLayout ──────────────────────────────────────────────────────

describe('duplicateLayout', () => {
  it('creates a copy with "Copy of" prefix and new ID', async () => {
    mockLayoutDao.save.mockResolvedValueOnce(undefined)
    const source = makeLayout({ name: 'Original', backgroundImageSrc: 'bg.jpg' })

    const service = await getService()
    const result = await service.duplicateLayout('user-2', source, [], {})

    expect(result.id).toBe('generated-id')
    expect(result.userId).toBe('user-2')
    expect(result.name).toBe('Copy of Original')
    expect(result.backgroundImageSrc).toBe('bg.jpg')
  })

  it('uses "Untitled" when source name is empty', async () => {
    mockLayoutDao.save.mockResolvedValueOnce(undefined)
    const source = makeLayout({ name: '' })

    const service = await getService()
    const result = await service.duplicateLayout('user-2', source, [], {})

    expect(result.name).toBe('Copy of Untitled')
  })

  it('preserves cloned tiles and overrides', async () => {
    mockLayoutDao.save.mockResolvedValueOnce(undefined)
    const tiles = [makeTile({ i: 'new-tile' })]
    const overrides = { lg: { 'new-tile': { x: 1, y: 1, w: 3, h: 3 } } } as Layout['overrides']
    const source = makeLayout()

    const service = await getService()
    const result = await service.duplicateLayout('user-2', source, tiles, overrides)

    expect(result.tiles).toEqual(tiles)
    expect(result.overrides).toEqual(overrides)
  })

  it('defaults backgroundImageSrc to empty string when falsy', async () => {
    mockLayoutDao.save.mockResolvedValueOnce(undefined)
    const source = makeLayout({ backgroundImageSrc: '' })

    const service = await getService()
    const result = await service.duplicateLayout('user-2', source, [], {})

    expect(result.backgroundImageSrc).toBe('')
  })

  it('throws when save fails', async () => {
    mockLayoutDao.save.mockRejectedValueOnce(new Error('Save failed'))
    const source = makeLayout()

    const service = await getService()
    await expect(service.duplicateLayout('user-2', source, [], {})).rejects.toThrow('Save failed')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error duplicating layout:',
      expect.any(Error),
    )
  })
})

// ── touchLastOpenedAt ────────────────────────────────────────────────────

describe('touchLastOpenedAt', () => {
  it('delegates to layoutDao.updateLastOpenedAt', async () => {
    mockLayoutDao.updateLastOpenedAt.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.touchLastOpenedAt('layout-1')

    expect(mockLayoutDao.updateLastOpenedAt).toHaveBeenCalledWith('layout-1')
  })

  it('swallows errors (non-critical operation)', async () => {
    mockLayoutDao.updateLastOpenedAt.mockRejectedValueOnce(new Error('Fail'))

    const service = await getService()
    // Should not throw
    await expect(service.touchLastOpenedAt('layout-1')).resolves.toBeUndefined()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to update lastOpenedAt:',
      expect.any(Error),
    )
  })
})

// ── loadRecentLayoutIds ──────────────────────────────────────────────────

describe('loadRecentLayoutIds', () => {
  it('returns recent layout IDs from user document', async () => {
    mockUserDao.getById.mockResolvedValueOnce({ recentLayoutIds: ['a', 'b', 'c'] })

    const service = await getService()
    const result = await service.loadRecentLayoutIds('user-1')

    expect(result).toEqual(['a', 'b', 'c'])
  })

  it('truncates to 3 IDs', async () => {
    mockUserDao.getById.mockResolvedValueOnce({
      recentLayoutIds: ['a', 'b', 'c', 'd', 'e'],
    })

    const service = await getService()
    const result = await service.loadRecentLayoutIds('user-1')

    expect(result).toEqual(['a', 'b', 'c'])
  })

  it('filters out non-string values', async () => {
    mockUserDao.getById.mockResolvedValueOnce({
      recentLayoutIds: ['a', 123, null, 'b'],
    })

    const service = await getService()
    const result = await service.loadRecentLayoutIds('user-1')

    expect(result).toEqual(['a', 'b'])
  })

  it('returns empty array when user document does not exist', async () => {
    mockUserDao.getById.mockResolvedValueOnce(null)

    const service = await getService()
    const result = await service.loadRecentLayoutIds('user-1')

    expect(result).toEqual([])
  })

  it('returns empty array when recentLayoutIds is not an array', async () => {
    mockUserDao.getById.mockResolvedValueOnce({ recentLayoutIds: 'not-an-array' })

    const service = await getService()
    const result = await service.loadRecentLayoutIds('user-1')

    expect(result).toEqual([])
  })

  it('returns empty array when recentLayoutIds is missing', async () => {
    mockUserDao.getById.mockResolvedValueOnce({})

    const service = await getService()
    const result = await service.loadRecentLayoutIds('user-1')

    expect(result).toEqual([])
  })

  it('swallows errors and returns empty array', async () => {
    mockUserDao.getById.mockRejectedValueOnce(new Error('DB error'))

    const service = await getService()
    const result = await service.loadRecentLayoutIds('user-1')

    expect(result).toEqual([])
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load recent layouts:',
      expect.any(Error),
    )
  })
})

// ── saveRecentLayoutIds ──────────────────────────────────────────────────

describe('saveRecentLayoutIds', () => {
  it('saves truncated IDs to user document', async () => {
    mockUserDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveRecentLayoutIds('user-1', ['a', 'b', 'c', 'd'])

    expect(mockUserDao.save).toHaveBeenCalledWith('user-1', {
      recentLayoutIds: ['a', 'b', 'c'],
    })
  })

  it('saves fewer than 3 IDs without padding', async () => {
    mockUserDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveRecentLayoutIds('user-1', ['a'])

    expect(mockUserDao.save).toHaveBeenCalledWith('user-1', {
      recentLayoutIds: ['a'],
    })
  })

  it('swallows errors (non-critical operation)', async () => {
    mockUserDao.save.mockRejectedValueOnce(new Error('Fail'))

    const service = await getService()
    await expect(service.saveRecentLayoutIds('user-1', ['a'])).resolves.toBeUndefined()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to save recent layouts:',
      expect.any(Error),
    )
  })
})

// ── createLayoutWithStarterTiles ─────────────────────────────────────────

describe('createLayoutWithStarterTiles', () => {
  it('creates a layout with starter tiles', async () => {
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    const result = await service.createLayoutWithStarterTiles('user-1', 'Starter')

    expect(result.name).toBe('Starter')
    expect(result.userId).toBe('user-1')
    expect(result.tiles.length).toBeGreaterThan(0)
    expect(mockLayoutDao.save).toHaveBeenCalled()
  })
})

// ── cloneAndPersistLayout ────────────────────────────────────────────────

describe('cloneAndPersistLayout', () => {
  it('full copy: clones tiles with new UUIDs', async () => {
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const tile = makeTile({ i: 'old-tile', content: { type: ContentType.TEXT } as never })
    const source = makeLayout({ tiles: [tile] })

    const service = await getService()
    const result = await service.cloneAndPersistLayout('user-2', source, 'full')

    expect(result.tiles.length).toBe(1)
    expect(result.tiles[0].i).not.toBe('old-tile')
  })

  it('full copy: clears chat messages', async () => {
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const chatTile = makeTile({
      i: 'chat-tile',
      content: {
        type: ContentType.CHAT,
        messages: [{ id: '1', text: 'hello', createdAt: 123 }],
      } as ChatContent,
    })
    const source = makeLayout({ tiles: [chatTile] })

    const service = await getService()
    const result = await service.cloneAndPersistLayout('user-2', source, 'full')

    const chatContent = result.tiles[0].content as ChatContent
    expect(chatContent.messages).toEqual([])
  })

  it('structure copy: replaces tiles with suggestion placeholders', async () => {
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const imageTile = makeTile({
      i: 'img-tile',
      content: { type: ContentType.IMAGE, src: 'https://example.com/pic.jpg' } as never,
    })
    const source = makeLayout({ tiles: [imageTile] })

    const service = await getService()
    const result = await service.cloneAndPersistLayout('user-2', source, 'structure')

    const content = result.tiles[0].content as SuggestionContent
    expect(content.type).toBe(ContentType.SUGGESTION)
    expect(content.action).toBe('media')
  })

  it('structure copy: maps content types to correct suggestion actions', async () => {
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const tiles = [
      makeTile({ i: 't1', content: { type: ContentType.TEXT } as never }),
      makeTile({ i: 't2', content: { type: ContentType.LINK } as never }),
      makeTile({ i: 't3', content: { type: ContentType.EMBED } as never }),
      makeTile({ i: 't4', content: { type: ContentType.PROFILE } as never }),
      makeTile({ i: 't5', content: { type: ContentType.YOUTUBE } as never }),
      makeTile({ i: 't6', content: { type: ContentType.VIDEO } as never }),
    ]
    const source = makeLayout({ tiles })

    const service = await getService()
    const result = await service.cloneAndPersistLayout('user-2', source, 'structure')

    const actions = result.tiles.map((t) => (t.content as SuggestionContent).action)
    expect(actions).toEqual(['text', 'link', 'embed', 'profile', 'embed', 'media'])
  })

  it('remaps breakpoint overrides to new tile IDs', async () => {
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const tile = makeTile({ i: 'old-id' })
    const source = makeLayout({
      tiles: [tile],
      overrides: {
        md: { 'old-id': { x: 0, y: 0, w: 6, h: 3 } },
        sm: { 'old-id': { x: 0, y: 0, w: 12, h: 2 } },
      },
    })

    const service = await getService()
    const result = await service.cloneAndPersistLayout('user-2', source, 'full')

    const newTileId = result.tiles[0].i
    expect(newTileId).not.toBe('old-id')

    expect(result.overrides?.md?.[newTileId]).toEqual({ x: 0, y: 0, w: 6, h: 3 })
    expect(result.overrides?.sm?.[newTileId]).toEqual({ x: 0, y: 0, w: 12, h: 2 })
    expect(result.overrides?.md?.['old-id']).toBeUndefined()
  })

  it('handles source layout with no overrides', async () => {
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const source = makeLayout({ tiles: [makeTile()], overrides: undefined })

    const service = await getService()
    const result = await service.cloneAndPersistLayout('user-2', source)

    expect(result.overrides).toBeUndefined()
  })

  it('defaults copyDepth to "full"', async () => {
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const chatTile = makeTile({
      i: 'chat-tile',
      content: { type: ContentType.CHAT, messages: [{ id: '1', text: 'hi', createdAt: 1 }] } as ChatContent,
    })
    const source = makeLayout({ tiles: [chatTile] })

    const service = await getService()
    const result = await service.cloneAndPersistLayout('user-2', source)

    // Full copy clears chat messages (not replaced with suggestion)
    const content = result.tiles[0].content as ChatContent
    expect(content.type).toBe(ContentType.CHAT)
    expect(content.messages).toEqual([])
  })
})

// ── queueSave ────────────────────────────────────────────────────────────

describe('queueSave', () => {
  it('saves the layout immediately when no save is in flight', async () => {
    mockLayoutDao.save.mockResolvedValueOnce(undefined)
    const layout = makeLayout()

    const service = await getService()
    await service.queueSave(layout)

    expect(mockLayoutDao.save).toHaveBeenCalledTimes(1)
  })

  it('substitutes blob URLs with resolved storage URLs', async () => {
    mockLayoutDao.save.mockResolvedValue(undefined)

    const tile = makeTile({
      i: 'tile-1',
      content: { type: ContentType.IMAGE, src: 'blob:http://localhost/abc' } as never,
    })
    const layout = makeLayout({ tiles: [tile] })

    const service = await getService()
    await service.queueSave(layout, { 'tile-1': 'https://storage.example.com/real.jpg' })

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    const savedTiles = payload.tiles as Array<{ content: { src: string } }>
    expect(savedTiles[0].content.src).toBe('https://storage.example.com/real.jpg')
  })

  it('queues a second save while one is in flight and flushes it after', async () => {
    let resolveFirst!: () => void
    const firstPromise = new Promise<void>((r) => { resolveFirst = r })
    mockLayoutDao.save.mockReturnValueOnce(firstPromise)
    mockLayoutDao.save.mockResolvedValueOnce(undefined)

    const layout1 = makeLayout({ name: 'First' })
    const layout2 = makeLayout({ name: 'Second' })

    const service = await getService()
    const p1 = service.queueSave(layout1)
    // Queue a second while first is in flight
    const p2 = service.queueSave(layout2)

    // Only one save call so far
    expect(mockLayoutDao.save).toHaveBeenCalledTimes(1)

    resolveFirst()
    await p1
    await p2

    // The queued save should have flushed
    expect(mockLayoutDao.save).toHaveBeenCalledTimes(2)
  })

  it('does not throw when the save fails (logs error)', async () => {
    mockLayoutDao.save.mockRejectedValueOnce(new Error('Write error'))

    const service = await getService()
    await expect(service.queueSave(makeLayout())).resolves.toBeUndefined()
    // saveLayout's catch logs first, then queueSave's catch logs its own message
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error saving layout with ID layout-1:',
      expect.any(Error),
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to save layout.',
      expect.any(Error),
    )
  })
})
