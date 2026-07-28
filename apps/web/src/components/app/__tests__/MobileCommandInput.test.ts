import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import MobileCommandInput from "../MobileCommandInput.vue";

describe("MobileCommandInput", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const mountInput = (props: Record<string, unknown> = {}) =>
    mount(MobileCommandInput, {
      props: { modelValue: "", placeholders: [], ...props },
    });

  it("renders a static filter chip only when a label is provided", () => {
    const withLabel = mountInput({ filterLabel: "/TILE" });
    expect(withLabel.get(".mci-chip").text()).toBe("/TILE");
    expect(mountInput({ filterLabel: null }).find(".mci-chip").exists()).toBe(
      false,
    );
  });

  it("emits toggle-view when the view toggle is tapped", async () => {
    const wrapper = mountInput({ filterLabel: "/TILE" });
    await wrapper.get('[aria-label="Switch to list view"]').trigger("click");
    expect(wrapper.emitted("toggle-view")).toHaveLength(1);
  });

  it("hides the view toggle when showViewToggle is false (e.g. /GRID)", () => {
    const wrapper = mountInput({ filterLabel: "/GRID", showViewToggle: false });
    expect(wrapper.find('[aria-label="Switch to list view"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('[aria-label="Switch to carousel view"]').exists(),
    ).toBe(false);
    // The close button remains available.
    expect(wrapper.find(".mci-close").exists()).toBe(true);
  });

  // The toggle offers the view you are not in, so both the icon and the label
  // name the destination rather than the current state.
  it("offers the list view while the carousel is up", () => {
    const wrapper = mountInput({ filterLabel: "/TILE", viewMode: "carousel" });
    expect(wrapper.findComponent({ name: "ListViewIcon" }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: "CarouselIcon" }).exists()).toBe(false);
    expect(wrapper.find('[aria-label="Switch to list view"]').exists()).toBe(
      true,
    );
  });

  it("offers the carousel while the list is up", () => {
    const wrapper = mountInput({ filterLabel: "/TILE", viewMode: "list" });
    expect(wrapper.findComponent({ name: "CarouselIcon" }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: "ListViewIcon" }).exists()).toBe(false);
    expect(
      wrapper.find('[aria-label="Switch to carousel view"]').exists(),
    ).toBe(true);
  });

  it("shows a fixed prompt (no rotation) when staticPlaceholder is set", async () => {
    const wrapper = mountInput({
      filterLabel: "/TILE",
      placeholders: ["paste a URL", "paste embed code"],
      staticPlaceholder: "Type a location (leave blank for current)",
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".mci-input").attributes("placeholder")).toBe(
      "Type a location (leave blank for current)",
    );
  });

  it("emits close when the close button (far right) is tapped", async () => {
    const wrapper = mountInput({
      filterLabel: "/TILE",
      closeLabel: "Close add a tile",
    });
    await wrapper.get('[aria-label="Close add a tile"]').trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("emits the current value on Enter and on input", async () => {
    const wrapper = mountInput({ filterLabel: "/TILE", modelValue: "hello" });
    const input = wrapper.get(".mci-input");

    await input.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("submit")?.[0]).toEqual(["hello"]);

    await input.setValue("world");
    const updates = wrapper.emitted("update:modelValue") ?? [];
    expect(updates[updates.length - 1]).toEqual(["world"]);
  });

  it("emits unpin after two backspaces on an empty field, but not with content or a single press", async () => {
    const empty = mountInput({ filterLabel: "/MAP", modelValue: "" });
    const input = empty.get(".mci-input");

    await input.trigger("keydown", { key: "Backspace" });
    expect(empty.emitted("unpin")).toBeUndefined();
    await input.trigger("keydown", { key: "Backspace" });
    expect(empty.emitted("unpin")).toHaveLength(1);

    // With content, backspaces delete text and never unpin.
    const withText = mountInput({ filterLabel: "/MAP", modelValue: "japan" });
    const textInput = withText.get(".mci-input");
    await textInput.trigger("keydown", { key: "Backspace" });
    await textInput.trigger("keydown", { key: "Backspace" });
    expect(withText.emitted("unpin")).toBeUndefined();
  });

  it("resets the empty-backspace counter when the user types", async () => {
    const wrapper = mountInput({ filterLabel: "/MAP", modelValue: "" });
    const input = wrapper.get(".mci-input");

    await input.trigger("keydown", { key: "Backspace" });
    await input.setValue("a");
    await wrapper.setProps({ modelValue: "" });
    await input.trigger("keydown", { key: "Backspace" });
    // Only one empty backspace since typing reset the counter.
    expect(wrapper.emitted("unpin")).toBeUndefined();
  });

  it("exposes focus() that focuses the input", () => {
    const wrapper = mount(MobileCommandInput, {
      props: { modelValue: "", placeholders: [], filterLabel: "/TILE" },
      attachTo: document.body,
    });
    (wrapper.vm as unknown as { focus: () => void }).focus();
    expect(document.activeElement).toBe(wrapper.get(".mci-input").element);
    wrapper.unmount();
  });
});
