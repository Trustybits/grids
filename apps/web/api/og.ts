/**
 * api/og.ts — Rate-limited proxy for the Firebase OG image generator
 *
 * Sits between social crawlers and the Firebase generateOgImage Cloud Function.
 * Enforces a two-tier IP-based rate limit before forwarding the request:
 *
 *   Soft limit  (>10 req / 60 s)  → 429, Retry-After: 60  — not blocked
 *   Hard limit  (>25 req / 60 s)  → 429, Retry-After: 3600 + 2 s tar-pit delay
 *                                    IP blocked for 1 hour
 *
 * Counters are kept in a module-level Map (per warm instance).  Multiple
 * concurrent Vercel instances each maintain their own counter, so the
 * effective threshold is multiplied by the number of active instances — this
 * is intentional: we're protecting against naive scripted abuse, not
 * coordinated DDoS (use Vercel Firewall / Cloud Armor for that).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Config ────────────────────────────────────────────────────────────────────

const FIREBASE_OG_URL =
  'https://us-central1-grids-one.cloudfunctions.net/generateOgImage'

const WINDOW_MS         = 60_000       // sliding window: 1 minute
const SOFT_LIMIT        = 10           // requests before throttling
const HARD_LIMIT        = 25           // requests before blocking
const BLOCK_DURATION_MS = 3_600_000    // block duration: 1 hour
const TAR_PIT_MS        = 2_000        // delay (ms) returned to blocked IPs

// ── In-memory rate limit store ────────────────────────────────────────────────

interface RateEntry {
  /** Request timestamps within the current window */
  timestamps: number[]
  blocked: boolean
  blockUntil: number
}

export const store = new Map<string, RateEntry>()

// Prune stale entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of store) {
    const windowExpired = entry.timestamps.every((t) => now - t > WINDOW_MS)
    const blockExpired  = entry.blockUntil < now
    if (windowExpired && blockExpired) store.delete(ip)
  }
}, 5 * 60_000)

type Decision = 'allow' | 'throttle' | 'block'

export function checkRateLimit(ip: string): Decision {
  const now   = Date.now()
  let entry   = store.get(ip)

  if (!entry) {
    entry = { timestamps: [], blocked: false, blockUntil: 0 }
    store.set(ip, entry)
  }

  // Still in an active block?
  if (entry.blocked && entry.blockUntil > now) return 'block'

  // Block has expired — reset
  if (entry.blocked) {
    entry.blocked    = false
    entry.timestamps = []
  }

  // Prune timestamps outside the sliding window
  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS)
  entry.timestamps.push(now)

  if (entry.timestamps.length > HARD_LIMIT) {
    entry.blocked   = true
    entry.blockUntil = now + BLOCK_DURATION_MS
    return 'block'
  }

  if (entry.timestamps.length > SOFT_LIMIT) return 'throttle'

  return 'allow'
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  // Public, rate-limited image endpoint — allow cross-origin calls so the
  // app's share-image modal works from any origin (including local dev).
  res.setHeader('Access-Control-Allow-Origin', '*')

  // Resolve caller IP — Vercel sets x-forwarded-for on all requests
  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]
      ?.trim() ??
    req.socket?.remoteAddress ??
    'unknown'

  const decision = checkRateLimit(ip)

  // ── Blocked — tar pit then reject ─────────────────────────────────────────
  if (decision === 'block') {
    await new Promise((r) => setTimeout(r, TAR_PIT_MS))
    res.setHeader('Retry-After', String(BLOCK_DURATION_MS / 1000))
    res.status(429).json({
      error: 'Too many requests — your IP has been blocked for 1 hour.',
    })
    return
  }

  // ── Soft throttle — reject immediately, no block ──────────────────────────
  if (decision === 'throttle') {
    res.setHeader('Retry-After', String(WINDOW_MS / 1000))
    res.status(429).json({
      error: 'Rate limit exceeded — please wait 60 seconds before retrying.',
    })
    return
  }

  // ── Proxy to Firebase OG function ─────────────────────────────────────────
  const isRefresh = req.query.refresh === '1'
  const target = new URL(FIREBASE_OG_URL)

  // Forward all query params (?slug=, ?gridId=, ?refresh=)
  const incoming = new URL(req.url ?? '/', `https://${req.headers.host}`)
  incoming.searchParams.forEach((value, key) =>
    target.searchParams.set(key, value),
  )

  try {
    const upstream = await fetch(target.toString(), {
      method: req.method ?? 'GET',
      headers: {
        // Let Firebase know the real caller IP (informational — not enforced)
        'x-forwarded-for': ip,
      },
      // Follow Storage redirect so we return the PNG directly
      redirect: 'follow',
      signal: AbortSignal.timeout(55_000),
    })

    const contentType = upstream.headers.get('content-type') ?? 'image/png'
    res.setHeader('Content-Type', contentType)

    if (contentType.includes('image/png')) {
      res.setHeader(
        'Cache-Control',
        isRefresh ? 'no-store' : 'public, max-age=86400, stale-while-revalidate=3600',
      )
      const buf = Buffer.from(await upstream.arrayBuffer())
      res.status(200).send(buf)
    } else {
      // Error JSON from Firebase — pass through without caching
      res.setHeader('Cache-Control', 'no-store')
      const text = await upstream.text()
      res.status(upstream.status).send(text)
    }
  } catch (err) {
    console.error('[og-proxy] upstream failed:', err)
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ error: 'OG image service temporarily unavailable.' })
  }
}

// Tell Vercel this function may take up to 60 s (Chromium is slow on cold start)
export const config = { maxDuration: 60 }
