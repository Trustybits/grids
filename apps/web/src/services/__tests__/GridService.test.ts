// Unit tests for GridService — all DAOs, DbUtils, and utility imports are mocked.
// console.error / console.warn are spied on so error-path logging is silenced
// during the test run and can be asserted on.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerDbUtils } from '@/dao/DbUtilsSingleton'
import type { GridDao } from '@grids/contracts/dao'
import type { UserDao } from '@grids/contracts/dao'
import type { Grid, Tile } from '@grids/contracts/types'
import { ContentType } from '@grids/contracts/types'
import type { ChatContent, SuggestionContent } from '@grids/contracts/types'
import {
  makeDbUtils,
  mockConsoleError,
  mockConsoleWarn,
  registerTestDaoFactory,
  type MockDbUtils,
} from './testHelpers'

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

// GridPersistenceUtils is a separate unit — mock it so GridService is tested in
// isolation. The spy defaults to a pass-through; tests assert that
// buildGridPayload delegates tile-stripping to it (rather than re-testing the
// real stripping logic, which has its own tests).
const { stripBlobSpy } = vi.hoisted(() => ({
  stripBlobSpy: vi.fn((tiles: unknown[]) => tiles),
}))
vi.mock('@/utils/GridPersistenceUtils', () => ({
  stripBlobUrlsFromTiles: stripBlobSpy,
}))

// ── Mock DAOs ─────────────────────────────────────────────────────────────

