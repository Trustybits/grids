import { describe, expect, it } from "vitest";
import {
  getHandleFormatIssue,
  numberedHandles,
  suggestHandles,
  toHandle,
} from "../handleSuggestions";

describe("getHandleFormatIssue", () => {
  it("accepts valid handles", () => {
    expect(getHandleFormatIssue("amor")).toBeNull();
    expect(getHandleFormatIssue("amor-rana-2")).toBeNull();
  });

  it("flags length and format problems", () => {
    expect(getHandleFormatIssue("ab")).toBe("too-short");
    expect(getHandleFormatIssue("a".repeat(31))).toBe("too-long");
    expect(getHandleFormatIssue("-amor")).toBe("invalid-format");
    expect(getHandleFormatIssue("amor-")).toBe("invalid-format");
    expect(getHandleFormatIssue("Amor")).toBe("invalid-format");
    expect(getHandleFormatIssue("am_or")).toBe("invalid-format");
  });
});

describe("toHandle", () => {
  it("normalizes names", () => {
    expect(toHandle("Amor Rana")).toBe("amor-rana");
    expect(toHandle("Amor Rana", "")).toBe("amorrana");
    expect(toHandle("José Álvarez")).toBe("jose-alvarez");
    expect(toHandle("  --Hi!! there--  ")).toBe("hi-there");
  });

  it("returns empty when nothing valid is left", () => {
    expect(toHandle("")).toBe("");
    expect(toHandle("李")).toBe("");
    expect(toHandle("ab")).toBe("");
  });

  it("trims to 30 characters without a trailing hyphen", () => {
    const handle = toHandle("a".repeat(29) + " bcd");
    expect(handle.length).toBeLessThanOrEqual(30);
    expect(handle.endsWith("-")).toBe(false);
  });
});

describe("suggestHandles", () => {
  it("prefers the Google name, then the email", () => {
    expect(
      suggestHandles({ displayName: "Amor Rana", email: "amor.r@gmail.com" }),
    ).toEqual(["amor-rana", "amorrana", "amor", "amor-r", "amorr"]);
  });

  it("falls back to the email when there is no name", () => {
    expect(suggestHandles({ displayName: null, email: "sam.lee@acme.io" })).toEqual([
      "sam-lee",
      "samlee",
    ]);
  });

  it("drops unusable candidates", () => {
    expect(suggestHandles({ displayName: "Al", email: "x@y.z" })).toEqual([]);
  });
});

describe("numberedHandles", () => {
  it("adds distinct two-digit suffixes", () => {
    const values = [0.1, 0.1, 0.5, 0.9];
    let i = 0;
    const result = numberedHandles("amor", 3, () => values[i++ % values.length]);
    expect(result).toEqual(["amor-19", "amor-55", "amor-91"]);
  });

  it("keeps results within the max length", () => {
    for (const handle of numberedHandles("a".repeat(30), 3)) {
      expect(handle.length).toBeLessThanOrEqual(30);
      expect(getHandleFormatIssue(handle)).toBeNull();
    }
  });
});
