import { shallowMount } from "@vue/test-utils";
import AppStatusBanners from "@/components/app/AppStatusBanners.vue";
import StubbedModeBanner from "@/components/app/StubbedModeBanner.vue";
import ViewportWarning from "@/components/grid/ViewportWarning.vue";
import Banner from "@/components/ui-elements/Banner.vue";

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

  it("shows projection and viewport warnings simultaneously", () => {
    const wrapper = shallowMount(AppStatusBanners, {
      props: {
        isStubbedMode: false,
        showViewportWarning: true,
        showResponsiveLayoutPreview: true,
      },
      global: { stubs: { Banner: false } },
    });

    expect(wrapper.findComponent(Banner).exists()).toBe(true);
    expect(wrapper.findComponent(ViewportWarning).exists()).toBe(true);
    expect(wrapper.text()).toContain("this grid is read-only");
    expect(wrapper.find('[aria-label="Dismiss"]').exists()).toBe(false);
  });

  it("emits the preview stop action from the non-dismissible banner", async () => {
    const wrapper = shallowMount(AppStatusBanners, {
      props: {
        isStubbedMode: false,
        showViewportWarning: false,
        showResponsiveLayoutPreview: true,
      },
      global: { stubs: { Banner: false } },
    });

    await wrapper
      .get('[data-testid="stop-responsive-layout-preview"]')
      .trigger("click");

    expect(wrapper.emitted("stop-responsive-layout-preview")).toHaveLength(1);
  });
});
