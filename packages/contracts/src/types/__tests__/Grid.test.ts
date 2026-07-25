import { describe, expect, it } from "vitest";
import {
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
  NEW_GRID_RESPONSIVE_LAYOUT_VERSION,
  RESPONSIVE_LAYOUT_VERSIONS,
  getResponsiveLayoutVersionStatus,
  isResponsiveLayoutVersion,
  resolveResponsiveLayoutVersion,
} from "../index.js";

describe("responsive layout version contract", () => {
  it("publishes griddle-v1 as the sole supported version", () => {
    expect(RESPONSIVE_LAYOUT_VERSIONS).toEqual(["griddle-v1"]);
    expect(GRIDDLE_RESPONSIVE_LAYOUT_VERSION).toBe("griddle-v1");
  });

  it("uses griddle-v1 for new grids and every defensive read fallback", () => {
    expect(NEW_GRID_RESPONSIVE_LAYOUT_VERSION).toBe("griddle-v1");
    expect(resolveResponsiveLayoutVersion(undefined)).toBe("griddle-v1");
  });

  it("accepts only griddle-v1 as a supported stamp", () => {
    expect(isResponsiveLayoutVersion("griddle-v1")).toBe(true);
    expect(isResponsiveLayoutVersion("griddle-v2")).toBe(false);
  });

  it.each([undefined, null, "griddle-v2", "invalid", "", 1, {}])(
    "resolves runtime value %j to griddle-v1",
    (value) => {
      expect(resolveResponsiveLayoutVersion(value)).toBe("griddle-v1");
    },
  );

  it("classifies raw stamps independently from rendering normalization", () => {
    expect(getResponsiveLayoutVersionStatus(undefined)).toBe("missing");
    expect(getResponsiveLayoutVersionStatus("griddle-v1")).toBe("supported");
    expect(getResponsiveLayoutVersionStatus("griddle-v2")).toBe(
      "unsupported",
    );
    expect(getResponsiveLayoutVersionStatus("griddle-v2")).toBe(
      "unsupported",
    );
    expect(getResponsiveLayoutVersionStatus(null)).toBe("unsupported");
  });
});
