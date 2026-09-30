import { describe, expect, it } from "vitest";
import { getMailProviderLink } from "../mailProviderLinks";

const id = (email: string) => getMailProviderLink(email)?.id ?? null;

describe("getMailProviderLink", () => {
  it("offers Gmail for Gmail addresses", () => {
    expect(id("alice@gmail.com")).toBe("gmail");
    expect(id("Alice@GoogleMail.com")).toBe("gmail");
  });

  it("offers Outlook for Microsoft consumer addresses", () => {
    for (const email of ["a@outlook.com", "a@hotmail.co.uk", "a@live.fr", "a@msn.com"]) {
      expect(id(email)).toBe("outlook");
    }
  });

  it("offers Gmail for custom domains", () => {
    expect(id("sam@acme.io")).toBe("gmail");
  });

  it("offers nothing for other consumer providers", () => {
    for (const email of ["a@yahoo.com", "a@icloud.com", "a@proton.me", "a@aol.com"]) {
      expect(id(email)).toBeNull();
    }
  });

  it("offers nothing for input without a domain", () => {
    expect(id("")).toBeNull();
    expect(id("noatsign")).toBeNull();
    expect(id("trailing@")).toBeNull();
  });

  it("does not treat lookalike domains as Outlook", () => {
    expect(id("a@notoutlook.com")).toBe("gmail");
    expect(id("a@outlook.com.evil.io")).toBe("gmail");
  });
});
