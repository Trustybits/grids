/**
 * Tests for useDragAndPaste — intercepts paste and drag-and-drop on the grid
 * page to create tiles from files, URLs, embed codes, and plain text.
 *
 * Every collaborator is mocked: useFileUpload, the grid store, TileUtils
 * factories, classifyFileForUpload, and the CloudFunctions service. A host
 * component is mounted so onMounted attaches the document paste listener and the
 * containerRef watcher (flush: "post") attaches drop/drag listeners. Synthetic
 * ClipboardEvent / drag Event objects carry hand-rolled clipboardData /
 * dataTransfer payloads since jsdom's are minimal.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent, h, nextTick, ref, type Ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { ContentType } from "@grids/contracts/types";
import { useDragAndPaste } from "@/composables/useDragAndPaste";
import {
  createTileContent,
  createTileContentFromEmbedUrl,
} from "@/utils/TileUtils";
import { classifyFileForUpload } from "@/utils/UploadFileClassification";

const { mockUploadFileOptimistic, mockUploadDocumentsOptimistic } = vi.hoisted(
  () => ({
    mockUploadFileOptimistic: vi.fn(() => Promise.resolve()),
    mockUploadDocumentsOptimistic: vi.fn(() => Promise.resolve()),
  }),
);
const mockGridStore = vi.hoisted(() => ({
  canEdit: true,
  addTile: vi.fn<() => string | null>(() => "tile-1"),
  patchTileContent: vi.fn(),
  pendingFocusTileId: null as string | null,
}));
const { mockCallFunction } = vi.hoisted(() => ({ mockCallFunction: vi.fn() }));

vi.mock("@/composables/useFileUpload", () => ({
  useFileUpload: () => ({
    uploadFileOptimistic: mockUploadFileOptimistic,
    uploadDocumentsOptimistic: mockUploadDocumentsOptimistic,
  }),
}));
vi.mock("@/stores/grid", () => ({ useGridStore: () => mockGridStore }));
vi.mock("@/utils/TileUtils", () => ({
  createTileContent: vi.fn((type, data) => ({ type, ...data })),
  createTileContentFromEmbedUrl: vi.fn((src) => ({
    type: ContentType.EMBED,
    src,
  })),
}));
vi.mock("@/utils/UploadFileClassification", () => ({
  classifyFileForUpload: vi.fn((file: File) => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type === "application/pdf" || file.name.endsWith(".pdf"))
      return "document";
    return null;
  }),
}));
vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: () => ({
    getCloudFunctionsService: () => ({ callFunction: mockCallFunction }),
  }),
}));

const mockCreateTileContent = vi.mocked(createTileContent);
const mockCreateFromEmbed = vi.mocked(createTileContentFromEmbedUrl);
const mockClassify = vi.mocked(classifyFileForUpload);

// ── Synthetic event builders ────────────────────────────────────────────────

function fileOf(name: string, type: string): File {
  return new File(["x"], name, { type });
}

function fileList(files: File[]): FileList {
  return {
    item: (i: number) => files[i] ?? null,
    ...files,
    length: files.length,
  } as unknown as FileList;
}

function pasteEvent(opts: { files?: File[]; text?: string }): ClipboardEvent {
  const items =
    opts.files?.map((f) => ({
      kind: "file" as const,
      getAsFile: () => f,
    })) ?? [];
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: {
      items,
      getData: (t: string) => (t === "text/plain" ? (opts.text ?? "") : ""),
    },
  });
  return event as ClipboardEvent;
}

function dragEvent(
  type: string,
  opts: {
    files?: File[];
    uriList?: string;
    plain?: string;
    types?: string[];
  } = {},
): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: {
      files: fileList(opts.files ?? []),
      types: opts.types ?? [],
      getData: (t: string) =>
        t === "text/uri-list"
          ? (opts.uriList ?? "")
          : t === "text/plain"
            ? (opts.plain ?? "")
            : "",
      dropEffect: "",
    },
  });
  return event as DragEvent;
}

// ── Host ────────────────────────────────────────────────────────────────────

const wrappers: VueWrapper[] = [];

function setup() {
  const containerRef = ref<HTMLElement | null>(null);
  let isDraggingOver: Ref<boolean>;
  const wrapper = mount(
    defineComponent({
      setup() {
        ({ isDraggingOver } = useDragAndPaste(containerRef));
        return () => h("div");
      },
    }),
  );
  wrappers.push(wrapper);
  return { wrapper, containerRef, isDraggingOver: isDraggingOver! };
}

/** Attach a fresh container element and let the post-flush watcher wire it. */
async function withContainer(containerRef: Ref<HTMLElement | null>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containerRef.value = container;
  await nextTick();
  return container;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  mockGridStore.canEdit = true;
  mockGridStore.addTile.mockReturnValue("tile-1");
  mockGridStore.pendingFocusTileId = null;
  mockClassify.mockImplementation((file: File) => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type === "application/pdf" || file.name.endsWith(".pdf"))
      return "document";
    return null;
  });
  mockCreateFromEmbed.mockImplementation(
    (src) =>
      ({
        type: ContentType.EMBED,
        src,
      }) as never,
  );
  vi.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount();
  document.body.querySelectorAll("div").forEach((el) => el.remove());
  vi.restoreAllMocks();
});

