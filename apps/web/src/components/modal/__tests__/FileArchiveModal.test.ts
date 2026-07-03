import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import type { AuthProvider } from "@grids/contracts/auth";
import type {
  Grid,
  UploadArchiveDocument,
  UserProfile,
} from "@grids/contracts/types";
import { registerAuthProvider } from "@/auth/AuthProviderSingleton";
import { registerServiceFactory } from "@/services/ServiceFactorySingleton";
import type { ServiceFactoryInterface } from "@/services/factory/ServiceFactoryInterface";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import FileArchiveModal from "../FileArchiveModal.vue";

const MB = 1024 * 1024;

function makeUpload(
  overrides: Partial<UploadArchiveDocument> = {},
): UploadArchiveDocument {
  return {
    uid: "user-1",
    hash: "a".repeat(64),
    kind: "images",
    path: "users/user-1/images/a.png",
    url: "https://cdn/a.png",
    displayName: "photo.png",
    size: 2 * MB,
    contentType: "image/png",
    ext: "png",
    status: "active",
    refCount: 0,
    shareable: false,
    ...overrides,
  };
}

function makeGrid(overrides: Partial<Grid> = {}): Grid {
  return {
    id: "grid-1",
    userId: "user-1",
    name: "My Grid",
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    tiles: [],
    ...overrides,
  };
}

function registerStubs(options: {
  uploads?: UploadArchiveDocument[];
  storageUsed?: number;
  isDevAccount?: boolean;
}) {
  const listArchiveUploads = vi
    .fn()
    .mockResolvedValue(options.uploads ?? []);

  registerAuthProvider({
    getCurrentUserId: () => "user-1",
  } as unknown as AuthProvider);

  registerServiceFactory({
    getStorageService: () => ({ listArchiveUploads }) as never,
    getUserService: () =>
      ({
        subscribeToUserProfile: (
          _uid: string,
          cb: (profile: UserProfile | null) => void,
        ) => {
          cb({
            storageUsed: options.storageUsed ?? 0,
            isDevAccount: options.isDevAccount ?? false,
          } as UserProfile);
          return () => {};
        },
      }) as never,
  } as unknown as ServiceFactoryInterface);

  return { listArchiveUploads };
}

describe("FileArchiveModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the empty state, filter pills and quota text", async () => {
    registerStubs({ uploads: [], storageUsed: 24 * MB });
    const wrapper = mount(FileArchiveModal, { props: { isOpen: true } });
    await flushPromises();

    const text = document.body.textContent ?? "";
    expect(text).toContain("File Archive");
    expect(document.body.querySelector(".fa__beta-tag")?.textContent).toBe(
      "Beta",
    );
    expect(text).toContain("No files in archive");
    for (const pill of ["All", "Images", "Videos", "Documents"]) {
      expect(text).toContain(pill);
    }
    expect(text).toContain("24 MB");
    expect(text).toContain("5 GB");

    wrapper.unmount();
    document.body.innerHTML = "";
  });

  it("shows ∞ instead of a limit for dev accounts", async () => {
    registerStubs({ uploads: [], storageUsed: 24 * MB, isDevAccount: true });
    const wrapper = mount(FileArchiveModal, { props: { isOpen: true } });
    await flushPromises();

    const text = document.body.textContent ?? "";
    expect(text).toContain("∞");
    expect(text).not.toContain("5 GB");

    wrapper.unmount();
    document.body.innerHTML = "";
  });

  it("lists files and filters by kind when a pill is clicked", async () => {
    registerStubs({
      uploads: [
        makeUpload({ hash: "i".repeat(64), displayName: "pic.png" }),
        makeUpload({
          hash: "v".repeat(64),
          kind: "videos",
          displayName: "clip.mp4",
          ext: "mp4",
          contentType: "video/mp4",
        }),
      ],
    });
    const wrapper = mount(FileArchiveModal, { props: { isOpen: true } });
    await flushPromises();

    expect(document.body.textContent).toContain("pic.png");
    expect(document.body.textContent).toContain("clip.mp4");

    const pills = document.body.querySelectorAll<HTMLButtonElement>(".fa__pill");
    const videosPill = Array.from(pills).find(
      (b) => b.textContent?.trim() === "Videos",
    );
    videosPill?.click();
    await flushPromises();

    expect(document.body.textContent).toContain("clip.mp4");
    expect(document.body.textContent).not.toContain("pic.png");

    wrapper.unmount();
    document.body.innerHTML = "";
  });

  it("renders visible icon actions with the expected archive icons", async () => {
    registerStubs({
      uploads: [makeUpload({ displayName: "pic.png" })],
    });
    const session = useGridSessionStore();
    session.setCurrentGrid(makeGrid());
    session.setOwner(true);

    const wrapper = mount(FileArchiveModal, { props: { isOpen: true } });
    await flushPromises();

    const expectedPaths = {
      "Add to grid": "M12 5v14M5 12h14",
      Rename:
        "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
      "Delete permanently": "M13 3.00004L3.00004 13M3 3L13 13",
    };

    for (const [label, path] of Object.entries(expectedPaths)) {
      const button = document.body.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"]`,
      );
      expect(button).not.toBeNull();
      expect(button?.classList.contains("fa__icon-btn")).toBe(true);
      expect(button?.querySelector(`svg path[d="${path}"]`)).not.toBeNull();
    }

    wrapper.unmount();
    document.body.innerHTML = "";
  });
});
