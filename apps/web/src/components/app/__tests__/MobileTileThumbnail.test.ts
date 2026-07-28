import { describe, expect, it } from "vitest";
import { markRaw } from "vue";
import { mount } from "@vue/test-utils";
import MobileTileThumbnail from "../MobileTileThumbnail.vue";

const Icon = markRaw({ template: "<svg class='icon' />" });

const mountThumbnail = (typeId: string) =>
  mount(MobileTileThumbnail, { props: { typeId, icon: Icon } });

describe("MobileTileThumbnail", () => {
  it("draws the wireframe shapes for a known tile type", () => {
    const wrapper = mountThumbnail("text");
    expect(wrapper.findAll(".mtt-shape")).toHaveLength(4);
  });

  it("positions shapes as percentages of Figma's 150px tile box", () => {
    const wrapper = mountThumbnail("text");
    // The Text heading bar sits at x19 y74, 50x10 in the 150 box.
    const style = wrapper.findAll(".mtt-shape")[0].attributes("style");
    expect(style).toContain("left: 12.6667%");
    expect(style).toContain("top: 49.3333%");
    expect(style).toContain("width: 33.3333%");
  });

  it("uses the stronger ink level where the design calls for it", () => {
    const shapes = mountThumbnail("text").findAll(".mtt-shape");
    expect(shapes[0].classes()).toContain("mtt-shape--ink2");
    expect(shapes[1].classes()).toContain("mtt-shape--ink1");
  });

  it("renders the tile type's own icon as the glyph", () => {
    const wrapper = mountThumbnail("map");
    expect(wrapper.find(".mtt-glyph .icon").exists()).toBe(true);
  });

  it("draws the dashed webpage frame for Embed", () => {
    expect(mountThumbnail("embed").find(".mtt-frame").exists()).toBe(true);
    expect(mountThumbnail("text").find(".mtt-frame").exists()).toBe(false);
  });

  it("falls back to a centered glyph for a type with no artwork", () => {
    const wrapper = mountThumbnail("something-new");
    expect(wrapper.findAll(".mtt-shape")).toHaveLength(0);
    expect(wrapper.find(".mtt-glyph .icon").exists()).toBe(true);
  });
});
