import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import MobileSettingsCard from "../MobileSettingsCard.vue";

describe("MobileSettingsCard", () => {
  it("is a labelled card with Done and its body", async () => {
    const wrapper = mount(MobileSettingsCard, {
      props: { title: "Grid settings" },
      slots: { default: "<p class='body'>Theme</p>" },
    });
    expect(wrapper.attributes("role")).toBe("dialog");
    expect(wrapper.attributes("aria-label")).toBe("Grid settings");
    expect(wrapper.find(".msc__title").text()).toBe("Grid settings");
    expect(wrapper.find(".body").exists()).toBe(true);
    expect(wrapper.find(".msc__back").exists()).toBe(false);

    await wrapper.get(".msc__done").trigger("click");
    expect(wrapper.emitted("done")).toHaveLength(1);
  });

  it("offers a way back from a page inside it", async () => {
    const wrapper = mount(MobileSettingsCard, {
      props: { title: "Background color", back: true },
    });
    const back = wrapper.get('button[aria-label="Back to grid settings"]');
    await back.trigger("click");
    expect(wrapper.emitted("back")).toHaveLength(1);
  });
});
