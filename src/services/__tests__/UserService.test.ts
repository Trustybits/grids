import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerDaoFactory } from '@/dao/DaoFactorySingleton'
import { registerDbUtils } from '@/dao/DbUtilsSingleton'
import { UserService } from '@/services/UserService'
import type { UserDao } from '@/dao/interfaces/UserDao'
import type { SlugDao } from '@/dao/interfaces/SlugDao'
import type { DbUtils } from '@/dao/interfaces/DbUtils'
import type { DaoFactory } from '@/dao/interfaces/factory/DaoFactory'
import type { UserProfile } from '@/types/UserProfile'

// ── Mock DAOs ─────────────────────────────────────────────────────────────

let mockUserDao: Record<string, ReturnType<typeof vi.fn>>
let mockSlugDao: Record<string, ReturnType<typeof vi.fn>>
let mockDbUtils: Record<string, ReturnType<typeof vi.fn>>

beforeEach(() => {
  mockUserDao = {
    getById: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    subscribe: vi.fn(),
  }

  mockSlugDao = {
    getBySlug: vi.fn(),
    checkAvailability: vi.fn(),
    claim: vi.fn(),
    updateDefaultGrid: vi.fn(),
  }

  mockDbUtils = {
    sanitizeValue: vi.fn((v) => v),
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  }

  registerDaoFactory({
    getUserDao: () => mockUserDao as unknown as UserDao,
    getSlugDao: () => mockSlugDao as unknown as SlugDao,
    getLayoutDao: () => null,
    getUserGameDataDao: () => null,
    getChatDao: () => null,
    getUpvoteDao: () => null,
    getCustomerDao: () => null,
    getStorageDao: () => null,
  } as unknown as DaoFactory)

  registerDbUtils(mockDbUtils as unknown as DbUtils)
})

// ── getUserProfile ────────────────────────────────────────────────────────

describe('getUserProfile', () => {
  it('returns the user profile when the document exists', async () => {
    const profile: UserProfile = {
      email: 'test@example.com',
      slug: 'testuser',
      defaultGridId: 'grid-123',
      storageUsed: 0,
    }
    mockUserDao.getById.mockResolvedValueOnce(profile)

    const service = new UserService()
    const result = await service.getUserProfile('uid-abc')

    expect(result).toEqual(profile)
    expect(mockUserDao.getById).toHaveBeenCalledWith('uid-abc')
  })

  it('returns null when no document exists for the user', async () => {
    mockUserDao.getById.mockResolvedValueOnce(null)

    const service = new UserService()
    const result = await service.getUserProfile('uid-unknown')

    expect(result).toBeNull()
  })

  it('throws when the DAO throws an error', async () => {
    mockUserDao.getById.mockRejectedValueOnce(new Error('Firestore unavailable'))

    const service = new UserService()
    await expect(service.getUserProfile('uid-abc')).rejects.toThrow('Firestore unavailable')
  })
})

// ── updateUserProfile ─────────────────────────────────────────────────────

describe('updateUserProfile', () => {
  it('calls userDao.save with the partial data', async () => {
    mockUserDao.save.mockResolvedValueOnce(undefined)

    const service = new UserService()
    await service.updateUserProfile('uid-abc', { email: 'new@example.com' })

    expect(mockUserDao.save).toHaveBeenCalledWith('uid-abc', { email: 'new@example.com' })
  })

  it('throws when the DAO write fails', async () => {
    mockUserDao.save.mockRejectedValueOnce(new Error('Permission denied'))

    const service = new UserService()
    await expect(
      service.updateUserProfile('uid-abc', { email: 'new@example.com' })
    ).rejects.toThrow('Permission denied')
  })
})

// ── recordLogin ───────────────────────────────────────────────────────────

describe('recordLogin', () => {
  it('saves email and server timestamp', async () => {
    mockUserDao.save.mockResolvedValueOnce(undefined)

    const service = new UserService()
    await service.recordLogin('uid-abc', 'test@example.com')

    expect(mockUserDao.save).toHaveBeenCalledWith('uid-abc', {
      email: 'test@example.com',
      lastLogin: 'SERVER_TIMESTAMP',
    })
  })
})

// ── grantSupporterBadge ──────────────────────────────────────────────────

describe('grantSupporterBadge', () => {
  it('updates hasSupporterBadge to true', async () => {
    mockUserDao.update.mockResolvedValueOnce(undefined)

    const service = new UserService()
    await service.grantSupporterBadge('uid-abc')

    expect(mockUserDao.update).toHaveBeenCalledWith('uid-abc', { hasSupporterBadge: true })
  })
})

// ── getUserIdBySlug ───────────────────────────────────────────────────────

describe('getUserIdBySlug', () => {
  it('returns userId when slug exists', async () => {
    mockSlugDao.getBySlug.mockResolvedValueOnce({ userId: 'uid-xyz' })

    const service = new UserService()
    const result = await service.getUserIdBySlug('testuser')

    expect(result).toBe('uid-xyz')
  })

  it('returns null when slug document does not exist', async () => {
    mockSlugDao.getBySlug.mockResolvedValueOnce(null)

    const service = new UserService()
    const result = await service.getUserIdBySlug('nonexistent')

    expect(result).toBeNull()
  })

  it('returns null when slug document has no userId field', async () => {
    mockSlugDao.getBySlug.mockResolvedValueOnce({})

    const service = new UserService()
    const result = await service.getUserIdBySlug('someSlug')

    expect(result).toBeNull()
  })

  it('throws when the DAO throws an error', async () => {
    mockSlugDao.getBySlug.mockRejectedValueOnce(new Error('Network error'))

    const service = new UserService()
    await expect(service.getUserIdBySlug('testuser')).rejects.toThrow()
  })
})

