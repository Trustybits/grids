import { describe, it, expect } from "vitest";
import { formatBytes, STORAGE_QUOTA_BYTES } from "../StorageFormat";

describe("formatBytes", () => {
  it("formats zero and non-finite input as 0 MB", () => {
    expect(formatBytes(0)).toBe("0 MB");
    expect(formatBytes(-100)).toBe("0 MB");
    expect(formatBytes(Number.NaN)).toBe("0 MB");
  });

  it("picks the largest fitting unit", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(24 * 1024 * 1024)).toBe("24 MB");
    expect(formatBytes(STORAGE_QUOTA_BYTES)).toBe("5 GB");
  });

  it("rounds to one decimal for fractional values and drops trailing zeros", () => {
    expect(formatBytes(1.4 * 1024 * 1024 * 1024)).toBe("1.4 GB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("rounds to a whole number for values at or above 100", () => {
    expect(formatBytes(150.6 * 1024 * 1024)).toBe("151 MB");
  });

  it("exposes the 5 GB free-tier quota constant", () => {
    expect(STORAGE_QUOTA_BYTES).toBe(5_368_709_120);
  });
});
