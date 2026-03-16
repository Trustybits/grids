import { describe, it, expect } from 'vitest'
import { markdownToHtml } from '../markdownToHtml'

describe('markdownToHtml', () => {
  describe('headings', () => {
    it('converts # to h1', () => {
      expect(markdownToHtml('# Hello')).toBe('<h1>Hello</h1>')
    })

    it('converts ## to h2', () => {
      expect(markdownToHtml('## Sub')).toBe('<h2>Sub</h2>')
    })

    it('converts ### to h3', () => {
      expect(markdownToHtml('### Sub')).toBe('<h3>Sub</h3>')
    })

    it('converts ###### to h6', () => {
      expect(markdownToHtml('###### Deep')).toBe('<h6>Deep</h6>')
    })
  })

  describe('paragraphs', () => {
    it('wraps plain text in <p>', () => {
      expect(markdownToHtml('Hello world')).toBe('<p>Hello world</p>')
    })

    it('joins consecutive lines into one paragraph', () => {
      expect(markdownToHtml('line one\nline two')).toBe('<p>line one line two</p>')
    })

    it('separates paragraphs with blank lines', () => {
      expect(markdownToHtml('para one\n\npara two')).toBe('<p>para one</p><p>para two</p>')
    })
  })

  describe('inline formatting', () => {
    it('converts **bold** to <strong>', () => {
      expect(markdownToHtml('**bold**')).toBe('<p><strong>bold</strong></p>')
    })

    it('converts *italic* to <em>', () => {
      expect(markdownToHtml('*italic*')).toBe('<p><em>italic</em></p>')
    })

    it('converts `code` to <code>', () => {
      expect(markdownToHtml('`code`')).toBe('<p><code>code</code></p>')
    })

    it('converts [text](url) to <a>', () => {
      const result = markdownToHtml('[click](https://example.com)')
      expect(result).toContain('<a href="https://example.com"')
      expect(result).toContain('target="_blank"')
      expect(result).toContain('>click</a>')
    })
  })

  describe('lists', () => {
    it('converts unordered list items', () => {
      const result = markdownToHtml('- item one\n- item two')
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>item one</li>')
      expect(result).toContain('<li>item two</li>')
      expect(result).toContain('</ul>')
    })

    it('converts ordered list items', () => {
      const result = markdownToHtml('1. first\n2. second')
      expect(result).toContain('<ol>')
      expect(result).toContain('<li>first</li>')
      expect(result).toContain('<li>second</li>')
      expect(result).toContain('</ol>')
    })

    it('handles nested lists', () => {
      const result = markdownToHtml('- parent\n  - child')
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>parent</li>')
      expect(result).toContain('<li>child</li>')
    })
  })

  describe('blockquotes', () => {
    it('converts > lines to blockquote', () => {
      const result = markdownToHtml('> quoted text')
      expect(result).toContain('<blockquote>')
      expect(result).toContain('quoted text')
      expect(result).toContain('</blockquote>')
    })
  })

  describe('horizontal rules', () => {
    it('converts --- to <hr />', () => {
      expect(markdownToHtml('---')).toBe('<hr />')
    })
  })

  describe('HTML escaping (XSS prevention)', () => {
    it('escapes <script> tags', () => {
      const result = markdownToHtml('<script>alert("xss")</script>')
      expect(result).not.toContain('<script>')
      expect(result).toContain('&lt;script&gt;')
    })

    it('escapes HTML in headings', () => {
      const result = markdownToHtml('# <b>bold</b>')
      expect(result).not.toContain('<b>')
      expect(result).toContain('&lt;b&gt;')
    })

    it('escapes quotes and ampersands', () => {
      const result = markdownToHtml('Tom & "Jerry"')
      expect(result).toContain('&amp;')
      expect(result).toContain('&quot;')
    })
  })

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(markdownToHtml('')).toBe('')
    })

    it('returns empty string for null/undefined input', () => {
      expect(markdownToHtml(null as any)).toBe('')
      expect(markdownToHtml(undefined as any)).toBe('')
    })

    it('handles Windows-style line endings', () => {
      const result = markdownToHtml('line one\r\nline two')
      expect(result).toBe('<p>line one line two</p>')
    })
  })
})
