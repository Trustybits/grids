import { beforeEach, describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({
  canEdit: true,
  userId: "user-1" as string | null,
  email: "user@example.com" as string | null,
  push: vi.fn(),
  addToast: vi.fn(),
  getUserProfile: vi.fn(async () => ({ defaultGridId: null as string | null })),
  setDefaultGrid: vi.fn(async () => undefined),
  setVerticalCompact: vi.fn(),
  setGridTheme: vi.fn(),
  setDuplicatable: vi.fn(),
  setShowMetaData: vi.fn(),
  setShowMetaDataVerbose: vi.fn(),
  addBackgroundImage: vi.fn(),
  getDownloadUrl: vi.fn(async () => "https://cdn/resolved.png"),
  hasBreakpointOverride: vi.fn(() => false),
  saveBreakpointPositions: vi.fn(),
  resetBreakpoint: vi.fn(),
  deleteGrid: vi.fn(async () => undefined),
  duplicateGrid: vi.fn(async () => "new-grid"),
  resolveStoragePlan: vi.fn(
    async (): Promise<Record<string, unknown> | null> => ({}),
  ),
  setTheme: vi.fn(),
  startGame: vi.fn(),
  pendingOutgoingForGrid: vi.fn(() => undefined as unknown),
  cancelTransfer: vi.fn(async () => undefined),
  writeText: vi.fn(async () => undefined),
  session: {
    currentGrid: { id: "grid-1", userId: "user-1", duplicatable: false } as
      | Record<string, unknown>
      | null,
    verticalCompact: false,
    isOwner: true,
  },
  viewport: { activeBreakpoint: "sm", displayPositions: [{ i: "a" }] },
  ui: { showMetaData: false, showMetaDataVerbose: false },
  theme: { isDarkMode: false },
}));

vi.mock("vue-router", () => ({ useRouter: () => ({ push: holder.push }) }));

vi.mock("@/auth/AuthProviderSingleton", () => ({
  getAuthProvider: () => ({
    getCurrentUserId: () => holder.userId,
    getCurrentUser: () =>
      holder.email === null ? null : { id: holder.userId, email: holder.email },
  }),
}));

vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: () => ({
    getUserService: () => ({
      getUserProfile: holder.getUserProfile,
      setDefaultGrid: holder.setDefaultGrid,
    }),
    getStorageService: () => ({
      getDownloadUrl: holder.getDownloadUrl,
    }),
  }),
}));

vi.mock("@/stores/grid/gridSession", () => ({
  useGridSessionStore: () => holder.session,
}));
vi.mock("@/stores/grid/gridViewport", () => ({
  useGridViewportStore: () => holder.viewport,
}));
vi.mock("@/stores/grid/gridUi", () => ({
  useGridUiStore: () => holder.ui,
}));
vi.mock("@/stores/theme", () => ({
  useThemeStore: () => ({
    get isDarkMode() {
      return holder.theme.isDarkMode;
    },
    setTheme: holder.setTheme,
  }),
}));
vi.mock("@/stores/toast", () => ({
  useToastStore: () => ({ addToast: holder.addToast }),
}));
vi.mock("@/stores/pixelRacers", () => ({
  usePixelRacersStore: () => ({ startGame: holder.startGame }),
}));

vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => ({
    canEditCurrentGrid: () => holder.canEdit,
    setVerticalCompact: holder.setVerticalCompact,
    setGridTheme: holder.setGridTheme,
    setDuplicatable: holder.setDuplicatable,
    setShowMetaData: holder.setShowMetaData,
    setShowMetaDataVerbose: holder.setShowMetaDataVerbose,
    hasBreakpointOverride: holder.hasBreakpointOverride,
    saveBreakpointPositions: holder.saveBreakpointPositions,
    resetBreakpoint: holder.resetBreakpoint,
    deleteGrid: holder.deleteGrid,
    duplicateGrid: holder.duplicateGrid,
    addBackgroundImage: holder.addBackgroundImage,
  }),
}));

