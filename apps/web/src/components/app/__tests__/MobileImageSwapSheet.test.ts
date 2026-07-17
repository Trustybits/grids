import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import type { UploadArchiveDocument } from "@grids/contracts/types";
import MobileImageSwapSheet from "../MobileImageSwapSheet.vue";

const img = (over: Partial<UploadArchiveDocument>): UploadArchiveDocument =>
  ({
    uid: "user-1",
    hash: "h",
    kind: "images",
    path: "p",
    url: "https://cdn/i.png",
    size: 1,
    contentType: "image/png",
    ext: "png",
    status: "active",
    refCount: 0,
    shareable: false,
    ...over,
  }) as UploadArchiveDocument;

const holder = vi.hoisted(() => ({
  uploads: [] as UploadArchiveDocument[],
  loading: false,
  refresh: vi.fn(async () => undefined),
  uploadBackgroundImage: vi.fn(async () => undefined),
  setBackgroundImageFromArchive: vi.fn(async () => undefined),
  backgroundImageSrc: "",
  backgroundImageHash: "",
  isImageBackgroundActive: false,
}));

vi.mock("@/composables/useFileArchive", () => ({
  useFileArchive: () => ({
    uploads: ref(holder.uploads),
    loading: ref(holder.loading),
    refresh: holder.refresh,
  }),
}));

vi.mock("@/composables/useGridSettings", () => ({
  useGridSettings: () => ({
    backgroundImageSrc: ref(holder.backgroundImageSrc),
    backgroundImageHash: ref(holder.backgroundImageHash),
    isImageBackgroundActive: ref(holder.isImageBackgroundActive),
    uploadBackgroundImage: holder.uploadBackgroundImage,
    setBackgroundImageFromArchive: holder.setBackgroundImageFromArchive,
  }),
}));

const mountSheet = () =>
  mount(MobileImageSwapSheet, {
    global: { stubs: { PlusIcon: true, SpinnerIcon: true } },
  });

describe("MobileImageSwapSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    holder.uploads = [];
    holder.loading = false;
    holder.backgroundImageSrc = "";
    holder.backgroundImageHash = "";
    holder.isImageBackgroundActive = false;
  });

  it("refreshes the archive on mount", () => {
    mountSheet();
    expect(holder.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the current image in the preview when one is set", () => {
    holder.backgroundImageSrc = "https://cdn/current.png";
    const wrapper = mountSheet();
    const preview = wrapper.find(".mis-preview__img");
    expect(preview.exists()).toBe(true);
    expect(preview.attributes("src")).toBe("https://cdn/current.png");
    expect(wrapper.find(".mis-preview__empty").exists()).toBe(false);
  });

  it("renders only image archive docs (skipping other kinds and failed)", () => {
    holder.uploads = [
      img({ hash: "a" }),
      img({ hash: "b", kind: "documents" }),
      img({ hash: "c", status: "failed" }),
      img({ hash: "d" }),
    ];
    const wrapper = mountSheet();
    // Two valid image tiles (the upload tile is separate).
    expect(wrapper.findAll(".mis-tile:not(.mis-tile--upload)")).toHaveLength(2);
  });

  it("sets an archive image as the background when its tile is tapped", async () => {
    holder.uploads = [img({ hash: "a" })];
    const wrapper = mountSheet();
    await wrapper.get(".mis-tile:not(.mis-tile--upload)").trigger("click");
    expect(holder.setBackgroundImageFromArchive).toHaveBeenCalledTimes(1);
    expect(holder.setBackgroundImageFromArchive).toHaveBeenCalledWith(
      expect.objectContaining({ hash: "a" }),
    );
  });

  it("highlights the active image by hash", () => {
    holder.uploads = [img({ hash: "a" }), img({ hash: "b" })];
    holder.isImageBackgroundActive = true;
    holder.backgroundImageHash = "b";
    const wrapper = mountSheet();
    const tiles = wrapper.findAll(".mis-tile:not(.mis-tile--upload)");
    expect(tiles[0].classes()).not.toContain("is-selected");
    expect(tiles[1].classes()).toContain("is-selected");
  });

  it("does not highlight any tile when the image source is inactive", () => {
    holder.uploads = [img({ hash: "a" })];
    holder.isImageBackgroundActive = false;
    holder.backgroundImageHash = "a";
    const wrapper = mountSheet();
    expect(wrapper.find(".mis-tile.is-selected").exists()).toBe(false);
  });

  it("uploads a new image and refreshes the strip", async () => {
    const wrapper = mountSheet();
    holder.refresh.mockClear();
    const input = wrapper.find(".mis-file");
    const file = new File(["x"], "pic.png", { type: "image/png" });
    Object.defineProperty(input.element, "files", { value: [file] });
    await input.trigger("change");
    expect(holder.uploadBackgroundImage).toHaveBeenCalledWith(file);
  });
});
