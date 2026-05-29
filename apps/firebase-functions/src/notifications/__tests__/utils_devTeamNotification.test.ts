import { beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { isDevTeamMember } from "../utils_devTeam.js";
import { shouldSkipDevTeamNotification } from "../utils_devTeamNotification.js";

const { adminState } = vi.hoisted(() => ({
  adminState: {
    email: undefined as string | undefined,
    getReject: false,
    getCalls: [] as string[],
  },
}));

vi.mock("firebase-functions/logger", () => ({
  info: vi.fn(),
}));

vi.mock("../utils_devTeam.js", () => ({
  isDevTeamMember: vi.fn(),
}));

vi.mock("../../admin.js", () => ({
  default: {
    firestore: () => ({
      collection: (name: string) => ({
        doc: (id: string) => ({
          get: async () => {
            adminState.getCalls.push(`${name}/${id}`);
            if (adminState.getReject) {
              throw new Error("firestore unavailable");
            }
            return {
              data: () =>
                adminState.email === undefined ? undefined : { email: adminState.email },
            };
          },
        }),
      }),
    }),
  },
}));

beforeEach(() => {
  adminState.email = undefined;
  adminState.getReject = false;
  adminState.getCalls = [];
  vi.mocked(isDevTeamMember).mockReset().mockReturnValue(false);
  vi.mocked(logger.info).mockClear();
});

describe("shouldSkipDevTeamNotification", () => {
  describe("with email provided directly", () => {
    it("returns true and logs when dev team member", async () => {
      vi.mocked(isDevTeamMember).mockReturnValue(true);

      const result = await shouldSkipDevTeamNotification({
        userId: "user-1",
        email: "dev@trustybits.com",
        logContext: { source: "test" },
      });

      expect(result).toBe(true);
      expect(isDevTeamMember).toHaveBeenCalledWith("user-1", "dev@trustybits.com");
      expect(logger.info).toHaveBeenCalledWith(
        "Skipping Discord notification for dev team member",
        { source: "test" },
      );
    });

    it("returns false and does not log when not a dev team member", async () => {
      vi.mocked(isDevTeamMember).mockReturnValue(false);

      const result = await shouldSkipDevTeamNotification({
        userId: "user-1",
        email: "person@example.com",
        logContext: { source: "test" },
      });

      expect(result).toBe(false);
      expect(isDevTeamMember).toHaveBeenCalledWith("user-1", "person@example.com");
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("does not look up email when one is already provided, even with lookupUserEmail=true", async () => {
      vi.mocked(isDevTeamMember).mockReturnValue(false);

      await shouldSkipDevTeamNotification({
        userId: "user-1",
        email: "person@example.com",
        lookupUserEmail: true,
        logContext: {},
      });

      expect(adminState.getCalls).toEqual([]);
      expect(isDevTeamMember).toHaveBeenCalledWith("user-1", "person@example.com");
    });
  });

  describe("without email and lookupUserEmail=false (default)", () => {
    it("calls isDevTeamMember with undefined email and does not touch firestore", async () => {
      vi.mocked(isDevTeamMember).mockReturnValue(false);

      const result = await shouldSkipDevTeamNotification({
        userId: "user-1",
        logContext: {},
      });

      expect(result).toBe(false);
      expect(adminState.getCalls).toEqual([]);
      expect(isDevTeamMember).toHaveBeenCalledWith("user-1", undefined);
    });

    it("returns true and logs when userId alone matches a dev team member", async () => {
      vi.mocked(isDevTeamMember).mockReturnValue(true);

      const result = await shouldSkipDevTeamNotification({
        userId: "dev-uid",
        logContext: { foo: "bar" },
      });

      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        "Skipping Discord notification for dev team member",
        { foo: "bar" },
      );
    });
  });

  describe("without email and lookupUserEmail=true", () => {
    it("looks up the user's email from firestore and uses it", async () => {
      adminState.email = "looked-up@grids.so";
      vi.mocked(isDevTeamMember).mockReturnValue(true);

      const result = await shouldSkipDevTeamNotification({
        userId: "user-1",
        lookupUserEmail: true,
        logContext: { ctx: 1 },
      });

      expect(result).toBe(true);
      expect(adminState.getCalls).toEqual(["users/user-1"]);
      expect(isDevTeamMember).toHaveBeenCalledWith("user-1", "looked-up@grids.so");
    });

    it("passes undefined email when the user doc has no email field", async () => {
      adminState.email = undefined; // doc data() returns undefined
      vi.mocked(isDevTeamMember).mockReturnValue(false);

      const result = await shouldSkipDevTeamNotification({
        userId: "user-1",
        lookupUserEmail: true,
        logContext: {},
      });

      expect(result).toBe(false);
      expect(adminState.getCalls).toEqual(["users/user-1"]);
      expect(isDevTeamMember).toHaveBeenCalledWith("user-1", undefined);
    });

    it("swallows firestore errors and treats the email as undefined", async () => {
      adminState.getReject = true;
      vi.mocked(isDevTeamMember).mockReturnValue(false);

      const result = await shouldSkipDevTeamNotification({
        userId: "user-1",
        lookupUserEmail: true,
        logContext: {},
      });

      expect(result).toBe(false);
      expect(adminState.getCalls).toEqual(["users/user-1"]);
      expect(isDevTeamMember).toHaveBeenCalledWith("user-1", undefined);
    });

    it("skips the firestore lookup entirely when no userId is provided", async () => {
      vi.mocked(isDevTeamMember).mockReturnValue(false);

      const result = await shouldSkipDevTeamNotification({
        lookupUserEmail: true,
        logContext: {},
      });

      expect(result).toBe(false);
      expect(adminState.getCalls).toEqual([]);
      expect(isDevTeamMember).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  it("returns false when neither userId nor email are provided and lookup is off", async () => {
    vi.mocked(isDevTeamMember).mockReturnValue(false);

    const result = await shouldSkipDevTeamNotification({ logContext: {} });

    expect(result).toBe(false);
    expect(isDevTeamMember).toHaveBeenCalledWith(undefined, undefined);
    expect(logger.info).not.toHaveBeenCalled();
  });
});
