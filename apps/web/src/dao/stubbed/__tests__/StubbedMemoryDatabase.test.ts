// Unit tests for the StubbedMemoryDatabase helper module — the pure utility
// functions (id/clone/sanitize/merge/channel/grid coercion/leaderboard) and the
// in-memory pub/sub layer (subscribeToValue / emit). The shared memoryDatabase
// singleton is reset before every test so suites stay isolated.
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  channel,
  cloneValue,
  createId,
  emit,
  isPlainObject,
  leaderboardEntries,
  memoryDatabase,
  mergeRecord,
  sanitizeStubbedValue,
  subscribeToValue,
  todayIsoDate,
  toGrid,
} from "../StubbedMemoryDatabase";
import type { UserGameData } from "@grids/contracts/types";
import { resetMemoryDatabase, flushMicrotasks } from "./memoryTestUtils";

beforeEach(() => {
  resetMemoryDatabase();
});

describe("createId", () => {
  it("defaults to the 'stub' prefix", () => {
    expect(createId()).toMatch(/^stub_/);
  });

  it("uses the provided prefix", () => {
    expect(createId("grid")).toMatch(/^grid_/);
  });

  it("returns a unique id on every call", () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId()));
    expect(ids.size).toBe(100);
  });
});

describe("cloneValue", () => {
  it("returns null and undefined unchanged", () => {
    expect(cloneValue(null)).toBeNull();
    expect(cloneValue(undefined)).toBeUndefined();
  });

  it("returns a deep copy that is not the same reference", () => {
    const original = { a: 1, nested: { b: 2 } };
    const copy = cloneValue(original);

    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy.nested).not.toBe(original.nested);
  });

  it("mutating the clone does not affect the original", () => {
    const original = { list: [1, 2, 3] };
    const copy = cloneValue(original);
    copy.list.push(4);

    expect(original.list).toEqual([1, 2, 3]);
  });

  it("clones Set instances by value", () => {
    const original = new Set(["a", "b"]);
    const copy = cloneValue(original);

    expect(copy).not.toBe(original);
    expect([...copy]).toEqual(["a", "b"]);
  });

  it("preserves Date instances as Dates", () => {
    const original = { when: new Date("2024-01-01T00:00:00.000Z") };
    const copy = cloneValue(original);

    expect(copy.when).toBeInstanceOf(Date);
    expect(copy.when.getTime()).toBe(original.when.getTime());
  });

  it("falls back to JSON clone when structuredClone is unavailable", () => {
    // cloneValue checks `typeof structuredClone === "function"` at call time,
    // so removing it forces the JSON.parse(JSON.stringify(...)) fallback path.
    vi.stubGlobal("structuredClone", undefined);
    try {
      const original = { a: 1, nested: { b: [2, 3] } };
      const copy = cloneValue(original);

      expect(copy).toEqual(original);
      expect(copy).not.toBe(original);
      expect(copy.nested).not.toBe(original.nested);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("isPlainObject", () => {
  it("returns true for object literals", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
  });

  it("returns true for null-prototype objects", () => {
    expect(isPlainObject(Object.create(null))).toBe(true);
  });

  it("returns false for arrays", () => {
    expect(isPlainObject([])).toBe(false);
  });

  it("returns false for Date instances", () => {
    expect(isPlainObject(new Date())).toBe(false);
  });

  it("returns false for class instances", () => {
    class Thing {}
    expect(isPlainObject(new Thing())).toBe(false);
  });

  it("returns false for null and primitives", () => {
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
    expect(isPlainObject(42)).toBe(false);
    expect(isPlainObject("str")).toBe(false);
  });
});

describe("sanitizeStubbedValue", () => {
  it("returns primitives unchanged", () => {
    expect(sanitizeStubbedValue(42)).toBe(42);
    expect(sanitizeStubbedValue("hello")).toBe("hello");
    expect(sanitizeStubbedValue(true)).toBe(true);
    expect(sanitizeStubbedValue(null)).toBeNull();
  });

  it("drops undefined-valued keys from objects", () => {
    expect(sanitizeStubbedValue({ a: 1, b: undefined, c: 3 })).toEqual({
      a: 1,
      c: 3,
    });
  });

  it("converts undefined array elements to null", () => {
    expect(sanitizeStubbedValue([1, undefined, 3])).toEqual([1, null, 3]);
  });

  it("recurses into nested objects and arrays", () => {
    const input = {
      keep: "x",
      drop: undefined,
      nested: { inner: undefined, val: 5 },
      list: [{ a: undefined, b: 2 }, undefined],
    };
    expect(sanitizeStubbedValue(input)).toEqual({
      keep: "x",
      nested: { val: 5 },
      list: [{ b: 2 }, null],
    });
  });

  it("preserves null values inside objects", () => {
    expect(sanitizeStubbedValue({ a: null })).toEqual({ a: null });
  });

  it("returns non-plain objects such as Dates unchanged", () => {
    const date = new Date("2024-01-01T00:00:00.000Z");
    expect(sanitizeStubbedValue(date)).toBe(date);
  });
});

describe("mergeRecord", () => {
  it("returns the sanitized patch when there is no existing record", () => {
    expect(mergeRecord(undefined, { a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it("merges patch over existing, with patch taking precedence", () => {
    expect(mergeRecord({ a: 1, b: 2 }, { b: 3, c: 4 })).toEqual({
      a: 1,
      b: 3,
      c: 4,
    });
  });

  it("does not overwrite existing keys with undefined patch values", () => {
    expect(mergeRecord({ a: 1 }, { a: undefined, b: 2 })).toEqual({
      a: 1,
      b: 2,
    });
  });

  it("clones the existing record so the source is not mutated", () => {
    const existing = { nested: { a: 1 } };
    const merged = mergeRecord(existing, { other: 2 }) as {
      nested: { a: number };
    };
    merged.nested.a = 99;

    expect(existing.nested.a).toBe(1);
  });
});

describe("channel", () => {
  it("joins parts with a colon", () => {
    expect(channel("a", "b", "c")).toBe("a:b:c");
  });

  it("returns a single part unchanged", () => {
    expect(channel("solo")).toBe("solo");
  });

  it("returns an empty string when given no parts", () => {
    expect(channel()).toBe("");
  });
});

describe("todayIsoDate", () => {
  it("returns today's date in YYYY-MM-DD form", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T15:30:00.000Z"));
    try {
      expect(todayIsoDate()).toBe("2026-06-18");
    } finally {
      vi.useRealTimers();
    }
  });

  it("matches the ISO date pattern", () => {
    expect(todayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("toGrid", () => {
  it("applies defaults for an empty data object", () => {
    expect(toGrid("grid-1", {})).toEqual({
      id: "grid-1",
      userId: "",
      rev: 0,
      name: "Untitled",
      colNum: 12,
      verticalCompact: true,
      backgroundImageSrc: "",
      backgroundImageHash: undefined,
      backgroundEmbed: false,
      backgroundColor: "",
      ogImageSrc: "",
      themeId: undefined,
      tiles: [],
      overrides: undefined,
      duplicatable: false,
      createdAt: null,
      updatedAt: null,
      lastOpenedAt: null,
    });
  });

  it("uses provided values when they have the correct type", () => {
    const result = toGrid("grid-2", {
      userId: "user-1",
      name: "My Grid",
      colNum: 6,
      verticalCompact: false,
      duplicatable: true,
      themeId: "dark",
    });

    expect(result).toMatchObject({
      id: "grid-2",
      userId: "user-1",
      name: "My Grid",
      colNum: 6,
      verticalCompact: false,
      duplicatable: true,
      themeId: "dark",
    });
  });

  it("falls back to defaults when values have the wrong type", () => {
    const result = toGrid("grid-3", {
      userId: 123,
      colNum: "not-a-number",
      verticalCompact: "yes",
      tiles: "not-an-array",
    });

    expect(result.userId).toBe("");
    expect(result.colNum).toBe(12);
    expect(result.verticalCompact).toBe(true);
    expect(result.tiles).toEqual([]);
  });

  it("clones tiles instead of holding the source reference", () => {
    const tiles = [{ i: "t1" }];
    const result = toGrid("grid-4", { tiles });

    expect(result.tiles).toEqual(tiles);
    expect(result.tiles).not.toBe(tiles);
  });

  it("preserves nullable timestamp fields when provided", () => {
    const createdAt = new Date("2024-01-01T00:00:00.000Z");
    const result = toGrid("grid-5", { createdAt });

    expect(result.createdAt).toBe(createdAt);
  });

  it("clones a plain-object overrides map", () => {
    const overrides = { lg: { t1: { x: 0, y: 0, w: 1, h: 1 } } };
    const result = toGrid("grid-6", { overrides });

    expect(result.overrides).toEqual(overrides);
    expect(result.overrides).not.toBe(overrides);
  });

  it("falls back to undefined overrides when not a plain object", () => {
    expect(toGrid("grid-7", { overrides: "nope" }).overrides).toBeUndefined();
    expect(toGrid("grid-8", {}).overrides).toBeUndefined();
  });
});

describe("leaderboardEntries", () => {
  function seed(userId: string, totalClicks: number): void {
    memoryDatabase.userGameData.set(userId, {
      userId,
      displayName: `name-${userId}`,
      totalClicks,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as UserGameData);
  }

  it("returns an empty array when there is no game data", () => {
    expect(leaderboardEntries(10)).toEqual([]);
  });

  it("sorts entries by totalClicks descending", () => {
    seed("a", 5);
    seed("b", 20);
    seed("c", 10);

    const entries = leaderboardEntries(10);

    expect(entries.map((e) => e.userId)).toEqual(["b", "c", "a"]);
  });

  it("limits results to topN", () => {
    seed("a", 5);
    seed("b", 20);
    seed("c", 10);

    expect(leaderboardEntries(2).map((e) => e.userId)).toEqual(["b", "c"]);
  });

  it("projects only userId, displayName and totalClicks", () => {
    seed("a", 5);

    expect(leaderboardEntries(1)).toEqual([
      { userId: "a", displayName: "name-a", totalClicks: 5 },
    ]);
  });
});

describe("subscribeToValue / emit", () => {
  it("delivers the initial value asynchronously on subscribe", async () => {
    const callback = vi.fn();
    subscribeToValue("ch-init", () => "value", callback);

    expect(callback).not.toHaveBeenCalled();
    await flushMicrotasks();
    expect(callback).toHaveBeenCalledWith("value");
  });

  it("delivers a clone, not the source reference", async () => {
    const source = { count: 1 };
    const callback = vi.fn();
    subscribeToValue("ch-clone", () => source, callback);
    await flushMicrotasks();

    const delivered = callback.mock.calls[0][0];
    expect(delivered).toEqual(source);
    expect(delivered).not.toBe(source);
  });

  it("re-delivers the current value to subscribers on emit", async () => {
    let value = "first";
    const callback = vi.fn();
    subscribeToValue("ch-emit", () => value, callback);
    await flushMicrotasks();

    value = "second";
    emit("ch-emit");
    await flushMicrotasks();

    expect(callback).toHaveBeenNthCalledWith(1, "first");
    expect(callback).toHaveBeenNthCalledWith(2, "second");
  });

  it("does not deliver to a subscriber after it unsubscribes", async () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToValue("ch-unsub", () => "value", callback);
    await flushMicrotasks();
    callback.mockClear();

    unsubscribe();
    emit("ch-unsub");
    await flushMicrotasks();

    expect(callback).not.toHaveBeenCalled();
  });

  it("does not deliver an already-queued initial snapshot if unsubscribed first", async () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToValue("ch-race", () => "value", callback);
    // Unsubscribe before the queued microtask runs.
    unsubscribe();
    await flushMicrotasks();

    expect(callback).not.toHaveBeenCalled();
  });

  it("emitting on a channel with no subscribers is a no-op", async () => {
    expect(() => emit("ch-nobody")).not.toThrow();
    await flushMicrotasks();
  });

  it("delivers to multiple subscribers on the same channel", async () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    subscribeToValue("ch-multi", () => "value", cb1);
    subscribeToValue("ch-multi", () => "value", cb2);
    await flushMicrotasks();

    expect(cb1).toHaveBeenCalledWith("value");
    expect(cb2).toHaveBeenCalledWith("value");
  });

  it("isolates one subscriber's unsubscribe from another on the same channel", async () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = subscribeToValue("ch-iso", () => "value", cb1);
    subscribeToValue("ch-iso", () => "value", cb2);
    await flushMicrotasks();
    cb1.mockClear();
    cb2.mockClear();

    unsub1();
    emit("ch-iso");
    await flushMicrotasks();

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledWith("value");
  });
});