let mockGridDao: Record<string, ReturnType<typeof vi.fn>>
let mockUserDao: Record<string, ReturnType<typeof vi.fn>>
let mockDbUtils: MockDbUtils
let consoleErrorSpy: ReturnType<typeof vi.spyOn>
let consoleWarnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  uuidCounter = 0
  stripBlobSpy.mockReset()
  stripBlobSpy.mockImplementation((tiles: unknown[]) => tiles)

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

  mockDbUtils = makeDbUtils({
    serverTimestamp: vi.fn(() => 'SERVER_TS'),
  })

  registerTestDaoFactory({
    getUserDao: () => mockUserDao as unknown as UserDao,
    getGridDao: () => mockGridDao as unknown as GridDao,
  })

  registerDbUtils(mockDbUtils)

  consoleErrorSpy = mockConsoleError()
  consoleWarnSpy = mockConsoleWarn()
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

  it('defaults backgroundColor to empty string when not set', async () => {
    const grid = makeGrid({ backgroundColor: undefined })
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveGrid(grid)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    expect(payload.backgroundColor).toBe('')
  })

  it('preserves an explicit backgroundColor', async () => {
    const grid = makeGrid({ backgroundColor: '#ff0000' })
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveGrid(grid)

    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    expect(payload.backgroundColor).toBe('#ff0000')
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

  it('delegates tile blob-stripping to GridPersistenceUtils and persists its result', async () => {
    const tile = makeTile({
      content: { type: ContentType.IMAGE, src: 'blob:http://localhost/abc' } as never,
    })
    const grid = makeGrid({ tiles: [tile] })
    // The stripping util is its own unit — here we only verify the wiring.
    const strippedTiles = [{ i: 'tile-1', content: { src: '' } }]
    stripBlobSpy.mockReturnValueOnce(strippedTiles as never)
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.saveGrid(grid)

    expect(stripBlobSpy).toHaveBeenCalledWith(grid.tiles)
    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    expect(payload.tiles).toBe(strippedTiles)
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

  it('delegates tile blob-stripping to GridPersistenceUtils', async () => {
    const tile = makeTile({
      content: { type: ContentType.VIDEO, src: 'blob:http://localhost/vid' } as never,
    })
    const grid = makeGrid({ tiles: [tile] })
    const strippedTiles = [{ i: 'tile-1', content: { src: '' } }]
    stripBlobSpy.mockReturnValueOnce(strippedTiles as never)
    mockGridDao.update.mockResolvedValueOnce(undefined)

    const service = await getService()
    await service.updateGrid(grid)

    expect(stripBlobSpy).toHaveBeenCalledWith(grid.tiles)
    const payload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    expect(payload.tiles).toBe(strippedTiles)
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
  it('delegates to gridDao.generateId', async () => {
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
  it('delegates to gridDao.updateLastOpenedAt', async () => {
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

// ── createStarterTiles (+ createTextDoc markdown parsing) ──────────────────

describe('createStarterTiles', () => {
  async function getStarterTiles() {
    const { createStarterTiles } = await import('@/services/GridService')
    return createStarterTiles()
  }

  it('builds the six starter tiles in order with the expected content types', async () => {
    const tiles = await getStarterTiles()

    expect(tiles).toHaveLength(6)
    expect(tiles.map((t) => t.content.type)).toEqual([
      ContentType.SUGGESTION,
      ContentType.IMAGE,
      ContentType.TEXT,
      ContentType.EMBED,
      ContentType.CHAT,
      ContentType.SUGGESTION,
    ])
  })

  it('wires the image, embed, and suggestion tile content', async () => {
    const tiles = await getStarterTiles()

    expect((tiles[0].content as unknown as { action: string }).action).toBe('profile')
    expect((tiles[1].content as unknown as { src: string }).src).toBe('hero.gif')
    expect((tiles[3].content as unknown as { src: string }).src).toContain(
      'youtube.com/embed',
    )
    expect((tiles[5].content as unknown as { action: string }).action).toBe('link')
  })

  it('renders the welcome text tile as a Tiptap doc with parsed markdown structure', async () => {
    const tiles = await getStarterTiles()
    const doc = JSON.parse((tiles[2].content as unknown as { text: string }).text)

    expect(doc.type).toBe('doc')
    expect(doc.content).toHaveLength(5)

    expect(doc.content[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 1 },
    })
    expect(doc.content[1]).toMatchObject({
      type: 'heading',
      attrs: { level: 4 },
    })
    expect(doc.content[2].content.map((node: { type: string }) => node.type)).toEqual([
      'text',
      'hardBreak',
      'hardBreak',
    ])
    expect(doc.content[3]).toEqual({ type: 'horizontalRule' })
    expect(doc.content[4].content[0]).toMatchObject({
      type: 'text',
      marks: [{ type: 'italic' }],
    })
  })

  it('assigns a unique generated id to each starter tile', async () => {
    const tiles = await getStarterTiles()
    const ids = tiles.map((t) => t.i)

    expect(new Set(ids).size).toBe(ids.length)
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

  it('structure copy: maps the remaining content types and falls back to "text"', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const tiles = [
      makeTile({ i: 'c1', content: { type: ContentType.CHAT } as never }),
      makeTile({ i: 'c2', content: { type: ContentType.CAMPFIRE } as never }),
      makeTile({ i: 'c3', content: { type: ContentType.IMAGE } as never }),
      makeTile({ i: 'c4', content: { type: ContentType.DOCUMENT } as never }),
      makeTile({ i: 'c5', content: { type: ContentType.MUSIC } as never }),
      makeTile({ i: 'c6', content: { type: ContentType.MAP } as never }),
      makeTile({ i: 'c7', content: { type: ContentType.ROADMAP_FEED } as never }),
      // Unmapped type → default branch
      makeTile({ i: 'c8', content: { type: ContentType.SMART_TEXT } as never }),
    ]
    const source = makeGrid({ tiles })

    const service = await getService()
    const result = await service.cloneAndPersistGrid('user-2', source, 'structure')

    const actions = result.tiles.map((t) => (t.content as SuggestionContent).action)
    expect(actions).toEqual([
      'text', // CHAT
      'text', // CAMPFIRE
      'media', // IMAGE
      'media', // DOCUMENT
      'embed', // MUSIC
      'embed', // MAP
      'embed', // ROADMAP_FEED
      'text', // SMART_TEXT (default)
    ])
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

  it('skips breakpoints whose positions map is null', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const tile = makeTile({ i: 'old-id' })
    const source = makeGrid({
      tiles: [tile],
      overrides: {
        md: null,
        sm: { 'old-id': { x: 0, y: 0, w: 12, h: 2 } },
      } as unknown as Grid['overrides'],
    })

    const service = await getService()
    const result = await service.cloneAndPersistGrid('user-2', source, 'full')

    const newTileId = result.tiles[0].i
    // md had a null positions map → it is skipped entirely (no key created).
    expect(result.overrides?.md).toBeUndefined()
    expect(result.overrides?.sm?.[newTileId]).toEqual({ x: 0, y: 0, w: 12, h: 2 })
  })

  it('drops override entries that reference unknown tile ids', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const tile = makeTile({ i: 'old-id' })
    const source = makeGrid({
      tiles: [tile],
      overrides: {
        md: {
          'old-id': { x: 1, y: 1, w: 6, h: 3 },
          // No tile with this id exists, so it must not appear in the remap.
          'ghost-id': { x: 9, y: 9, w: 1, h: 1 },
        },
      },
    })

    const service = await getService()
    const result = await service.cloneAndPersistGrid('user-2', source, 'full')

    const newTileId = result.tiles[0].i
    expect(result.overrides?.md?.[newTileId]).toEqual({ x: 1, y: 1, w: 6, h: 3 })
    // The ghost id mapped to no new tile → dropped, leaving only the one entry.
    expect(Object.keys(result.overrides?.md ?? {})).toEqual([newTileId])
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
    // ...and the flush must carry the LATEST snapshot (grid2), not a stale one —
    // that is the entire point of the serialization queue.
    const firstPayload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    const secondPayload = mockDbUtils.sanitizeValue.mock.calls[1][0] as Record<string, unknown>
    expect(firstPayload.name).toBe('First')
    expect(secondPayload.name).toBe('Second')
  })

  it('coalesces multiple queued saves to the latest pending snapshot', async () => {
    let resolveFirst!: () => void
    const firstPromise = new Promise<void>((r) => { resolveFirst = r })
    mockGridDao.save.mockReturnValueOnce(firstPromise)
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const service = await getService()
    const p1 = service.queueSave(makeGrid({ name: 'First' }))
    const p2 = service.queueSave(makeGrid({ name: 'Second' }))
    const p3 = service.queueSave(makeGrid({ name: 'Third' }))

    expect(mockGridDao.save).toHaveBeenCalledTimes(1)

    resolveFirst()
    await p1
    await p2
    await p3

    expect(mockGridDao.save).toHaveBeenCalledTimes(2)
    const firstPayload = mockDbUtils.sanitizeValue.mock.calls[0][0] as Record<string, unknown>
    const secondPayload = mockDbUtils.sanitizeValue.mock.calls[1][0] as Record<string, unknown>
    expect(firstPayload.name).toBe('First')
    expect(secondPayload.name).toBe('Third')
  })

  it('substitutes blob URLs inside DOCUMENT tile items when a resolved map is given', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const tile = makeTile({
      i: 'doc-tile',
      content: {
        type: ContentType.DOCUMENT,
        items: [
          { id: 'item-1', url: 'blob:http://localhost/doc1' },
          { id: 'item-2', url: 'blob:http://localhost/doc2' },
          { id: 'item-3', url: 'https://cdn.example.com/already.pdf' },
        ],
      } as never,
    })
    const grid = makeGrid({ tiles: [tile] })

    const service = await getService()
    await service.queueSave(grid, {}, {
      'doc-tile': { 'item-1': 'https://storage.example.com/doc1.pdf' },
    })

    // Inspect what was handed to the persistence boundary (stripBlobSpy is a
    // pass-through, so the snapshot is what reaches buildGridPayload).
    const passedTiles = stripBlobSpy.mock.calls[0][0] as Array<{
      content: { items: Array<{ id: string; url: string }> }
    }>
    const items = passedTiles[0].content.items
    // item-1 had a resolved URL → swapped
    expect(items[0].url).toBe('https://storage.example.com/doc1.pdf')
    // item-2 is a blob with no resolved entry → left as-is for the strip safety net
    expect(items[1].url).toBe('blob:http://localhost/doc2')
    // item-3 was never a blob → untouched
    expect(items[2].url).toBe('https://cdn.example.com/already.pdf')
  })

  it('leaves a blob src untouched in the snapshot when no resolved URL exists', async () => {
    mockGridDao.save.mockResolvedValueOnce(undefined)

    const tile = makeTile({
      i: 'tile-1',
      content: { type: ContentType.IMAGE, src: 'blob:http://localhost/unresolved' } as never,
    })
    const grid = makeGrid({ tiles: [tile] })

    const service = await getService()
    // No matching entry in the resolved-URL map for tile-1.
    await service.queueSave(grid, { 'other-tile': 'https://x/y.jpg' })

    const passedTiles = stripBlobSpy.mock.calls[0][0] as Array<{
      content: { src: string }
    }>
    // createPersistableSnapshot leaves it as the blob; the strip util (its own
    // unit) is what neutralizes it downstream.
    expect(passedTiles[0].content.src).toBe('blob:http://localhost/unresolved')
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
