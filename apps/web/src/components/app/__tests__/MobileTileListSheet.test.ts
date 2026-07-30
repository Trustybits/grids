import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import MobileTileListSheet from "../MobileTileListSheet.vue";
import type { TileTypeDescriptor } from "@/composables/useTileCreation";

const Icon = { template: "<span class='icon' />" };

const types: TileTypeDescriptor[] = [
  { id: "text", label: "Text", icon: Icon, keywords: ["text"], kind: "create" },
  { id: "chat", label: "Chat", icon: Icon, keywords: ["chat"], kind: "create" },
];

describe("MobileTileListSheet", () => {
  it("renders a row per tile type", () => {
    const wrapper = mount(MobileTileListSheet, { props: { types } });
    expect(wrapper.findAll(".mtl-row")).toHaveLength(2);
    expect(wrapper.text()).toContain("Text");
    expect(wrapper.text()).toContain("Chat");
  });

  it("emits select with the tile id when a row is tapped", async () => {
    const wrapper = mount(MobileTileListSheet, { props: { types } });
    await wrapper.findAll(".mtl-row")[1].trigger("click");
    expect(wrapper.emitted("select")?.[0]).toEqual(["chat"]);
  });

  it("shows an empty message when no types match", () => {
    const wrapper = mount(MobileTileListSheet, { props: { types: [] } });
    expect(wrapper.find(".mtl-empty").exists()).toBe(true);
  });

  it("marks the selected type row", () => {
    const wrapper = mount(MobileTileListSheet, {
      props: { types, selectedId: "chat" },
    });
    const selected = wrapper.findAll(".mtl-row--selected");
    expect(selected).toHaveLength(1);
    expect(selected[0].text()).toContain("Chat");
    expect(selected[0].attributes("aria-selected")).toBe("true");
  });
});
