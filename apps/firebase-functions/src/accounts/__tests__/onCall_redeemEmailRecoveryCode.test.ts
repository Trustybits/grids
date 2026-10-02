import { beforeEach, describe, expect, it, vi } from "vitest";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";
import {
  RecoveryCodeRejectedError,
  consumeRecoveryCode,
  releaseRecoveryCode,
} from "../utils_emailRecovery.js";

const { createCustomToken } = vi.hoisted(() => ({
  createCustomToken: vi.fn(),
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
  warn: vi.fn(),
}));

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

vi.mock("../../admin.js", () => ({
  default: {
    firestore: Object.assign(() => ({ __db: true }), {
      FieldValue: { serverTimestamp: () => ({ __op: "serverTimestamp" }) },
    }),
    auth: () => ({ createCustomToken }),
  },
}));

vi.mock("../utils_emailRecovery.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils_emailRecovery.js")>();
  return {
    ...actual,
    consumeRecoveryCode: vi.fn(),
    releaseRecoveryCode: vi.fn(),
  };
});

import { redeemEmailRecoveryCode as handlerExport } from "../onCall_redeemEmailRecoveryCode.js";

const redeem = handlerExport as unknown as (
  data: unknown,
  context: { auth?: { uid?: string } | null },
) => Promise<unknown>;

describe("redeemEmailRecoveryCode", () => {
  beforeEach(() => {
    resetMaintenanceMock(noopIfMaintenance);
    vi.mocked(consumeRecoveryCode).mockReset();
    vi.mocked(releaseRecoveryCode).mockReset().mockResolvedValue(undefined);
    createCustomToken.mockReset();
  });

  it("returns a custom token for a valid code", async () => {
    vi.mocked(consumeRecoveryCode).mockResolvedValue("uid-1");
    createCustomToken.mockResolvedValue("custom-token");

    await expect(redeem({ code: "abcd-efgh-jkmn" }, {})).resolves.toEqual({
      token: "custom-token",
    });
    expect(consumeRecoveryCode).toHaveBeenCalledWith(
      { __db: true },
      expect.any(Function),
      "ABCDEFGHJKMN",
      null,
    );
    expect(createCustomToken).toHaveBeenCalledWith("uid-1");
  });

  it("passes the signed-in caller's uid for the ownership check", async () => {
    vi.mocked(consumeRecoveryCode).mockResolvedValue("uid-1");
    createCustomToken.mockResolvedValue("custom-token");

    await redeem({ code: "ABCDEFGHJKMN" }, { auth: { uid: "uid-1" } });

    expect(vi.mocked(consumeRecoveryCode).mock.calls[0][3]).toBe("uid-1");
  });

  it("rejects malformed codes without touching Firestore", async () => {
    await expect(redeem({ code: "nope" }, {})).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect(consumeRecoveryCode).not.toHaveBeenCalled();
  });

  it("returns the same generic error for every rejection reason", async () => {
    for (const reason of ["not-found", "used", "expired", "wrong-account"] as const) {
      vi.mocked(consumeRecoveryCode).mockRejectedValueOnce(
        new RecoveryCodeRejectedError(reason),
      );
      await expect(redeem({ code: "ABCDEFGHJKMN" }, {})).rejects.toMatchObject({
        code: "permission-denied",
        message: "That code is invalid or has expired.",
      });
    }
    expect(createCustomToken).not.toHaveBeenCalled();
  });

  it("releases the code when the token can't be minted", async () => {
    vi.mocked(consumeRecoveryCode).mockResolvedValue("uid-1");
    createCustomToken.mockRejectedValue(new Error("signBlob denied"));

    await expect(redeem({ code: "ABCDEFGHJKMN" }, {})).rejects.toMatchObject({
      code: "internal",
    });
    expect(releaseRecoveryCode).toHaveBeenCalledWith({ __db: true }, "ABCDEFGHJKMN");
  });

  it("no-ops in maintenance mode", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);
    await expect(redeem({ code: "ABCDEFGHJKMN" }, {})).resolves.toBeNull();
    expect(consumeRecoveryCode).not.toHaveBeenCalled();
  });
});
