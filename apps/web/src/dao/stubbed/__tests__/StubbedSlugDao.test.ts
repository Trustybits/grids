// Unit tests for StubbedSlugDao — slug normalization, availability checks
// (format/reserved/own/taken/available), claiming (with single-slug-per-user
// enforcement), and default-grid updates. The AuthProvider singleton is mocked
// to supply the current user id.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StubbedSlugDao } from "../StubbedSlugDao";
import { registerAuthProvider } from "@/auth/AuthProviderSingleton";
import type { AuthProvider } from "@grids/contracts/auth";
import { STUBBED_USER_ID, memoryDatabase } from "../StubbedMemoryDatabase";
import { resetMemoryDatabase, flushMicrotasks } from "./memoryTestUtils";

let dao: StubbedSlugDao;
let getCurrentUserId: ReturnType<typeof vi.fn>;

function registerUser(id: string | null): void {
  getCurrentUserId = vi.fn(() => id);
  registerAuthProvider({
    getCurrentUserId,
  } as unknown as AuthProvider);
}

beforeEach(() => {
  resetMemoryDatabase();
  registerUser("user-1");
  dao = new StubbedSlugDao();
});

describe("StubbedSlugDao.getBySlug", () => {
  it("returns null when the slug is unknown", async () => {
    expect(await dao.getBySlug("nope")).toBeNull();
  });

  it("normalizes the slug before lookup", async () => {
    memoryDatabase.slugs.set("ada", { userId: "user-1" });
    expect(await dao.getBySlug("  ADA  ")).toEqual({ userId: "user-1" });
  });
});

describe("StubbedSlugDao.checkAvailability", () => {
  it("rejects slugs shorter than three characters as invalid-format", async () => {
    const result = await dao.checkAvailability("ab");
    expect(result).toMatchObject({ available: false, reason: "invalid-format" });
  });

  it("rejects slugs with invalid characters", async () => {
    const result = await dao.checkAvailability("Has Space");
    expect(result.reason).toBe("invalid-format");
  });

  it("rejects slugs with a leading or trailing hyphen", async () => {
    expect((await dao.checkAvailability("-abc")).reason).toBe("invalid-format");
    expect((await dao.checkAvailability("abc-")).reason).toBe("invalid-format");
  });

  it("rejects slugs longer than 30 characters", async () => {
    const result = await dao.checkAvailability("a".repeat(31));
    expect(result.reason).toBe("invalid-format");
  });

  it("accepts a minimal valid 3-character slug", async () => {
    const result = await dao.checkAvailability("abc");
    expect(result).toMatchObject({ available: true, reason: "available" });
  });

  it("accepts a maximal valid 30-character slug", async () => {
    const result = await dao.checkAvailability("a".repeat(30));
    expect(result).toMatchObject({ available: true, reason: "available" });
  });

  it("rejects reserved slugs", async () => {
    const result = await dao.checkAvailability("admin");
    expect(result).toMatchObject({ available: false, reason: "reserved" });
  });

  it("reports a slug already owned by the current user as own-slug", async () => {
    memoryDatabase.slugs.set("mine", { userId: "user-1" });
    const result = await dao.checkAvailability("mine");
    expect(result).toMatchObject({ available: true, reason: "own-slug" });
  });

  it("reports a slug owned by someone else as taken", async () => {
    memoryDatabase.slugs.set("theirs", { userId: "other" });
    const result = await dao.checkAvailability("theirs");
    expect(result).toMatchObject({ available: false, reason: "taken" });
  });

  it("reports an unclaimed valid slug as available", async () => {
    const result = await dao.checkAvailability("freehandle");
    expect(result).toMatchObject({ available: true, reason: "available" });
  });

  it("checks reserved status against the normalized slug", async () => {
    const result = await dao.checkAvailability("  ADMIN  ");
    expect(result.reason).toBe("reserved");
  });
});