// ── handlePaste: guards ─────────────────────────────────────────────────────

describe("handlePaste — guards", () => {
  it("ignores paste when the user cannot edit", async () => {
    mockGridStore.canEdit = false;
    setup();
    document.body.dispatchEvent(pasteEvent({ text: "https://x.com" }));
    await tick();
    expect(mockGridStore.addTile).not.toHaveBeenCalled();
  });

  it("ignores paste targeting an input element", async () => {
    setup();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(pasteEvent({ text: "https://x.com" }));
    await tick();
    expect(mockGridStore.addTile).not.toHaveBeenCalled();
    input.remove();
  });

  it("ignores paste targeting a textarea", async () => {
    setup();
    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    ta.dispatchEvent(pasteEvent({ text: "https://x.com" }));
    await tick();
    expect(mockGridStore.addTile).not.toHaveBeenCalled();
    ta.remove();
  });

  it("ignores paste inside a contenteditable element", async () => {
    setup();
    const ce = document.createElement("div");
    ce.setAttribute("contenteditable", "");
    Object.defineProperty(ce, "isContentEditable", { value: true });
    document.body.appendChild(ce);
    ce.dispatchEvent(pasteEvent({ text: "https://x.com" }));
    await tick();
    expect(mockGridStore.addTile).not.toHaveBeenCalled();
    ce.remove();
  });

  it("ignores paste inside a modal overlay", async () => {
    setup();
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    const child = document.createElement("span");
    modal.appendChild(child);
    document.body.appendChild(modal);
    child.dispatchEvent(pasteEvent({ text: "https://x.com" }));
    await tick();
    expect(mockGridStore.addTile).not.toHaveBeenCalled();
    modal.remove();
  });

  it("does nothing when there is no clipboard data", async () => {
    setup();
    const event = new Event("paste", { bubbles: true, cancelable: true });
    // No clipboardData property at all.
    document.body.dispatchEvent(event);
    await tick();
    expect(mockGridStore.addTile).not.toHaveBeenCalled();
  });
});

// ── handlePaste: files ──────────────────────────────────────────────────────

