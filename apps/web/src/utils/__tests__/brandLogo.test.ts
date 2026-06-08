import { describe, it, expect } from "vitest";
import type { BrandLogoRef } from "@grids/contracts/types";
import {
  brandfetchLogoUrl,
  resolveBrandLogoSrc,
  resolveBrandLogoLink,
} from "@/utils/brandLogo";
import { brandDefinition } from "@/registries/tiles/brand";

const brandfetchRef = (over: Partial<BrandLogoRef> = {}): BrandLogoRef => ({
  id: "1",
  provider: "brandfetch",
  domain: "figma.com",
  label: "Figma",
  ...over,
});

const customRef = (over: Partial<BrandLogoRef> = {}): BrandLogoRef => ({
  id: "2",
  provider: "custom",
  src: "https://cdn.example.com/logo.png",
  label: "My Brand",
  ...over,
});

describe("brandfetchLogoUrl", () => {
  it("builds a CDN url for the domain with the icon type by default", () => {
    const url = brandfetchLogoUrl("figma.com");
    expect(url.startsWith("https://cdn.brandfetch.io/figma.com")).toBe(true);
    expect(url).toContain("type=icon");
    expect(url).toContain("fallback=transparent");
  });

  it("requests 2x dimensions for a given size", () => {
    const url = brandfetchLogoUrl("figma.com", { size: 32 });
    expect(url).toContain("w=64");
    expect(url).toContain("h=64");
  });

  it("includes the theme when provided", () => {
    expect(brandfetchLogoUrl("figma.com", { theme: "dark" })).toContain("theme=dark");
  });
});

describe("resolveBrandLogoSrc", () => {
  it("returns the dynamic CDN url for brandfetch refs", () => {
    expect(resolveBrandLogoSrc(brandfetchRef(), 24)).toContain(
      "https://cdn.brandfetch.io/figma.com",
    );
  });

  it("returns the uploaded src for custom refs", () => {
    expect(resolveBrandLogoSrc(customRef())).toBe("https://cdn.example.com/logo.png");
  });

  it("returns empty string for a brandfetch ref with no domain", () => {
    expect(resolveBrandLogoSrc(brandfetchRef({ domain: undefined }))).toBe("");
  });
});

describe("resolveBrandLogoLink", () => {
  it("defaults to the brand site for brandfetch refs", () => {
    expect(resolveBrandLogoLink(brandfetchRef())).toBe("https://figma.com");
  });

  it("uses an explicit custom link when present", () => {
    expect(resolveBrandLogoLink(brandfetchRef({ link: "https://figma.com/community" }))).toBe(
      "https://figma.com/community",
    );
  });

  it("returns null when linking is disabled", () => {
    expect(resolveBrandLogoLink(brandfetchRef({ linkDisabled: true }))).toBeNull();
  });

  it("returns null for custom refs without an explicit link", () => {
    expect(resolveBrandLogoLink(customRef())).toBeNull();
  });
});

describe("brandDefinition", () => {
  it("creates default content with empty items and sensible size/gap", () => {
    const content = brandDefinition.defaultContent();
    expect(content.type).toBe("brand");
    expect(content.items).toEqual([]);
    expect(content.iconSize).toBe(32);
    expect(content.gap).toBe(12);
  });

  it("preserves provided data", () => {
    const items: BrandLogoRef[] = [brandfetchRef()];
    const content = brandDefinition.defaultContent({ items, iconSize: 48, gap: 4 });
    expect(content.items).toBe(items);
    expect(content.iconSize).toBe(48);
    expect(content.gap).toBe(4);
  });

  it("validates any array of items (including empty)", () => {
    expect(brandDefinition.validate(brandDefinition.defaultContent())).toBe(true);
    expect(
      brandDefinition.validate(brandDefinition.defaultContent({ items: [brandfetchRef()] })),
    ).toBe(true);
  });

  it("is gated behind the beta-brand-tile feature flag", () => {
    expect(brandDefinition.featureFlag).toBe("beta-brand-tile");
  });
});
