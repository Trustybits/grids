// Unit tests for StubbedCustomerDao — checkout sessions are created in memory
// and keyed by user/session; the three subscribe methods deliver current
// snapshots (session, active subscriptions, payments) through the pub/sub layer.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StubbedCustomerDao } from "../StubbedCustomerDao";
import { memoryDatabase } from "../StubbedMemoryDatabase";
import { resetMemoryDatabase, flushMicrotasks } from "./memoryTestUtils";

let dao: StubbedCustomerDao;

beforeEach(() => {
  resetMemoryDatabase();
  dao = new StubbedCustomerDao();
});

describe("StubbedCustomerDao.createCheckoutSession", () => {
  it("returns a checkout-prefixed session id", async () => {
    const id = await dao.createCheckoutSession("user-1", {});
    expect(id).toMatch(/^checkout_/);
  });

  it("stores the session keyed by user and session id", async () => {
    const id = await dao.createCheckoutSession("user-1", { mode: "payment" });
    const stored = memoryDatabase.checkoutSessions.get(`user-1/${id}`);

    expect(stored).toMatchObject({ id, mode: "payment" });
    expect(stored?.created).toBeInstanceOf(Date);
  });

  it("uses the provided success_url as the session url", async () => {
    const id = await dao.createCheckoutSession("user-1", {
      success_url: "https://example.com/done",
    });
    const stored = memoryDatabase.checkoutSessions.get(`user-1/${id}`);

    expect(stored?.url).toBe("https://example.com/done");
  });

  it("falls back to a local dashboard url when success_url is absent", async () => {
    const id = await dao.createCheckoutSession("user-1", {});
    const stored = memoryDatabase.checkoutSessions.get(`user-1/${id}`);

    expect(stored?.url).toBe(`${window.location.origin}/dashboard`);
  });
});

describe("StubbedCustomerDao.subscribeToCheckoutSession", () => {
  it("delivers the stored session asynchronously", async () => {
    const id = await dao.createCheckoutSession("user-1", { mode: "payment" });
    const callback = vi.fn();

    dao.subscribeToCheckoutSession("user-1", id, callback);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ id, mode: "payment" }),
    );
  });

  it("delivers null when the session does not exist", async () => {
    const callback = vi.fn();
    dao.subscribeToCheckoutSession("user-1", "missing", callback);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledWith(null);
  });
});

describe("StubbedCustomerDao.subscribeToActiveSubscriptions", () => {
  it("delivers an empty array when there are no subscriptions", async () => {
    const callback = vi.fn();
    dao.subscribeToActiveSubscriptions("user-1", callback);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledWith([]);
  });

  it("delivers the stored subscriptions", async () => {
    memoryDatabase.subscriptions.set("user-1", [{ status: "active" }]);
    const callback = vi.fn();

    dao.subscribeToActiveSubscriptions("user-1", callback);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledWith([{ status: "active" }]);
  });
});

describe("StubbedCustomerDao.subscribeToPayments", () => {
  it("delivers an empty array when there are no payments", async () => {
    const callback = vi.fn();
    dao.subscribeToPayments("user-1", callback);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledWith([]);
  });

  it("delivers the stored payments", async () => {
    memoryDatabase.payments.set("user-1", [{ amount: 100 }]);
    const callback = vi.fn();

    dao.subscribeToPayments("user-1", callback);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledWith([{ amount: 100 }]);
  });
});
