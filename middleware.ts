/**
 * Vercel Edge Middleware — Dynamic OG Meta Tag Injection
 *
 * Intercepts requests from social/search crawlers and injects the correct
 * Open Graph + Twitter Card meta tags into the HTML before it's served.
 * Regular browsers pass through untouched (zero added latency).
 *
 * Routes handled:
 *   /grid/:id   → fetches layout name from Firestore
 *   /:slug      → fetches user profile from Firestore
 *   static pages (/, /pricing, etc.) → injects default meta tags
 */

const FIREBASE_PROJECT_ID = 'grids-one'
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`

// Paths that are definitely NOT user slugs
const RESERVED_PATHS = new Set([
  'login',
  'signup',
  'dashboard',
  'pricing',
  'privacy',
  'terms',
  'notion-callback',
  'api',
])

// Social/search crawlers that need pre-rendered meta tags
const CRAWLER_UA_PATTERNS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'LinkedInBot',
  'Slackbot',
  'WhatsApp',
  'TelegramBot',
  'Discordbot',
  'Pinterest',
  'Googlebot',
  'bingbot',
  'Applebot',
  'redditbot',
  'Iframely',
  'embedly',
  'meta-externalagent',
]

function isCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase()
  return CRAWLER_UA_PATTERNS.some((p) => ua.includes(p.toLowerCase()))
}

// Parses a Firestore REST API string field value
function firestoreStr(
  doc: Record<string, unknown>,
  field: string,
): string | null {
  const fields = doc.fields as Record<string, { stringValue?: string }> | undefined
  return fields?.[field]?.stringValue ?? null
}

async function fetchFirestoreDoc(
  collection: string,
  id: string,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${FIRESTORE_BASE}/${collection}/${id}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

interface OgData {
  title: string
  description: string
  ogImageUrl: string
  canonicalUrl: string
}

async function resolveOgData(
  pathname: string,
  requestUrl: string,
): Promise<OgData> {
  const origin = new URL(requestUrl).origin
  const defaultOg: OgData = {
    title: 'Grids — Your personal grid',
    description: 'Create and share your personal grid of links, tools, and more.',
    ogImageUrl: `${origin}/api/og?title=Your+personal+grid`,
    canonicalUrl: `${origin}${pathname}`,
  }

  // ── /grid/:id ──────────────────────────────────────────────────────────
  const gridMatch = pathname.match(/^\/grid\/([^/]+)$/)
  if (gridMatch) {
    const layoutId = gridMatch[1]
    const doc = await fetchFirestoreDoc('layouts', layoutId)
    if (!doc) return defaultOg

    const name = firestoreStr(doc, 'name') || 'Untitled Grid'
    const encodedTitle = encodeURIComponent(name)

    return {
      title: `${name} — Grids`,
      description: 'View this grid on Grids.',
      ogImageUrl: `${origin}/api/og?title=${encodedTitle}`,
      canonicalUrl: `${origin}${pathname}`,
    }
  }

  // ── /:slug (user profile) ──────────────────────────────────────────────
  const slugMatch = pathname.match(/^\/([^/]+)$/)
  if (slugMatch) {
    const slug = slugMatch[1]
    if (RESERVED_PATHS.has(slug)) return defaultOg

    // Resolve slug → userId
    const slugDoc = await fetchFirestoreDoc('slugs', slug.toLowerCase())
    const userId = slugDoc ? firestoreStr(slugDoc, 'userId') : null
    if (!userId) return defaultOg

    // Fetch public profile for display name / photo
    const profileDoc = await fetchFirestoreDoc('publicProfiles', userId)
    const displayName =
      (profileDoc ? firestoreStr(profileDoc, 'displayName') : null) || slug

    const encodedTitle = encodeURIComponent(`${displayName}'s grid`)
    const encodedUsername = encodeURIComponent(slug)

    return {
      title: `@${slug}'s grid — Grids`,
      description: `Check out ${displayName}'s grid on Grids.`,
      ogImageUrl: `${origin}/api/og?title=${encodedTitle}&username=${encodedUsername}`,
      canonicalUrl: `${origin}${pathname}`,
    }
  }

  // ── Static pages ───────────────────────────────────────────────────────
  const staticMeta: Record<string, Partial<OgData>> = {
    '/': {
      title: 'Grids — Your personal grid',
      description: 'Create and share your personal grid of links, tools, and more.',
      ogImageUrl: `${origin}/api/og?title=Your+personal+grid`,
    },
    '/pricing': {
      title: 'Pricing — Grids',
      description: 'Simple, transparent pricing for Grids.',
      ogImageUrl: `${origin}/api/og?title=Grids+Pricing`,
    },
    '/privacy': {
      title: 'Privacy Policy — Grids',
      description: 'How we handle your data.',
      ogImageUrl: `${origin}/api/og?title=Privacy+Policy`,
    },
    '/terms': {
      title: 'Terms of Service — Grids',
      description: 'Terms and conditions for using Grids.',
      ogImageUrl: `${origin}/api/og?title=Terms+of+Service`,
    },
  }

  const staticEntry = staticMeta[pathname]
  if (staticEntry) {
    return {
      ...defaultOg,
      ...staticEntry,
      canonicalUrl: `${origin}${pathname}`,
    }
  }

  return defaultOg
}

function buildMetaTags(og: OgData): string {
  const escape = (s: string) => s.replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const t = escape(og.title)
  const d = escape(og.description)
  const img = escape(og.ogImageUrl)
  const url = escape(og.canonicalUrl)

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
    <!-- Twitter Card -->
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

  // Pass through for non-crawlers — SPA handles everything client-side
  if (!isCrawler(ua)) {
    return undefined
  }

  const url = new URL(request.url)
  const { pathname } = url

  // Never intercept API routes or static assets
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_vercel/') ||
    /\.\w{2,6}$/.test(pathname)
  ) {
    return undefined
  }

  const og = await resolveOgData(pathname, request.url)
  const metaTags = buildMetaTags(og)

  // Fetch the actual SPA index.html from Vercel's static file server.
  // We pass a header so the middleware can detect the re-entrant request
  // and skip processing, avoiding an infinite loop.
  const passThroughReq = new Request(request.url, {
    headers: {
      ...Object.fromEntries(request.headers.entries()),
      'x-og-passthrough': '1',
    },
  })
  const htmlRes = await fetch(passThroughReq)
  const html = await htmlRes.text()

  // Inject meta tags immediately before </head>
  const injected = html.replace('</head>', `${metaTags}\n  </head>`)

  return new Response(injected, {
    status: htmlRes.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
      'X-Robots-Tag': 'index, follow',
    },
  })
}

export const config = {
  // Run on all non-asset paths
  matcher: ['/((?!_vercel|.*\\..*).*)'],
}