vi.mock("@/composables/useGridTransfers", () => ({
  useGridTransfers: () => ({
    pendingOutgoingForGrid: holder.pendingOutgoingForGrid,
    cancelTransfer: holder.cancelTransfer,
  }),
}));
vi.mock("@/composables/useGridDuplicateStorage", () => ({
  useGridDuplicateStorage: () => ({ resolveStoragePlan: holder.resolveStoragePlan }),
}));
vi.mock("@/utils/CallableError", () => ({
  describeCallableError: (_error: unknown, fallback: string) => fallback,
}));

const load = async () => {
  const { useGridSettings } = await import("../useGridSettings");
  return useGridSettings();
};

describe("useGridSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    holder.canEdit = true;
    holder.userId = "user-1";
    holder.email = "user@example.com";
    holder.session = {
      currentGrid: { id: "grid-1", userId: "user-1", duplicatable: false },
      verticalCompact: false,
      isOwner: true,
    };
    holder.getUserProfile.mockResolvedValue({ defaultGridId: null });
    holder.duplicateGrid.mockResolvedValue("new-grid");
    holder.resolveStoragePlan.mockResolvedValue({});
    holder.pendingOutgoingForGrid.mockReturnValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: holder.writeText },
      configurable: true,
    });
    Object.defineProperty(window, "location", {
      value: { href: "https://grids.so/grid/grid-1" },
      configurable: true,
    });
  });

  it("reports ownership from the auth id + grid owner", async () => {
    const owned = await load();
    expect(owned.isOwner.value).toBe(true);

    holder.userId = "someone-else";
    const notOwned = await load();
    expect(notOwned.isOwner.value).toBe(false);
  });

  it("flags Trustybits staff by email domain", async () => {
    holder.email = "matt@trustybits.com";
    expect((await load()).isStaff.value).toBe(true);

    holder.email = "matt@TRUSTYBITS.COM";
    expect((await load()).isStaff.value).toBe(true);

    holder.email = "someone@example.com";
    expect((await load()).isStaff.value).toBe(false);

    holder.email = null;
    expect((await load()).isStaff.value).toBe(false);
  });

  it("routes toggle setters through the controller", async () => {
    const gs = await load();
    gs.verticalCompact.value = true;
    gs.duplicatable.value = true;
    gs.isDarkMode.value = true;
    expect(holder.setVerticalCompact).toHaveBeenCalledWith(true);
    expect(holder.setDuplicatable).toHaveBeenCalledWith(true);
    expect(holder.setTheme).toHaveBeenCalledWith("dark");
    expect(holder.setGridTheme).toHaveBeenCalledWith("dark");
  });

  it("blocks grid mutations and local theme state while preview is read-only", async () => {
    holder.canEdit = false;
    const gs = await load();

    gs.verticalCompact.value = true;
    gs.duplicatable.value = true;
    gs.isDarkMode.value = true;
    gs.saveBreakpoint();
    gs.resetBreakpoint();
    gs.requestDelete();
    const duplicate = await gs.duplicateGrid("full");
    await gs.performDelete();

    expect(holder.setVerticalCompact).not.toHaveBeenCalled();
    expect(holder.setDuplicatable).not.toHaveBeenCalled();
    expect(holder.setTheme).not.toHaveBeenCalled();
    expect(holder.setGridTheme).not.toHaveBeenCalled();
    expect(holder.saveBreakpointPositions).not.toHaveBeenCalled();
    expect(holder.resetBreakpoint).not.toHaveBeenCalled();
    expect(gs.showDeleteModal.value).toBe(false);
    expect(duplicate).toBeNull();
    expect(holder.duplicateGrid).not.toHaveBeenCalled();
    expect(holder.deleteGrid).not.toHaveBeenCalled();
    expect(holder.push).not.toHaveBeenCalled();
  });

  it("reflects and toggles the default-grid preference", async () => {
    holder.getUserProfile.mockResolvedValue({ defaultGridId: "grid-1" });
    const gs = await load();
    await gs.refreshDefaultGrid();
    expect(gs.isDefaultGrid.value).toBe(true);

    await gs.toggleDefaultGrid();
    expect(holder.setDefaultGrid).toHaveBeenCalledWith("user-1", null);
    expect(gs.isDefaultGrid.value).toBe(false);

    await gs.toggleDefaultGrid();
    expect(holder.setDefaultGrid).toHaveBeenLastCalledWith("user-1", "grid-1");
    expect(gs.isDefaultGrid.value).toBe(true);
  });

  it("duplicates and navigates, but bails when the storage plan is declined", async () => {
    const gs = await load();
    const newId = await gs.duplicateGrid("full");
    expect(newId).toBe("new-grid");
    expect(holder.push).toHaveBeenCalledWith("/grid/new-grid");

    holder.resolveStoragePlan.mockResolvedValueOnce(null);
    holder.push.mockClear();
    const cancelled = await gs.duplicateGrid("structure");
    expect(cancelled).toBeNull();
    expect(holder.push).not.toHaveBeenCalled();
  });

  it("copies the grid link to the clipboard", async () => {
    const gs = await load();
    await gs.copyGridLink();
    expect(holder.writeText).toHaveBeenCalledWith("https://grids.so/grid/grid-1");
    expect(holder.addToast).toHaveBeenCalledWith(
      "Link to Grid copied to the clipboard",
      "success",
    );
  });

  it("opens the delete modal and performs the delete + navigation", async () => {
    const gs = await load();
    gs.requestDelete();
    expect(gs.showDeleteModal.value).toBe(true);

    await gs.performDelete();
    expect(holder.deleteGrid).toHaveBeenCalledWith("grid-1");
    expect(gs.showDeleteModal.value).toBe(false);
    expect(holder.push).toHaveBeenCalledWith("/dashboard");
  });

  it("cancels a pending transfer", async () => {
    holder.pendingOutgoingForGrid.mockReturnValue({ id: "transfer-1" });
    const gs = await load();
    await gs.cancelPendingTransfer();
    expect(holder.cancelTransfer).toHaveBeenCalledWith("transfer-1");
    expect(holder.addToast).toHaveBeenCalledWith("Transfer cancelled", "success");
  });

  it("launches Pixel Racers via the game store", async () => {
    const gs = await load();
    gs.launchPixelRacers();
    expect(holder.startGame).toHaveBeenCalledTimes(1);
  });

  it("links an external image URL as a non-hosted background (no hash)", async () => {
    const gs = await load();
    gs.linkBackgroundImage("  https://cdn/pic.png  ");
    expect(holder.addBackgroundImage).toHaveBeenCalledWith(
      "https://cdn/pic.png",
      false,
    );
  });

  it("ignores an empty linked image URL", async () => {
    const gs = await load();
    gs.linkBackgroundImage("   ");
    expect(holder.addBackgroundImage).not.toHaveBeenCalled();
  });

  it("sets an archive image as the background, resolving a fresh URL + hash", async () => {
    const gs = await load();
    await gs.setBackgroundImageFromArchive({
      hash: "abc123",
      path: "users/user-1/uploads/abc123",
      url: "https://cdn/stale.png",
      kind: "images",
    } as never);
    expect(holder.getDownloadUrl).toHaveBeenCalledWith(
      "users/user-1/uploads/abc123",
    );
    expect(holder.addBackgroundImage).toHaveBeenCalledWith(
      "https://cdn/resolved.png",
      false,
      "abc123",
    );
  });

  it("falls back to the stored URL when the path cannot be resolved", async () => {
    holder.getDownloadUrl.mockRejectedValueOnce(new Error("nope"));
    const gs = await load();
    await gs.setBackgroundImageFromArchive({
      hash: "abc123",
      path: "users/user-1/uploads/abc123",
      url: "https://cdn/stored.png",
      kind: "images",
    } as never);
    expect(holder.addBackgroundImage).toHaveBeenCalledWith(
      "https://cdn/stored.png",
      false,
      "abc123",
    );
  });
});
