import { describe, expect, it } from "vitest";
import {
  buildFirstGridEmail,
  buildSupporterBadgeEmail,
  buildWelcomeEmail,
} from "../utils_emailTemplates.js";

describe("buildWelcomeEmail", () => {
  it("includes a personalized greeting when display name is set", () => {
    const { subject, html } = buildWelcomeEmail({ displayName: "Matt" });
    expect(subject).toBe("Welcome to Grids");
    expect(html).toContain("Hi Matt,");
    expect(html).toContain("https://grids.so/dashboard");
    expect(html).toContain("grids_logo.png");
    expect(html).toContain(">grids</td>");
    expect(html).toContain("https://discord.gg/5dVU9EPPAY");
    expect(html).not.toContain("Reply to this email");
  });

  it("uses a generic greeting when display name is missing", () => {
    const { html } = buildWelcomeEmail({ displayName: null });
    expect(html).toContain("Hi there,");
  });
});

describe("buildFirstGridEmail", () => {
  it("links to slug URL when slug is available", () => {
    const { subject, html } = buildFirstGridEmail({
      displayName: "Matt",
      gridName: "My Grid",
      gridId: "grid-1",
      slug: "matt",
    });

    expect(subject).toBe("My Grid is live");
    expect(html).toContain("https://grids.so/matt");
    expect(html).toContain("My Grid is live.");
    expect(html).toContain("grids_logo.png");
  });

  it("falls back to grid id URL when slug is missing", () => {
    const { html } = buildFirstGridEmail({
      displayName: null,
      gridName: "Untitled",
      gridId: "grid-abc",
      slug: null,
    });

    expect(html).toContain("https://grids.so/grid/grid-abc");
  });
});

describe("buildSupporterBadgeEmail", () => {
  it("mentions the supporter badge and Discord support", () => {
    const { subject, html } = buildSupporterBadgeEmail({ displayName: "Matt" });
    expect(subject).toBe("Thank you for supporting Grids ✦");
    expect(html).toContain("Supporter");
    expect(html).toContain("https://grids.so/dashboard");
    expect(html).toContain("https://discord.gg/5dVU9EPPAY");
    expect(html).not.toContain("reply to this email");
  });
});
