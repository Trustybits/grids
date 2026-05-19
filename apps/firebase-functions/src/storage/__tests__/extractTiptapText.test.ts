/**
 * Tests for extractTiptapText — the function that converts TipTap/ProseMirror
 * JSON stored in Firestore into plain text used in OG image generation.
 *
 * Bugs here are silent: a regression produces an OG image with the wrong name
 * or title with no error thrown and no visible failure until a user reports it.
 */

import { describe, it, expect } from "vitest";
import { extractTiptapText } from "../onRequest_generateOgImage.js";

// ── Already-plain strings ──────────────────────────────────────────────────

describe("plain string input", () => {
  it("returns the string trimmed when passed plain text", () => {
    expect(extractTiptapText("Matthew Galley")).toBe("Matthew Galley");
  });

  it("trims surrounding whitespace", () => {
    expect(extractTiptapText("  CEO & Founder  ")).toBe("CEO & Founder");
  });

  it("returns empty string for an empty string", () => {
    expect(extractTiptapText("")).toBe("");
  });
});

// ── Serialised TipTap JSON passed as a string ──────────────────────────────

describe("JSON string input", () => {
  it("extracts text from a serialised TipTap doc with one paragraph", () => {
    const json = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Matthew Galley" }],
        },
      ],
    });
    expect(extractTiptapText(json)).toBe("Matthew Galley");
  });

  it("concatenates text across multiple paragraphs", () => {
    const json = JSON.stringify({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "CEO" }] },
        { type: "paragraph", content: [{ type: "text", text: "Founder" }] },
      ],
    });
    // extractTiptapText joins and trims — two adjacent words become one string
    expect(extractTiptapText(json)).toBe("CEOFounder");
  });

  it("returns empty string for a doc with no text nodes", () => {
    const json = JSON.stringify({ type: "doc", content: [] });
    expect(extractTiptapText(json)).toBe("");
  });

  it("returns the raw string when JSON.parse fails (malformed input)", () => {
    // Malformed JSON falls through to the plain-text branch
    expect(extractTiptapText("{not valid json")).toBe("{not valid json");
  });
});

// ── TipTap object input (already parsed) ──────────────────────────────────

describe("object input", () => {
  it("extracts text from a doc object", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Community Manager" }],
        },
      ],
    };
    expect(extractTiptapText(doc)).toBe("Community Manager");
  });

  it("returns text from a bare text node", () => {
    expect(extractTiptapText({ type: "text", text: "hello" })).toBe("hello");
  });

  it("handles deeply nested content", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "bold",
              content: [{ type: "text", text: "Bold" }],
            },
            { type: "text", text: " normal" },
          ],
        },
      ],
    };
    expect(extractTiptapText(doc)).toBe("Bold normal");
  });

  it("handles emoji in display names", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "nath 👋" }],
        },
      ],
    };
    expect(extractTiptapText(doc)).toBe("nath 👋");
  });

  it("returns empty string for null", () => {
    expect(extractTiptapText(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(extractTiptapText(undefined)).toBe("");
  });

  it("returns empty string for a number", () => {
    expect(extractTiptapText(42)).toBe("");
  });

  it("returns empty string for an object with no text or content", () => {
    expect(extractTiptapText({ type: "hardBreak" })).toBe("");
  });
});
