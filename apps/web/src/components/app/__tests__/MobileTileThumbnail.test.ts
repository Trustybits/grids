import { describe, expect, it } from "vitest";
import { markRaw } from "vue";
import { mount } from "@vue/test-utils";
import MobileTileThumbnail from "../MobileTileThumbnail.vue";

const Icon = markRaw({ template: "<svg class='icon' />" });

const mountThumbnail = (typeId: string, active = false) =>
  mount(MobileTileThumbnail, { props: { typeId, icon: Icon, active } });

describe("MobileTileThumbnail", () => {
  // ── The animated half ──────────────────────────────────────────────────
  // The nine types in Figma's "Animated icons" set draw themselves; the
  // static wireframe is not rendered for them at all.

  it("hands a covered type to the animated artwork", () => {
    const wrapper = mountThumbnail("text");
    expect(wrapper.find(".mta").exists()).toBe(true);
    expect(wrapper.find(".mtt").exists()).toBe(false);
  });

  it("only plays the loop for the active card", () => {
    expect(mountThumbnail("map", true).find(".mta--playing").exists()).toBe(
      true,
    );
    expect(mountThumbnail("map", false).find(".mta--playing").exists()).toBe(
      false,
    );
  });

  // ── The static half ────────────────────────────────────────────────────
  // Smart Text has no animated design, so it still gets the wireframe — as
  // would any tile type added before one is drawn for it.

  it("draws the wireframe shapes for a type with no animated design", () => {
    const wrapper = mountThumbnail("smart_text");
    expect(wrapper.find(".mta").exists()).toBe(false);
    expect(wrapper.findAll(".mtt-shape")).toHaveLength(3);
  });

  it("positions shapes as percentages of Figma's 150px tile box", () => {
    const wrapper = mountThumbnail("smart_text");
    // Smart Text's first body line sits at x19 y94, 95x5 in the 150 box.
    const style = wrapper.findAll(".mtt-shape")[0].attributes("style");
    expect(style).toContain("left: 12.6667%");
    expect(style).toContain("top: 62.6667%");
    expect(style).toContain("width: 63.3333%");
  });

  it("defaults shapes to the subtle ink level", () => {
    const shapes = mountThumbnail("smart_text").findAll(".mtt-shape");
    expect(shapes[0].classes()).toContain("mtt-shape--ink1");
  });

  it("renders the tile type's own icon as the glyph", () => {
    const wrapper = mountThumbnail("smart_text");
    expect(wrapper.find(".mtt-glyph .icon").exists()).toBe(true);
  });

  it("falls back to a centered glyph for a type with no artwork at all", () => {
    const wrapper = mountThumbnail("something-new");
    expect(wrapper.find(".mta").exists()).toBe(false);
    expect(wrapper.findAll(".mtt-shape")).toHaveLength(0);
    expect(wrapper.find(".mtt-glyph .icon").exists()).toBe(true);
  });
});
