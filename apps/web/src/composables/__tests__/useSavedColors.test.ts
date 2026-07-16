import { beforeEach, describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({
  userId: "user-1" as string | null,
  getUserProfile: vi.fn(async () => ({
    savedColors: [] as string[] | undefined,
  })),
  updateUserProfile: vi.fn(async () => undefined),
}));

vi.mock("@/auth/AuthProviderSingleton", () => ({
  getAuthProvider: () => ({
    getCurrentUserId: () => holder.userId,
  }),
}));

vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: () => ({
    getUserService: () => ({
      getUserProfile: holder.getUserProfile,
      updateUserProfile: holder.updateUserProfile,
    }),
  }),
}));

const load = async () => {
  const { useSavedColors } = await import("../useSavedColors");
  return useSavedColors();
};

describe("useSavedColors", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    holder.userId = "user-1";
    holder.getUserProfile.mockResolvedValue({ savedColors: [] });
    holder.updateUserProfile.mockResolvedValue(undefined);
  });

  it("loads and normalizes the user's saved colors", async () => {
    holder.getUserProfile.mockResolvedValue({
      savedColors: ["ff0000", "#00ff00", "bogus!!"],
    });
    const { savedColors, load: loadColors } = await load();
    await loadColors();
    expect(savedColors.value).toEqual(["#FF0000", "#00FF00"]);
  });

  it("prepends a newly added color and persists it newest-first", async () => {
    holder.getUserProfile.mockResolvedValue({ savedColors: ["#00FF00"] });
    const { savedColors, load: loadColors, addColor } = await load();
    await loadColors();

    await addColor("ff0000");
    expect(savedColors.value).toEqual(["#FF0000", "#00FF00"]);
    expect(holder.updateUserProfile).toHaveBeenCalledWith("user-1", {
      savedColors: ["#FF0000", "#00FF00"],
    });
  });

  it("de-duplicates case-insensitively, moving an existing color to the front", async () => {
    holder.getUserProfile.mockResolvedValue({
      savedColors: ["#00FF00", "#0000FF"],
    });
    const { savedColors, load: loadColors, addColor } = await load();
    await loadColors();

    await addColor("#0000ff");
    expect(savedColors.value).toEqual(["#0000FF", "#00FF00"]);
  });

  it("ignores invalid input", async () => {
    const { savedColors, addColor } = await load();
    await addColor("not-a-color");
    expect(savedColors.value).toEqual([]);
    expect(holder.updateUserProfile).not.toHaveBeenCalled();
  });

  it("rolls back the optimistic add if persistence fails", async () => {
    holder.getUserProfile.mockResolvedValue({ savedColors: ["#00FF00"] });
    holder.updateUserProfile.mockRejectedValue(new Error("offline"));
    const { savedColors, load: loadColors, addColor } = await load();
    await loadColors();

    await addColor("#FF0000");
    expect(savedColors.value).toEqual(["#00FF00"]);
  });

  it("caps the list at 24 colors", async () => {
    const existing = Array.from(
      { length: 24 },
      (_, i) => `#0000${i.toString(16).padStart(2, "0").toUpperCase()}`,
    );
    holder.getUserProfile.mockResolvedValue({ savedColors: existing });
    const { savedColors, load: loadColors, addColor } = await load();
    await loadColors();

    await addColor("#FF0000");
    expect(savedColors.value).toHaveLength(24);
    expect(savedColors.value[0]).toBe("#FF0000");
  });

  it("clears colors when signed out", async () => {
    holder.userId = null;
    const { savedColors, load: loadColors } = await load();
    await loadColors();
    expect(savedColors.value).toEqual([]);
  });
});
