/**
 * FloatingFormatToolbar against a real editor. jsdom has no layout, so the
 * rect APIs ProseMirror uses for caret coordinates are stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { Editor } from "@tiptap/vue-3";
import { richTextSchemaExtensions } from "@/extensions/tiptap/richTextExtensions";
import FloatingFormatToolbar from "@/components/richtext/FloatingFormatToolbar.vue";
import { TYPING_IDLE_MS, placeAboveSelection } from "@/composables/useFloatingToolbar";

const editors: Editor[] = [];
const wrappers: VueWrapper[] = [];

beforeEach(() => {
  const rect = { top: 300, bottom: 320, left: 200, right: 260, width: 60, height: 20, x: 200, y: 300 };
  const rects = Object.assign([rect], { item: () => rect });
  Range.prototype.getBoundingClientRect = () => rect as DOMRect;
  Range.prototype.getClientRects = () => rects as unknown as DOMRectList;
});

afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount();
  while (editors.length) editors.pop()!.destroy();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

async function setup(
  html = "<p>hello world</p>",
  props: { active?: boolean; suppressed?: boolean } = {},
) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const editor = new Editor({
    element: host,
    extensions: richTextSchemaExtensions(),
    content: html,
  });
  editors.push(editor);
  editor.commands.setTextSelection({ from: 1, to: 6 }); // "hello"
  const wrapper = mount(FloatingFormatToolbar, {
    props: { editor, active: props.active ?? true, suppressed: props.suppressed ?? false },
    attachTo: document.body,
  });
  wrappers.push(wrapper);
  (wrapper.vm as unknown as { refresh: () => void }).refresh();
  await flushPromises();
  return { editor, wrapper };
}

const toolbar = () => document.body.querySelector<HTMLElement>(".rt-format-toolbar");
const button = (title: string) =>
  document.body.querySelector<HTMLButtonElement>(`.rt-format-toolbar button[title="${title}"]`)!;
const json = (editor: Editor) => JSON.stringify(editor.getJSON());

describe("placeAboveSelection", () => {
  const viewport = { width: 1000, height: 800 };
  const size = { width: 200, height: 40 };

  it("centers above the selection", () => {
    expect(
      placeAboveSelection({ top: 300, bottom: 320, left: 400, right: 500 }, size, viewport),
    ).toEqual({ top: 252, left: 350 });
  });

  it("flips below when there is no room above", () => {
    expect(
      placeAboveSelection({ top: 20, bottom: 40, left: 400, right: 500 }, size, viewport).top,
    ).toBe(48);
  });

  it("stays inside the viewport horizontally", () => {
    expect(
      placeAboveSelection({ top: 300, bottom: 320, left: 0, right: 10 }, size, viewport).left,
    ).toBe(8);
    expect(
      placeAboveSelection({ top: 300, bottom: 320, left: 990, right: 1000 }, size, viewport).left,
    ).toBe(792);
  });
});

describe("FloatingFormatToolbar visibility", () => {
  it("shows over a selection while active", async () => {
    await setup();
    expect(toolbar()).not.toBeNull();
  });

  it("stays hidden when not active or when suppressed", async () => {
    await setup(undefined, { active: false });
    expect(toolbar()).toBeNull();
    wrappers.pop()!.unmount();
    await setup(undefined, { suppressed: true });
    expect(toolbar()).toBeNull();
  });

  it("hides while typing at a caret and returns once typing pauses", async () => {
    vi.useFakeTimers();
    const { editor } = await setup();
    editor.commands.setTextSelection(6);
    // Tiptap's focus() waits for an animation frame, which fake timers hold.
    (editor.view.dom as HTMLElement).focus();
    expect(editor.isFocused).toBe(true);
    await flushPromises();
    expect(toolbar()).not.toBeNull();

    editor.commands.insertContent("!");
    await flushPromises();
    // A document change while the editor has focus counts as typing.
    expect(toolbar()).toBeNull();

    vi.advanceTimersByTime(TYPING_IDLE_MS + 10);
    await flushPromises();
    expect(toolbar()).not.toBeNull();
  });
});

describe("FloatingFormatToolbar commands", () => {
  it("toggles marks on the selection", async () => {
    const { editor } = await setup();
    button("Bold").click();
    button("Strikethrough").click();
    await flushPromises();
    expect(json(editor)).toContain('{"type":"bold"}');
    expect(json(editor)).toContain('{"type":"strike"}');
    expect(button("Bold").getAttribute("aria-pressed")).toBe("true");
  });

  it("applies a size preset and a typed custom size", async () => {
    const { editor } = await setup();
    button("Text size").click();
    await flushPromises();
    const large = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>(".rt-ft-size-item"),
    ).find((b) => b.textContent?.includes("Large"))!;
    large.click();
    await flushPromises();
    expect(json(editor)).toContain('"fontSize":"20px"');

    button("Text size").click();
    await flushPromises();
    const input = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Custom text size in pixels"]',
    )!;
    input.value = "41";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await flushPromises();
    expect(json(editor)).toContain('"fontSize":"41px"');
    expect(button("Text size").textContent).toContain("41px");
  });

  it("sets a text color and returns to Auto", async () => {
    const { editor } = await setup();
    button("Text color").click();
    await flushPromises();
    document.body.querySelector<HTMLButtonElement>('.rt-ft-swatch[title="blue"]')!.click();
    await flushPromises();
    expect(json(editor)).toContain('"color":"var(--color-blue)"');

    button("Text color").click();
    await flushPromises();
    document.body.querySelector<HTMLButtonElement>(".rt-ft-auto-color")!.click();
    await flushPromises();
    expect(json(editor)).not.toContain("--color-blue");
  });

  it("aligns the block and toggles back to the tile default", async () => {
    const { editor } = await setup();
    button("Align right").click();
    await flushPromises();
    expect(editor.getJSON().content![0]!.attrs!.textAlign).toBe("right");
    button("Align right").click();
    await flushPromises();
    expect(editor.getJSON().content![0]!.attrs!.textAlign).toBeNull();
  });

  it("changes the font family", async () => {
    const { editor } = await setup();
    button("Font").click();
    await flushPromises();
    Array.from(document.body.querySelectorAll<HTMLButtonElement>(".rt-ft-menu-item"))
      .find((b) => b.textContent?.includes("Lobster"))!
      .click();
    await flushPromises();
    expect(json(editor)).toContain('"fontFamily":"Lobster"');
  });

  it("asks the host to edit the link", async () => {
    const { wrapper } = await setup('<p><a href="https://grids.so">hello</a> world</p>');
    button("Edit link (https://grids.so)").click();
    await flushPromises();
    expect(wrapper.emitted("edit-link")).toEqual([["https://grids.so"]]);
  });

  it("keeps editor focus when a toolbar button is pressed", async () => {
    await setup();
    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    button("Bold").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not let toolbar clicks reach document listeners", async () => {
    await setup();
    const outside = vi.fn();
    document.addEventListener("click", outside);
    button("Italic").click();
    document.removeEventListener("click", outside);
    expect(outside).not.toHaveBeenCalled();
  });
});
