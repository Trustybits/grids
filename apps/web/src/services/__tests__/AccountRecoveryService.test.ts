import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthProvider } from "@grids/contracts/auth";
import type { CloudFunctionsDao } from "@grids/contracts/dao";
import { registerAuthProvider } from "@/auth/AuthProviderSingleton";
import { AccountRecoveryService } from "@/services/AccountRecoveryService";
import { registerTestDaoFactory } from "./testHelpers";

let callFunction: ReturnType<typeof vi.fn>;
let signInWithRecoveryToken: ReturnType<typeof vi.fn>;
let service: AccountRecoveryService;

beforeEach(() => {
  callFunction = vi.fn();
  signInWithRecoveryToken = vi.fn();
  registerTestDaoFactory({
    getCloudFunctionsDao: () =>
      ({ callFunction }) as unknown as CloudFunctionsDao,
  });
  registerAuthProvider({ signInWithRecoveryToken } as unknown as AuthProvider);
  service = new AccountRecoveryService();
});

describe("AccountRecoveryService", () => {
  it("files a recovery request through the callable", async () => {
    callFunction.mockResolvedValue({ ok: true });
    const input = {
      requestedEmail: "new@example.com",
      contact: "rochdi",
      details: "Grid: Studio",
    };

    await service.requestEmailRecovery(input);

    expect(callFunction).toHaveBeenCalledWith("requestEmailRecovery", input);
  });

  it("redeems a code and signs in with the returned token", async () => {
    const user = { uid: "u1", email: "old@example.com", displayName: null, photoURL: null };
    callFunction.mockResolvedValue({ token: "custom-token" });
    signInWithRecoveryToken.mockResolvedValue(user);

    await expect(service.redeemRecoveryCode("ABCD-EFGH-JKMN")).resolves.toBe(user);
    expect(callFunction).toHaveBeenCalledWith("redeemEmailRecoveryCode", {
      code: "ABCD-EFGH-JKMN",
    });
    expect(signInWithRecoveryToken).toHaveBeenCalledWith("custom-token");
  });

  it("does not sign in when the code is rejected", async () => {
    callFunction.mockRejectedValue(new Error("That code is invalid or has expired."));

    await expect(service.redeemRecoveryCode("nope")).rejects.toThrow(
      "invalid or has expired",
    );
    expect(signInWithRecoveryToken).not.toHaveBeenCalled();
  });
});
