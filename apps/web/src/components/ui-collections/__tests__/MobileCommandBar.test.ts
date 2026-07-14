import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import MobileCommandBar from "../MobileCommandBar.vue";

describe("MobileCommandBar", () => {
  it("renders default slot content inside a toolbar landmark", () => {
    const wrapper = mount(MobileCommandBar, {
      slots: { default: '<button class="a">A</button>' },
    });

    const toolbar = wrapper.get('[role="toolbar"]');
    expect(toolbar.find("button.a").exists()).toBe(true);
  });

  it("applies the default aria-label and honors an override", () => {
    const def = mount(MobileCommandBar);
    expect(def.get('[role="toolbar"]').attributes("aria-label")).toBe(
      "Grid commands",
    );

    const custom = mount(MobileCommandBar, {
      props: { ariaLabel: "Tile picker" },
    });
    expect(custom.get('[role="toolbar"]').attributes("aria-label")).toBe(
      "Tile picker",
    );
  });

  it("omits the divider when no end slot is provided", () => {
    const wrapper = mount(MobileCommandBar, {
      slots: { default: "<button>A</button>" },
    });
    expect(wrapper.find(".mobile-command-bar__divider").exists()).toBe(false);
  });

  it("renders a divider and second group when the end slot is used", () => {
    const wrapper = mount(MobileCommandBar, {
      slots: {
        default: '<button class="main">A</button>',
        end: '<button class="trailing">S</button>',
      },
    });

    expect(wrapper.find(".mobile-command-bar__divider").exists()).toBe(true);
    expect(wrapper.findAll(".mobile-command-bar__group")).toHaveLength(2);
    expect(wrapper.find("button.trailing").exists()).toBe(true);
  });
});
