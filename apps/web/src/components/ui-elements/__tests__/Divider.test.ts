import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import Divider from "../Divider.vue";

/**
 * One hairline for the whole app. These pin the two things every caller depends
 * on: which orientation class it carries (that class is what sizes it — fill
 * the space, held back `--divider-inset` from each end) and the fact that it is
 * decorative unless a caller asks otherwise.
 */
describe("Divider", () => {
  it("is horizontal unless told otherwise", () => {
    const wrapper = mount(Divider);
    expect(wrapper.classes()).toContain("divider--horizontal");
    expect(wrapper.classes()).not.toContain("divider--vertical");
  });

  it("switches orientation on request", () => {
    const wrapper = mount(Divider, { props: { orientation: "vertical" } });
    expect(wrapper.classes()).toContain("divider--vertical");
    expect(wrapper.classes()).not.toContain("divider--horizontal");
  });

  it("hides itself from assistive tech by default", () => {
    const wrapper = mount(Divider);
    expect(wrapper.attributes("aria-hidden")).toBe("true");
    expect(wrapper.attributes("role")).toBeUndefined();
  });

  it("becomes a real separator when the split carries meaning", () => {
    const wrapper = mount(Divider, {
      props: { orientation: "vertical", semantic: true },
    });
    expect(wrapper.attributes("role")).toBe("separator");
    expect(wrapper.attributes("aria-orientation")).toBe("vertical");
    expect(wrapper.attributes("aria-hidden")).toBeUndefined();
  });

  it("merges a caller's positioning class onto its root", () => {
    const wrapper = mount(Divider, { attrs: { class: "mgs-separator" } });
    expect(wrapper.classes()).toContain("mgs-separator");
    expect(wrapper.classes()).toContain("divider--horizontal");
  });
});
