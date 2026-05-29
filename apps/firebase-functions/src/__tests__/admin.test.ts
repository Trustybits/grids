import { beforeEach, describe, expect, it, vi } from "vitest";

const { adminState, adminMock } = vi.hoisted(() => {
  const adminState = {
    initializeApp: vi.fn(),
  };
  const adminMock = {
    initializeApp: adminState.initializeApp,
  };

  return { adminState, adminMock };
});

vi.mock("firebase-admin", () => ({
  default: adminMock,
}));

beforeEach(() => {
  vi.resetModules();
  adminState.initializeApp.mockClear();
});

describe("admin bootstrap", () => {
  it("initializes Firebase Admin when the module is imported", async () => {
    await import("../admin.js");

    expect(adminState.initializeApp).toHaveBeenCalledTimes(1);
    expect(adminState.initializeApp).toHaveBeenCalledWith();
  });

  it("exports the initialized Firebase Admin module", async () => {
    const module = await import("../admin.js");

    expect(module.default).toBe(adminMock);
  });
});
