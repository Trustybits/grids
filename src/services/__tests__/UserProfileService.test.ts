/**
 * Tests for UserProfileService.ts
 *
 * All Firestore and Firebase Functions calls are mocked via src/test/setup.ts.
 * Tests verify the service's behavior under success, not-found, and error conditions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as firestore from 'firebase/firestore'
import * as functions from 'firebase/functions'
import {
  getUserProfile,
  getUserIdBySlug,
  checkSlugAvailability,
  claimSlug,
  setDefaultGrid,
  updateUserProfile,
} from '@/services/UserProfileService'
import type { UserProfile } from '@/types/UserProfile'

// ── Helpers ────────────────────────────────────────────────────────────────

function mockDocSnap(exists: boolean, data?: Record<string, any>) {
  return {
    exists: () => exists,
    data: () => data ?? {},
  }
}

// ── getUserProfile ─────────────────────────────────────────────────────────

describe('getUserProfile', () => {
  it('returns the user profile when the document exists', async () => {
    const profile: UserProfile = {
      email: 'test@example.com',
      slug: 'testuser',
      defaultGridId: 'grid-123',
      storageUsed: 0,
    }
    vi.mocked(firestore.getDoc).mockResolvedValueOnce(mockDocSnap(true, profile) as any)

    const result = await getUserProfile('uid-abc')

    expect(result).toEqual(profile)
    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'users', 'uid-abc')
  })

  it('returns null when no document exists for the user', async () => {
    vi.mocked(firestore.getDoc).mockResolvedValueOnce(mockDocSnap(false) as any)

    const result = await getUserProfile('uid-unknown')

    expect(result).toBeNull()
  })

  it('throws when Firestore throws an error', async () => {
    vi.mocked(firestore.getDoc).mockRejectedValueOnce(new Error('Firestore unavailable'))

    await expect(getUserProfile('uid-abc')).rejects.toThrow('Firestore unavailable')
  })
})

// ── getUserIdBySlug ────────────────────────────────────────────────────────

describe('getUserIdBySlug', () => {
  it('returns userId when slug exists', async () => {
    vi.mocked(firestore.getDoc).mockResolvedValueOnce(
      mockDocSnap(true, { userId: 'uid-xyz' }) as any
    )

    const result = await getUserIdBySlug('testuser')

    expect(result).toBe('uid-xyz')
    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'slugs', 'testuser')
  })

  it('normalizes slug to lowercase before querying', async () => {
    vi.mocked(firestore.getDoc).mockResolvedValueOnce(
      mockDocSnap(true, { userId: 'uid-xyz' }) as any
    )

    await getUserIdBySlug('TestUser')

    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'slugs', 'testuser')
  })

  it('returns null when slug document does not exist', async () => {
    vi.mocked(firestore.getDoc).mockResolvedValueOnce(mockDocSnap(false) as any)

    const result = await getUserIdBySlug('nonexistent')

    expect(result).toBeNull()
  })

  it('returns null when slug document has no userId field', async () => {
    vi.mocked(firestore.getDoc).mockResolvedValueOnce(
      mockDocSnap(true, {}) as any // exists but no userId
    )

    const result = await getUserIdBySlug('someSlug')

    expect(result).toBeNull()
  })

  it('throws when Firestore throws an error', async () => {
    vi.mocked(firestore.getDoc).mockRejectedValueOnce(new Error('Network error'))

    await expect(getUserIdBySlug('testuser')).rejects.toThrow()
  })
})

// ── checkSlugAvailability ──────────────────────────────────────────────────

describe('checkSlugAvailability', () => {
  it('returns available response from Cloud Function', async () => {
    const mockResponse = { available: true, reason: 'available', message: 'Slug is available' }
    const mockCallable = vi.fn().mockResolvedValueOnce({ data: mockResponse })
    vi.mocked(functions.httpsCallable).mockReturnValueOnce(mockCallable)

    const result = await checkSlugAvailability('newslug')

    expect(result.available).toBe(true)
    expect(result.reason).toBe('available')
    expect(mockCallable).toHaveBeenCalledWith({ slug: 'newslug' })
  })

  it('returns taken response from Cloud Function', async () => {
    const mockResponse = { available: false, reason: 'taken', message: 'Already taken' }
    const mockCallable = vi.fn().mockResolvedValueOnce({ data: mockResponse })
    vi.mocked(functions.httpsCallable).mockReturnValueOnce(mockCallable)

    const result = await checkSlugAvailability('takenslug')

    expect(result.available).toBe(false)
    expect(result.reason).toBe('taken')
  })

  it('returns reserved response for protected slugs', async () => {
    const mockResponse = { available: false, reason: 'reserved', message: 'This slug is reserved' }
    const mockCallable = vi.fn().mockResolvedValueOnce({ data: mockResponse })
    vi.mocked(functions.httpsCallable).mockReturnValueOnce(mockCallable)

    const result = await checkSlugAvailability('admin')

    expect(result.available).toBe(false)
    expect(result.reason).toBe('reserved')
  })

  it('throws with a user-friendly message when Cloud Function fails', async () => {
    const mockCallable = vi.fn().mockRejectedValueOnce({ message: 'Functions error' })
    vi.mocked(functions.httpsCallable).mockReturnValueOnce(mockCallable)

    await expect(checkSlugAvailability('slug')).rejects.toThrow('Functions error')
  })
})

// ── claimSlug ─────────────────────────────────────────────────────────────

describe('claimSlug', () => {
  it('returns success response from Cloud Function', async () => {
    const mockResponse = { success: true, message: 'Slug claimed successfully' }
    const mockCallable = vi.fn().mockResolvedValueOnce({ data: mockResponse })
    vi.mocked(functions.httpsCallable).mockReturnValueOnce(mockCallable)

    const result = await claimSlug('myslug')

    expect(result.success).toBe(true)
    expect(mockCallable).toHaveBeenCalledWith({ slug: 'myslug' })
  })

  it('throws with error message when claim fails', async () => {
    const mockCallable = vi.fn().mockRejectedValueOnce({ message: 'Slug already taken' })
    vi.mocked(functions.httpsCallable).mockReturnValueOnce(mockCallable)

    await expect(claimSlug('takenslug')).rejects.toThrow('Slug already taken')
  })
})

// ── setDefaultGrid ─────────────────────────────────────────────────────────

describe('setDefaultGrid', () => {
  it('calls Cloud Function with gridId', async () => {
    const mockCallable = vi.fn().mockResolvedValueOnce({ data: { success: true } })
    vi.mocked(functions.httpsCallable).mockReturnValueOnce(mockCallable)

    await setDefaultGrid('uid-abc', 'grid-123')

    expect(mockCallable).toHaveBeenCalledWith({ gridId: 'grid-123' })
  })

  it('accepts null to clear the default grid', async () => {
    const mockCallable = vi.fn().mockResolvedValueOnce({ data: { success: true } })
    vi.mocked(functions.httpsCallable).mockReturnValueOnce(mockCallable)

    await setDefaultGrid('uid-abc', null)

    expect(mockCallable).toHaveBeenCalledWith({ gridId: null })
  })

  it('throws when Cloud Function call fails', async () => {
    const mockCallable = vi.fn().mockRejectedValueOnce(new Error('Unauthorized'))
    vi.mocked(functions.httpsCallable).mockReturnValueOnce(mockCallable)

    await expect(setDefaultGrid('uid-abc', 'grid-123')).rejects.toThrow()
  })
})

// ── updateUserProfile ──────────────────────────────────────────────────────

describe('updateUserProfile', () => {
  it('calls setDoc with merge: true for partial updates', async () => {
    vi.mocked(firestore.doc).mockReturnValueOnce("dummy-ref")
    vi.mocked(firestore.setDoc).mockResolvedValueOnce(undefined)

    await updateUserProfile('uid-abc', { email: 'new@example.com' })

    expect(firestore.setDoc).toHaveBeenCalledWith(
      "dummy-ref",
      { email: 'new@example.com' },
      { merge: true }
    )
  })

  it('throws when Firestore write fails', async () => {
    vi.mocked(firestore.setDoc).mockRejectedValueOnce(new Error('Permission denied'))

    await expect(
      updateUserProfile('uid-abc', { email: 'new@example.com' })
    ).rejects.toThrow('Permission denied')
  })
})
