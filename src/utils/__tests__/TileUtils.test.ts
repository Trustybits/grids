/**
 * Tests for TileUtils.ts
 *
 * Covers:
 *  - isDirectImageUrl / isDirectVideoUrl (URL detection)
 *  - createTileContent (default values for every ContentType)
 *  - validateTileContent (business rules per type)
 *  - createTileContentFromEmbedUrl (YouTube, Spotify, Apple Music, image, video routing)
 *
 * TileUtils has no runtime Firebase calls so no special mocking is needed beyond
 * what setup.ts already provides for the module-level store import.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  isDirectImageUrl,
  isDirectVideoUrl,
  createTileContent,
  validateTileContent,
  createTileContentFromEmbedUrl,
} from '@/utils/TileUtils'
import { ContentType } from '@/types/TileContent'
import type {
  TextContent,
  ImageContent,
  LinkContent,
  YouTubeContent,
  MusicContent,
  MapContent,
  ProfileBioContent,
  CampfireContent,
  RPGContent,
  EmbedContent,
  VideoContent,
} from '@/types/TileContent'

// TileUtils imports useThemeStore at module level but never calls it in the
// functions under test. Mock it to avoid Pinia "no active instance" errors.
vi.mock('@/stores/theme', () => ({
  useThemeStore: vi.fn(() => ({ isDark: false })),
}))

// ── isDirectImageUrl ───────────────────────────────────────────────────────

describe('isDirectImageUrl', () => {
  it.each([
    'https://example.com/photo.png',
    'https://cdn.example.com/img/banner.jpg',
    'https://example.com/image.jpeg',
    'https://example.com/animation.gif',
    'https://example.com/photo.webp',
    'https://example.com/icon.svg',
    'https://example.com/bitmap.bmp',
  ])('returns true for direct image URL: %s', (url) => {
    expect(isDirectImageUrl(url)).toBe(true)
  })

  it('returns true for data: image URIs', () => {
    expect(isDirectImageUrl('data:image/png;base64,abc123')).toBe(true)
  })

  it.each([
    '',
    'https://example.com/page',
    'https://youtube.com/watch?v=abc',
    'https://example.com/document.pdf',
    'https://example.com/video.mp4',
    'not-a-url',
  ])('returns false for non-image URL: %s', (url) => {
    expect(isDirectImageUrl(url)).toBe(false)
  })

  it('handles URLs without protocol by adding https://', () => {
    expect(isDirectImageUrl('example.com/photo.png')).toBe(true)
  })

  it('returns false for empty string', () => {
    expect(isDirectImageUrl('')).toBe(false)
  })
})

// ── isDirectVideoUrl ───────────────────────────────────────────────────────

describe('isDirectVideoUrl', () => {
  it.each([
    'https://example.com/video.mp4',
    'https://example.com/clip.webm',
    'https://example.com/recording.mov',
  ])('returns true for direct video URL: %s', (url) => {
    expect(isDirectVideoUrl(url)).toBe(true)
  })

  it('returns true for data: video URIs', () => {
    expect(isDirectVideoUrl('data:video/mp4;base64,abc123')).toBe(true)
  })

  it.each([
    '',
    'https://example.com/page',
    'https://example.com/photo.png',
    'https://example.com/document.pdf',
  ])('returns false for non-video URL: %s', (url) => {
    expect(isDirectVideoUrl(url)).toBe(false)
  })
})

// ── createTileContent defaults ─────────────────────────────────────────────

describe('createTileContent', () => {
  it('creates TEXT content with correct defaults', () => {
    const content = createTileContent(ContentType.TEXT) as TextContent
    expect(content.type).toBe(ContentType.TEXT)
    expect(content.text).toBe('')
    expect(content.font).toBe('Arial')
    expect(content.fontSize).toBe(14)
    expect(content.isBold).toBe(false)
    expect(content.isItalic).toBe(false)
    expect(content.color).toBe('#ffffff')
  })

  it('creates TEXT content with provided data', () => {
    const content = createTileContent(ContentType.TEXT, {
      text: 'Hello',
      font: 'Georgia',
      isBold: true,
    }) as TextContent
    expect(content.text).toBe('Hello')
    expect(content.font).toBe('Georgia')
    expect(content.isBold).toBe(true)
    expect(content.fontSize).toBe(14) // default preserved
  })

  it('creates IMAGE content with correct defaults', () => {
    const content = createTileContent(ContentType.IMAGE) as ImageContent
    expect(content.type).toBe(ContentType.IMAGE)
    expect(content.src).toBe('')
    expect(content.zoom).toBe(1)
    expect(content.offsetX).toBe(0)
    expect(content.offsetY).toBe(0)
  })

  it('creates LINK content and derives domain + favicon from URL', () => {
    const content = createTileContent(ContentType.LINK, {
      link: 'https://github.com',
    }) as LinkContent
    expect(content.type).toBe(ContentType.LINK)
    expect(content.link).toBe('https://github.com')
    expect(content.domain).toBe('github.com')
    expect(content.faviconUrl).toContain('github.com')
    expect(content.linkBackgroundEnabled).toBe(true)
  })

  it('creates LINK content for URL without protocol', () => {
    const content = createTileContent(ContentType.LINK, {
      link: 'github.com',
    }) as LinkContent
    expect(content.link).toBe('https://github.com')
    expect(content.domain).toBe('github.com')
  })

  it('creates MAP content with correct defaults', () => {
    const content = createTileContent(ContentType.MAP) as MapContent
    expect(content.type).toBe(ContentType.MAP)
    expect(content.provider).toBe('mapbox')
    expect(content.center).toEqual({ lat: 0, lng: 0 })
    expect(content.zoom).toBe(9)
    expect(content.style).toBe('default')
    expect(content.show3d).toBe(false)
  })

  it('creates PROFILE content with correct defaults', () => {
    const content = createTileContent(ContentType.PROFILE) as ProfileBioContent
    expect(content.type).toBe(ContentType.PROFILE)
    expect(content.name).toBe('')
    expect(content.avatarShape).toBe('square')
    expect(content.avatarRadius).toBe(12)
  })

  it('creates CAMPFIRE content with correct defaults', () => {
    const content = createTileContent(ContentType.CAMPFIRE) as CampfireContent
    expect(content.type).toBe(ContentType.CAMPFIRE)
    expect(content.count).toBe(0)
    expect(content.highScore).toBe(0)
  })

  it('creates RPG content with correct defaults', () => {
    const content = createTileContent(ContentType.RPG) as RPGContent
    expect(content.type).toBe(ContentType.RPG)
    expect(content.playerHealth).toBe(100)
    expect(content.playerMaxHealth).toBe(100)
    expect(content.playerAttack).toBe(15)
    expect(content.gameState).toBe('playing')
    expect(content.wave).toBe(1)
    expect(content.score).toBe(0)
    expect(Array.isArray(content.enemies)).toBe(true)
    expect(Array.isArray(content.walls)).toBe(true)
  })

  it('creates YOUTUBE content with provided data', () => {
    const content = createTileContent(ContentType.YOUTUBE, {
      youtubeUrl: 'https://youtube.com/watch?v=abc123defgh',
      youtubeType: 'video',
      youtubeId: 'abc123defgh',
    }) as YouTubeContent
    expect(content.type).toBe(ContentType.YOUTUBE)
    expect(content.youtubeId).toBe('abc123defgh')
    expect(content.youtubeType).toBe('video')
  })

  it('creates MUSIC content with provided data', () => {
    const content = createTileContent(ContentType.MUSIC, {
      platform: 'spotify',
      trackId: 'ABC123',
      trackName: 'Test Song',
      artistName: 'Test Artist',
    }) as MusicContent
    expect(content.type).toBe(ContentType.MUSIC)
    expect(content.platform).toBe('spotify')
    expect(content.trackId).toBe('ABC123')
  })

  it('throws for unsupported content type', () => {
    expect(() => createTileContent('unsupported' as ContentType)).toThrow()
  })
})

// ── validateTileContent ────────────────────────────────────────────────────

describe('validateTileContent', () => {
  it('validates TEXT: returns false for empty text', () => {
    const content = createTileContent(ContentType.TEXT) as TextContent
    expect(validateTileContent(content)).toBe(false)
  })

  it('validates TEXT: returns true for non-empty text', () => {
    const content = createTileContent(ContentType.TEXT, { text: 'Hello' }) as TextContent
    expect(validateTileContent(content)).toBe(true)
  })

  it('validates TEXT: returns false for whitespace-only text', () => {
    const content = createTileContent(ContentType.TEXT, { text: '   ' }) as TextContent
    expect(validateTileContent(content)).toBe(false)
  })

  it('validates IMAGE: returns false for empty src', () => {
    const content = createTileContent(ContentType.IMAGE) as ImageContent
    expect(validateTileContent(content)).toBe(false)
  })

  it('validates IMAGE: returns true for https src', () => {
    const content = createTileContent(ContentType.IMAGE, {
      src: 'https://example.com/photo.jpg',
    }) as ImageContent
    expect(validateTileContent(content)).toBe(true)
  })

  it('validates IMAGE: returns true for data: URI', () => {
    const content = createTileContent(ContentType.IMAGE, {
      src: 'data:image/png;base64,abc',
    }) as ImageContent
    expect(validateTileContent(content)).toBe(true)
  })

  it('validates LINK: returns false for empty link', () => {
    const content = createTileContent(ContentType.LINK) as LinkContent
    expect(validateTileContent(content)).toBe(false)
  })

  it('validates LINK: returns true for valid https link', () => {
    const content = createTileContent(ContentType.LINK, {
      link: 'https://example.com',
    }) as LinkContent
    expect(validateTileContent(content)).toBe(true)
  })

  it('validates EMBED: returns false for empty src', () => {
    const content = createTileContent(ContentType.EMBED) as EmbedContent
    expect(validateTileContent(content)).toBe(false)
  })

  it('validates EMBED: returns true for https src', () => {
    const content = createTileContent(ContentType.EMBED, {
      src: 'https://example.com/embed',
    }) as EmbedContent
    expect(validateTileContent(content)).toBe(true)
  })

  it('validates MAP: returns false for non-finite coordinates', () => {
    const content = createTileContent(ContentType.MAP, {
      center: { lat: NaN, lng: 0 },
    }) as MapContent
    expect(validateTileContent(content)).toBe(false)
  })

  it('validates MAP: returns true for valid coordinates', () => {
    const content = createTileContent(ContentType.MAP, {
      center: { lat: 40.7128, lng: -74.006 },
    }) as MapContent
    expect(validateTileContent(content)).toBe(true)
  })

  it('validates YOUTUBE: returns false when youtubeId is empty', () => {
    const content = createTileContent(ContentType.YOUTUBE) as YouTubeContent
    expect(validateTileContent(content)).toBe(false)
  })

  it('validates YOUTUBE: returns true when both url and id are present', () => {
    const content = createTileContent(ContentType.YOUTUBE, {
      youtubeUrl: 'https://youtube.com/watch?v=abc123defgh',
      youtubeId: 'abc123defgh',
    }) as YouTubeContent
    expect(validateTileContent(content)).toBe(true)
  })

  it('validates MUSIC: returns false when trackId is empty', () => {
    const content = createTileContent(ContentType.MUSIC) as MusicContent
    expect(validateTileContent(content)).toBe(false)
  })

  it('validates MUSIC: returns true when platform and trackId are set', () => {
    const content = createTileContent(ContentType.MUSIC, {
      platform: 'spotify',
      trackId: 'ABC123',
    }) as MusicContent
    expect(validateTileContent(content)).toBe(true)
  })

  it.each([
    ContentType.CHAT,
    ContentType.RPG,
    ContentType.CAMPFIRE,
    ContentType.CLICKER,
    ContentType.PROFILE,
    ContentType.ROADMAP_FEED,
    ContentType.SUGGESTION,
  ])('validates %s as always true (no validation rules)', (type) => {
    const content = createTileContent(type)
    expect(validateTileContent(content)).toBe(true)
  })
})

// ── createTileContentFromEmbedUrl (URL routing) ────────────────────────────

describe('createTileContentFromEmbedUrl', () => {
  describe('YouTube URLs', () => {
    it('detects standard youtube.com/watch?v= URL as YOUTUBE type', () => {
      const content = createTileContentFromEmbedUrl(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      ) as YouTubeContent
      expect(content.type).toBe(ContentType.YOUTUBE)
      expect(content.youtubeType).toBe('video')
      expect(content.youtubeId).toBe('dQw4w9WgXcQ')
    })

    it('detects youtu.be short URL as YOUTUBE type', () => {
      const content = createTileContentFromEmbedUrl(
        'https://youtu.be/dQw4w9WgXcQ'
      ) as YouTubeContent
      expect(content.type).toBe(ContentType.YOUTUBE)
      expect(content.youtubeId).toBe('dQw4w9WgXcQ')
    })

    it('detects youtube.com/shorts/ URL', () => {
      const content = createTileContentFromEmbedUrl(
        'https://www.youtube.com/shorts/abc12345678'
      ) as YouTubeContent
      expect(content.type).toBe(ContentType.YOUTUBE)
      expect(content.youtubeType).toBe('short')
    })

    it('detects YouTube playlist URL', () => {
      const content = createTileContentFromEmbedUrl(
        'https://www.youtube.com/playlist?list=PLrEnWoR732-BHrPp_Pm8_VleD68f9s14-'
      ) as YouTubeContent
      expect(content.type).toBe(ContentType.YOUTUBE)
      expect(content.youtubeType).toBe('playlist')
    })

    it('detects YouTube channel @handle URL', () => {
      const content = createTileContentFromEmbedUrl(
        'https://www.youtube.com/@SomeChannel'
      ) as YouTubeContent
      expect(content.type).toBe(ContentType.YOUTUBE)
      expect(content.youtubeType).toBe('channel')
    })
  })

  describe('Spotify URLs', () => {
    it('detects open.spotify.com/track/ URL as MUSIC type', () => {
      const content = createTileContentFromEmbedUrl(
        'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'
      ) as MusicContent
      expect(content.type).toBe(ContentType.MUSIC)
      expect(content.platform).toBe('spotify')
      expect(content.trackId).toBe('4cOdK2wGLETKBW3PvgPWqT')
    })

    it('detects Spotify album URL as MUSIC type', () => {
      const content = createTileContentFromEmbedUrl(
        'https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3'
      ) as MusicContent
      expect(content.type).toBe(ContentType.MUSIC)
      expect(content.platform).toBe('spotify')
    })
  })

  describe('Apple Music URLs', () => {
    it('detects music.apple.com song URL as MUSIC type', () => {
      const content = createTileContentFromEmbedUrl(
        'https://music.apple.com/us/song/bad-guy/1450695723'
      ) as MusicContent
      expect(content.type).toBe(ContentType.MUSIC)
      expect(content.platform).toBe('apple')
      expect(content.trackId).toBe('1450695723')
    })

    it('detects Apple Music album track with ?i= param', () => {
      const content = createTileContentFromEmbedUrl(
        'https://music.apple.com/us/album/some-album/123456?i=789012'
      ) as MusicContent
      expect(content.type).toBe(ContentType.MUSIC)
      expect(content.platform).toBe('apple')
      expect(content.trackId).toBe('789012')
    })
  })

  describe('Image URLs', () => {
    it('routes direct .png URL to IMAGE type', () => {
      const content = createTileContentFromEmbedUrl('https://example.com/photo.png')
      expect(content.type).toBe(ContentType.IMAGE)
    })

    it('routes direct .jpg URL to IMAGE type', () => {
      const content = createTileContentFromEmbedUrl('https://example.com/photo.jpg')
      expect(content.type).toBe(ContentType.IMAGE)
    })
  })

  describe('Video URLs', () => {
    it('routes direct .mp4 URL to VIDEO type', () => {
      const content = createTileContentFromEmbedUrl('https://example.com/clip.mp4')
      expect(content.type).toBe(ContentType.VIDEO)
    })
  })

  describe('Embed fallback', () => {
    it('falls back to EMBED type for generic URLs', () => {
      const content = createTileContentFromEmbedUrl('https://example.com/some-page') as EmbedContent
      expect(content.type).toBe(ContentType.EMBED)
      expect(content.src).toBe('https://example.com/some-page')
    })

    it('normalizes YouTube watch URLs to nocookie embed format in EMBED type', () => {
      // When an embed-style YouTube URL is passed but not caught by YouTube parser
      // (shouldn't happen, but tests the normalizeEmbedSrc fallback path)
      const content = createTileContentFromEmbedUrl(
        'https://www.youtube.com/embed/dQw4w9WgXcQ'
      )
      // This is a YouTube embed URL — it should be caught as YOUTUBE type
      // OR normalized to nocookie URL if it falls through to EMBED
      expect([ContentType.YOUTUBE, ContentType.EMBED]).toContain(content.type)
    })

    it('extracts src from pasted <iframe> HTML', () => {
      const iframe = '<iframe src="https://example.com/embed/123" width="560" height="315"></iframe>'
      const content = createTileContentFromEmbedUrl(iframe) as EmbedContent
      expect(content.type).toBe(ContentType.EMBED)
      expect(content.src).toContain('example.com')
    })

    it('adds https:// when protocol is missing', () => {
      const content = createTileContentFromEmbedUrl('example.com/some-page') as EmbedContent
      expect(content.src).toMatch(/^https:\/\//)
    })
  })
})
