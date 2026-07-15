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
    await wrapper.get('[aria-label="Toggle list view"]').trigger("click");
    expect(wrapper.emitted("toggle-view")).toHaveLength(1);
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
