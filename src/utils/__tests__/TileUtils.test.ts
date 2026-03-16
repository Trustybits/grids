import { describe, it, expect, vi } from 'vitest'
import {
  isDirectImageUrl,
  isDirectVideoUrl,
  createTileContent,
  createTileContentFromEmbedUrl,
  createTile,
  validateTileContent,
} from '../TileUtils'
import { ContentType } from '@/types/TileContent'

// Mock the theme store since createTileContent imports it indirectly
vi.mock('@/stores/theme', () => ({
  useThemeStore: () => ({ isDark: true }),
}))

describe('TileUtils', () => {
  // ── isDirectImageUrl ──────────────────────────────────────
  describe('isDirectImageUrl', () => {
    it.each([
      'https://example.com/photo.png',
      'https://example.com/photo.jpg',
      'https://example.com/photo.jpeg',
      'https://example.com/photo.gif',
      'https://example.com/photo.webp',
      'https://example.com/photo.bmp',
      'https://example.com/photo.svg',
    ])('returns true for %s', (url) => {
      expect(isDirectImageUrl(url)).toBe(true)
    })

    it('returns true for data:image/ URIs', () => {
      expect(isDirectImageUrl('data:image/png;base64,abc')).toBe(true)
    })

    it.each([
      'https://example.com/page.html',
      'https://example.com/video.mp4',
      'https://example.com/',
      '',
    ])('returns false for %s', (url) => {
      expect(isDirectImageUrl(url)).toBe(false)
    })

    it('handles URLs without protocol', () => {
      expect(isDirectImageUrl('example.com/photo.png')).toBe(true)
    })
  })

  // ── isDirectVideoUrl ──────────────────────────────────────
  describe('isDirectVideoUrl', () => {
    it.each([
      'https://example.com/clip.mp4',
      'https://example.com/clip.webm',
      'https://example.com/clip.mov',
    ])('returns true for %s', (url) => {
      expect(isDirectVideoUrl(url)).toBe(true)
    })

    it('returns true for data:video/ URIs', () => {
      expect(isDirectVideoUrl('data:video/mp4;base64,abc')).toBe(true)
    })

    it.each([
      'https://example.com/photo.png',
      'https://example.com/page.html',
      '',
    ])('returns false for %s', (url) => {
      expect(isDirectVideoUrl(url)).toBe(false)
    })
  })

  // ── createTileContent defaults ────────────────────────────
  describe('createTileContent', () => {
    it('creates TEXT with correct defaults', () => {
      const content = createTileContent(ContentType.TEXT)
      expect(content.type).toBe(ContentType.TEXT)
      expect((content as any).text).toBe('')
      expect((content as any).font).toBe('Arial')
      expect((content as any).fontSize).toBe(14)
      expect((content as any).isBold).toBe(false)
      expect((content as any).isItalic).toBe(false)
      expect((content as any).color).toBe('#ffffff')
    })

    it('creates IMAGE with correct defaults', () => {
      const content = createTileContent(ContentType.IMAGE)
      expect(content.type).toBe(ContentType.IMAGE)
      expect((content as any).src).toBe('')
      expect((content as any).zoom).toBe(1)
      expect((content as any).offsetX).toBe(0)
      expect((content as any).offsetY).toBe(0)
    })

    it('creates VIDEO with correct defaults', () => {
      const content = createTileContent(ContentType.VIDEO)
      expect(content.type).toBe(ContentType.VIDEO)
      expect((content as any).src).toBe('')
      expect((content as any).zoom).toBe(1)
    })

    it('creates CHAT with empty messages', () => {
      const content = createTileContent(ContentType.CHAT)
      expect(content.type).toBe(ContentType.CHAT)
      expect((content as any).messages).toEqual([])
    })

    it('creates LINK with domain and favicon from URL', () => {
      const content = createTileContent(ContentType.LINK, { link: 'https://github.com' })
      expect(content.type).toBe(ContentType.LINK)
      expect((content as any).domain).toBe('github.com')
      expect((content as any).faviconUrl).toContain('github.com')
      expect((content as any).linkBackgroundEnabled).toBe(true)
    })

    it('creates LINK with empty data when no URL given', () => {
      const content = createTileContent(ContentType.LINK)
      expect(content.type).toBe(ContentType.LINK)
    })

    it('creates EMBED and normalizes YouTube watch URL', () => {
      const content = createTileContent(ContentType.EMBED, {
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      })
      expect(content.type).toBe(ContentType.EMBED)
      expect((content as any).src).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
    })

    it('creates EMBED with non-YouTube URL as-is', () => {
      const content = createTileContent(ContentType.EMBED, {
        src: 'https://example.com/widget',
      })
      expect((content as any).src).toBe('https://example.com/widget')
    })

    it('creates MAP with correct defaults', () => {
      const content = createTileContent(ContentType.MAP)
      expect(content.type).toBe(ContentType.MAP)
      expect((content as any).provider).toBe('mapbox')
      expect((content as any).center).toEqual({ lat: 0, lng: 0 })
      expect((content as any).zoom).toBe(9)
      expect((content as any).bearing).toBe(0)
      expect((content as any).pitch).toBe(0)
      expect((content as any).show3d).toBe(false)
    })

    it('creates RPG with correct defaults', () => {
      const content = createTileContent(ContentType.RPG)
      expect(content.type).toBe(ContentType.RPG)
      expect((content as any).playerHealth).toBe(100)
      expect((content as any).playerAttack).toBe(15)
      expect((content as any).wave).toBe(1)
      expect((content as any).gameState).toBe('playing')
    })

    it('creates PROFILE with correct defaults', () => {
      const content = createTileContent(ContentType.PROFILE)
      expect(content.type).toBe(ContentType.PROFILE)
      expect((content as any).name).toBe('')
      expect((content as any).avatarShape).toBe('circle')
    })

    it('creates CAMPFIRE with correct defaults', () => {
      const content = createTileContent(ContentType.CAMPFIRE)
      expect(content.type).toBe(ContentType.CAMPFIRE)
      expect((content as any).count).toBe(0)
      expect((content as any).highScore).toBe(0)
    })

    it('creates CLICKER with correct type', () => {
      const content = createTileContent(ContentType.CLICKER)
      expect(content.type).toBe(ContentType.CLICKER)
    })

    it('creates YOUTUBE with correct defaults', () => {
      const content = createTileContent(ContentType.YOUTUBE, {
        youtubeUrl: 'https://youtube.com/watch?v=abc',
        youtubeType: 'video',
        youtubeId: 'abc',
      })
      expect(content.type).toBe(ContentType.YOUTUBE)
      expect((content as any).youtubeUrl).toBe('https://youtube.com/watch?v=abc')
      expect((content as any).youtubeType).toBe('video')
      expect((content as any).youtubeId).toBe('abc')
    })

    it('creates ROADMAP_FEED with correct defaults', () => {
      const content = createTileContent(ContentType.ROADMAP_FEED)
      expect(content.type).toBe(ContentType.ROADMAP_FEED)
      expect((content as any).notionDatabaseId).toBe('')
      expect((content as any).statusMapping).toEqual({})
    })

    it('creates SUGGESTION with correct defaults', () => {
      const content = createTileContent(ContentType.SUGGESTION, { action: 'text' })
      expect(content.type).toBe(ContentType.SUGGESTION)
      expect((content as any).action).toBe('text')
    })

    it('throws for unsupported content type', () => {
      expect(() => createTileContent('INVALID' as any)).toThrow('Unsupported content type')
    })
  })

  // ── createTileContentFromEmbedUrl ─────────────────────────
  describe('createTileContentFromEmbedUrl', () => {
    it('routes YouTube watch URL to YOUTUBE type', () => {
      const content = createTileContentFromEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      expect(content.type).toBe(ContentType.YOUTUBE)
      expect((content as any).youtubeType).toBe('video')
      expect((content as any).youtubeId).toBe('dQw4w9WgXcQ')
    })

    it('routes YouTube short URL to YOUTUBE type', () => {
      const content = createTileContentFromEmbedUrl('https://youtu.be/dQw4w9WgXcQ')
      expect(content.type).toBe(ContentType.YOUTUBE)
      expect((content as any).youtubeType).toBe('video')
    })

    it('routes YouTube shorts to YOUTUBE type with short type', () => {
      const content = createTileContentFromEmbedUrl('https://www.youtube.com/shorts/abc123def45')
      expect(content.type).toBe(ContentType.YOUTUBE)
      expect((content as any).youtubeType).toBe('short')
    })

    it('routes YouTube playlist to YOUTUBE type', () => {
      const content = createTileContentFromEmbedUrl('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')
      expect(content.type).toBe(ContentType.YOUTUBE)
      expect((content as any).youtubeType).toBe('playlist')
    })

    it('routes YouTube channel @handle to YOUTUBE type', () => {
      const content = createTileContentFromEmbedUrl('https://www.youtube.com/@username')
      expect(content.type).toBe(ContentType.YOUTUBE)
      expect((content as any).youtubeType).toBe('channel')
    })

    it('routes YouTube channel/ID to YOUTUBE type', () => {
      const content = createTileContentFromEmbedUrl('https://www.youtube.com/channel/UC1234')
      expect(content.type).toBe(ContentType.YOUTUBE)
      expect((content as any).youtubeType).toBe('channel')
    })

    it('ignores RD-prefix (My Mix) playlists and treats as video', () => {
      const content = createTileContentFromEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDabc')
      expect(content.type).toBe(ContentType.YOUTUBE)
      expect((content as any).youtubeType).toBe('video')
    })

    it('routes image URLs to IMAGE type', () => {
      const content = createTileContentFromEmbedUrl('https://example.com/photo.png')
      expect(content.type).toBe(ContentType.IMAGE)
    })

    it('routes video URLs to VIDEO type', () => {
      const content = createTileContentFromEmbedUrl('https://example.com/clip.mp4')
      expect(content.type).toBe(ContentType.VIDEO)
    })

    it('routes other URLs to EMBED type', () => {
      const content = createTileContentFromEmbedUrl('https://example.com/widget')
      expect(content.type).toBe(ContentType.EMBED)
    })

    it('adds https:// to URLs without protocol', () => {
      const content = createTileContentFromEmbedUrl('example.com/photo.png')
      expect(content.type).toBe(ContentType.IMAGE)
    })
  })

  // ── createTile ────────────────────────────────────────────
  describe('createTile', () => {
    it('creates a tile with correct shape', () => {
      const tile = createTile(ContentType.TEXT, 'tile-1', 0, 0, 2, 2, {}, 'My Caption')
      expect(tile.i).toBe('tile-1')
      expect(tile.x).toBe(0)
      expect(tile.y).toBe(0)
      expect(tile.w).toBe(2)
      expect(tile.h).toBe(2)
      expect(tile.borderEnabled).toBe(true)
      expect(tile.caption).toBe('My Caption')
      expect(tile.content.type).toBe(ContentType.TEXT)
    })
  })

  // ── validateTileContent ───────────────────────────────────
  describe('validateTileContent', () => {
    it('validates TEXT — non-empty text is valid', () => {
      const content = createTileContent(ContentType.TEXT, { text: 'hello' })
      expect(validateTileContent(content)).toBe(true)
    })

    it('validates TEXT — empty text is invalid', () => {
      const content = createTileContent(ContentType.TEXT, { text: '' })
      expect(validateTileContent(content)).toBe(false)
    })

    it('validates TEXT — whitespace-only text is invalid', () => {
      const content = createTileContent(ContentType.TEXT, { text: '   ' })
      expect(validateTileContent(content)).toBe(false)
    })

    it('validates CHAT — always valid', () => {
      const content = createTileContent(ContentType.CHAT)
      expect(validateTileContent(content)).toBe(true)
    })

    it('validates IMAGE — valid with http src', () => {
      const content = createTileContent(ContentType.IMAGE, { src: 'https://example.com/img.png' })
      expect(validateTileContent(content)).toBe(true)
    })

    it('validates IMAGE — valid with data: src', () => {
      const content = createTileContent(ContentType.IMAGE, { src: 'data:image/png;base64,abc' })
      expect(validateTileContent(content)).toBe(true)
    })

    it('validates IMAGE — invalid with empty src', () => {
      const content = createTileContent(ContentType.IMAGE)
      expect(validateTileContent(content)).toBe(false)
    })

    it('validates LINK — valid with http link', () => {
      const content = createTileContent(ContentType.LINK, { link: 'https://example.com' })
      expect(validateTileContent(content)).toBe(true)
    })

    it('validates LINK — auto-prepends https:// so bare domain is valid', () => {
      const content = createTileContent(ContentType.LINK, { link: 'example.com' })
      // createTileContent normalizes via getLinkData, adding https://
      expect(validateTileContent(content)).toBe(true)
    })

    it('validates LINK — invalid with empty link', () => {
      const content = createTileContent(ContentType.LINK, { link: '' })
      expect(validateTileContent(content)).toBe(false)
    })

    it('validates VIDEO — valid with http src', () => {
      const content = createTileContent(ContentType.VIDEO, { src: 'https://example.com/v.mp4' })
      expect(validateTileContent(content)).toBe(true)
    })

    it('validates EMBED — valid with http src', () => {
      const content = createTileContent(ContentType.EMBED, { src: 'https://example.com/widget' })
      expect(validateTileContent(content)).toBe(true)
    })

    it('validates EMBED — invalid with empty src', () => {
      const content = createTileContent(ContentType.EMBED)
      expect(validateTileContent(content)).toBe(false)
    })

    it('validates RPG — always valid', () => {
      const content = createTileContent(ContentType.RPG)
      expect(validateTileContent(content)).toBe(true)
    })

    it('validates PROFILE — always valid', () => {
      const content = createTileContent(ContentType.PROFILE)
      expect(validateTileContent(content)).toBe(true)
    })

    it('validates MAP — valid with mapbox provider and finite center', () => {
      const content = createTileContent(ContentType.MAP, {
        center: { lat: 40.7, lng: -74.0 },
      })
      expect(validateTileContent(content)).toBe(true)
    })

    it('validates CAMPFIRE — always valid', () => {
      const content = createTileContent(ContentType.CAMPFIRE)
      expect(validateTileContent(content)).toBe(true)
    })

    it('validates CLICKER — always valid', () => {
      const content = createTileContent(ContentType.CLICKER)
      expect(validateTileContent(content)).toBe(true)
    })

    it('validates YOUTUBE — valid with url and id', () => {
      const content = createTileContent(ContentType.YOUTUBE, {
        youtubeUrl: 'https://youtube.com/watch?v=abc',
        youtubeId: 'abc',
      })
      expect(validateTileContent(content)).toBe(true)
    })

    it('validates YOUTUBE — invalid without id', () => {
      const content = createTileContent(ContentType.YOUTUBE, {
        youtubeUrl: 'https://youtube.com/watch?v=abc',
        youtubeId: '',
      })
      expect(validateTileContent(content)).toBe(false)
    })
  })
})
