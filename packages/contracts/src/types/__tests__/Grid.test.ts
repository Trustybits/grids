import { describe, expect, it } from "vitest";
import {
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
  LEGACY_RESPONSIVE_LAYOUT_VERSION,
  NEW_GRID_RESPONSIVE_LAYOUT_VERSION,
  RESPONSIVE_LAYOUT_VERSIONS,
  isResponsiveLayoutUpgradeEligible,
  isResponsiveLayoutVersion,
  resolveResponsiveLayoutVersion,
} from "../index.js";

describe("responsive layout version contract", () => {
  it("publishes the exact supported version vocabulary", () => {
    expect(RESPONSIVE_LAYOUT_VERSIONS).toEqual(["legacy-v1", "griddle-v1"]);
    expect(LEGACY_RESPONSIVE_LAYOUT_VERSION).toBe("legacy-v1");
    expect(GRIDDLE_RESPONSIVE_LAYOUT_VERSION).toBe("griddle-v1");
  });

  it("keeps the new-grid default separate from the defensive read fallback", () => {
    expect(NEW_GRID_RESPONSIVE_LAYOUT_VERSION).toBe("griddle-v1");
    expect(resolveResponsiveLayoutVersion(undefined)).toBe("legacy-v1");
  });

  it.each(["legacy-v1", "griddle-v1"])(
    "accepts the supported value %s",
    (value) => {
      expect(isResponsiveLayoutVersion(value)).toBe(true);
      expect(resolveResponsiveLayoutVersion(value)).toBe(value);
    },
  );

  it.each([undefined, null, "griddle-v2", "", 1, {}])(
    "resolves unsupported runtime value %j to legacy-v1",
    (value) => {
      expect(isResponsiveLayoutVersion(value)).toBe(false);
      expect(resolveResponsiveLayoutVersion(value)).toBe("legacy-v1");
    },
  );

  it("limits upgrade eligibility to absent and exact legacy-v1 values", () => {
    expect(isResponsiveLayoutUpgradeEligible(undefined)).toBe(true);
    expect(isResponsiveLayoutUpgradeEligible("legacy-v1")).toBe(true);

    expect(isResponsiveLayoutUpgradeEligible("griddle-v1")).toBe(false);
    expect(isResponsiveLayoutUpgradeEligible("griddle-v2")).toBe(false);
    expect(isResponsiveLayoutUpgradeEligible(null)).toBe(false);
    expect(isResponsiveLayoutUpgradeEligible("")).toBe(false);
  });
});
