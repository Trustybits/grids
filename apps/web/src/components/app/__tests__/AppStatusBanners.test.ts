import { shallowMount } from "@vue/test-utils";
import AppStatusBanners from "@/components/app/AppStatusBanners.vue";
import StubbedModeBanner from "@/components/app/StubbedModeBanner.vue";
import ViewportWarning from "@/components/grid/ViewportWarning.vue";

describe("AppStatusBanners", () => {
  it("shows the stubbed-mode banner when the app selected stubbed implementations", () => {
    const wrapper = shallowMount(AppStatusBanners, {
      props: {
        isStubbedMode: true,
        showViewportWarning: false,
      },
    });

    expect(wrapper.findComponent(StubbedModeBanner).exists()).toBe(true);
  });

  it("does not show the stubbed-mode banner when the app selected the Firebase runtime", () => {
    const wrapper = shallowMount(AppStatusBanners, {
      props: {
        isStubbedMode: false,
        showViewportWarning: false,
      },
    });

    expect(wrapper.findComponent(StubbedModeBanner).exists()).toBe(false);
  });

  it("keeps the existing viewport warning independently gated", () => {
    const wrapper = shallowMount(AppStatusBanners, {
      props: {
        isStubbedMode: false,
        showViewportWarning: true,
      },
    });

    expect(wrapper.findComponent(ViewportWarning).exists()).toBe(true);
  });

});
