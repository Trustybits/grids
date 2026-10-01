import { shallowMount } from "@vue/test-utils";
import AppStatusBanners from "@/components/app/AppStatusBanners.vue";
import PublishedViewBanner from "@/components/app/PublishedViewBanner.vue";
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

  it("shows the published-view banner only while the owner is viewing the live grid", () => {
    const hidden = shallowMount(AppStatusBanners, {
      props: { isStubbedMode: false, showViewportWarning: false },
    });
    expect(hidden.findComponent(PublishedViewBanner).exists()).toBe(false);

    const shown = shallowMount(AppStatusBanners, {
      props: {
        isStubbedMode: false,
        showViewportWarning: false,
        showPublishedView: true,
      },
    });
    expect(shown.findComponent(PublishedViewBanner).exists()).toBe(true);
  });
});
