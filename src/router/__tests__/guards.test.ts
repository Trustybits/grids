/**
 * Tests for router navigation guard logic (src/router/index.ts)
 *
 * The router guard is the first line of defence against unauthorized access.
 * We test the key decision branches:
 *  - Unauthenticated users are redirected to /login for protected routes
 *  - Authenticated users are redirected away from /login to /dashboard
 *  - Root path / redirects authenticated users to /dashboard
 *  - Users without a slug are redirected to /dashboard
 *  - Public routes (/:slug, /grid/:id) are always accessible
 *
 * The router itself isn't imported — we test the guard logic as a pure
 * function by extracting the core decision tree into a helper and verifying
 * its output, avoiding the need to spin up a full Vue app.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Types ──────────────────────────────────────────────────────────────────

interface MockRoute {
  path: string
  fullPath: string
  meta: { requiresAuth?: boolean }
  query: Record<string, string>
}

interface MockUser {
  uid: string
  email: string
}

type NextFn = (location?: string | { path: string; query?: Record<string, string> }) => void

// ── Guard logic extracted for unit testing ─────────────────────────────────
//
// Rather than importing the router (which triggers Firebase init), we replicate
// the guard's decision logic here. This pattern lets us test every branch in
// isolation and serves as living documentation of the expected auth behaviour.
// When you modify the actual router guard, update this too.

async function runGuard(
  to: MockRoute,
  user: MockUser | null,
  userSlug: string | null,
  next: NextFn
) {
  // Root path
  if (to.path === '/') {
    if (user) { next('/dashboard'); return }
    next(); return
  }

  // Already logged in trying to access /login
  if (to.path === '/login' && user) {
    const redirect = to.query.redirect
    next(redirect && redirect.length > 0 ? redirect : '/dashboard')
    return
  }

  // Protected route with no user
  if (to.meta.requiresAuth && !user) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  // Authenticated user on protected route without a slug → dashboard
  if (user && to.meta.requiresAuth && to.path !== '/login' && to.path !== '/dashboard') {
    if (!userSlug) {
      next('/dashboard')
      return
    }
  }

  next()
}

// ── Tests ──────────────────────────────────────────────────────────────────

const authedUser: MockUser = { uid: 'uid-123', email: 'user@example.com' }

function makeRoute(path: string, requiresAuth = false, query: Record<string, string> = {}): MockRoute {
  return { path, fullPath: path, meta: { requiresAuth }, query }
}

describe('Router auth guard', () => {
  let next: ReturnType<typeof vi.fn>

  beforeEach(() => {
    next = vi.fn()
  })

  // ── Root path ────────────────────────────────────────────────────────────

  describe('root path /', () => {
    it('redirects authenticated users to /dashboard', async () => {
      await runGuard(makeRoute('/'), authedUser, 'myslug', next)
      expect(next).toHaveBeenCalledWith('/dashboard')
    })

    it('allows unauthenticated users to see the homepage', async () => {
      await runGuard(makeRoute('/'), null, null, next)
      expect(next).toHaveBeenCalledWith() // next() with no args = allow
    })
  })

  // ── /login ───────────────────────────────────────────────────────────────

  describe('/login route', () => {
    it('redirects already-authenticated users to /dashboard', async () => {
      await runGuard(makeRoute('/login'), authedUser, 'myslug', next)
      expect(next).toHaveBeenCalledWith('/dashboard')
    })

    it('honours the ?redirect query param for authenticated users', async () => {
      const to = makeRoute('/login', false, { redirect: '/grid/some-grid-id' })
      await runGuard(to, authedUser, 'myslug', next)
      expect(next).toHaveBeenCalledWith('/grid/some-grid-id')
    })

    it('falls back to /dashboard when redirect param is empty string', async () => {
      const to = makeRoute('/login', false, { redirect: '' })
      await runGuard(to, authedUser, 'myslug', next)
      expect(next).toHaveBeenCalledWith('/dashboard')
    })

    it('allows unauthenticated access to /login', async () => {
      await runGuard(makeRoute('/login'), null, null, next)
      expect(next).toHaveBeenCalledWith()
    })
  })

  // ── Protected routes ──────────────────────────────────────────────────────

  describe('protected routes (requiresAuth: true)', () => {
    it('redirects unauthenticated users to /login with redirect param', async () => {
      const to = makeRoute('/dashboard', true)
      await runGuard(to, null, null, next)
      expect(next).toHaveBeenCalledWith({
        path: '/login',
        query: { redirect: '/dashboard' },
      })
    })

    it('allows authenticated users with a slug', async () => {
      const to = makeRoute('/grid/abc', true)
      await runGuard(to, authedUser, 'myslug', next)
      expect(next).toHaveBeenCalledWith()
    })

    it('redirects to /dashboard when authenticated user has no slug', async () => {
      const to = makeRoute('/grid/abc', true)
      await runGuard(to, authedUser, null, next) // null slug
      expect(next).toHaveBeenCalledWith('/dashboard')
    })

    it('allows authenticated users without a slug to access /dashboard itself', async () => {
      const to = makeRoute('/dashboard', true)
      await runGuard(to, authedUser, null, next)
      // /dashboard is excluded from slug check — user should be allowed through
      expect(next).toHaveBeenCalledWith()
    })
  })

  // ── Public routes ─────────────────────────────────────────────────────────

  describe('public routes (requiresAuth: false)', () => {
    it.each([
      '/privacy',
      '/terms',
      '/notion-callback',
      '/someusersslug',
      '/grid/some-grid-id',
    ])('allows unauthenticated access to %s', async (path) => {
      await runGuard(makeRoute(path, false), null, null, next)
      expect(next).toHaveBeenCalledWith()
    })

    it.each([
      '/privacy',
      '/terms',
      '/someusersslug',
    ])('allows authenticated access to public route %s', async (path) => {
      await runGuard(makeRoute(path, false), authedUser, 'myslug', next)
      expect(next).toHaveBeenCalledWith()
    })
  })
})
