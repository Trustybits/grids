import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import MobileModeBar from "../MobileModeBar.vue";

describe("MobileModeBar", () => {
  it.each([
    ["crop", "Drag to reposition", "Done"],
    ["pan", "Drag and pinch the map", "Done"],
    ["interact", "Interacting", "Stop"],
    ["edit", "Editing", "Done"],
  ] as const)("%s says what the finger does and how to leave", (mode, label, action) => {
    const wrapper = mount(MobileModeBar, { props: { mode } });
    expect(wrapper.find(".mmb__label").text()).toBe(label);
    expect(wrapper.find(".mmb__done").text()).toBe(action);
    expect(wrapper.attributes("data-tile-edit-surface")).toBeDefined();
  });

  it("doesn't take focus from the field being typed in", () => {
    const wrapper = mount(MobileModeBar, { props: { mode: "edit" } });
    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    wrapper.find(".mmb__label").element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("emits done", async () => {
    const wrapper = mount(MobileModeBar, { props: { mode: "crop" } });
    await wrapper.find(".mmb__done").trigger("click");
    expect(wrapper.emitted("done")).toHaveLength(1);
  });
});
