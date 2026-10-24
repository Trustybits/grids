import { describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";
import { mount } from "@vue/test-utils";
import { useScrollArea } from "@/composables/useScrollArea";

function fakeBox(
  el: HTMLElement,
  box: { offsetWidth: number; clientWidth: number; scrollHeight: number; clientHeight: number },
) {
  for (const [key, value] of Object.entries(box)) {
    Object.defineProperty(el, key, { configurable: true, get: () => value });
  }
}

function mountScrollArea(el: HTMLElement | null) {
  const result: { area?: ReturnType<typeof useScrollArea> } = {};
  const wrapper = mount(
    defineComponent({
      setup() {
        result.area = useScrollArea(ref(el));
        return () => h("div");
      },
    }),
  );
  return {
    wrapper,
    gutter: () => result.area?.gutter.value,
    isOverflowing: () => result.area?.isOverflowing.value,
  };
}

describe("useScrollArea", () => {
  it("measures the gutter and overflow on mount and again on window resize", () => {
    const el = document.createElement("div");
    fakeBox(el, { offsetWidth: 200, clientWidth: 185, scrollHeight: 300, clientHeight: 100 });
    const { wrapper, gutter, isOverflowing } = mountScrollArea(el);
    expect(gutter()).toBe(15);
    expect(isOverflowing()).toBe(true);

    fakeBox(el, { offsetWidth: 200, clientWidth: 188, scrollHeight: 100, clientHeight: 100 });
    window.dispatchEvent(new Event("resize"));
    expect(gutter()).toBe(12);
    expect(isOverflowing()).toBe(false);

    wrapper.unmount();
    fakeBox(el, { offsetWidth: 200, clientWidth: 190, scrollHeight: 300, clientHeight: 100 });
    window.dispatchEvent(new Event("resize"));
    expect(gutter()).toBe(12);
  });

  it("reports nothing without an element", () => {
    const { gutter, isOverflowing } = mountScrollArea(null);
    expect(gutter()).toBe(0);
    expect(isOverflowing()).toBe(false);
  });
});
