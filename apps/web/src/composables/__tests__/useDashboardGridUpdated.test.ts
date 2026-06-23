/**
 * Tests for useDashboardGridUpdated — derives a human label + tooltip for when
 * a grid was last persisted, preferring updatedAt and falling back to createdAt.
 *
 * The TimeConversion and RelativeTime utilities are mocked so the test isolates
 * this composable's own logic: which timestamp it picks, and how it maps a
 * resolved/absent date onto label and title.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import type { Grid } from "@grids/contracts/types";
import { useDashboardGridUpdated } from "@/composables/useDashboardGridUpdated";
import { valueToDate } from "@/utils/TimeConversion";
import { formatRelativeSince } from "@/utils/RelativeTime";

vi.mock("@/utils/TimeConversion", () => ({
  valueToDate: vi.fn(),
}));

vi.mock("@/utils/RelativeTime", () => ({
  formatRelativeSince: vi.fn(),
}));

const mockValueToDate = vi.mocked(valueToDate);
const mockFormatRelativeSince = vi.mocked(formatRelativeSince);
type GridTimestamps = Pick<Grid, "updatedAt" | "createdAt">;

/**
 * Build a grid-timestamps source from opaque sentinels. The real fields are
 * Firestore-ish timestamps, but here they only ever flow through the mocked
 * valueToDate, so any value works — the cast keeps the call sites readable.
 */
function stamps(updatedAt: unknown, createdAt: unknown): GridTimestamps {
  return { updatedAt, createdAt } as unknown as GridTimestamps;
}

beforeEach(() => {
  mockValueToDate.mockReset();
  mockFormatRelativeSince.mockReset();
});

describe("updatedAtDate selection", () => {
  it("uses updatedAt when it resolves to a date", () => {
    const updated = new Date("2026-06-10T00:00:00Z");
    mockValueToDate.mockImplementation((v) =>
      v === "UPDATED" ? updated : null,
    );

    const { updatedAtDate } = useDashboardGridUpdated(
      stamps("UPDATED", "CREATED"),
    );

    expect(updatedAtDate.value).toBe(updated);
    // createdAt is only consulted when updatedAt is null — first call wins here.
    expect(mockValueToDate).toHaveBeenCalledWith("UPDATED");
  });

  it("falls back to createdAt when updatedAt does not resolve", () => {
    const created = new Date("2026-06-01T00:00:00Z");
    mockValueToDate.mockImplementation((v) =>
      v === "CREATED" ? created : null,
    );

    const { updatedAtDate } = useDashboardGridUpdated(
      stamps("UPDATED", "CREATED"),
    );

    expect(updatedAtDate.value).toBe(created);
    expect(mockValueToDate).toHaveBeenCalledWith("CREATED");
  });

  it("is null when neither timestamp resolves", () => {
    mockValueToDate.mockReturnValue(null);
    const { updatedAtDate } = useDashboardGridUpdated(
      stamps(undefined, undefined),
    );
    expect(updatedAtDate.value).toBeNull();
  });

  it("reacts to a reactive grid source", () => {
    const a = new Date("2026-01-01T00:00:00Z");
    const b = new Date("2026-02-02T00:00:00Z");
    mockValueToDate.mockImplementation((v) => (v === "A" ? a : v === "B" ? b : null));

    const source = ref(stamps("A", undefined));
    const { updatedAtDate } = useDashboardGridUpdated(source);
    expect(updatedAtDate.value).toBe(a);

    source.value = stamps("B", undefined);
    expect(updatedAtDate.value).toBe(b);
  });
});

describe("label", () => {
  it("returns the relative-time string when a date is resolved", () => {
    mockValueToDate.mockReturnValue(new Date("2026-06-10T00:00:00Z"));
    mockFormatRelativeSince.mockReturnValue("3d ago");

    const { label } = useDashboardGridUpdated(stamps("x", "y"));

    expect(label.value).toBe("3d ago");
    expect(mockFormatRelativeSince).toHaveBeenCalledWith(expect.any(Date));
  });

  it("returns an em-dash placeholder when no date is resolved", () => {
    mockValueToDate.mockReturnValue(null);
    const { label } = useDashboardGridUpdated(stamps(undefined, undefined));
    expect(label.value).toBe("—");
    expect(mockFormatRelativeSince).not.toHaveBeenCalled();
  });
});

describe("title", () => {
  it("returns a 'Last updated …' tooltip with the locale string when resolved", () => {
    const date = new Date("2026-06-10T12:00:00Z");
    mockValueToDate.mockReturnValue(date);

    const { title } = useDashboardGridUpdated(stamps("x", "y"));

    expect(title.value).toBe(`Last updated ${date.toLocaleString()}`);
  });

  it("returns an empty string when no date is resolved", () => {
    mockValueToDate.mockReturnValue(null);
    const { title } = useDashboardGridUpdated(stamps(undefined, undefined));
    expect(title.value).toBe("");
  });
});
