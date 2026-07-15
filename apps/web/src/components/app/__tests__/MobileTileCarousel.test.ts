import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import MobileTileCarousel from "../MobileTileCarousel.vue";
import type { TileTypeDescriptor } from "@/composables/useTileCreation";

const Icon = { template: "<span class='icon' />" };

const types: TileTypeDescriptor[] = [
  { id: "text", label: "Text", icon: Icon, keywords: ["text"], kind: "create" },
  { id: "chat", label: "Chat", icon: Icon, keywords: ["chat"], kind: "create" },
];

describe("MobileTileCarousel", () => {
  it("renders a card per tile type", () => {
    const wrapper = mount(MobileTileCarousel, { props: { types } });
    expect(wrapper.findAll(".tile-carousel__card")).toHaveLength(2);
    expect(wrapper.text()).toContain("Text");
    expect(wrapper.text()).toContain("Chat");
  });

  it("emits select with the tile id when a card is tapped", async () => {
    const wrapper = mount(MobileTileCarousel, { props: { types } });
    await wrapper.findAll(".tile-carousel__card")[1].trigger("click");
    expect(wrapper.emitted("select")?.[0]).toEqual(["chat"]);
  });

  it("shows an empty message when no types match", () => {
    const wrapper = mount(MobileTileCarousel, { props: { types: [] } });
    expect(wrapper.find(".tile-carousel__empty").exists()).toBe(true);
  });

  it("applies the list layout modifier", () => {
    const wrapper = mount(MobileTileCarousel, {
      props: { types, layout: "list" },
    });
    expect(wrapper.find(".tile-carousel--list").exists()).toBe(true);
  });
});