describe("StubbedSlugDao.claim", () => {
  it("claims an available slug and records it for the user", async () => {
    const result = await dao.claim("newhandle");

    expect(result).toMatchObject({ success: true, slug: "newhandle" });
    expect(memoryDatabase.slugs.get("newhandle")).toEqual({
      userId: "user-1",
      defaultGridId: null,
    });
    expect(memoryDatabase.users.get("user-1")).toMatchObject({
      slug: "newhandle",
    });
  });

  it("fails to claim a reserved slug", async () => {
    const result = await dao.claim("admin");
    expect(result.success).toBe(false);
  });

  it("fails to claim a format-invalid slug", async () => {
    const result = await dao.claim("ab");
    expect(result.success).toBe(false);
    expect(memoryDatabase.slugs.has("ab")).toBe(false);
  });

  it("fails to claim a slug taken by another user", async () => {
    memoryDatabase.slugs.set("theirs", { userId: "other" });
    const result = await dao.claim("theirs");
    expect(result.success).toBe(false);
  });

  it("releases the user's previous slug when claiming a new one", async () => {
    memoryDatabase.slugs.set("oldhandle", { userId: "user-1" });
    await dao.claim("newhandle");

    expect(memoryDatabase.slugs.has("oldhandle")).toBe(false);
    expect(memoryDatabase.slugs.has("newhandle")).toBe(true);
  });

  it("succeeds when re-claiming the user's own slug", async () => {
    memoryDatabase.slugs.set("mine", { userId: "user-1" });
    const result = await dao.claim("mine");

    expect(result.success).toBe(true);
    expect(memoryDatabase.slugs.has("mine")).toBe(true);
  });

  it("notifies user subscribers after a successful claim", async () => {
    const callback = vi.fn();
    memoryDatabase.users.set("user-1", { name: "Ada" });
    // Subscribe via the shared channel the slug DAO emits on.
    const { channel, subscribeToValue } = await import(
      "../StubbedMemoryDatabase"
    );
    subscribeToValue(
      channel("user", "user-1"),
      () => memoryDatabase.users.get("user-1") ?? null,
      callback,
    );
    await flushMicrotasks();
    callback.mockClear();

    await dao.claim("newhandle");
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "newhandle" }),
    );
  });

  it("falls back to the stubbed user id when no user is authenticated", async () => {
    registerUser(null);
    const result = await dao.claim("anonslug");

    expect(result.success).toBe(true);
    expect(memoryDatabase.slugs.get("anonslug")).toMatchObject({
      userId: STUBBED_USER_ID,
    });
  });
});

describe("StubbedSlugDao.updateDefaultGrid", () => {
  it("updates the default grid on both the slug doc and the user", async () => {
    memoryDatabase.users.set("user-1", { slug: "mine" });
    memoryDatabase.slugs.set("mine", { userId: "user-1", defaultGridId: null });

    const result = await dao.updateDefaultGrid("grid-9");

    expect(result).toEqual({ success: true });
    expect(memoryDatabase.slugs.get("mine")).toEqual({
      userId: "user-1",
      defaultGridId: "grid-9",
    });
    expect(memoryDatabase.users.get("user-1")).toMatchObject({
      defaultGridId: "grid-9",
    });
  });

  it("still updates the user when no slug is set", async () => {
    memoryDatabase.users.set("user-1", { name: "Ada" });

    const result = await dao.updateDefaultGrid("grid-9");

    expect(result).toEqual({ success: true });
    expect(memoryDatabase.users.get("user-1")).toMatchObject({
      defaultGridId: "grid-9",
    });
  });

  it("accepts null to clear the default grid", async () => {
    memoryDatabase.users.set("user-1", { slug: "mine" });
    memoryDatabase.slugs.set("mine", {
      userId: "user-1",
      defaultGridId: "grid-1",
    });

    await dao.updateDefaultGrid(null);

    expect(memoryDatabase.slugs.get("mine")).toEqual({
      userId: "user-1",
      defaultGridId: null,
    });
  });
});
