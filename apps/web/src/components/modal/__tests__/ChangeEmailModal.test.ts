/**
 * Tests for ChangeEmailModal — the verified email-change flow.
 *
 * A fake AuthProvider is registered through the singleton so these tests
 * isolate the modal's step machine: enter → (reauth → recovery) → sent, the
 * client-side validation, the requires-recent-login branch for both sign-in
 * methods, and the recovery-code path that stands in for re-authentication.
 * The recovery service is stubbed through the service-factory singleton.
 * BaseModal teleports its content to <body>, so assertions read from there.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import {
  AuthProviderError,
  type AuthProvider,
  type AuthSignInMethod,
} from "@grids/contracts/auth";
import { registerAuthProvider } from "@/auth/AuthProviderSingleton";
import { registerServiceFactory } from "@/services/ServiceFactorySingleton";
import type { ServiceFactoryInterface } from "@/services/factory/ServiceFactoryInterface";
import { PENDING_NEW_EMAIL_STORAGE_KEY } from "@/utils/emailChange";
import ChangeEmailModal from "../ChangeEmailModal.vue";

function registerAuth(methods: AuthSignInMethod[] = ["emailLink"]) {
  const auth = {
    requestEmailChange: vi.fn().mockResolvedValue(undefined),
    getSignInMethods: vi.fn(() => methods),
    reauthenticateWithGoogle: vi.fn().mockResolvedValue(undefined),
    sendEmailSignInLink: vi.fn().mockResolvedValue(undefined),
  };
  registerAuthProvider(auth as unknown as AuthProvider);
  return auth;
}

function registerRecovery() {
  const redeemRecoveryCode = vi
    .fn()
    .mockResolvedValue({ uid: "u1", email: "old@example.com" });
  const requestEmailRecovery = vi.fn().mockResolvedValue(undefined);
  registerServiceFactory({
    getAccountRecoveryService: () =>
      ({ redeemRecoveryCode, requestEmailRecovery }) as never,
  } as unknown as ServiceFactoryInterface);
  return { redeemRecoveryCode, requestEmailRecovery };
}

let wrapper: VueWrapper | null = null;

function mountModal(currentEmail = "old@example.com") {
  wrapper = mount(ChangeEmailModal, {
    props: { isOpen: true, currentEmail },
  });
  return wrapper;
}

const body = () => document.body;
const heading = () => body().querySelector("h2")?.textContent?.trim();

function typeInto(selector: string, value: string) {
  const input = body().querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`${selector} not found`);
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

function findButton(label: string | RegExp) {
  return Array.from(body().querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => {
      const text = b.textContent?.trim() ?? "";
      return typeof label === "string" ? text === label : label.test(text);
    },
  );
}

async function click(label: string | RegExp) {
  const button = findButton(label);
  if (!button) throw new Error(`button ${label} not found`);
  button.click();
  await flushPromises();
}

const requiresRecentLogin = () =>
  new AuthProviderError("requires-recent-login", "stale session");

beforeEach(() => {
  window.localStorage.clear();
  registerRecovery();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = "";
});

describe("ChangeEmailModal — enter step", () => {
  it("sends the verification to the new address and shows the sent step", async () => {
    const auth = registerAuth();
    mountModal();
    await flushPromises();

    typeInto("#change-email-input", "  new@example.com ");
    await flushPromises();
    await click("Send confirmation");

    expect(auth.requestEmailChange).toHaveBeenCalledWith(
      "new@example.com",
      `${window.location.origin}/account/change-email?done=1`,
    );
    expect(heading()).toBe("Check your new inbox");
    expect(body().textContent).toContain("new@example.com");
    expect(wrapper!.emitted("sent")?.[0]).toEqual(["new@example.com"]);
  });

  it("disables submit for an invalid or unchanged email", async () => {
    registerAuth();
    mountModal();
    await flushPromises();

    typeInto("#change-email-input", "not-an-email");
    await flushPromises();
    expect(findButton("Send confirmation")?.disabled).toBe(true);
    expect(body().textContent).toContain("Enter a valid email address.");

    typeInto("#change-email-input", "OLD@example.com");
    await flushPromises();
    expect(findButton("Send confirmation")?.disabled).toBe(true);
    expect(body().textContent).toContain("already your email");
  });

  it("shows a friendly error for other failures", async () => {
    const auth = registerAuth();
    auth.requestEmailChange.mockRejectedValue(
      new AuthProviderError("email-already-in-use"),
    );
    mountModal();
    await flushPromises();

    typeInto("#change-email-input", "taken@example.com");
    await flushPromises();
    await click("Send confirmation");

    expect(heading()).toBe("Change email");
    expect(body().textContent).toContain("already used by another Grids account");
  });
});

describe("ChangeEmailModal — re-authentication", () => {
  async function reachReauth(auth: ReturnType<typeof registerAuth>) {
    auth.requestEmailChange.mockRejectedValueOnce(requiresRecentLogin());
    mountModal();
    await flushPromises();
    typeInto("#change-email-input", "new@example.com");
    await flushPromises();
    await click("Send confirmation");
    expect(heading()).toBe("Confirm it’s you");
  }

  it("re-authenticates with Google, then retries the change", async () => {
    const auth = registerAuth(["google"]);
    await reachReauth(auth);
    expect(findButton(/Email a link/)).toBeUndefined();

    await click("Confirm with Google");

    expect(auth.reauthenticateWithGoogle).toHaveBeenCalled();
    expect(auth.requestEmailChange).toHaveBeenCalledTimes(2);
    expect(heading()).toBe("Check your new inbox");
  });

  it("emails a confirmation link to the current address and remembers the new one", async () => {
    const auth = registerAuth(["emailLink"]);
    await reachReauth(auth);

    await click("Email a link to old@example.com");

    expect(auth.sendEmailSignInLink).toHaveBeenCalledWith(
      "old@example.com",
      `${window.location.origin}/account/change-email`,
    );
    expect(window.localStorage.getItem(PENDING_NEW_EMAIL_STORAGE_KEY)).toBe(
      "new@example.com",
    );
    expect(body().textContent).toContain("We sent a confirmation link to old@example.com");
  });

  it("offers lost-inbox recovery, and a redeemed code completes the change", async () => {
    const auth = registerAuth(["emailLink"]);
    const { redeemRecoveryCode } = registerRecovery();
    await reachReauth(auth);

    await click("Lost access to old@example.com?");
    expect(heading()).toBe("Lost access to your email?");

    typeInto("#recovery-code-input", "abcd-efgh-jkmn");
    await flushPromises();
    await click("Use code");

    expect(redeemRecoveryCode).toHaveBeenCalledWith("abcd-efgh-jkmn");
    expect(auth.requestEmailChange).toHaveBeenLastCalledWith(
      "new@example.com",
      expect.stringContaining("/account/change-email?done=1"),
    );
    expect(heading()).toBe("Check your new inbox");
  });

  it("surfaces a rejected recovery code inline", async () => {
    const auth = registerAuth(["emailLink"]);
    const { redeemRecoveryCode } = registerRecovery();
    redeemRecoveryCode.mockRejectedValue(new Error("That code is invalid or has expired."));
    await reachReauth(auth);

    await click("Lost access to old@example.com?");
    typeInto("#recovery-code-input", "ABCD-EFGH-JKMN");
    await flushPromises();
    await click("Use code");

    expect(body().textContent).toContain("That code is invalid or has expired.");
    expect(heading()).toBe("Lost access to your email?");
  });

  it("files a recovery request with the typed new email", async () => {
    const auth = registerAuth(["emailLink"]);
    const { requestEmailRecovery } = registerRecovery();
    await reachReauth(auth);

    await click("Lost access to old@example.com?");
    await click("Request a code");
    typeInto("#recovery-contact", "rochdi");
    typeInto("#recovery-details", "Grid: Studio");
    await flushPromises();
    await click("Send request");

    expect(requestEmailRecovery).toHaveBeenCalledWith({
      lostEmail: undefined,
      requestedEmail: "new@example.com",
      contact: "rochdi",
      details: "Grid: Studio",
    });
    expect(body().textContent).toContain("Request sent.");
  });
});
