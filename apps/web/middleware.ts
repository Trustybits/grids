/**
 * Vercel Edge Middleware — Dynamic OG Meta Tag Injection
 *
 * Intercepts requests from social/search crawlers and injects the correct
 * Open Graph + Twitter Card meta tags into the HTML before it's served.
 * Regular browsers pass through untouched — zero added latency.
 *
 * og:image points at the Firebase Cloud Function (generateOgImage) which takes
 * a Puppeteer screenshot of the actual grid page and composites a gradient +
 * avatar + handle overlay, caching the result in Firebase Storage.
 *
 * Routes handled:
 *   /:slug      → verifies slug exists, points og:image at generateOgImage?slug=
 *   /grid/:id   → fetches grid name, points og:image at generateOgImage?gridId=
 *   static pages (/, /pricing, etc.) → injects hardcoded meta tags
 * Trustybits©2026
 */

const FIREBASE_PROJECT_ID = 'grids-one'
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`
const SITE_ORIGIN = 'https://grids.so'

// OG images are served through the Vercel proxy (api/og.ts) which applies
// rate limiting before forwarding to the Firebase generateOgImage function.
// Pointing crawlers at a grids.so URL also keeps the Firebase URL private.
const OG_FUNCTION_URL = `${SITE_ORIGIN}/api/og`

// Paths that are definitely NOT user slugs
const RESERVED_PATHS = new Set([
  'login',
  'signup',
  'dashboard',
  'pricing',
  'showcase',
  'templates',
  'privacy',
  'terms',
  'notion-callback',
  'api',
])

// Social/search crawlers that need server-rendered meta tags
const CRAWLER_PATTERNS = [
  'facebookexternalhit',
  'facebot',
  'twitterbot',
  'linkedinbot',
  'slackbot',
  'whatsapp',
  'telegrambot',
  'discordbot',
  'pinterest',
  'googlebot',
  'bingbot',
  'applebot',
  'redditbot',
  'iframely',
  'embedly',
  'meta-externalagent',
]

function isCrawler(ua: string): boolean {
  const lower = ua.toLowerCase()
  return CRAWLER_PATTERNS.some((p) => lower.includes(p))
}

function firestoreStr(
  doc: Record<string, unknown>,
  field: string,
): string | null {
  const fields = doc.fields as Record<string, { stringValue?: string }> | undefined
  return fields?.[field]?.stringValue ?? null
}

function firestoreTimestampSeconds(
  doc: Record<string, unknown>,
  field: string,
): number | null {
  const fields = doc.fields as Record<string, { timestampValue?: string }> | undefined
  const ts = fields?.[field]?.timestampValue
  if (!ts) return null
  const ms = new Date(ts).getTime()
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null
}

// Recursively convert a Firestore REST API typed value into a plain JS value.
// Handles string, boolean, integer, double, null, array, and map types.
function parseFsValue(v: unknown): unknown {
  if (!v || typeof v !== 'object') return null
  const f = v as Record<string, unknown>
  if ('stringValue'  in f) return f.stringValue
  if ('booleanValue' in f) return f.booleanValue
  if ('integerValue' in f) return Number(f.integerValue)
  if ('doubleValue'  in f) return f.doubleValue
  if ('nullValue'    in f) return null
  if ('arrayValue'   in f) {
    const av = f.arrayValue as { values?: unknown[] }
    return (av.values ?? []).map(parseFsValue)
  }
  if ('mapValue' in f) {
    const mv = f.mapValue as { fields?: Record<string, unknown> }
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(mv.fields ?? {})) out[k] = parseFsValue(val)
    return out
  }
  return null
}

// Extract plain text from a TipTap/ProseMirror doc — mirrors extractTiptapText
// in ogImage.ts without any Firebase dependency.
function extractText(raw: unknown): string {
  if (typeof raw === 'string') {
    try { return extractText(JSON.parse(raw)) } catch { return raw.trim() }
  }
  if (!raw || typeof raw !== 'object') return ''
  const n = raw as Record<string, unknown>
  if (typeof n.text === 'string') return n.text
  return ((n.content as unknown[]) ?? []).map(extractText).join('').trim()
}

async function fetchFirestoreDoc(
  collection: string,
  id: string,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `${FIRESTORE_BASE}/${collection}/${encodeURIComponent(id)}`,
      { headers: { Accept: 'application/json' } },
    )
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

interface OgData {
  title: string
  description: string
  /** Absolute URL of the og:image — points to the Firebase generateOgImage function */
  ogImageUrl: string
  canonicalUrl: string
}

async function resolveOgData(pathname: string): Promise<OgData> {
  const defaultOg: OgData = {
    title: 'Grids — Your personal grid',
    description: 'Create and share your personal grid of links, tools, and more.',
    ogImageUrl: `${OG_FUNCTION_URL}?slug=grids`,
    canonicalUrl: `${SITE_ORIGIN}${pathname}`,
  }

  // ── /grid/:id ──────────────────────────────────────────────────────────────
  const gridMatch = pathname.match(/^\/grid\/([^/]+)$/)
  if (gridMatch) {
    const gridId = gridMatch[1]
    const doc = await fetchFirestoreDoc('grids', gridId)
    const name = doc ? (firestoreStr(doc, 'name') ?? 'Untitled Grid') : 'Untitled Grid'
    const v = doc ? firestoreTimestampSeconds(doc, 'updatedAt') : null
    const vParam = v ? `&v=${v}` : ''

    return {
      title: `${name} — Grids`,
      description: 'View this grid on Grids.',
      ogImageUrl: `${OG_FUNCTION_URL}?gridId=${encodeURIComponent(gridId)}${vParam}`,
      canonicalUrl: `${SITE_ORIGIN}${pathname}`,
    }
  }

  // ── /:slug (user profile) ──────────────────────────────────────────────────
  const slugMatch = pathname.match(/^\/([^/]+)$/)
  if (slugMatch) {
    const slug = slugMatch[1]
    if (RESERVED_PATHS.has(slug)) return defaultOg

    // Verify the slug exists and is active
    const slugDoc = await fetchFirestoreDoc('slugs', slug.toLowerCase())
    const userId = slugDoc ? firestoreStr(slugDoc, 'userId') : null
    if (!userId) return defaultOg

    // Fetch profile data: defaultGridId → grid document → profile tile
    const defaultGridId = slugDoc ? firestoreStr(slugDoc, 'defaultGridId') : null
    let ogTitle = `@${slug} — Grids`
    let ogDescription = `Check out @${slug}'s grid on Grids.`

    let v: number | null = null

    if (defaultGridId) {
      const gridDoc = await fetchFirestoreDoc('grids', defaultGridId)
      if (gridDoc) {
        v = firestoreTimestampSeconds(gridDoc, 'updatedAt')

        const fields = gridDoc.fields as Record<string, unknown> | undefined
        const tilesRaw = fields?.tiles
        const tiles = parseFsValue(tilesRaw) as Array<Record<string, unknown>> | null

        const profileTile = (tiles ?? []).find((t) => {
          const content = (t as Record<string, unknown>)?.content as Record<string, unknown>
          return content?.type === 'profile'
        })
        const content = (profileTile as Record<string, unknown> | undefined)
          ?.content as Record<string, unknown> | undefined

        if (content) {
          const displayName = extractText(content.name) || `@${slug}`
          const role        = extractText(content.title)
          const bio         = extractText(content.bio)

          ogTitle       = role
            ? `${displayName}  |  ${role}`
            : `${displayName} — Grids`
          ogDescription = bio || `Check out @${slug}'s grid on Grids.`
        }
      }
    }

    const vParam = v ? `&v=${v}` : ''

    return {
      title: ogTitle,
      description: ogDescription,
      ogImageUrl: `${OG_FUNCTION_URL}?slug=${encodeURIComponent(slug)}${vParam}`,
      canonicalUrl: `${SITE_ORIGIN}${pathname}`,
    }
  }

  // ── Static pages ───────────────────────────────────────────────────────────
  const staticMeta: Record<string, Partial<OgData>> = {
    '/': {
      title: 'Grids — Your personal grid',
      description: 'Create and share your personal grid of links, tools, and more.',
    },
    '/pricing': {
      title: 'Pricing — Grids',
      description: 'Simple, transparent pricing for Grids.',
    },
    '/showcase': {
      title: 'Showcase — Grids',
      description: 'See what people are building with Grids.',
    },
    '/templates': {
      title: 'Templates — Grids',
      description: 'Start with a grid that already works.',
    },
    '/privacy': {
      title: 'Privacy Policy — Grids',
      description: 'How we handle your data on Grids.',
    },
    '/terms': {
      title: 'Terms of Service — Grids',
      description: 'Terms and conditions for using Grids.',
    },
  }

  const staticEntry = staticMeta[pathname]
  if (staticEntry) {
    return { ...defaultOg, ...staticEntry, canonicalUrl: `${SITE_ORIGIN}${pathname}` }
  }

  return defaultOg
}