// ── getSlugData ───────────────────────────────────────────────────────────

describe('getSlugData', () => {
  it('returns full slug data when document exists', async () => {
    mockSlugDao.getBySlug.mockResolvedValueOnce({ userId: 'uid-xyz', defaultGridId: 'grid-1' })

    const service = new UserService()
    const result = await service.getSlugData('testuser')

    expect(result).toEqual({ userId: 'uid-xyz', defaultGridId: 'grid-1' })
  })

  it('returns null when slug does not exist', async () => {
    mockSlugDao.getBySlug.mockResolvedValueOnce(null)

    const service = new UserService()
    const result = await service.getSlugData('nonexistent')

    expect(result).toBeNull()
  })

  it('returns null when userId is not a string', async () => {
    mockSlugDao.getBySlug.mockResolvedValueOnce({ userId: 123 })

    const service = new UserService()
    const result = await service.getSlugData('baddata')

    expect(result).toBeNull()
  })
})

// ── checkSlugAvailability ─────────────────────────────────────────────────

describe('checkSlugAvailability', () => {
  it('returns available response', async () => {
    const response = { available: true, reason: 'available' as const, message: 'Slug is available' }
    mockSlugDao.checkAvailability.mockResolvedValueOnce(response)

    const service = new UserService()
    const result = await service.checkSlugAvailability('newslug')

    expect(result.available).toBe(true)
    expect(result.reason).toBe('available')
    expect(mockSlugDao.checkAvailability).toHaveBeenCalledWith('newslug')
  })

  it('returns taken response', async () => {
    const response = { available: false, reason: 'taken' as const, message: 'Already taken' }
    mockSlugDao.checkAvailability.mockResolvedValueOnce(response)

    const service = new UserService()
    const result = await service.checkSlugAvailability('takenslug')

    expect(result.available).toBe(false)
    expect(result.reason).toBe('taken')
  })

  it('returns reserved response for protected slugs', async () => {
    const response = { available: false, reason: 'reserved' as const, message: 'This slug is reserved' }
    mockSlugDao.checkAvailability.mockResolvedValueOnce(response)

    const service = new UserService()
    const result = await service.checkSlugAvailability('admin')

    expect(result.available).toBe(false)
    expect(result.reason).toBe('reserved')
  })

  it('throws with a user-friendly message when the DAO fails', async () => {
    mockSlugDao.checkAvailability.mockRejectedValueOnce(new Error('Functions error'))

    const service = new UserService()
    await expect(service.checkSlugAvailability('slug')).rejects.toThrow('Functions error')
  })
})

// ── claimSlug ────────────────────────────────────────────────────────────

describe('claimSlug', () => {
  it('returns success response', async () => {
    const response = { success: true, message: 'Slug claimed successfully' }
    mockSlugDao.claim.mockResolvedValueOnce(response)

    const service = new UserService()
    const result = await service.claimSlug('myslug')

    expect(result.success).toBe(true)
    expect(mockSlugDao.claim).toHaveBeenCalledWith('myslug')
  })

  it('throws with error message when claim fails', async () => {
    mockSlugDao.claim.mockRejectedValueOnce(new Error('Slug already taken'))

    const service = new UserService()
    await expect(service.claimSlug('takenslug')).rejects.toThrow('Slug already taken')
  })
})

// ── setDefaultGrid ────────────────────────────────────────────────────────

describe('setDefaultGrid', () => {
  it('calls slugDao.updateDefaultGrid with gridId', async () => {
    mockSlugDao.updateDefaultGrid.mockResolvedValueOnce({ success: true })

    const service = new UserService()
    await service.setDefaultGrid('uid-abc', 'grid-123')

    expect(mockSlugDao.updateDefaultGrid).toHaveBeenCalledWith('grid-123')
  })

  it('accepts null to clear the default grid', async () => {
    mockSlugDao.updateDefaultGrid.mockResolvedValueOnce({ success: true })

    const service = new UserService()
    await service.setDefaultGrid('uid-abc', null)

    expect(mockSlugDao.updateDefaultGrid).toHaveBeenCalledWith(null)
  })

  it('throws when the DAO call fails', async () => {
    mockSlugDao.updateDefaultGrid.mockRejectedValueOnce(new Error('Unauthorized'))

    const service = new UserService()
    await expect(service.setDefaultGrid('uid-abc', 'grid-123')).rejects.toThrow()
  })
})

// ── subscribeToUserProfile ────────────────────────────────────────────────

describe('subscribeToUserProfile', () => {
  it('delegates to userDao.subscribe and forwards profile data', () => {
    const profile = { email: 'test@example.com', slug: 'testuser' }
    const unsubFn = vi.fn()

    mockUserDao.subscribe.mockImplementation((_id: string, cb: Function) => {
      cb(profile)
      return unsubFn
    })

    const callback = vi.fn()
    const service = new UserService()
    const unsub = service.subscribeToUserProfile('uid-abc', callback)

    expect(mockUserDao.subscribe).toHaveBeenCalledWith('uid-abc', expect.any(Function))
    expect(callback).toHaveBeenCalledWith(profile)
    expect(unsub).toBe(unsubFn)
  })

  it('forwards null when the document does not exist', () => {
    mockUserDao.subscribe.mockImplementation((_id: string, cb: Function) => {
      cb(null)
      return vi.fn()
    })

    const callback = vi.fn()
    const service = new UserService()
    service.subscribeToUserProfile('uid-abc', callback)

    expect(callback).toHaveBeenCalledWith(null)
  })
})
