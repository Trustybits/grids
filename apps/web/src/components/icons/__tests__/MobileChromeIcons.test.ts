import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import AddTileIcon from "../AddTileIcon.vue";
import CarouselIcon from "../CarouselIcon.vue";
import GridSettingsIcon from "../GridSettingsIcon.vue";
import ListViewIcon from "../ListViewIcon.vue";
import PreviewDesktopIcon from "../PreviewDesktopIcon.vue";
import PreviewIcon from "../PreviewIcon.vue";
import PreviewMobileIcon from "../PreviewMobileIcon.vue";
import PreviewTabletIcon from "../PreviewTabletIcon.vue";
import ShareAppleIcon from "../ShareAppleIcon.vue";
import ShareDefaultIcon from "../ShareDefaultIcon.vue";

/**
 * The Mobile 2.0 chrome icon set: the command bar (Figma `mobileGridBar`
 * 1727:11044 and `addTile` 1728:11055) plus the preview toolbar (`preview`
 * 1765:11379).
 *
 * Each icon is Figma's exported path(s) placed in a 24x24 box via a nested
 * `<svg>` carrying the inset Figma laid it out at. That inset is hand-converted
 * from a percentage, so these pin the arithmetic: a leaf whose declared box does
 * not match its own viewBox is being stretched, which is the symptom of a
 * mistyped inset.
 */
const icons = {
  AddTileIcon,
  CarouselIcon,
  GridSettingsIcon,
  ListViewIcon,
  PreviewIcon,
  PreviewDesktopIcon,
  PreviewTabletIcon,
  PreviewMobileIcon,
  ShareAppleIcon,
  ShareDefaultIcon,
};

describe("mobile chrome icons", () => {
  for (const [name, component] of Object.entries(icons)) {
    describe(name, () => {
      it("draws into a 24x24 box at the requested size", () => {
        const wrapper = mount(component, { props: { size: 40 } });
        const root = wrapper.get("svg");
        expect(root.attributes("viewBox")).toBe("0 0 24 24");
        expect(root.attributes("width")).toBe("40");
        expect(root.attributes("height")).toBe("40");
      });

      it("places every leaf at its own scale, inside the box", () => {
        const wrapper = mount(component);
        const leaves = wrapper.findAll("svg svg");
        expect(leaves.length).toBeGreaterThan(0);

        for (const leaf of leaves) {
          const [, , boxWidth, boxHeight] = (
            leaf.attributes("viewBox") ?? ""
          )
            .split(" ")
            .map(Number);
          const x = Number(leaf.attributes("x"));
          const y = Number(leaf.attributes("y"));
          const width = Number(leaf.attributes("width"));
          const height = Number(leaf.attributes("height"));

          // Drawn at 1:1 — the leaf is positioned, never stretched. (Two of
          // Figma's viewBoxes carry float noise, hence the tolerance.)
          expect(width).toBeCloseTo(boxWidth, 3);
          expect(height).toBeCloseTo(boxHeight, 3);

          // And it fits within the 24x24 box.
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x + width).toBeLessThanOrEqual(24);
          expect(y + height).toBeLessThanOrEqual(24);
        }
      });

      it("inherits its color from the button rather than hard-coding one", () => {
        const wrapper = mount(component);
        for (const path of wrapper.findAll("path")) {
          expect(path.attributes("fill")).toBe("currentColor");
        }
        expect(wrapper.html()).not.toContain("fill-opacity");
      });
    });
  }
});