describe("handlePaste — files", () => {
  it("optimistically uploads a pasted image and prevents default", async () => {
    setup();
    const event = pasteEvent({ files: [fileOf("a.png", "image/png")] });
    document.body.dispatchEvent(event);
    await tick();
    expect(mockUploadFileOptimistic).toHaveBeenCalledWith(expect.any(File));
    expect(event.defaultPrevented).toBe(true);
  });

  it("routes a pasted document file to the documents uploader", async () => {
    setup();
    document.body.dispatchEvent(
      pasteEvent({ files: [fileOf("a.pdf", "application/pdf")] }),
    );
    await tick();
    expect(mockUploadDocumentsOptimistic).toHaveBeenCalledWith([
      expect.any(File),
    ]);
    expect(mockUploadFileOptimistic).not.toHaveBeenCalled();
  });

  it("alerts and logs when a pasted file upload fails", async () => {
    mockUploadFileOptimistic.mockRejectedValueOnce(new Error("disk full"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setup();
    document.body.dispatchEvent(
      pasteEvent({ files: [fileOf("a.png", "image/png")] }),
    );
    await tick();
    expect(window.alert).toHaveBeenCalledWith("disk full");
    expect(errSpy).toHaveBeenCalled();
  });
});

// ── handlePaste: text ───────────────────────────────────────────────────────

describe("handlePaste — text", () => {
  it("creates an embed tile from pasted iframe HTML", async () => {
    setup();
    const html = '<iframe src="https://embed.example/x"></iframe>';
    document.body.dispatchEvent(pasteEvent({ text: html }));
    await tick();
    expect(mockCreateFromEmbed).toHaveBeenCalledWith(html);
    expect(mockGridStore.addTile).toHaveBeenCalledWith({
      type: ContentType.EMBED,
      src: html,
    });
  });

  it("creates a SmartText tile from plain text and flags it for focus", async () => {
    setup();
    document.body.dispatchEvent(pasteEvent({ text: "hello world" }));
    await tick();
    expect(mockCreateTileContent).toHaveBeenCalledWith(
      ContentType.SMART_TEXT,
      expect.objectContaining({ text: expect.stringContaining("hello world") }),
    );
    expect(mockGridStore.pendingFocusTileId).toBe("tile-1");
  });

  it("stores plain text as stringified TipTap JSON", async () => {
    setup();
    document.body.dispatchEvent(pasteEvent({ text: "note" }));
    await tick();
    const calls = mockCreateTileContent.mock.calls;
    const arg = calls[calls.length - 1][1] as { text: string };
    expect(JSON.parse(arg.text)).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "note" }] },
      ],
    });
  });

  it("does not set pendingFocusTileId when the text tile cannot be created", async () => {
    mockGridStore.addTile.mockReturnValue(null);
    setup();
    document.body.dispatchEvent(pasteEvent({ text: "note" }));
    await tick();
    expect(mockGridStore.pendingFocusTileId).toBeNull();
  });

  it("ignores whitespace-only text", async () => {
    setup();
    document.body.dispatchEvent(pasteEvent({ text: "   " }));
    await tick();
    expect(mockGridStore.addTile).not.toHaveBeenCalled();
  });
});

// ── URL routing (isUrl heuristic via paste) ─────────────────────────────────

describe("handlePaste — URL detection", () => {
  it("treats a bare domain as a URL and creates a link tile", async () => {
    setup();
    document.body.dispatchEvent(pasteEvent({ text: "example.com" }));
    await tick();
    // Non-special embed → link tile created.
    expect(mockCreateTileContent).toHaveBeenCalledWith(ContentType.LINK, {
      link: "https://example.com",
    });
  });

  it("treats an https URL as a URL", async () => {
    setup();
    document.body.dispatchEvent(pasteEvent({ text: "https://example.com" }));
    await tick();
    expect(mockCreateTileContent).toHaveBeenCalledWith(ContentType.LINK, {
      link: "https://example.com",
    });
  });

  it("treats a mailto: link as a URL and skips the preview fetch", async () => {
    setup();
    document.body.dispatchEvent(pasteEvent({ text: "mailto:a@b.com" }));
    await tick();
    expect(mockCreateTileContent).toHaveBeenCalledWith(ContentType.LINK, {
      link: "mailto:a@b.com",
    });
    expect(mockCallFunction).not.toHaveBeenCalled();
  });

  it("treats multi-word text containing a domain as plain text, not a URL", async () => {
    setup();
    document.body.dispatchEvent(
      pasteEvent({ text: "check out amazon.com for deals" }),
    );
    await tick();
    expect(mockCreateTileContent).toHaveBeenCalledWith(
      ContentType.SMART_TEXT,
      expect.anything(),
    );
  });

  it("treats a single token without a dot as plain text", async () => {
    setup();
    document.body.dispatchEvent(pasteEvent({ text: "justaword" }));
    await tick();
    expect(mockCreateTileContent).toHaveBeenCalledWith(
      ContentType.SMART_TEXT,
      expect.anything(),
    );
  });
});

// ── handleUrlPaste enrichment ───────────────────────────────────────────────

