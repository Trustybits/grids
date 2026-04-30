/**
 * api/thumbnail.ts — Proxy for the Firebase generateThumbnail Cloud Function
 *
 * Mirrors api/og.ts: sits between callers and the Firebase function, applies
 * the same two-tier IP rate limit, and keeps the Firebase URL private.
 *
 * Query params forwarded to Firebase:
 *   ?slug=matt              desktop thumbnail of grids.so/matt
 *   ?gridId=abc123          desktop thumbnail of grids.so/grid/abc123
 *   ?breakpoint=desktop     1524 × 940 (default)
 *   ?breakpoint=tablet      1240 × 1784
 *   ?breakpoint=mobile      560  × 1212
 *   ?breakpoint=all         returns JSON { desktop, tablet, mobile } with Storage URLs
 *   ?refresh=1              bypass Storage cache and regenerate
 *
 * Usage:
 *   https://grids.so/api/thumbnail?slug=matt
 *   https://grids.so/api/thumbnail?slug=matt&breakpoint=all
 *   https://grids.so/api/thumbnail?slug=matt&refresh=1
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Config ────────────────────────────────────────────────────────────────────

const FIREBASE_THUMB_URL =
  'https://us-central1-grids-one.cloudfunctions.net/generateThumbnail'

const WINDOW_MS         = 60_000
const SOFT_LIMIT        = 10
const HARD_LIMIT        = 25
const BLOCK_DURATION_MS = 3_600_000
const TAR_PIT_MS        = 2_000

// ── In-memory rate limit store ────────────────────────────────────────────────

interface RateEntry {
  timestamps: number[]
  blocked: boolean
  blockUntil: number
}

export const store = new Map<string, RateEntry>()

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
  const now  = Date.now()
  let entry  = store.get(ip)

  if (!entry) {
    entry = { timestamps: [], blocked: false, blockUntil: 0 }
    store.set(ip, entry)
  }

  if (entry.blocked && entry.blockUntil > now) return 'block'

  if (entry.blocked) {
    entry.blocked    = false
    entry.timestamps = []
  }

  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS)
  entry.timestamps.push(now)

  if (entry.timestamps.length > HARD_LIMIT) {
    entry.blocked    = true
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
  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]
      ?.trim() ??
    req.socket?.remoteAddress ??
    'unknown'

  const decision = checkRateLimit(ip)

  if (decision === 'block') {
    await new Promise((r) => setTimeout(r, TAR_PIT_MS))
    res.setHeader('Retry-After', String(BLOCK_DURATION_MS / 1000))
    res.status(429).json({
      error: 'Too many requests — your IP has been blocked for 1 hour.',
    })
    return
  }

  if (decision === 'throttle') {
    res.setHeader('Retry-After', String(WINDOW_MS / 1000))
    res.status(429).json({
      error: 'Rate limit exceeded — please wait 60 seconds before retrying.',
    })
    return
  }

  // ── Proxy to Firebase thumbnail function ──────────────────────────────────
  const target   = new URL(FIREBASE_THUMB_URL)
  const incoming = new URL(req.url ?? '/', `https://${req.headers.host}`)
  incoming.searchParams.forEach((value, key) =>
    target.searchParams.set(key, value),
  )

  const isAll = incoming.searchParams.get('breakpoint') === 'all'

  try {
    const upstream = await fetch(target.toString(), {
      method: req.method ?? 'GET',
      headers: { 'x-forwarded-for': ip },
      // ?breakpoint=all returns JSON (Storage URLs), not a PNG redirect.
      // For single breakpoints Firebase redirects to Storage — follow it.
      redirect: isAll ? 'manual' : 'follow',
      signal: AbortSignal.timeout(115_000),
    })

    const contentType = upstream.headers.get('content-type') ?? ''

    if (isAll) {
      // Firebase returns JSON: { desktop: "https://...", tablet: "...", mobile: "..." }
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600')
      res.status(upstream.status).send(await upstream.text())
      return
    }

    if (contentType.includes('image/png')) {
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600')
      res.status(200).send(Buffer.from(await upstream.arrayBuffer()))
      return
    }

    // Error JSON — pass through without caching
    res.setHeader('Content-Type', contentType || 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.status(upstream.status).send(await upstream.text())
  } catch (err) {
    console.error('[thumbnail-proxy] upstream failed:', err)
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ error: 'Thumbnail service temporarily unavailable.' })
  }
}

// Thumbnail generation can take up to ~2 min for ?breakpoint=all (3 serial Chromium runs)
export const config = { maxDuration: 120 }
