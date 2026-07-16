import { describe, expect, it } from "vitest";
import {
  hexToHsv,
  hexToRgb,
  hsvToHex,
  hsvToRgb,
  isValidHex,
  normalizeHex,
  rgbToHex,
  rgbToHsv,
  type Hsv,
} from "../color";

describe("normalizeHex", () => {
  it("canonicalizes assorted valid inputs to #RRGGBB uppercase", () => {
    expect(normalizeHex("ff0000")).toBe("#FF0000");
    expect(normalizeHex("#ff0000")).toBe("#FF0000");
    expect(normalizeHex("0xFF0000")).toBe("#FF0000");
    expect(normalizeHex("  #Ff0000  ")).toBe("#FF0000");
  });

  it("expands 3-digit shorthand", () => {
    expect(normalizeHex("f00")).toBe("#FF0000");
    expect(normalizeHex("#abc")).toBe("#AABBCC");
  });

  it("returns empty string for invalid input", () => {
    expect(normalizeHex("")).toBe("");
    expect(normalizeHex("ff00")).toBe("");
    expect(normalizeHex("zzzzzz")).toBe("");
  });
});

describe("isValidHex", () => {
  it("accepts valid, rejects invalid", () => {
    expect(isValidHex("#00ff88")).toBe(true);
    expect(isValidHex("abc")).toBe(true);
    expect(isValidHex("nope")).toBe(false);
    expect(isValidHex("12345")).toBe(false);
  });
});

describe("hex <-> rgb", () => {
  it("parses hex to rgb", () => {
    expect(hexToRgb("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#00FF00")).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb("#0000FF")).toEqual({ r: 0, g: 0, b: 255 });
    expect(hexToRgb("xyz")).toBeNull();
  });

  it("serializes rgb to hex and clamps out-of-range channels", () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe("#FF0000");
    expect(rgbToHex({ r: 300, g: -5, b: 128 })).toBe("#FF0080");
  });
});

describe("rgb <-> hsv", () => {
  it("converts primaries correctly", () => {
    expect(rgbToHsv({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 1, v: 1 });
    expect(rgbToHsv({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 1, v: 1 });
    expect(rgbToHsv({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 1, v: 1 });
  });

  it("treats black and white as zero-saturation", () => {
    expect(rgbToHsv({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, v: 0 });
    expect(rgbToHsv({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, v: 1 });
  });

  it("round-trips rgb -> hsv -> rgb for sample colors", () => {
    const samples = [
      { r: 211, g: 189, b: 255 },
      { r: 255, g: 175, b: 163 },
      { r: 51, g: 49, b: 44 },
      { r: 18, g: 200, b: 137 },
    ];
    for (const rgb of samples) {
      const back = hsvToRgb(rgbToHsv(rgb));
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(1);
    }
  });
});

describe("hex <-> hsv convenience", () => {
  it("round-trips hex -> hsv -> hex", () => {
    for (const hex of ["#FF0000", "#D3BDFF", "#12C889", "#33312C"]) {
      const hsv = hexToHsv(hex) as Hsv;
      expect(hsvToHex(hsv)).toBe(hex);
    }
  });

  it("returns null hsv for invalid hex", () => {
    expect(hexToHsv("nope")).toBeNull();
  });

  it("wraps negative / >360 hue in hsvToRgb", () => {
    expect(hsvToRgb({ h: -360, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 0 });
    expect(hsvToRgb({ h: 360, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 0 });
  });
});
