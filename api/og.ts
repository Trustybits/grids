import { ImageResponse } from '@vercel/og'

export const config = {
  runtime: 'edge',
}

// Fetched once per edge worker instance and cached in module scope
let interFontData: ArrayBuffer | null = null
let interBoldFontData: ArrayBuffer | null = null

async function getInterFont(): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> {
  if (interFontData && interBoldFontData) {
    return { regular: interFontData, bold: interBoldFontData }
  }

  const [regular, bold] = await Promise.all([
    fetch(
      'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff',
    ).then((r) => r.arrayBuffer()),
    fetch(
      'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff',
    ).then((r) => r.arrayBuffer()),
  ])

  interFontData = regular
  interBoldFontData = bold
  return { regular, bold }
}

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url)

  const title = searchParams.get('title') || 'Your personal grid'
  const username = searchParams.get('username') || ''
  const description = searchParams.get('description') || ''

  const fonts = await getInterFont()

  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: '#10100E',
          padding: '72px 80px',
          fontFamily: 'Inter, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        },
        children: [
          // Grid line pattern (horizontal + vertical lines)
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                inset: 0,
                backgroundImage:
                  'linear-gradient(rgba(254,253,236,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(254,253,236,0.06) 1px, transparent 1px)',
                backgroundSize: '60px 60px',
              },
            },
          },
          // Radial glow in bottom-right
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                bottom: '-120px',
                right: '-120px',
                width: '520px',
                height: '520px',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(254,253,236,0.07) 0%, transparent 70%)',
              },
            },
          },
          // Top content: username chip + title + description
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                zIndex: 1,
                maxWidth: '960px',
              },
              children: [
                username
                  ? {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          backgroundColor: 'rgba(254,253,236,0.08)',
                          border: '1px solid rgba(254,253,236,0.15)',
                          borderRadius: '100px',
                          padding: '6px 18px',
                          width: 'fit-content',
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                color: 'rgba(254,253,236,0.55)',
                                fontSize: 22,
                                fontWeight: 400,
                              },
                              children: `@${username}`,
                            },
                          },
                        ],
                      },
                    }
                  : null,
                {
                  type: 'div',
                  props: {
                    style: {
                      color: '#FEFDEC',
                      fontSize: title.length > 40 ? 52 : 68,
                      fontWeight: 700,
                      lineHeight: 1.1,
                      letterSpacing: '-1.5px',
                    },
                    children: title,
                  },
                },
                description
                  ? {
                      type: 'div',
                      props: {
                        style: {
                          color: 'rgba(254,253,236,0.5)',
                          fontSize: 26,
                          fontWeight: 400,
                          lineHeight: 1.4,
                        },
                        children: description,
                      },
                    }
                  : null,
              ].filter(Boolean),
            },
          },
          // Bottom branding
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                zIndex: 1,
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: '#FEFDEC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                    children: {
                      type: 'div',
                      props: {
                        style: {
                          width: '18px',
                          height: '18px',
                          backgroundImage:
                            'linear-gradient(rgba(16,16,14,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(16,16,14,0.8) 1px, transparent 1px)',
                          backgroundSize: '6px 6px',
                          backgroundColor: 'transparent',
                        },
                      },
                    },
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      color: '#FEFDEC',
                      fontSize: 30,
                      fontWeight: 700,
                      letterSpacing: '-0.5px',
                    },
                    children: 'grids.',
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: fonts.regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: fonts.bold, weight: 700, style: 'normal' },
      ],
    },
  )
}
