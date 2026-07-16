import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import MobileColorPicker from "../MobileColorPicker.vue";

const mountPicker = (modelValue = "#FF0000", swatches = ["#FF0000", "#00FF00"]) =>
  mount(MobileColorPicker, { props: { modelValue, swatches } });

describe("MobileColorPicker", () => {
  it("renders the HSB pad, hue slider, and one swatch per color", () => {
    const wrapper = mountPicker();
    expect(wrapper.find(".mcp-pad").exists()).toBe(true);
    expect(wrapper.find(".mcp-hue").exists()).toBe(true);
    expect(wrapper.findAll(".mcp-swatch")).toHaveLength(2);
  });

  it("marks the swatch matching the current color as selected", () => {
    const wrapper = mountPicker("#00FF00");
    const swatches = wrapper.findAll(".mcp-swatch");
    expect(swatches[0].classes()).not.toContain("is-selected");
    expect(swatches[1].classes()).toContain("is-selected");
  });

  it("emits update:modelValue and commit with the tapped swatch color", async () => {
    const wrapper = mountPicker();
    await wrapper.findAll(".mcp-swatch")[1].trigger("click");

    const updates = wrapper.emitted("update:modelValue") ?? [];
    const commits = wrapper.emitted("commit") ?? [];
    expect(updates[updates.length - 1]).toEqual(["#00FF00"]);
    expect(commits[commits.length - 1]).toEqual(["#00FF00"]);
  });

  it("emits update + preview while dragging the hue and commit on pointer-up", async () => {
    const wrapper = mountPicker();
    await wrapper.get(".mcp-hue").trigger("pointerdown", { clientX: 10, clientY: 0 });
    expect(wrapper.emitted("update:modelValue")?.length).toBeGreaterThan(0);
    // Preview drives the live grid background during the drag.
    expect(wrapper.emitted("preview")?.length).toBeGreaterThan(0);
    expect(wrapper.emitted("commit")).toBeUndefined();

    window.dispatchEvent(new Event("pointerup"));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("commit")?.length).toBe(1);
  });

  it("does not emit preview for a discrete swatch tap (no drag)", async () => {
    const wrapper = mountPicker();
    await wrapper.findAll(".mcp-swatch")[1].trigger("click");
    expect(wrapper.emitted("preview")).toBeUndefined();
    expect(wrapper.emitted("commit")?.length).toBe(1);
  });

  it("re-selects the swatch when the color changes externally", async () => {
    const wrapper = mountPicker("#FF0000");
    expect(wrapper.findAll(".mcp-swatch")[0].classes()).toContain("is-selected");

    await wrapper.setProps({ modelValue: "#00FF00" });
    const swatches = wrapper.findAll(".mcp-swatch");
    expect(swatches[0].classes()).not.toContain("is-selected");
    expect(swatches[1].classes()).toContain("is-selected");
  });
});
