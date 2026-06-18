/**
 * Tests for MarkdownToHtml.ts
 *
 * Covers markdownToHtml — a small, security-conscious Markdown subset renderer.
 * The renderer escapes ALL input first and then re-introduces a limited tag set,
 * so the suite emphasizes:
 *  - block elements: paragraphs, headings, lists (nested + mixed), blockquotes, hr
 *  - inline elements: code, links, bold, italics
 *  - HTML/attribute escaping (XSS hardening) and edge cases
 */

import { describe, it, expect } from "vitest";
import { markdownToHtml } from "../MarkdownToHtml";

describe("markdownToHtml", () => {
  describe("empty / trivial input", () => {
    it("returns an empty string for empty input", () => {
      expect(markdownToHtml("")).toBe("");
    });

    it("returns an empty string for null/undefined-ish input", () => {
      expect(markdownToHtml(null as unknown as string)).toBe("");
      expect(markdownToHtml(undefined as unknown as string)).toBe("");
    });

    it("returns an empty string for whitespace-only input", () => {
      expect(markdownToHtml("   \n  \n")).toBe("");
    });
  });

  describe("paragraphs", () => {
    it("wraps a single line in a paragraph", () => {
      expect(markdownToHtml("Hello world")).toBe("<p>Hello world</p>");
    });

    it("joins consecutive lines into one paragraph separated by spaces", () => {
      expect(markdownToHtml("line one\nline two")).toBe(
        "<p>line one line two</p>",
      );
    });

    it("splits paragraphs on a blank line", () => {
      expect(markdownToHtml("first\n\nsecond")).toBe(
        "<p>first</p><p>second</p>",
      );
    });

    it("normalizes CRLF line endings", () => {
      expect(markdownToHtml("a\r\n\r\nb")).toBe("<p>a</p><p>b</p>");
    });
  });

  describe("headings", () => {
    it.each([
      ["# H1", "<h1>H1</h1>"],
      ["## H2", "<h2>H2</h2>"],
      ["### H3", "<h3>H3</h3>"],
      ["#### H4", "<h4>H4</h4>"],
      ["##### H5", "<h5>H5</h5>"],
      ["###### H6", "<h6>H6</h6>"],
    ])("renders %s", (input, expected) => {
      expect(markdownToHtml(input)).toBe(expected);
    });

    it("does not treat 7 hashes as a heading", () => {
      // Falls through to a paragraph (escaped).
      expect(markdownToHtml("####### Nope")).toBe("<p>####### Nope</p>");
    });

    it("renders inline formatting inside a heading", () => {
      expect(markdownToHtml("# **big** title")).toBe(
        "<h1><strong>big</strong> title</h1>",
      );
    });

    it("requires a space after the hashes (no space is a paragraph)", () => {
      expect(markdownToHtml("#NoSpace")).toBe("<p>#NoSpace</p>");
    });
  });

  describe("horizontal rule", () => {
    it("renders --- as an <hr />", () => {
      expect(markdownToHtml("---")).toBe("<hr />");
    });
  });

  describe("inline formatting", () => {
    it("renders inline code", () => {
      expect(markdownToHtml("use `npm test` now")).toBe(
        "<p>use <code>npm test</code> now</p>",
      );
    });

    it("renders bold text", () => {
      expect(markdownToHtml("a **bold** word")).toBe(
        "<p>a <strong>bold</strong> word</p>",
      );
    });

    it("renders italic text", () => {
      expect(markdownToHtml("an *italic* word")).toBe(
        "<p>an <em>italic</em> word</p>",
      );
    });

    it("renders a link with target/rel and the visible text", () => {
      expect(markdownToHtml("[grids](https://grids.so)")).toBe(
        '<p><a href="https://grids.so" target="_blank" rel="noopener noreferrer">grids</a></p>',
      );
    });

    it("applies bold inside italics for triple-asterisk text", () => {
      expect(markdownToHtml("***x***")).toBe(
        "<p><em><strong>x</strong></em></p>",
      );
    });

    it("neutralizes a backtick in a link href", () => {
      const html = markdownToHtml("[x](https://a.com/`b)");
      expect(html).toContain("&#96;");
      expect(html).not.toContain("`b");
    });
  });

  describe("lists", () => {
    it("renders an unordered list", () => {
      expect(markdownToHtml("- one\n- two")).toBe(
        "<ul><li>one</li><li>two</li></ul>",
      );
    });

    it("renders an ordered list", () => {
      expect(markdownToHtml("1. one\n2. two")).toBe(
        "<ol><li>one</li><li>two</li></ol>",
      );
    });

    it("ignores the actual ordinal and emits a plain <ol> (numbers not preserved)", () => {
      // The renderer keys off the bullet pattern, not the digit, so a list that
      // starts at 3 still produces a default-numbered <ol>.
      expect(markdownToHtml("3. three\n4. four")).toBe(
        "<ol><li>three</li><li>four</li></ol>",
      );
    });

    it("supports '*' bullets for unordered lists", () => {
      expect(markdownToHtml("* one")).toBe("<ul><li>one</li></ul>");
    });

    it("nests a list inside the parent <li> when indented by two spaces", () => {
      // The nested <ul> sits inside the parent's still-open <li>, producing
      // valid list markup.
      expect(markdownToHtml("- a\n  - b")).toBe(
        "<ul><li>a<ul><li>b</li></ul></li></ul>",
      );
    });

    it("switches list type at the same level by closing and reopening", () => {
      expect(markdownToHtml("- a\n1. b")).toBe(
        "<ul><li>a</li></ul><ol><li>b</li></ol>",
      );
    });

    it("de-nests when an indented item is followed by a top-level item", () => {
      // The nested list and the parent <li> both close before the sibling item.
      expect(markdownToHtml("- a\n  - b\n- c")).toBe(
        "<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>",
      );
    });

    it("closes an open list when a heading interrupts it", () => {
      expect(markdownToHtml("- a\n# H")).toBe(
        "<ul><li>a</li></ul><h1>H</h1>",
      );
    });

    it("closes an open list when a horizontal rule interrupts it", () => {
      expect(markdownToHtml("- a\n---")).toBe("<ul><li>a</li></ul><hr />");
    });

    it("renders inline formatting inside a list item", () => {
      expect(markdownToHtml("- **bold** item")).toBe(
        "<ul><li><strong>bold</strong> item</li></ul>",
      );
    });

    it("keeps multiple top-level siblings after a nested list inside one item", () => {
      expect(markdownToHtml("- a\n  - b\n  - c\n- d")).toBe(
        "<ul><li>a<ul><li>b</li><li>c</li></ul></li><li>d</li></ul>",
      );
    });

    it("nests an ordered list inside an unordered list item", () => {
      expect(markdownToHtml("- a\n  1. b")).toBe(
        "<ul><li>a<ol><li>b</li></ol></li></ul>",
      );
    });
  });

  describe("blockquotes", () => {
    it("wraps quoted lines in a blockquote with inner paragraph", () => {
      expect(markdownToHtml("> quoted")).toBe(
        "<blockquote><p>quoted</p></blockquote>",
      );
    });

    it("ends the blockquote when a non-quoted line follows", () => {
      expect(markdownToHtml("> quoted\nafter")).toBe(
        "<blockquote><p>quoted</p></blockquote><p>after</p>",
      );
    });

    it("splits paragraphs across a blank quoted line within the blockquote", () => {
      expect(markdownToHtml("> a\n>\n> b")).toBe(
        "<blockquote><p>a</p><p>b</p></blockquote>",
      );
    });
  });

  describe("HTML escaping / XSS hardening", () => {
    it("escapes raw HTML tags in paragraph text", () => {
      expect(markdownToHtml("<script>alert(1)</script>")).toBe(
        "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
      );
    });

    it("escapes ampersands and quotes", () => {
      expect(markdownToHtml(`Tom & "Jerry"`)).toBe(
        "<p>Tom &amp; &quot;Jerry&quot;</p>",
      );
    });

    it("escapes single quotes/apostrophes to &#39;", () => {
      expect(markdownToHtml("it's a trap")).toBe("<p>it&#39;s a trap</p>");
    });

    it("escapes special characters inside link text", () => {
      // The whole line is escaped before the link regex runs, so the visible
      // anchor text carries entity-encoded characters.
      expect(markdownToHtml("[a & b](https://x.test)")).toBe(
        '<p><a href="https://x.test" target="_blank" rel="noopener noreferrer">a &amp; b</a></p>',
      );
    });

    it("escapes HTML inside inline code exactly once", () => {
      // Content is escaped a single time, so `<b>` renders as the literal
      // text "<b>" (entity-encoded once), not the double-encoded "&lt;b&gt;".
      expect(markdownToHtml("`<b>`")).toBe("<p><code>&lt;b&gt;</code></p>");
    });

    it("neutralizes a double quote in a link href (no attribute breakout)", () => {
      const html = markdownToHtml('[x](https://a.com/" onmouseover=alert)');
      // The user's quote is escaped once to &quot;, so it cannot terminate the
      // href attribute and inject onmouseover.
      expect(html).toContain("&quot; onmouseover=alert");
      expect(html).not.toContain('a.com/" onmouseover');
    });

    // SECURITY NOTE: the renderer escapes HTML entities but does NOT restrict
    // URL schemes, so a `javascript:` href passes through into the anchor.
    // This test pins that (risky) current behavior so the gap is visible.
    it("does NOT sanitize javascript: hrefs (current behavior — flagged)", () => {
      const html = markdownToHtml("[click](javascript:alert)");
      expect(html).toContain('href="javascript:alert"');
    });
  });
});
