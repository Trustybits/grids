import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { getUserEmailInfo } from "../utils_userEmail.js";
import { sendResendEmail } from "../utils_resend.js";
import {
  getGridEngagementEmailDelayMs,
  processPendingGridEngagementEmails,
} from "../utils_gridEngagementEmail.js";

vi.mock("firebase-functions/logger", () => ({
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("../utils_userEmail.js", () => ({
  getUserEmailInfo: vi.fn(),
}));

vi.mock("../utils_resend.js", () => ({
  sendResendEmail: vi.fn(),
}));

vi.mock("../../admin.js", () => ({
  default: {
    firestore: Object.assign(
      () => ({
        collection: () => ({
          where: () => ({
            get: vi.fn(),
          }),
          doc: () => ({
            get: async () => ({ exists: false, data: () => undefined }),
          }),
        }),
      }),
      {
        FieldValue: {
          serverTimestamp: vi.fn(() => ({ __op: "serverTimestamp" })),
        },
      },
    ),
  },
}));

const { mockPendingDocs, mockDb } = vi.hoisted(() => {
  const mockPendingDocs = {
    size: 0,
    docs: [] as Array<{
      id: string;
      data: () => Record<string, unknown>;
      ref: { set: ReturnType<typeof vi.fn> };
    }>,
  };

  const mockDb = {
    collection: vi.fn(() => ({
      where: vi.fn(() => ({
        get: vi.fn(async () => {
          mockPendingDocs.size = mockPendingDocs.docs.length;
          return mockPendingDocs;
        }),
      })),
      doc: vi.fn((userId: string) => ({
        get: async () => ({
          exists: userId === "user-with-slug",
          data: () => ({ slug: "matt" }),
        }),
      })),
    })),
  };

  return { mockPendingDocs, mockDb };
});

beforeEach(() => {
  delete process.env.GRID_ENGAGEMENT_EMAIL_DELAY_MS;
  mockPendingDocs.docs = [];
  vi.mocked(getUserEmailInfo).mockReset().mockResolvedValue({
    email: "person@example.com",
    displayName: "Person",
  });
  vi.mocked(sendResendEmail).mockReset().mockResolvedValue(true);
  vi.mocked(logger.warn).mockClear();
});

afterEach(() => {
  delete process.env.GRID_ENGAGEMENT_EMAIL_DELAY_MS;
});

describe("getGridEngagementEmailDelayMs", () => {
  it("defaults to two days", () => {
    expect(getGridEngagementEmailDelayMs()).toBe(2 * 24 * 60 * 60 * 1000);
  });

  it("reads override from env", () => {
    process.env.GRID_ENGAGEMENT_EMAIL_DELAY_MS = "60000";
    expect(getGridEngagementEmailDelayMs()).toBe(60000);
  });
});

describe("processPendingGridEngagementEmails", () => {
  it("sends for pending records past the delay window", async () => {
    process.env.GRID_ENGAGEMENT_EMAIL_DELAY_MS = "1000";
    const refSet = vi.fn().mockResolvedValue(undefined);
    mockPendingDocs.docs = [
      {
        id: "user-with-slug",
        data: () => ({
          gridId: "grid-1",
          gridName: "My Grid",
          firstEditAt: { toMillis: () => Date.now() - 5000 },
          status: "pending",
        }),
        ref: { set: refSet },
      },
    ];

    const result = await processPendingGridEngagementEmails({
      db: mockDb as never,
      apiKey: "re_test",
      from: "Grids <hello@grids.so>",
    });

    expect(result).toEqual({ processed: 1, sent: 1 });
    expect(vi.mocked(sendResendEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendResendEmail).mock.calls[0][0].payload.subject).toBe(
      "Your grid is ready",
    );
    expect(refSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent" }),
      { merge: true },
    );
  });

  it("skips records still inside the delay window", async () => {
    process.env.GRID_ENGAGEMENT_EMAIL_DELAY_MS = "100000";
    mockPendingDocs.docs = [
      {
        id: "user-1",
        data: () => ({
          gridId: "grid-1",
          gridName: "My Grid",
          firstEditAt: { toMillis: () => Date.now() - 1000 },
          status: "pending",
        }),
        ref: { set: vi.fn() },
      },
    ];

    const result = await processPendingGridEngagementEmails({
      db: mockDb as never,
      apiKey: "re_test",
      from: "Grids <hello@grids.so>",
    });

    expect(result).toEqual({ processed: 1, sent: 0 });
    expect(sendResendEmail).not.toHaveBeenCalled();
  });
});
