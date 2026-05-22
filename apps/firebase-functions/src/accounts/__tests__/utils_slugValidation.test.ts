import { describe, expect, it } from "vitest";
import { isValidSlugFormat } from "../utils_slugValidation.js";

describe("isValidSlugFormat", () => {
  it.each([
    ["empty string", ""],
    ["null", null],
    ["undefined", undefined],
    ["number", 123],
    ["object", { slug: "valid-slug" }],
  ])("returns false for %s", (_label, value) => {
    expect(isValidSlugFormat(value as string)).toBe(false);
  });

  it.each([
    ["two characters", "ab"],
    ["thirty-one characters", "a".repeat(31)],
  ])("returns false for length boundary: %s", (_label, slug) => {
    expect(isValidSlugFormat(slug)).toBe(false);
  });

  it.each([
    ["minimum length", "abc"],
    ["maximum length", "a".repeat(30)],
    ["lowercase letters", "matty"],
    ["numbers", "user123"],
    ["internal hyphen", "matt-galley"],
    ["mixed allowed characters", "abc-123-def"],
  ])("returns true for %s", (_label, slug) => {
    expect(isValidSlugFormat(slug)).toBe(true);
  });

  it.each([
    ["uppercase letters", "Matt"],
    ["leading hyphen", "-matt"],
    ["trailing hyphen", "matt-"],
    ["space", "matt galley"],
    ["underscore", "matt_galley"],
    ["dot", "matt.galley"],
    ["slash", "matt/galley"],
    ["unicode", "café"],
    ["emoji", "matt😀"],
  ])("returns false for %s", (_label, slug) => {
    expect(isValidSlugFormat(slug)).toBe(false);
  });
});
