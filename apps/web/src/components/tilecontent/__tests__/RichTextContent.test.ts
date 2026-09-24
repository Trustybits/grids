/**
 * RichTextContent — the unified text tile.
 *
 * The grid view context and controller are mocked with one reactive spy
 * object (same approach as contentEscapeHatches.test.ts). jsdom has no layout,
 * so the range/rect APIs ProseMirror uses for caret coordinates are stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { computed, nextTick, reactive } from "vue";
import {
  ContentType,
  type SmartTextContent,
  type TextContent,
} from "@grids/contracts/types";
import RichTextContent, {
  parseStoredText,
} from "@/components/tilecontent/RichTextContent.vue";
import type { TextEditorProfile } from "@/utils/richText/profiles";

const storeHolder = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

vi.mock("@/grid-context/useGridViewContext", () => ({
  useGridViewContext: () => storeHolder.current,
}));

vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => storeHolder.current,
}));

vi.mock("@/stores/grid/gridUi", () => ({
  useGridUiStore: () => ({ consumePendingFocus: () => false }),
}));

vi.mock("@/composables/useColorPicker", () => ({
  useColorPicker: () => ({
    backgroundColor: computed(() => "var(--color-tile-background)"),
    textColor: computed(() => "#000000"),
    handleBackgroundColorChange: vi.fn(),
  }),
}));

vi.mock("@/composables/useFileUpload", () => ({
  useFileUpload: () => ({ uploadFileToArchive: vi.fn() }),
}));

const paragraph = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

const doc = (...content: unknown[]) =>
  JSON.stringify({ type: "doc", content });

function makeContent(
  text: string,
  type: ContentType.TEXT | ContentType.SMART_TEXT = ContentType.TEXT,
): TextContent | SmartTextContent {
  return reactive({
    type,
    text,
    font: "Inter",
    fontSize: 14,
    isBold: false,
    isItalic: false,
    textType: "",
    color: "#000",
  }) as TextContent;
}

function makeStore(canEdit = true) {
  return reactive({
    canEdit,
    canEditCurrentGrid: () => canEdit,
    patchTileContent: vi.fn(),
    autosaveTileContent: vi.fn(),
    beginEditing: vi.fn(),
    commitEditing: vi.fn(),
  });
}

const wrappers: VueWrapper[] = [];

async function mountTile(
  content: TextContent | SmartTextContent,
  options: { canEdit?: boolean; profile?: TextEditorProfile } = {},
) {
  storeHolder.current = makeStore(options.canEdit ?? true);
  const wrapper = mount(RichTextContent, {
    props: { content, ...(options.profile ? { profile: options.profile } : {}) },
    attachTo: document.body,
    global: {
      provide: {
        tileId: "tile-1",
        gridTileW: computed(() => 3),
        gridTileH: computed(() => 3),
      },
    },
  });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

type Exposed = {
  editor: {
    isEditable: boolean;
    isEmpty: boolean;
    getJSON(): unknown;
    getText(): string;
    commands: { insertContent(value: string): boolean; focus(pos?: unknown): boolean };
  };
  isEditing: boolean;
  onShortClick(event?: MouseEvent): void;
  onExitClick(): void;
  handleVerticalAlignChange(align: string): void;
  handleTextAlignChange(align: string): void;
};

const vm = (wrapper: VueWrapper) => wrapper.vm as unknown as Exposed;

beforeEach(() => {
  class ResizeObserverStub {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  const rect = { top: 10, bottom: 30, left: 10, right: 20, width: 10, height: 20, x: 10, y: 10 };
  const rects = Object.assign([rect], { item: () => rect });
  Range.prototype.getBoundingClientRect = () => rect as DOMRect;
  Range.prototype.getClientRects = () => rects as unknown as DOMRectList;
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("parseStoredText", () => {
  it("parses a stored Tiptap doc", () => {
    expect(parseStoredText(doc(paragraph("hi")))).toMatchObject({ type: "doc" });
  });

  it("treats empty and legacy plain text safely", () => {
    expect(parseStoredText("")).toBe("");
    expect(parseStoredText(undefined)).toBe("");
    expect(parseStoredText("just words")).toBe("just words");
    expect(parseStoredText("42")).toBe("42");
  });
});

describe("RichTextContent rendering", () => {
  it("renders a smart text doc with a table and button without dropping it", async () => {
    const wrapper = await mountTile(
      makeContent(
        doc(
          paragraph("Intro"),
          {
            type: "paragraph",
            content: [
              { type: "smartButton", attrs: { href: "https://grids.so", label: "Go" } },
            ],
          },
          {
            type: "table",
            content: [
              { type: "tableRow", content: [{ type: "tableCell", content: [paragraph("Cell")] }] },
            ],
          },
        ),
        ContentType.SMART_TEXT,
      ),
    );

    expect(wrapper.text()).toContain("Intro");
    expect(wrapper.text()).toContain("Cell");
    expect(wrapper.find("a.smart-button").exists()).toBe(true);
    expect(wrapper.find("table").exists()).toBe(true);
  });

  it("renders legacy plain text as a paragraph", async () => {
    const wrapper = await mountTile(makeContent("Old plain text"));
    expect(wrapper.find(".ProseMirror p").text()).toBe("Old plain text");
  });

  it("keeps the .text-container class the OG image renderer looks for", async () => {
    const wrapper = await mountTile(makeContent(""));
    expect(wrapper.find(".text-container").exists()).toBe(true);
  });

  it("starts read-only", async () => {
    const wrapper = await mountTile(makeContent(doc(paragraph("Hi"))));
    expect(vm(wrapper).editor.isEditable).toBe(false);
  });
});

describe("RichTextContent editing", () => {
  it("enters edit mode on the first short click for the owner", async () => {
    const wrapper = await mountTile(makeContent(doc(paragraph("Hi"))));
    vm(wrapper).onShortClick();
    await flushPromises();

    expect(vm(wrapper).isEditing).toBe(true);
    expect(vm(wrapper).editor.isEditable).toBe(true);
    expect(
      (storeHolder.current as { beginEditing: ReturnType<typeof vi.fn> })
        .beginEditing,
    ).toHaveBeenCalledWith("tile-1");
  });

  it("never enters edit mode for a visitor", async () => {
    const wrapper = await mountTile(makeContent(doc(paragraph("Hi"))), {
      canEdit: false,
    });
    vm(wrapper).onShortClick();
    await flushPromises();

    expect(vm(wrapper).isEditing).toBe(false);
    expect(vm(wrapper).editor.isEditable).toBe(false);
  });

  it("saves typed text through the controller's autosave path", async () => {
    vi.useFakeTimers();
    const wrapper = await mountTile(makeContent(""));
    vm(wrapper).onShortClick();
    await nextTick();
    vm(wrapper).editor.commands.insertContent("Hello");
    vi.runAllTimers();
    vi.useRealTimers();

    const autosave = (
      storeHolder.current as { autosaveTileContent: ReturnType<typeof vi.fn> }
    ).autosaveTileContent;
    const lastPatch = autosave.mock.calls[autosave.mock.calls.length - 1]?.[1] as {
      text: string;
    };
    expect(JSON.parse(lastPatch.text)).toMatchObject({ type: "doc" });
    expect(lastPatch.text).toContain("Hello");
  });

  it("patches tile-level alignment", async () => {
    const wrapper = await mountTile(makeContent(""));
    vm(wrapper).handleVerticalAlignChange("center");
    vm(wrapper).handleTextAlignChange("right");

    const patch = (
      storeHolder.current as { patchTileContent: ReturnType<typeof vi.fn> }
    ).patchTileContent;
    expect(patch).toHaveBeenCalledWith("tile-1", { verticalAlign: "center" });
    expect(patch).toHaveBeenCalledWith("tile-1", { textAlign: "right" });
  });
});

describe("RichTextContent slash menu", () => {
  const menuLabels = () =>
    Array.from(document.body.querySelectorAll(".rt-slash-menu-label")).map(
      (el) => el.textContent,
    );

  async function typeSlash(wrapper: VueWrapper, text: string) {
    vm(wrapper).onShortClick();
    await flushPromises();
    vm(wrapper).editor.commands.insertContent(text);
    await flushPromises();
  }

  it("opens on / while editing and lists every full-profile command", async () => {
    const wrapper = await mountTile(makeContent(""));
    await typeSlash(wrapper, "/");

    expect(menuLabels()).toEqual([
      "Heading 1",
      "Heading 2",
      "Bulleted list",
      "Numbered list",
      "To-do list",
      "Quote",
      "Divider",
      "Image",
      "Link",
      "Button link",
      "Table",
    ]);
  });

  it("filters as the query is typed", async () => {
    const wrapper = await mountTile(makeContent(""));
    await typeSlash(wrapper, "/tab");
    expect(menuLabels()).toEqual(["Table"]);
  });

  it("only offers what the profile allows", async () => {
    const wrapper = await mountTile(makeContent(""), {
      profile: {
        id: "limited",
        slashMenu: true,
        features: new Set(["heading", "link"]),
      },
    });
    await typeSlash(wrapper, "/");
    expect(menuLabels()).toEqual(["Heading 1", "Heading 2", "Link"]);
  });

  it("stays closed while not editing", async () => {
    const wrapper = await mountTile(makeContent(doc(paragraph("/h"))));
    await flushPromises();
    expect(menuLabels()).toEqual([]);
    expect(vm(wrapper).isEditing).toBe(false);
  });

  it("runs the chosen command from the menu", async () => {
    const wrapper = await mountTile(makeContent(""));
    await typeSlash(wrapper, "/h1");
    const item = document.body.querySelector<HTMLElement>(".rt-slash-menu-item");
    item!.click();
    await flushPromises();

    expect(JSON.stringify(vm(wrapper).editor.getJSON())).toContain(
      '"type":"heading"',
    );
    expect(vm(wrapper).editor.getText()).not.toContain("/h1");
    expect(menuLabels()).toEqual([]);
  });

  it("keeps edit mode open while an inline field request is pending", async () => {
    const wrapper = await mountTile(makeContent(""));
    await typeSlash(wrapper, "/link");
    document.body.querySelector<HTMLElement>(".rt-slash-menu-item")!.click();
    await flushPromises();

    expect(document.body.querySelector(".rt-inline-fields")).not.toBeNull();
    vm(wrapper).onExitClick();
    expect(vm(wrapper).isEditing).toBe(true);

    const cancel = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>(".rt-inline-btn"),
    ).find((b) => b.textContent?.trim() === "Cancel")!;
    cancel.click();
    await flushPromises();

    expect(document.body.querySelector(".rt-inline-fields")).toBeNull();
    expect(vm(wrapper).editor.getText()).toBe("");
    vm(wrapper).onExitClick();
    expect(vm(wrapper).isEditing).toBe(false);
  });
});
