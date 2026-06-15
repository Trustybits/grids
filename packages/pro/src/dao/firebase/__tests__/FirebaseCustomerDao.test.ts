/**
 * Unit tests for FirebaseCustomerDao
 *
 * Covers:
 *  - createCheckoutSession: writes config + created serverTimestamp to the
 *    customers/{uid}/checkout_sessions subcollection, returns the doc id
 *  - subscribeToCheckoutSession: doc path, callback with data, null when the
 *    snapshot has no data, unsubscribe passthrough
 *  - subscribeToActiveSubscriptions: status-in query limited to 1, doc mapping
 *  - subscribeToPayments: status == succeeded query, doc mapping
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { FirebaseCustomerDao } from "../FirebaseCustomerDao.js";
import type { Firestore } from "firebase/firestore";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fakeDb = {} as Firestore;

function fakeQuerySnapshot(docs: Array<Record<string, unknown>>) {
  return { docs: docs.map((d) => ({ data: () => d })) };
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe("FirebaseCustomerDao", () => {
  let dao: FirebaseCustomerDao;

  beforeEach(() => {
    dao = new FirebaseCustomerDao(fakeDb);
  });

  // ── createCheckoutSession ─────────────────────────────────────────────────

  describe("createCheckoutSession", () => {
    it("adds the config plus a created serverTimestamp and returns the session id", async () => {
      vi.mocked(collection).mockReturnValue("sessionsRef" as any);
      vi.mocked(serverTimestamp).mockReturnValue("SERVER_TS" as any);
      vi.mocked(addDoc).mockResolvedValue({ id: "session-1" } as any);

      const config = { price: "price_123", mode: "subscription" };
      const id = await dao.createCheckoutSession("user-1", config);

      expect(collection).toHaveBeenCalledWith(
        fakeDb,
        "customers",
        "user-1",
        "checkout_sessions",
      );
      expect(addDoc).toHaveBeenCalledWith("sessionsRef", {
        price: "price_123",
        mode: "subscription",
        created: "SERVER_TS",
      });
      expect(id).toBe("session-1");
    });

    it("propagates errors from addDoc", async () => {
      vi.mocked(collection).mockReturnValue("sessionsRef" as any);
      vi.mocked(addDoc).mockRejectedValue(new Error("denied"));

      await expect(dao.createCheckoutSession("user-1", {})).rejects.toThrow(
        "denied",
      );
    });
  });

  // ── subscribeToCheckoutSession ────────────────────────────────────────────

  describe("subscribeToCheckoutSession", () => {
    it("subscribes to the session doc and passes its data to the callback", () => {
      const sessionData = { url: "https://checkout.stripe.com/x" };
      const callback = vi.fn();

      vi.mocked(doc).mockReturnValue("sessionDocRef" as any);
      vi.mocked(onSnapshot).mockImplementation((_ref: any, handler: any) => {
        handler({ data: () => sessionData });
        return vi.fn();
      });

      dao.subscribeToCheckoutSession("user-1", "session-1", callback);

      expect(doc).toHaveBeenCalledWith(
        fakeDb,
        "customers",
        "user-1",
        "checkout_sessions",
        "session-1",
      );
      expect(callback).toHaveBeenCalledWith(sessionData);
    });

    it("passes null to the callback when the snapshot has no data", () => {
      const callback = vi.fn();

      vi.mocked(doc).mockReturnValue("sessionDocRef" as any);
      vi.mocked(onSnapshot).mockImplementation((_ref: any, handler: any) => {
        handler({ data: () => undefined });
        return vi.fn();
      });

      dao.subscribeToCheckoutSession("user-1", "session-1", callback);

      expect(callback).toHaveBeenCalledWith(null);
    });

    it("returns the unsubscribe function from onSnapshot", () => {
      const unsubFn = vi.fn();
      vi.mocked(doc).mockReturnValue("sessionDocRef" as any);
      vi.mocked(onSnapshot).mockReturnValue(unsubFn as any);

      const result = dao.subscribeToCheckoutSession("u", "s", vi.fn());

      expect(result).toBe(unsubFn);
    });
  });

  // ── subscribeToActiveSubscriptions ────────────────────────────────────────

  describe("subscribeToActiveSubscriptions", () => {
    it("queries subscriptions with active-ish statuses limited to one result", () => {
      const callback = vi.fn();
      vi.mocked(collection).mockReturnValue("subsColRef" as any);
      vi.mocked(where).mockReturnValue("whereClause" as any);
      vi.mocked(limit).mockReturnValue("limitClause" as any);
      vi.mocked(query).mockReturnValue("subsQuery" as any);
      vi.mocked(onSnapshot).mockImplementation((_q: any, handler: any) => {
        handler(fakeQuerySnapshot([{ status: "active" }]));
        return vi.fn();
      });

      dao.subscribeToActiveSubscriptions("user-1", callback);

      expect(collection).toHaveBeenCalledWith(
        fakeDb,
        "customers",
        "user-1",
        "subscriptions",
      );
      expect(where).toHaveBeenCalledWith("status", "in", [
        "active",
        "trialing",
        "past_due",
      ]);
      expect(limit).toHaveBeenCalledWith(1);
      expect(query).toHaveBeenCalledWith(
        "subsColRef",
        "whereClause",
        "limitClause",
      );
      expect(callback).toHaveBeenCalledWith([{ status: "active" }]);
    });

    it("passes an empty array when there are no matching subscriptions", () => {
      const callback = vi.fn();
      vi.mocked(collection).mockReturnValue("subsColRef" as any);
      vi.mocked(query).mockReturnValue("subsQuery" as any);
      vi.mocked(onSnapshot).mockImplementation((_q: any, handler: any) => {
        handler(fakeQuerySnapshot([]));
        return vi.fn();
      });

      dao.subscribeToActiveSubscriptions("user-1", callback);

      expect(callback).toHaveBeenCalledWith([]);
    });
  });

  // ── subscribeToPayments ───────────────────────────────────────────────────

  describe("subscribeToPayments", () => {
    it("queries payments with status == succeeded and maps doc data", () => {
      const callback = vi.fn();
      vi.mocked(collection).mockReturnValue("paymentsColRef" as any);
      vi.mocked(where).mockReturnValue("whereClause" as any);
      vi.mocked(query).mockReturnValue("paymentsQuery" as any);
      vi.mocked(onSnapshot).mockImplementation((_q: any, handler: any) => {
        handler(fakeQuerySnapshot([{ amount: 999 }, { amount: 500 }]));
        return vi.fn();
      });

      dao.subscribeToPayments("user-1", callback);

      expect(collection).toHaveBeenCalledWith(
        fakeDb,
        "customers",
        "user-1",
        "payments",
      );
      expect(where).toHaveBeenCalledWith("status", "==", "succeeded");
      expect(query).toHaveBeenCalledWith("paymentsColRef", "whereClause");
      expect(callback).toHaveBeenCalledWith([{ amount: 999 }, { amount: 500 }]);
    });

    it("returns the unsubscribe function from onSnapshot", () => {
      const unsubFn = vi.fn();
      vi.mocked(collection).mockReturnValue("paymentsColRef" as any);
      vi.mocked(query).mockReturnValue("paymentsQuery" as any);
      vi.mocked(onSnapshot).mockReturnValue(unsubFn as any);

      const result = dao.subscribeToPayments("user-1", vi.fn());

      expect(result).toBe(unsubFn);
    });
  });
});
