import { describe, expect, it } from "vitest";
import {
  REMOVE_BRANDING_MIN_CENTS,
  SUPPORTER_BADGE_MIN_CENTS,
} from "../constants.js";

describe("badge constants", () => {
  it("sets the supporter badge threshold to one dollar in cents", () => {
    expect(SUPPORTER_BADGE_MIN_CENTS).toBe(100);
  });

  it("sets the remove-branding threshold to ten dollars in cents", () => {
    expect(REMOVE_BRANDING_MIN_CENTS).toBe(1000);
  });

  it("keeps remove-branding as a higher tier than supporter", () => {
    expect(REMOVE_BRANDING_MIN_CENTS).toBeGreaterThan(SUPPORTER_BADGE_MIN_CENTS);
  });

  it("uses whole-cent positive integer thresholds", () => {
    expect(Number.isInteger(SUPPORTER_BADGE_MIN_CENTS)).toBe(true);
    expect(Number.isInteger(REMOVE_BRANDING_MIN_CENTS)).toBe(true);
    expect(SUPPORTER_BADGE_MIN_CENTS).toBeGreaterThan(0);
    expect(REMOVE_BRANDING_MIN_CENTS).toBeGreaterThan(0);
  });
});
