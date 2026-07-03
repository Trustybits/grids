import { beforeEach, describe, expect, it, vi } from "vitest";
import { isDevTeamMember } from "../utils_devTeam.js";

const { firestoreState } = vi.hoisted(() => ({
  firestoreState: {
    setCalls: [] as Array<{
      path: string;
      data: Record<string, unknown>;
      options?: Record<string, unknown>;
    }>,
  },
}));

vi.mock("../utils_devTeam.js", () => ({
  isDevTeamMember: vi.fn(),
}));

vi.mock("../../admin.js", () => ({
  default: {
    firestore: () => ({
      collection: (collectionName: string) => ({
        doc: (docId: string) => ({
          set: async (
            data: Record<string, unknown>,
            options?: Record<string, unknown>,
          ) => {
            firestoreState.setCalls.push({
              path: `${collectionName}/${docId}`,
              data,
              options,
            });
          },
        }),
      }),
    }),
  },
}));

import { syncDevAccountFlagForUser } from "../utils_devAccount.js";

beforeEach(() => {
  firestoreState.setCalls = [];
  vi.mocked(isDevTeamMember).mockReset().mockReturnValue(false);
});

describe("syncDevAccountFlagForUser", () => {
  it("writes the dev account flag based on the existing dev-team helper", async () => {
    vi.mocked(isDevTeamMember).mockReturnValue(true);

    await expect(
      syncDevAccountFlagForUser("user-1", "dev@grids.so"),
    ).resolves.toBe(true);

    expect(isDevTeamMember).toHaveBeenCalledWith("user-1", "dev@grids.so");
    expect(firestoreState.setCalls).toEqual([
      {
        path: "users/user-1",
        data: { isDevAccount: true },
        options: { merge: true },
      },
    ]);
  });
});
