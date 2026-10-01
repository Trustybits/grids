import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import MobileTileArt, {
  ANIMATED_TILE_ART_TYPES,
  hasAnimatedTileArt,
} from "../MobileTileArt.vue";

const mountArt = (typeId: string, active = false) =>
  mount(MobileTileArt, { props: { typeId, active } });

describe("MobileTileArt", () => {
  it("covers exactly the nine types Figma drew", () => {
    expect([...ANIMATED_TILE_ART_TYPES].sort()).toEqual([
      "campfire",
      "chat",
      "document",
      "embed",
      "image",
      "link",
      "map",
      "profile",
      "text",
    ]);
  });

  it("leaves types with no animated design to the static wireframe", () => {
    // Smart Text is the one registry type the Figma set skipped.
    expect(hasAnimatedTileArt("smart_text")).toBe(false);
    expect(hasAnimatedTileArt("something-new")).toBe(false);
  });

  it("draws artwork for every covered type", () => {
    for (const typeId of ANIMATED_TILE_ART_TYPES) {
      const wrapper = mountArt(typeId);
      expect(wrapper.classes()).toContain(`mta--${typeId}`);
      // Something is actually drawn — no branch falls through empty.
      expect(wrapper.findAll(".mta-el").length).toBeGreaterThan(0);
    }
  });

  it("runs the loop only while active", () => {
    expect(mountArt("chat", true).classes()).toContain("mta--playing");
    expect(mountArt("chat", false).classes()).not.toContain("mta--playing");
  });

  it("rests fully drawn, so an inactive card still reads", () => {
    // Nothing is hidden by an inline style: the resting frame is the CSS
    // base state and the keyframes only override it while playing.
    const wrapper = mountArt("text", false);
    for (const el of wrapper.findAll(".mta-el")) {
      expect(el.attributes("style")).toBeUndefined();
    }
  });

  it("puts the accent on the elements Figma coloured with it", () => {
    // Text: the heading bar is primary, the three body lines are ink.
    const text = mountArt("text");
    expect(text.find(".mta-heading .mta-fillA").exists()).toBe(true);
    expect(text.findAll(".mta-line")).toHaveLength(3);
    expect(text.findAll(".mta-line .mta-fill1")).toHaveLength(3);

    // Chat: the first bubble is primary, the other two are ink.
    const chat = mountArt("chat");
    expect(chat.find(".mta-chat__msg--1 .mta-fillA").exists()).toBe(true);
    expect(chat.find(".mta-chat__msg--2 .mta-fill2").exists()).toBe(true);
    expect(chat.find(".mta-chat__msg--3 .mta-fill1").exists()).toBe(true);
  });

  it("keeps an animated opacity off the element carrying an ink level", () => {
    // The wrapper owns the timeline and the leaf owns the ink, so the two
    // multiply instead of the animation overwriting the ink.
    const doc = mountArt("document");
    expect(doc.find(".mta-doc__page > .mta-art1").exists()).toBe(true);
    expect(doc.find(".mta-doc__page.mta-art1").exists()).toBe(false);
  });

  it("marks the tile type on the root for the per-icon loop length", () => {
    // Text and Profile run 2.5s; the rest run 2s. The class is what selects it.
    expect(mountArt("profile").classes()).toContain("mta--profile");
    expect(mountArt("campfire").classes()).toContain("mta--campfire");
  });
});
