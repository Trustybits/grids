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

  // The bar is a container only: consumers place their own `Divider` between
  // groups, so everything they pass lands in the single default group.
  it("keeps all slot content in one group", () => {
    const wrapper = mount(MobileCommandBar, {
      slots: {
        default: '<button class="main">A</button><button class="two">B</button>',
      },
    });

    expect(wrapper.findAll(".mobile-command-bar__group")).toHaveLength(1);
    expect(wrapper.findAll("button")).toHaveLength(2);
  });
});
