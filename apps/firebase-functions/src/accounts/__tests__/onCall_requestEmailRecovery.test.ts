import { beforeEach, describe, expect, it, vi } from "vitest";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";
import { hasRecentPendingRequest } from "../utils_emailRecovery.js";

const { auth, added } = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
  },
  added: [] as Array<{ collection: string; data: Record<string, unknown> }>,
}));

vi.mock("firebase-functions/v1", () => ({
  https: { onCall: (handler: unknown) => handler },
}));

vi.mock("firebase-functions/v1/https", async () => {
  const { createHttpsModuleMock } = await import("../../__tests__/utils_testMocks.js");
  return createHttpsModuleMock();
});

vi.mock("firebase-functions/logger", () => ({
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

vi.mock("../../admin.js", () => ({
  default: {
    firestore: Object.assign(
      () => ({
        collection: (collection: string) => ({
          add: async (data: Record<string, unknown>) => {
            added.push({ collection, data });
            return { id: `req-${added.length}` };
          },
        }),
      }),
      { FieldValue: { serverTimestamp: () => ({ __op: "serverTimestamp" }) } },
    ),
    auth: () => auth,
  },
}));

vi.mock("../utils_emailRecovery.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils_emailRecovery.js")>();
  return { ...actual, hasRecentPendingRequest: vi.fn() };
});

import { requestEmailRecovery as handlerExport } from "../onCall_requestEmailRecovery.js";

const request = handlerExport as unknown as (
  data: unknown,
  context: { auth?: { uid?: string } | null },
) => Promise<unknown>;

const validInput = {
  requestedEmail: "New@Example.com",
  contact: "rochdi#1234",
  details: "My grid is called Studio",
};

describe("requestEmailRecovery", () => {
  beforeEach(() => {
    resetMaintenanceMock(noopIfMaintenance);
    vi.mocked(hasRecentPendingRequest).mockReset().mockResolvedValue(false);
    auth.getUser.mockReset();
    auth.getUserByEmail.mockReset();
    added.length = 0;
  });

  it("files a request for a signed-in user using their auth email", async () => {
    auth.getUser.mockResolvedValue({ uid: "uid-1", email: "Old@Example.com" });

    await expect(
      request({ ...validInput, lostEmail: "spoofed@example.com" }, { auth: { uid: "uid-1" } }),
    ).resolves.toEqual({ ok: true });

    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      collection: "emailRecoveryRequests",
      data: {
        uid: "uid-1",
        lostEmail: "old@example.com",
        requestedEmail: "new@example.com",
        contact: "rochdi#1234",
        details: "My grid is called Studio",
        signedIn: true,
        status: "pending",
        dedupeKey: "uid:uid-1",
      },
    });
  });

  it("resolves the account by email when signed out", async () => {
    auth.getUserByEmail.mockResolvedValue({ uid: "uid-9" });

    await request({ ...validInput, lostEmail: "lost@example.com" }, {});

    expect(auth.getUserByEmail).toHaveBeenCalledWith("lost@example.com");
    expect(added[0].data).toMatchObject({
      uid: "uid-9",
      lostEmail: "lost@example.com",
      signedIn: false,
      dedupeKey: "uid:uid-9",
    });
  });

  it("returns the same response when no account exists", async () => {
    auth.getUserByEmail.mockRejectedValue(new Error("auth/user-not-found"));

    await expect(
      request({ ...validInput, lostEmail: "nobody@example.com" }, {}),
    ).resolves.toEqual({ ok: true });
    expect(added[0].data).toMatchObject({
      uid: null,
      dedupeKey: "email:nobody@example.com",
    });
  });

  it("skips writing a duplicate while a recent request is pending", async () => {
    auth.getUser.mockResolvedValue({ uid: "uid-1", email: "old@example.com" });
    vi.mocked(hasRecentPendingRequest).mockResolvedValue(true);

    await expect(request(validInput, { auth: { uid: "uid-1" } })).resolves.toEqual({
      ok: true,
    });
    expect(added).toHaveLength(0);
  });

  it("validates the new email, contact, and (signed out) account email", async () => {
    await expect(
      request({ ...validInput, requestedEmail: "nope" }, { auth: { uid: "u" } }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      request({ ...validInput, contact: "   " }, { auth: { uid: "u" } }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(request(validInput, {})).rejects.toMatchObject({
      code: "invalid-argument",
    });
    expect(added).toHaveLength(0);
  });

  it("no-ops in maintenance mode", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);
    await expect(request(validInput, {})).resolves.toBeNull();
  });
});
