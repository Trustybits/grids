/**
 * Tests for PendingGridTransfers — the recipient's dashboard surface for
 * incoming transfers.
 *
 * Auth + the GridTransferService are stubbed through their singletons (the
 * component's own useGridTransfers composable talks to that boundary), so these
 * tests isolate this component's behavior: rendering a card per incoming
 * transfer, the sender-label fallbacks, decline, and the two-step accept
 * (preview → confirm) including the over-quota guard and the accepted event.
 *
 * The cards render inline in the wrapper; the accept confirmation is a BaseModal
 * teleported to <body>, so modal assertions read from document.body.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import type { AuthProvider } from "@grids/contracts/auth";
import type {
  GridTransfer,
  PreviewGridTransferAcceptanceResponse,
} from "@grids/contracts/types";
import { registerAuthProvider } from "@/auth/AuthProviderSingleton";
import { registerServiceFactory } from "@/services/ServiceFactorySingleton";
import type { ServiceFactoryInterface } from "@/services/factory/ServiceFactoryInterface";
import { useToastStore } from "@/stores/toast";
import PendingGridTransfers from "../PendingGridTransfers.vue";

const MB = 1024 * 1024;

function makeTransfer(overrides: Partial<GridTransfer> = {}): GridTransfer {
  return {
    id: "transfer-1",
    gridId: "grid-1",
    gridName: "My Grid",
    fromUserId: "sender-1",
    fromSlug: "matt",
    fromEmail: "matt@example.com",
    toUserId: "user-1",
    removeOrphanedFiles: false,
    status: "pending",
    expiresAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

function makePreview(
  overrides: Partial<PreviewGridTransferAcceptanceResponse> = {},
): PreviewGridTransferAcceptanceResponse {
  return {
    additionalBytesRequired: 2 * MB,
    recipientQuotaRemaining: 100 * MB,
    wouldExceedQuota: false,
    files: [],
    nonCopiableCount: 0,
    ...overrides,
  };
}

function registerStubs(options: {
  transfers?: GridTransfer[];
  preview?: PreviewGridTransferAcceptanceResponse;
}) {
  const subscribeIncomingTransfers = vi.fn(
    (_uid: string, cb: (t: GridTransfer[]) => void) => {
      cb(options.transfers ?? []);
      return () => {};
    },
  );
  const previewTransferAcceptance = vi
    .fn()
    .mockResolvedValue(options.preview ?? makePreview());
  const acceptTransfer = vi.fn().mockResolvedValue({
    transferId: "transfer-1",
    gridId: "grid-1",
    status: "accepted",
  });
  const declineTransfer = vi
    .fn()
    .mockResolvedValue({ transferId: "transfer-1", status: "declined" });

  registerAuthProvider({
    getCurrentUserId: () => "user-1",
  } as unknown as AuthProvider);

  registerServiceFactory({
    getGridTransferService: () =>
      ({
        subscribeIncomingTransfers,
        subscribeOutgoingTransfers: () => () => {},
        previewTransferAcceptance,
        acceptTransfer,
        declineTransfer,
      }) as never,
  } as unknown as ServiceFactoryInterface);

  return {
    subscribeIncomingTransfers,
    previewTransferAcceptance,
    acceptTransfer,
    declineTransfer,
  };
}

function cardButton(wrapper: VueWrapper, label: string) {
  return wrapper
    .findAll("button")
    .find((b) => b.text().trim() === label);
}

function bodyButton(label: string): HTMLButtonElement | undefined {
  return Array.from(
    document.body.querySelectorAll<HTMLButtonElement>("button"),
  ).find((b) => b.textContent?.trim() === label);
}

beforeEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("rendering", () => {
  it("renders nothing when there are no incoming transfers", async () => {
    registerStubs({ transfers: [] });
    const wrapper = mount(PendingGridTransfers);
    await flushPromises();

    expect(wrapper.find(".pgt").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Incoming Transfers");

    wrapper.unmount();
  });

  it("renders a card with the grid name and slug sender", async () => {
    registerStubs({
      transfers: [makeTransfer({ gridName: "Design Portfolio", fromSlug: "matt" })],
    });
    const wrapper = mount(PendingGridTransfers);
    await flushPromises();

    expect(wrapper.find(".pgt").exists()).toBe(true);
    expect(wrapper.text()).toContain("Design Portfolio");
    expect(wrapper.text()).toContain("@matt");

    wrapper.unmount();
  });

  it("falls back to the sender email when there is no slug", async () => {
    registerStubs({
      transfers: [
        makeTransfer({ fromSlug: null, fromEmail: "friend@example.com" }),
      ],
    });
    const wrapper = mount(PendingGridTransfers);
    await flushPromises();

    expect(wrapper.text()).toContain("friend@example.com");

    wrapper.unmount();
  });

  it("shows 'another user' when neither slug nor email is present", async () => {
    registerStubs({
      transfers: [makeTransfer({ fromSlug: null, fromEmail: null })],
    });
    const wrapper = mount(PendingGridTransfers);
    await flushPromises();

    expect(wrapper.text()).toContain("another user");

    wrapper.unmount();
  });
});

describe("decline", () => {
  it("calls declineTransfer with the transfer id and toasts", async () => {
    const { declineTransfer } = registerStubs({
      transfers: [makeTransfer({ id: "t-decline" })],
    });
    const wrapper = mount(PendingGridTransfers);
    await flushPromises();

    await cardButton(wrapper, "Decline")?.trigger("click");
    await flushPromises();

    expect(declineTransfer).toHaveBeenCalledWith("t-decline");
    const toast = useToastStore();
    expect(
      toast.toasts.some(
        (t) => t.type === "success" && t.message.includes("declined"),
      ),
    ).toBe(true);

    wrapper.unmount();
  });
});

describe("accept — preview step", () => {
  it("loads the preview and shows the quota cost and file list", async () => {
    const { previewTransferAcceptance } = registerStubs({
      transfers: [makeTransfer({ id: "t-accept" })],
      preview: makePreview({
        additionalBytesRequired: 3 * MB,
        files: [
          {
            hash: "a".repeat(64),
            displayName: "hero.png",
            kind: "images",
            size: 3 * MB,
            alreadyOwned: false,
          },
        ],
      }),
    });
    const wrapper = mount(PendingGridTransfers);
    await flushPromises();

    await cardButton(wrapper, "Accept")?.trigger("click");
    await flushPromises();

    expect(previewTransferAcceptance).toHaveBeenCalledWith("t-accept");
    const text = document.body.textContent ?? "";
    expect(text).toContain("3 MB");
    expect(text).toContain("hero.png");

    wrapper.unmount();
  });

  it("marks already-owned files as costing no extra storage", async () => {
    registerStubs({
      transfers: [makeTransfer()],
      preview: makePreview({
        files: [
          {
            hash: "b".repeat(64),
            displayName: "shared.png",
            kind: "images",
            size: 5 * MB,
            alreadyOwned: true,
          },
        ],
        nonCopiableCount: 2,
      }),
    });
    const wrapper = mount(PendingGridTransfers);
    await flushPromises();

    await cardButton(wrapper, "Accept")?.trigger("click");
    await flushPromises();

    const text = document.body.textContent ?? "";
    expect(text).toContain("Already in your archive");
    expect(text).toContain("2 files can't be copied");

    wrapper.unmount();
  });
});

describe("accept — confirm step", () => {
  it("accepts the transfer, emits accepted and toasts on confirm", async () => {
    const { acceptTransfer } = registerStubs({
      transfers: [makeTransfer({ id: "t-accept", gridName: "Cool Grid" })],
      preview: makePreview({ wouldExceedQuota: false }),
    });
    const wrapper = mount(PendingGridTransfers);
    await flushPromises();

    await cardButton(wrapper, "Accept")?.trigger("click");
    await flushPromises();

    bodyButton("Confirm Transfer")?.click();
    await flushPromises();

    expect(acceptTransfer).toHaveBeenCalledWith("t-accept");
    expect(wrapper.emitted("accepted")).toHaveLength(1);
    const toast = useToastStore();
    expect(
      toast.toasts.some(
        (t) => t.type === "success" && t.message.includes("Cool Grid"),
      ),
    ).toBe(true);

    wrapper.unmount();
  });

  it("blocks confirming when the transfer would exceed quota", async () => {
    const { acceptTransfer } = registerStubs({
      transfers: [makeTransfer()],
      preview: makePreview({
        wouldExceedQuota: true,
        additionalBytesRequired: 200 * MB,
        recipientQuotaRemaining: 10 * MB,
      }),
    });
    const wrapper = mount(PendingGridTransfers);
    await flushPromises();

    await cardButton(wrapper, "Accept")?.trigger("click");
    await flushPromises();

    expect(document.body.textContent).toContain("Not enough storage");
    const confirm = bodyButton("Confirm Transfer");
    expect(confirm?.disabled).toBe(true);

    confirm?.click();
    await flushPromises();
    expect(acceptTransfer).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});