function buildMetaTags(og: OgData): string {
  const esc = (s: string) => s.replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const t = esc(og.title)
  const d = esc(og.description)
  const img = esc(og.ogImageUrl)
  const url = esc(og.canonicalUrl)

  return `
    <!-- Open Graph -->
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Grids" />
    <!-- Twitter / X Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />
    <!-- Standard -->
    <meta name="description" content="${d}" />`
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  // Skip re-entrant requests (from our own fetch() below) to prevent loops
  if (request.headers.get('x-og-passthrough') === '1') {
    return undefined
  }

  const ua = request.headers.get('user-agent') || ''

  // Regular users get the normal SPA — no overhead
  if (!isCrawler(ua)) {
    return undefined
  }

  const { pathname } = new URL(request.url)

  // Never intercept API routes or static assets
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_vercel/') ||
    /\.\w{2,6}$/.test(pathname)
  ) {
    return undefined
  }

  const og = await resolveOgData(pathname)
  const metaTags = buildMetaTags(og)

  // Fetch the SPA's index.html from Vercel's static file server.
  // The x-og-passthrough header causes this middleware to skip the re-entrant
  // request so the static file is served normally and we get the raw HTML.
  const passThroughReq = new Request(request.url, {
    headers: {
      ...Object.fromEntries(request.headers.entries()),
      'x-og-passthrough': '1',
    },
  })

  const htmlRes = await fetch(passThroughReq)
  const html = await htmlRes.text()

  // Strip the static fallback OG/Twitter/description meta tags shipped in
  // index.html. Otherwise crawlers (Discord, iMessage, …) end up with TWO
  // og:image tags — the dynamic one we inject *and* the static fallback —
  // and many platforms render both as a carousel instead of picking the
  // first. We keep the static tags in index.html itself so non-crawler
  // services that bypass this middleware (FigJam, getLinkPreview, regular
  // browsers) still get a sensible default.
  const STATIC_META_RE =
    /\s*<meta\b[^>]*?\b(?:property=["']og:[^"']*["']|name=["'](?:twitter:[^"']*|description)["'])[^>]*?>/gi
  const stripped = html.replace(STATIC_META_RE, '')

  // Inject meta tags immediately after <head> so the only og:/twitter: tags
  // the crawler sees are the personalized ones we just rendered.
  const injected = stripped.replace('<head>', `<head>${metaTags}`)

  return new Response(injected, {
    status: htmlRes.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    },
  })
}

export const config = {
  matcher: ['/((?!_vercel|.*\\..*).*)'],
}
