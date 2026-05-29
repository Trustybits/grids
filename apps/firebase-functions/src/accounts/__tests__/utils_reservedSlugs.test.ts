import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS } from "../utils_reservedSlugs.js";
import { isValidSlugFormat } from "../utils_slugValidation.js";

describe("RESERVED_SLUGS", () => {
  it("contains the public and application routes that must not be claimable", () => {
    expect(RESERVED_SLUGS).toEqual(
      expect.arrayContaining([
        "admin",
        "api",
        "app",
        "auth",
        "dashboard",
        "docs",
        "grid",
        "grids",
        "login",
        "logout",
        "privacy",
        "profile",
        "roadmap",
        "settings",
        "signup",
        "support",
        "terms",
        "user",
        "users",
        "www",
      ]),
    );
  });

  it("contains file-like reserved paths that are intentionally invalid slug formats", () => {
    expect(RESERVED_SLUGS).toEqual(
      expect.arrayContaining(["favicon.ico", "robots.txt", "sitemap.xml"]),
    );
    expect(isValidSlugFormat("favicon.ico")).toBe(false);
    expect(isValidSlugFormat("robots.txt")).toBe(false);
    expect(isValidSlugFormat("sitemap.xml")).toBe(false);
  });

  it("does not contain duplicate entries", () => {
    expect(new Set(RESERVED_SLUGS).size).toBe(RESERVED_SLUGS.length);
  });

  it("keeps every entry lowercase and trimmed for direct includes checks", () => {
    for (const slug of RESERVED_SLUGS) {
      expect(slug).toBe(slug.toLowerCase());
      expect(slug).toBe(slug.trim());
    }
  });

  it("keeps entries sorted so additions are easy to review", () => {
    expect(RESERVED_SLUGS).toEqual([...RESERVED_SLUGS].sort());
  });
});