describe("handleUrlPaste — special content vs link", () => {
  it("adds a detected YouTube tile directly without fetching a preview", async () => {
    mockCreateFromEmbed.mockReturnValue({ type: ContentType.YOUTUBE } as never);
    setup();
    document.body.dispatchEvent(
      pasteEvent({ text: "https://youtube.com/watch?v=abc" }),
    );
    await tick();
    expect(mockGridStore.addTile).toHaveBeenCalledWith({
      type: ContentType.YOUTUBE,
    });
    expect(mockCallFunction).not.toHaveBeenCalled();
  });

  it("fetches OG metadata and patches the link tile for a plain URL", async () => {
    mockGridStore.addTile.mockReturnValue("link-1");
    mockCallFunction.mockResolvedValue({
      url: "https://example.com/",
      domain: "example.com",
      title: "Example",
    });
    setup();
    document.body.dispatchEvent(pasteEvent({ text: "https://example.com" }));
    await tick();
    await tick();
    expect(mockCallFunction).toHaveBeenCalledWith("getLinkPreview", {
      url: "https://example.com",
    });
    expect(mockGridStore.patchTileContent).toHaveBeenCalledWith(
      "link-1",
      expect.objectContaining({
        link: "https://example.com/",
        domain: "example.com",
        metaTitle: "Example",
      }),
    );
  });

  it("swallows a preview fetch error without throwing", async () => {
    mockGridStore.addTile.mockReturnValue("link-1");
    mockCallFunction.mockRejectedValue(new Error("preview down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setup();
    document.body.dispatchEvent(pasteEvent({ text: "https://example.com" }));
    await tick();
    await tick();
    expect(mockGridStore.patchTileContent).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
  });

  it("does not fetch a preview when the link tile cannot be created", async () => {
    mockGridStore.addTile.mockReturnValue(null);
    setup();
    document.body.dispatchEvent(pasteEvent({ text: "https://example.com" }));
    await tick();
    expect(mockCallFunction).not.toHaveBeenCalled();
  });
});

// ── handleDrop ──────────────────────────────────────────────────────────────

describe("handleDrop", () => {
  it("ignores internal SmartText drags entirely", async () => {
    const { containerRef, isDraggingOver } = setup();
    const container = await withContainer(containerRef);
    isDraggingOver.value = true;

    const event = dragEvent("drop", {
      types: ["application/x-smarttext-drag"],
      files: [fileOf("a.png", "image/png")],
    });
    container.dispatchEvent(event);
    await tick();

    expect(event.defaultPrevented).toBe(false);
    expect(mockUploadFileOptimistic).not.toHaveBeenCalled();
    expect(isDraggingOver.value).toBe(true);
  });

  it("resets the drag state and uploads nothing when not editable", async () => {
    const { containerRef, isDraggingOver } = setup();
    const container = await withContainer(containerRef);
    isDraggingOver.value = true;
    mockGridStore.canEdit = false;

    const event = dragEvent("drop", { files: [fileOf("a.png", "image/png")] });
    container.dispatchEvent(event);
    await tick();

    expect(event.defaultPrevented).toBe(true);
    expect(isDraggingOver.value).toBe(false);
    expect(mockUploadFileOptimistic).not.toHaveBeenCalled();
  });

  it("groups consecutive media/document files and uploads each group", async () => {
    const { containerRef } = setup();
    const container = await withContainer(containerRef);

    container.dispatchEvent(
      dragEvent("drop", {
        files: [
          fileOf("a.png", "image/png"),
          fileOf("b.png", "image/png"),
          fileOf("c.pdf", "application/pdf"),
          fileOf("d.png", "image/png"),
        ],
      }),
    );
    await tick();

    // media group [a,b] → two single uploads; document group [c] → one batch;
    // media group [d] → one upload.
    expect(mockUploadFileOptimistic).toHaveBeenCalledTimes(3);
    expect(mockUploadDocumentsOptimistic).toHaveBeenCalledTimes(1);
    expect(mockUploadDocumentsOptimistic).toHaveBeenCalledWith([
      expect.any(File),
    ]);
  });

  it("skips unsupported (unclassified) files", async () => {
    mockClassify.mockReturnValue(null);
    const { containerRef } = setup();
    const container = await withContainer(containerRef);

    container.dispatchEvent(
      dragEvent("drop", { files: [fileOf("a.bin", "application/x-foo")] }),
    );
    await tick();

    expect(mockUploadFileOptimistic).not.toHaveBeenCalled();
    expect(mockUploadDocumentsOptimistic).not.toHaveBeenCalled();
  });

  it("alerts when a dropped document group fails to upload", async () => {
    mockUploadDocumentsOptimistic.mockRejectedValueOnce(new Error("too big"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { containerRef } = setup();
    const container = await withContainer(containerRef);

    container.dispatchEvent(
      dragEvent("drop", { files: [fileOf("a.pdf", "application/pdf")] }),
    );
    await tick();

    expect(window.alert).toHaveBeenCalledWith("too big");
    expect(errSpy).toHaveBeenCalled();
  });

  it("creates link tiles from a newline-separated URL drop", async () => {
    mockGridStore.addTile.mockReturnValue("link-x");
    mockCallFunction.mockResolvedValue({ url: "u" });
    const { containerRef } = setup();
    const container = await withContainer(containerRef);

    container.dispatchEvent(
      dragEvent("drop", {
        uriList: "https://one.com\nhttps://two.com",
      }),
    );
    await tick();
    await tick();

    expect(mockCreateTileContent).toHaveBeenCalledWith(ContentType.LINK, {
      link: "https://one.com",
    });
    expect(mockCreateTileContent).toHaveBeenCalledWith(ContentType.LINK, {
      link: "https://two.com",
    });
  });
});

// ── Drag enter / leave / over ───────────────────────────────────────────────

describe("drag enter/leave/over", () => {
  it("shows the overlay on dragenter and hides it once the counter returns to zero", async () => {
    const { containerRef, isDraggingOver } = setup();
    const container = await withContainer(containerRef);

    container.dispatchEvent(dragEvent("dragenter"));
    expect(isDraggingOver.value).toBe(true);

    container.dispatchEvent(dragEvent("dragleave"));
    expect(isDraggingOver.value).toBe(false);
  });

  it("keeps the overlay visible while nested dragenters outnumber dragleaves", async () => {
    const { containerRef, isDraggingOver } = setup();
    const container = await withContainer(containerRef);

    container.dispatchEvent(dragEvent("dragenter")); // counter 1
    container.dispatchEvent(dragEvent("dragenter")); // counter 2
    container.dispatchEvent(dragEvent("dragleave")); // counter 1
    expect(isDraggingOver.value).toBe(true);

    container.dispatchEvent(dragEvent("dragleave")); // counter 0
    expect(isDraggingOver.value).toBe(false);
  });

  it("sets dropEffect to copy and prevents default on dragover", async () => {
    const { containerRef } = setup();
    const container = await withContainer(containerRef);

    const event = dragEvent("dragover");
    container.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(event.dataTransfer!.dropEffect).toBe("copy");
  });

  it("does not react to dragenter when the user cannot edit", async () => {
    const { containerRef, isDraggingOver } = setup();
    const container = await withContainer(containerRef);
    mockGridStore.canEdit = false;

    container.dispatchEvent(dragEvent("dragenter"));
    expect(isDraggingOver.value).toBe(false);
  });

  it("ignores SmartText drags on dragover/dragenter", async () => {
    const { containerRef, isDraggingOver } = setup();
    const container = await withContainer(containerRef);

    const over = dragEvent("dragover", {
      types: ["application/x-smarttext-drag"],
    });
    container.dispatchEvent(over);
    container.dispatchEvent(
      dragEvent("dragenter", { types: ["application/x-smarttext-drag"] }),
    );

    expect(over.defaultPrevented).toBe(false);
    expect(isDraggingOver.value).toBe(false);
  });
});

// ── Listener lifecycle ──────────────────────────────────────────────────────

describe("listener lifecycle", () => {
  it("moves drop listeners to a new container when the ref changes", async () => {
    const { containerRef } = setup();
    const first = await withContainer(containerRef);
    const second = await withContainer(containerRef);

    // The old container no longer triggers uploads.
    first.dispatchEvent(
      dragEvent("drop", { files: [fileOf("a.png", "image/png")] }),
    );
    await tick();
    expect(mockUploadFileOptimistic).not.toHaveBeenCalled();

    // The new container does.
    second.dispatchEvent(
      dragEvent("drop", { files: [fileOf("a.png", "image/png")] }),
    );
    await tick();
    expect(mockUploadFileOptimistic).toHaveBeenCalledTimes(1);
  });

  it("detaches all listeners on unmount", async () => {
    const { wrapper, containerRef } = setup();
    const container = await withContainer(containerRef);
    wrapper.unmount();

    container.dispatchEvent(
      dragEvent("drop", { files: [fileOf("a.png", "image/png")] }),
    );
    document.body.dispatchEvent(pasteEvent({ text: "https://x.com" }));
    await tick();

    expect(mockUploadFileOptimistic).not.toHaveBeenCalled();
    expect(mockGridStore.addTile).not.toHaveBeenCalled();
  });
});
