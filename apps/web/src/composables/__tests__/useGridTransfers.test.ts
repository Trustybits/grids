/**
 * Tests for useGridTransfers — the composable both transfer participants use to
 * read pending transfers and drive the transfer callables.
 *
 * The AuthProvider and GridTransferService are stubbed through their singletons
 * (the same boundary the app wires at boot), so these tests isolate the
 * composable's own logic: which subscriptions it opens per option, how emitted
 * transfers land in the reactive lists, unmount cleanup, delegation of every
 * mutation to the service, and the pendingOutgoingForGrid lookup.
 *
 * Because the composable relies on onMounted/onUnmounted, each case runs inside
 * a host component mounted with @vue/test-utils.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import type { AuthProvider } from "@grids/contracts/auth";
import type { GridTransfer } from "@grids/contracts/types";
import { registerAuthProvider } from "@/auth/AuthProviderSingleton";
import { registerServiceFactory } from "@/services/ServiceFactorySingleton";
import type { ServiceFactoryInterface } from "@/services/factory/ServiceFactoryInterface";
import { useGridTransfers } from "@/composables/useGridTransfers";

type IncomingCb = (transfers: GridTransfer[]) => void;

function makeTransfer(overrides: Partial<GridTransfer> = {}): GridTransfer {
  return {
    id: "transfer-1",
    gridId: "grid-1",
    gridName: "My Grid",
    fromUserId: "sender-1",
    toUserId: "user-1",
    removeOrphanedFiles: false,
    status: "pending",
    expiresAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

/**
 * Register auth + a GridTransferService stub. The subscribe stubs capture their
 * callbacks so a test can emit transfers on demand, and hand back unsubscribe
 * spies so cleanup can be asserted.
 */
function registerStubs(options: { userId?: string | null } = {}) {
  const unsubIncoming = vi.fn();
  const unsubOutgoing = vi.fn();
  const captured: { incoming?: IncomingCb; outgoing?: IncomingCb } = {};

  const service = {
    subscribeIncomingTransfers: vi.fn((_uid: string, cb: IncomingCb) => {
      captured.incoming = cb;
      return unsubIncoming;
    }),
    subscribeOutgoingTransfers: vi.fn((_uid: string, cb: IncomingCb) => {
      captured.outgoing = cb;
      return unsubOutgoing;
    }),
    createTransfer: vi.fn(),
    previewTransferAcceptance: vi.fn(),
    acceptTransfer: vi.fn(),
    declineTransfer: vi.fn(),
    cancelTransfer: vi.fn(),
  };

  registerAuthProvider({
    getCurrentUserId: () =>
      options.userId === undefined ? "user-1" : options.userId,
  } as unknown as AuthProvider);

  registerServiceFactory({
    getGridTransferService: () => service as never,
  } as unknown as ServiceFactoryInterface);

  return { service, unsubIncoming, unsubOutgoing, captured };
}

