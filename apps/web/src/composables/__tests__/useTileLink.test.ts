/**
 * Tests for useTileLink — manages a tile's outbound link: modal state, URL
 * normalization/validation, persistence (patch existing tile vs. save grid for
 * a new one), follow, and clear. All owner-gated.
 *
 * The grid and toast stores are mocked; window.open is spied. The `content`
 * object is passed by reference and mutated in place by the composable.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTileLink } from "@/composables/useTileLink";

const mockGridStore = vi.hoisted(() => ({
  isOwner: true,
  patchTileContent: vi.fn(),
  saveGrid: vi.fn(),
}));
const mockToastStore = vi.hoisted(() => ({ addToast: vi.fn() }));

vi.mock("@/stores/grid", () => ({ useGridStore: () => mockGridStore }));
vi.mock("@/stores/toast", () => ({ useToastStore: () => mockToastStore }));

beforeEach(() => {
  mockGridStore.isOwner = true;
  mockGridStore.patchTileContent.mockReset();
  mockGridStore.saveGrid.mockReset();
  mockToastStore.addToast.mockReset();
});

describe("derived link state", () => {
  it("reflects the content's tileLink", () => {
    const { tileLink, tileLinkExists } = useTileLink("t1", {
      tileLink: "https://x.com",
    });
    expect(tileLink.value).toBe("https://x.com");
    expect(tileLinkExists.value).toBe(true);
  });

  it("reports no link when tileLink is absent", () => {
    const { tileLink, tileLinkExists } = useTileLink("t1", {});
    expect(tileLink.value).toBeUndefined();
    expect(tileLinkExists.value).toBe(false);
  });
});

describe("modal control", () => {
  it("opens the modal for an owner", () => {
    const { openUrlInput, showLinkModal } = useTileLink("t1", {});
    openUrlInput();
    expect(showLinkModal.value).toBe(true);
  });

  it("does not open the modal for a non-owner", () => {
    mockGridStore.isOwner = false;
    const { openUrlInput, showLinkModal } = useTileLink("t1", {});
    openUrlInput();
    expect(showLinkModal.value).toBe(false);
  });

  it("closes the modal", () => {
    const { openUrlInput, closeLinkModal, showLinkModal } = useTileLink("t1", {});
    openUrlInput();
    closeLinkModal();
    expect(showLinkModal.value).toBe(false);
  });
});

describe("handleAddLink", () => {
  it("normalizes a bare domain to https and patches an existing tile without mutating content directly", () => {
    const content: { tileLink?: string } = {};
    const { handleAddLink, showLinkModal } = useTileLink("t1", content);

    handleAddLink("example.com");

    // Live tile: the controller owns the canonical write; the composable does
    // not mutate the content prop directly.
    expect(content.tileLink).toBeUndefined();
    expect(mockGridStore.patchTileContent).toHaveBeenCalledWith("t1", {
      tileLink: "https://example.com",
    });
    expect(mockGridStore.saveGrid).not.toHaveBeenCalled();
    expect(showLinkModal.value).toBe(false);
  });

  it("preserves an existing http/https scheme", () => {
    const content: { tileLink?: string } = {};
    const { handleAddLink } = useTileLink("t1", content);
    handleAddLink("http://insecure.example");
    expect(mockGridStore.patchTileContent).toHaveBeenCalledWith("t1", {
      tileLink: "http://insecure.example",
    });
  });

  it("mutates local preview content (no persistence) when there is no tileId", () => {
    const content: { tileLink?: string } = {};
    const { handleAddLink } = useTileLink(null, content);
    handleAddLink("example.com");
    expect(content.tileLink).toBe("https://example.com");
    expect(mockGridStore.patchTileContent).not.toHaveBeenCalled();
    expect(mockGridStore.saveGrid).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only input with a toast and persists nothing", () => {
    const content: { tileLink?: string } = {};
    const { handleAddLink } = useTileLink("t1", content);

    handleAddLink("   ");

    expect(mockToastStore.addToast).toHaveBeenCalledWith(
      "Invalid URL format",
      "error",
    );
    expect(content.tileLink).toBeUndefined();
    expect(mockGridStore.patchTileContent).not.toHaveBeenCalled();
  });

  it("rejects a malformed (non-blank) URL that fails to parse", () => {
    const content: { tileLink?: string } = {};
    const { handleAddLink } = useTileLink("t1", content);

    // Has an http scheme but no host → new URL() throws → normalizeUrl returns "".
    handleAddLink("http://");

    expect(mockToastStore.addToast).toHaveBeenCalledWith(
      "Invalid URL format",
      "error",
    );
    expect(content.tileLink).toBeUndefined();
    expect(mockGridStore.patchTileContent).not.toHaveBeenCalled();
  });

  it("does nothing for a non-owner", () => {
    mockGridStore.isOwner = false;
    const content: { tileLink?: string } = {};
    const { handleAddLink } = useTileLink("t1", content);
    handleAddLink("example.com");
    expect(content.tileLink).toBeUndefined();
    expect(mockGridStore.patchTileContent).not.toHaveBeenCalled();
  });
});

describe("handleFollowLink", () => {
  beforeEach(() => {
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  it("opens the link in a new tab when one exists", () => {
    const { handleFollowLink } = useTileLink("t1", {
      tileLink: "https://x.com",
    });
    handleFollowLink();
    expect(window.open).toHaveBeenCalledWith(
      "https://x.com",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("does nothing when there is no link", () => {
    const { handleFollowLink } = useTileLink("t1", {});
    handleFollowLink();
    expect(window.open).not.toHaveBeenCalled();
  });
});

describe("clearLink", () => {
  it("clears an existing tile's link through a patch without mutating content directly", () => {
    const content: { tileLink?: string } = { tileLink: "https://x.com" };
    const { clearLink } = useTileLink("t1", content);

    clearLink();

    // Live tile: content prop is untouched; the patch owns the canonical write.
    expect(content.tileLink).toBe("https://x.com");
    expect(mockGridStore.patchTileContent).toHaveBeenCalledWith("t1", {
      tileLink: "",
    });
  });

  it("clears local preview content (no persistence) when there is no tileId", () => {
    const content: { tileLink?: string } = { tileLink: "https://x.com" };
    const { clearLink } = useTileLink(null, content);
    clearLink();
    expect(content.tileLink).toBeUndefined();
    expect(mockGridStore.patchTileContent).not.toHaveBeenCalled();
    expect(mockGridStore.saveGrid).not.toHaveBeenCalled();
  });

  it("does nothing for a non-owner", () => {
    mockGridStore.isOwner = false;
    const content: { tileLink?: string } = { tileLink: "https://x.com" };
    const { clearLink } = useTileLink("t1", content);
    clearLink();
    expect(content.tileLink).toBe("https://x.com");
    expect(mockGridStore.patchTileContent).not.toHaveBeenCalled();
  });
});
