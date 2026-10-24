import { beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";

const store = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  transactionFails: false,
}));

vi.mock("../../admin.js", () => {
  const docRef = (path: string) => ({
    path,
    set: async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
      store.docs.set(path, options?.merge ? { ...store.docs.get(path), ...data } : data);
    },
  });
  const db = {
    collection: (name: string) => ({ doc: (id: string) => docRef(`${name}/${id}`) }),
    runTransaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      if (store.transactionFails) throw new Error("firestore down");
      return callback({
        get: async (ref: { path: string }) => ({ data: () => store.docs.get(ref.path) }),
        set: (ref: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean }) =>
          void docRef(ref.path).set(data, options),
      });
    },
  };
  return { default: { firestore: () => db } };
});

vi.mock("firebase-functions/logger", () => ({
  warn: vi.fn(),
}));

import { readThroughXCache } from "../utils_xCache.js";

const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;
const KEY = "post_1";
const PATH = `xCache/${KEY}`;

interface Data {
  value: string;
  fetchedAt: number;
  note?: string;
}

function request(overrides: { canSeed?: boolean; load?: () => Promise<Data> } = {}) {
  return {
    key: KEY,
    refreshAfterMs: () => HOUR,
    canSeed: overrides.canSeed ?? true,
    load: vi.fn(overrides.load ?? (async () => ({ value: "fresh", fetchedAt: NOW }))),
  };
}

beforeEach(() => {
  store.docs.clear();
  store.transactionFails = false;
  vi.mocked(logger.warn).mockClear();
  vi.spyOn(Date, "now").mockReturnValue(NOW);
});

describe("readThroughXCache", () => {
  it("serves a fresh entry without loading", async () => {
    store.docs.set(PATH, { data: { value: "cached", fetchedAt: NOW - HOUR / 2 } });
    const req = request({ canSeed: false });

    await expect(readThroughXCache(req)).resolves.toEqual({
      value: "cached",
      fetchedAt: NOW - HOUR / 2,
    });
    expect(req.load).not.toHaveBeenCalled();
  });

  it("refreshes a stale entry for anyone, and stores the result", async () => {
    store.docs.set(PATH, { data: { value: "cached", fetchedAt: NOW - 2 * HOUR } });
    const req = request({ canSeed: false });

    await expect(readThroughXCache(req)).resolves.toEqual({ value: "fresh", fetchedAt: NOW });
    expect(store.docs.get(PATH)).toEqual({ data: { value: "fresh", fetchedAt: NOW } });
  });

  it("lets signed-in callers fill an empty entry, but not anonymous ones", async () => {
    const anonymous = request({ canSeed: false });
    await expect(readThroughXCache(anonymous)).resolves.toBeNull();
    expect(anonymous.load).not.toHaveBeenCalled();
    expect(store.docs.has(PATH)).toBe(false);

    await expect(readThroughXCache(request())).resolves.toEqual({
      value: "fresh",
      fetchedAt: NOW,
    });
  });

  it("serves the stored copy while another caller is refreshing", async () => {
    store.docs.set(PATH, {
      data: { value: "cached", fetchedAt: NOW - 2 * HOUR },
      retryAfter: NOW + 1000,
    });
    const req = request();

    await expect(readThroughXCache(req)).resolves.toMatchObject({ value: "cached" });
    expect(req.load).not.toHaveBeenCalled();
  });

  it("falls back to the stored copy when a refresh fails, and backs off", async () => {
    store.docs.set(PATH, { data: { value: "cached", fetchedAt: NOW - 2 * HOUR } });
    const req = request({
      load: async () => {
        throw new Error("x.com returned 429");
      },
    });

    await expect(readThroughXCache(req)).resolves.toMatchObject({ value: "cached" });
    expect(store.docs.get(PATH)?.retryAfter).toBe(NOW + HOUR);

    const next = request({ canSeed: false });
    await readThroughXCache(next);
    expect(next.load).not.toHaveBeenCalled();
  });

  it("rethrows a failed load when nothing is stored", async () => {
    const req = request({
      load: async () => {
        throw new Error("x.com returned 503");
      },
    });

    await expect(readThroughXCache(req)).rejects.toThrow("x.com returned 503");
  });

  it("drops undefined fields before storing", async () => {
    const req = request({
      load: async () => ({ value: "fresh", fetchedAt: NOW, note: undefined }),
    });

    await readThroughXCache(req);
    expect(store.docs.get(PATH)?.data).not.toHaveProperty("note");
  });

  it("loads directly for signed-in callers when the cache can't be read", async () => {
    store.transactionFails = true;

    await expect(readThroughXCache(request())).resolves.toMatchObject({ value: "fresh" });
    await expect(readThroughXCache(request({ canSeed: false }))).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith("X cache read failed", {
      error: "Error: firestore down",
      key: KEY,
    });
  });
});