/** Mount a host that runs the composable and exposes its return value. */
function mountComposable(options?: Parameters<typeof useGridTransfers>[0]) {
  let api!: ReturnType<typeof useGridTransfers>;
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useGridTransfers(options);
        return () => h("div");
      },
    }),
  );
  return { api, wrapper };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("subscriptions", () => {
  it("subscribes to both incoming and outgoing by default", () => {
    const { service } = registerStubs();
    mountComposable();

    expect(service.subscribeIncomingTransfers).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(service.subscribeOutgoingTransfers).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
  });

  it("only subscribes to outgoing when incoming is disabled", () => {
    const { service } = registerStubs();
    mountComposable({ incoming: false });

    expect(service.subscribeIncomingTransfers).not.toHaveBeenCalled();
    expect(service.subscribeOutgoingTransfers).toHaveBeenCalledTimes(1);
  });

  it("only subscribes to incoming when outgoing is disabled", () => {
    const { service } = registerStubs();
    mountComposable({ outgoing: false });

    expect(service.subscribeIncomingTransfers).toHaveBeenCalledTimes(1);
    expect(service.subscribeOutgoingTransfers).not.toHaveBeenCalled();
  });

  it("does not subscribe when there is no authenticated user", () => {
    const { service } = registerStubs({ userId: null });
    const { api } = mountComposable();

    expect(service.subscribeIncomingTransfers).not.toHaveBeenCalled();
    expect(service.subscribeOutgoingTransfers).not.toHaveBeenCalled();
    expect(api.incoming.value).toEqual([]);
    expect(api.outgoing.value).toEqual([]);
  });

  it("populates the reactive lists when the subscription callbacks fire", async () => {
    const { captured } = registerStubs();
    const { api } = mountComposable();

    const incoming = [makeTransfer({ id: "in-1" })];
    const outgoing = [makeTransfer({ id: "out-1", fromUserId: "user-1" })];
    captured.incoming?.(incoming);
    captured.outgoing?.(outgoing);

    expect(api.incoming.value).toEqual(incoming);
    expect(api.outgoing.value).toEqual(outgoing);
  });

  it("unsubscribes from both streams on unmount", () => {
    const { unsubIncoming, unsubOutgoing } = registerStubs();
    const { wrapper } = mountComposable();

    expect(unsubIncoming).not.toHaveBeenCalled();
    expect(unsubOutgoing).not.toHaveBeenCalled();

    wrapper.unmount();

    expect(unsubIncoming).toHaveBeenCalledTimes(1);
    expect(unsubOutgoing).toHaveBeenCalledTimes(1);
  });
});

describe("mutation delegation", () => {
  it("createTransfer forwards gridId, recipient and the remove flag", async () => {
    const { service } = registerStubs();
    const response = { transferId: "t-9", status: "pending", estimatedBytes: 5 };
    service.createTransfer.mockResolvedValue(response);
    const { api } = mountComposable();

    const recipient = { email: "friend@example.com" };
    const result = await api.createTransfer("grid-7", recipient, true);

    expect(service.createTransfer).toHaveBeenCalledWith(
      "grid-7",
      recipient,
      true,
    );
    expect(result).toBe(response);
  });

  it("previewTransferAcceptance forwards the transfer id and returns its result", async () => {
    const { service } = registerStubs();
    const preview = {
      additionalBytesRequired: 10,
      recipientQuotaRemaining: 100,
      wouldExceedQuota: false,
      files: [],
      nonCopiableCount: 0,
    };
    service.previewTransferAcceptance.mockResolvedValue(preview);
    const { api } = mountComposable();

    const result = await api.previewTransferAcceptance("t-1");

    expect(service.previewTransferAcceptance).toHaveBeenCalledWith("t-1");
    expect(result).toBe(preview);
  });

  it("acceptTransfer, declineTransfer and cancelTransfer each forward the id", async () => {
    const { service } = registerStubs();
    const { api } = mountComposable();

    await api.acceptTransfer("a-1");
    await api.declineTransfer("d-1");
    await api.cancelTransfer("c-1");

    expect(service.acceptTransfer).toHaveBeenCalledWith("a-1");
    expect(service.declineTransfer).toHaveBeenCalledWith("d-1");
    expect(service.cancelTransfer).toHaveBeenCalledWith("c-1");
  });
});

describe("pendingOutgoingForGrid", () => {
  it("returns the pending outgoing transfer matching the grid", () => {
    const { captured } = registerStubs();
    const { api } = mountComposable();

    const match = makeTransfer({ id: "out-1", gridId: "grid-1" });
    captured.outgoing?.([
      makeTransfer({ id: "out-0", gridId: "grid-other" }),
      match,
    ]);

    expect(api.pendingOutgoingForGrid("grid-1")).toEqual(match);
  });

  it("ignores outgoing transfers that are no longer pending", () => {
    const { captured } = registerStubs();
    const { api } = mountComposable();

    captured.outgoing?.([
      makeTransfer({ id: "out-1", gridId: "grid-1", status: "cancelled" }),
    ]);

    expect(api.pendingOutgoingForGrid("grid-1")).toBeUndefined();
  });

  it("returns undefined when no outgoing transfer matches the grid", () => {
    const { captured } = registerStubs();
    const { api } = mountComposable();

    captured.outgoing?.([makeTransfer({ gridId: "grid-2" })]);

    expect(api.pendingOutgoingForGrid("grid-1")).toBeUndefined();
  });
});
