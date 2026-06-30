import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";
import { SUPPORTER_BADGE_MIN_CENTS } from "../constants.js";

const { firestoreState, FieldValue } = vi.hoisted(() => {
  const FieldValue = {
    serverTimestamp: vi.fn(() => ({ __op: "serverTimestamp" })),
  };
  const firestoreState = {
    badgeDocs: new Map<string, Record<string, unknown>>(),
    paymentDocs: new Map<string, Array<Record<string, unknown>>>(),
    badgeGetCalls: [] as string[],
    badgeSetCalls: [] as Array<{
      path: string;
      data: Record<string, unknown>;
      options?: Record<string, unknown>;
    }>,
    paymentWhereCalls: [] as Array<{
      collection: string;
      field: string;
      op: string;
      value: unknown;
    }>,
  };

  return { firestoreState, FieldValue };
});

vi.mock("firebase-functions/v1", () => ({
  runWith: vi.fn(() => ({
    firestore: {
      document: vi.fn((_path: string) => ({
        onWrite: (handler: unknown) => handler,
      })),
    },
  })),
  firestore: {
    document: vi.fn((_path: string) => ({
      onWrite: (handler: unknown) => handler,
    })),
  },
}));

vi.mock("firebase-functions/logger", () => ({
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

vi.mock("../../notifications/secrets.js", () => ({
  resendApiKey: { value: vi.fn() },
  resendFromEmail: { value: vi.fn() },
}));

vi.mock("../../notifications/utils_userEmail.js", () => ({
  getUserEmailInfo: vi.fn(),
}));

vi.mock("firebase-admin", () => ({
  default: {
    firestore: Object.assign(
      () => ({
        collection: (collectionPath: string) => {
          if (collectionPath === "userBadges") {
            return {
              doc: (uid: string) => ({
                get: async () => {
                  const path = `userBadges/${uid}`;
                  firestoreState.badgeGetCalls.push(path);
                  const data = firestoreState.badgeDocs.get(path);
                  return {
                    exists: data !== undefined,
                    data: () => data,
                  };
                },
                set: async (
                  data: Record<string, unknown>,
                  options?: Record<string, unknown>,
                ) => {
                  firestoreState.badgeSetCalls.push({
                    path: `userBadges/${uid}`,
                    data,
                    options,
                  });
                },
              }),
            };
          }

          return {
            where: (field: string, op: string, value: unknown) => {
              firestoreState.paymentWhereCalls.push({
                collection: collectionPath,
                field,
                op,
                value,
              });
              return {
                get: async () => ({
                  docs: (firestoreState.paymentDocs.get(collectionPath) ?? []).map(
                    (data) => ({
                      data: () => data,
                    }),
                  ),
                }),
              };
            },
          };
        },
      }),
      { FieldValue },
    ),
  },
}));

import { grantSupporterBadgeOnPayment as handlerExport } from "../grantSupporterBadge.js";
import { resendApiKey, resendFromEmail } from "../../notifications/secrets.js";
import { getUserEmailInfo } from "../../notifications/utils_userEmail.js";

const grantSupporterBadgeOnPayment = handlerExport as unknown as (
  change: {
    after: {
      exists: boolean;
      data: () => Record<string, unknown>;
    };
  },
  context: { params: { uid: string; paymentId: string } },
) => Promise<unknown>;

function makeChange(
  after: Record<string, unknown> | null,
): Parameters<typeof grantSupporterBadgeOnPayment>[0] {
  return {
    after: {
      exists: after !== null,
      data: () => after ?? {},
    },
  };
}

function makeContext(uid = "user-1", paymentId = "payment-1") {
  return { params: { uid, paymentId } };
}

function setBadgeDoc(uid: string, data: Record<string, unknown>): void {
  firestoreState.badgeDocs.set(`userBadges/${uid}`, data);
}

function setPayments(uid: string, payments: Array<Record<string, unknown>>): void {
  firestoreState.paymentDocs.set(`customers/${uid}/payments`, payments);
}

beforeEach(() => {
  firestoreState.badgeDocs = new Map();
  firestoreState.paymentDocs = new Map();
  firestoreState.badgeGetCalls = [];
  firestoreState.badgeSetCalls = [];
  firestoreState.paymentWhereCalls = [];
  FieldValue.serverTimestamp.mockClear();
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(logger.info).mockClear();
  vi.mocked(resendApiKey.value).mockReset().mockReturnValue("re_test");
  vi.mocked(resendFromEmail.value).mockReset().mockReturnValue("Grids <hello@grids.so>");
  vi.mocked(getUserEmailInfo).mockReset().mockResolvedValue({
    email: "person@example.com",
    displayName: "Person",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"id":"email-1"}',
    }),
  );
});

describe("grantSupporterBadgeOnPayment", () => {
  it("returns null without touching Firestore when maintenance mode is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);

    await expect(
      grantSupporterBadgeOnPayment(
        makeChange({ status: "succeeded", amount: SUPPORTER_BADGE_MIN_CENTS }),
        makeContext(),
      ),
    ).resolves.toBeNull();

    expect(noopIfMaintenance).toHaveBeenCalledWith("grantSupporterBadgeOnPayment");
    expect(firestoreState.badgeGetCalls).toEqual([]);
    expect(firestoreState.paymentWhereCalls).toEqual([]);
    expect(firestoreState.badgeSetCalls).toEqual([]);
  });

  it("ignores deleted payment documents", async () => {
    await expect(
      grantSupporterBadgeOnPayment(makeChange(null), makeContext()),
    ).resolves.toBeNull();

    expect(firestoreState.badgeGetCalls).toEqual([]);
    expect(firestoreState.paymentWhereCalls).toEqual([]);
    expect(firestoreState.badgeSetCalls).toEqual([]);
  });

  it.each([
    ["pending", "pending"],
    ["failed", "failed"],
    ["missing", undefined],
  ])("ignores %s payments", async (_label, status) => {
    await grantSupporterBadgeOnPayment(
      makeChange({ status, amount: 500 }),
      makeContext(),
    );

    expect(firestoreState.badgeGetCalls).toEqual([]);
    expect(firestoreState.paymentWhereCalls).toEqual([]);
    expect(firestoreState.badgeSetCalls).toEqual([]);
  });

  it("does nothing when the supporter badge already exists", async () => {
    setBadgeDoc("user-1", {
      supporter: { earnedAt: "existing-timestamp" },
    });

    await grantSupporterBadgeOnPayment(
      makeChange({ status: "succeeded", amount: 500 }),
      makeContext(),
    );

    expect(firestoreState.badgeGetCalls).toEqual(["userBadges/user-1"]);
    expect(firestoreState.paymentWhereCalls).toEqual([]);
    expect(firestoreState.badgeSetCalls).toEqual([]);
  });

  it("aggregates succeeded payments for the triggering user", async () => {
    setPayments("user-1", [{ amount: 40 }, { amount: 60 }]);

    await grantSupporterBadgeOnPayment(
      makeChange({ status: "succeeded", amount: 60 }),
      makeContext("user-1"),
    );

    expect(firestoreState.paymentWhereCalls).toEqual([
      {
        collection: "customers/user-1/payments",
        field: "status",
        op: "==",
        value: "succeeded",
      },
    ]);
  });

  it("logs and does not grant when total succeeded payment amount is below threshold", async () => {
    setPayments("user-1", [{ amount: 40 }, { amount: 59 }]);

    await grantSupporterBadgeOnPayment(
      makeChange({ status: "succeeded", amount: 59 }),
      makeContext("user-1"),
    );

    expect(firestoreState.badgeSetCalls).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith(
      "Payment processed but threshold not met",
      {
        uid: "user-1",
        totalCents: SUPPORTER_BADGE_MIN_CENTS - 1,
        threshold: SUPPORTER_BADGE_MIN_CENTS,
      },
    );
  });

  it("treats non-number payment amounts as zero while aggregating", async () => {
    setPayments("user-1", [
      { amount: 99 },
      { amount: "1000" },
      { amount: null },
      {},
    ]);

    await grantSupporterBadgeOnPayment(
      makeChange({ status: "succeeded", amount: 99 }),
      makeContext("user-1"),
    );

    expect(firestoreState.badgeSetCalls).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith(
      "Payment processed but threshold not met",
      expect.objectContaining({ totalCents: 99 }),
    );
  });

  it("grants the supporter badge exactly at the threshold", async () => {
    setPayments("user-1", [{ amount: SUPPORTER_BADGE_MIN_CENTS }]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"id":"email-1"}',
    });
    vi.stubGlobal("fetch", fetchMock);

    await grantSupporterBadgeOnPayment(
      makeChange({ status: "succeeded", amount: SUPPORTER_BADGE_MIN_CENTS }),
      makeContext("user-1"),
    );

    expect(firestoreState.badgeSetCalls).toEqual([
      {
        path: "userBadges/user-1",
        data: {
          supporter: {
            earnedAt: { __op: "serverTimestamp" },
          },
        },
        options: { merge: true },
      },
    ]);
    expect(logger.info).toHaveBeenCalledWith("Granted supporter badge", {
      uid: "user-1",
      totalCents: SUPPORTER_BADGE_MIN_CENTS,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(init.body);
    expect(body.to).toBe("person@example.com");
    expect(body.subject).toBe("Thank you for supporting Grids ✦");
  });

  it("grants the supporter badge when cumulative succeeded payments exceed the threshold", async () => {
    setPayments("user-1", [{ amount: 25 }, { amount: 75 }, { amount: 500 }]);

    await grantSupporterBadgeOnPayment(
      makeChange({ status: "succeeded", amount: 500 }),
      makeContext("user-1"),
    );

    expect(firestoreState.badgeSetCalls[0]).toMatchObject({
      path: "userBadges/user-1",
      options: { merge: true },
    });
    expect(logger.info).toHaveBeenCalledWith("Granted supporter badge", {
      uid: "user-1",
      totalCents: 600,
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
