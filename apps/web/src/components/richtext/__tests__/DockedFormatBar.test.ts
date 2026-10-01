import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { Editor } from "@tiptap/vue-3";
import { richTextSchemaExtensions } from "@/extensions/tiptap/richTextExtensions";
import DockedFormatBar from "@/components/richtext/DockedFormatBar.vue";

const editors: Editor[] = [];
const wrappers: VueWrapper[] = [];

beforeEach(() => {
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: {
      height: 500,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
});

afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount();
  while (editors.length) editors.pop()!.destroy();
  document.body.innerHTML = "";
  Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
});

async function setup(props: { active?: boolean; inline?: boolean } = {}) {
  const editor = new Editor({
    extensions: richTextSchemaExtensions(),
    content: "<p>hello world</p>",
  });
  editors.push(editor);
  editor.commands.setTextSelection({ from: 1, to: 6 });
  const wrapper = mount(DockedFormatBar, {
    props: { editor, active: props.active ?? true, inline: props.inline ?? false },
    attachTo: document.body,
  });
  wrappers.push(wrapper);
  await flushPromises();
  return { editor, wrapper };
}

const bar = () => document.body.querySelector<HTMLElement>(".rt-docked-bar");
const button = (title: string) =>
  document.body.querySelector<HTMLButtonElement>(`.rt-docked-bar button[title="${title}"]`)!;

describe("DockedFormatBar", () => {
  it("docks on top of the on-screen keyboard", async () => {
    await setup();
    expect(bar()!.classList.contains("rt-docked-bar--fixed")).toBe(true);
    // 800 - 500 = 300px of keyboard, plus the 8px resting gap.
    expect(bar()!.style.bottom).toBe("308px");
  });

  it("renders in place for a host that already sits on the keyboard", async () => {
    const { wrapper } = await setup({ inline: true });
    expect(wrapper.find(".rt-docked-bar").exists()).toBe(true);
    expect(bar()!.classList.contains("rt-docked-bar--fixed")).toBe(false);
    expect(bar()!.style.bottom).toBe("");
  });

  it("stays hidden while the tile is not being edited", async () => {
    await setup({ active: false });
    expect(bar()).toBeNull();
  });

  it("opens its menus upward, away from the keyboard", async () => {
    await setup();
    expect(document.body.querySelector(".rt-fc--menus-above")).not.toBeNull();
    button("Text size").click();
    await flushPromises();
    expect(document.body.querySelector(".rt-ft-menu")).not.toBeNull();
  });

  it("applies formatting to the selection", async () => {
    const { editor } = await setup();
    button("Bold").click();
    await flushPromises();
    expect(JSON.stringify(editor.getJSON())).toContain('{"type":"bold"}');
    expect(button("Bold").getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps taps from reading as a tap outside the tile", async () => {
    await setup();
    const outsideTouch = vi.fn();
    const outsideClick = vi.fn();
    document.addEventListener("touchstart", outsideTouch);
    document.addEventListener("click", outsideClick);
    button("Italic").dispatchEvent(new Event("touchstart", { bubbles: true }));
    button("Italic").click();
    document.removeEventListener("touchstart", outsideTouch);
    document.removeEventListener("click", outsideClick);
    expect(outsideTouch).not.toHaveBeenCalled();
    expect(outsideClick).not.toHaveBeenCalled();
  });

  it("forwards link editing to its host", async () => {
    const { wrapper } = await setup();
    button("Link").click();
    await flushPromises();
    expect(wrapper.emitted("edit-link")).toEqual([[null]]);
  });
});
