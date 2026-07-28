import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import MobileTileCarousel from "../MobileTileCarousel.vue";
import type { TileTypeDescriptor } from "@/composables/useTileCreation";

const Icon = { template: "<span class='icon' />" };

const types: TileTypeDescriptor[] = [
  { id: "text", label: "Text", icon: Icon, keywords: ["text"], kind: "create" },
  { id: "chat", label: "Chat", icon: Icon, keywords: ["chat"], kind: "create" },
  { id: "map", label: "Map", icon: Icon, keywords: ["map"], kind: "command" },
];

const mountCarousel = (props: Record<string, unknown> = {}) =>
  mount(MobileTileCarousel, { props: { types, ...props } });

/** A drag of `distance` px, in enough steps to clear the tap threshold. */
const drag = async (
  wrapper: ReturnType<typeof mountCarousel>,
  distance: number,
) => {
  const track = wrapper.get(".tile-carousel__track");
  await track.trigger("pointerdown", { clientX: 0, button: 0, pointerId: 1 });
  await track.trigger("pointermove", { clientX: distance / 2, pointerId: 1 });
  await track.trigger("pointermove", { clientX: distance, pointerId: 1 });
  await track.trigger("pointerup", { clientX: distance, pointerId: 1 });
};

describe("MobileTileCarousel", () => {
  it("renders a card per tile type", () => {
    const wrapper = mountCarousel();
    expect(wrapper.findAll(".tile-carousel__card")).toHaveLength(3);
    expect(wrapper.text()).toContain("Text");
    expect(wrapper.text()).toContain("Chat");
  });

  it("shows an empty message when no types match", () => {
    const wrapper = mountCarousel({ types: [] });
    expect(wrapper.find(".tile-carousel__empty").exists()).toBe(true);
  });

  it("marks the active type card", () => {
    const wrapper = mountCarousel({ selectedId: "chat" });
    const selected = wrapper.findAll(".tile-carousel__card--selected");
    expect(selected).toHaveLength(1);
    expect(selected[0].text()).toContain("Chat");
    expect(selected[0].attributes("aria-selected")).toBe("true");
  });

  it("starts with the first card centered", () => {
    const wrapper = mountCarousel();
    const cards = wrapper.findAll(".tile-carousel__card");
    expect(cards[0].classes()).toContain("tile-carousel__card--center");
    expect(cards[1].classes()).not.toContain("tile-carousel__card--center");
  });

  it("tilts the off-center cards away and leaves the centered one square-on", () => {
    const wrapper = mountCarousel();
    const cards = wrapper.findAll(".tile-carousel__card");
    expect(cards[0].attributes("style")).toContain("rotateY(0deg)");
    // Cards to the right rotate towards the viewer's right-hand vanishing point.
    expect(cards[1].attributes("style")).toContain("rotateY(-45deg)");
    expect(cards[1].attributes("style")).toContain("translateZ(-140px)");
  });

  it("steps the opacity down from the center and floors the far cards", () => {
    const many = ["a", "b", "c", "d", "e"].map((id) => ({
      id,
      label: id.toUpperCase(),
      icon: Icon,
      keywords: [],
      kind: "create" as const,
    }));
    const wrapper = mountCarousel({ types: many });

    const opacities = wrapper
      .findAll(".tile-carousel__card")
      .map((card) => card.attributes("style")?.match(/opacity:\s*([\d.]+)/)?.[1]);

    // Uncapped the fourth card would sit at 0.50, so the floor holds it up.
    expect(opacities).toEqual(["1", "0.89", "0.76", "0.63", "0.55"]);
  });

  it("emits select when the centered card is tapped", async () => {
    const wrapper = mountCarousel();
    await wrapper.findAll(".tile-carousel__card")[0].trigger("click");
    expect(wrapper.emitted("select")?.[0]).toEqual(["text"]);
  });

  it("centers an off-center card instead of committing it", async () => {
    const wrapper = mountCarousel();
    await wrapper.findAll(".tile-carousel__card")[1].trigger("click");

    expect(wrapper.emitted("select")).toBeUndefined();
    expect(wrapper.emitted("focus-type")?.[0]).toEqual(["chat"]);
  });

  it("commits the card once it has been centered", async () => {
    const wrapper = mountCarousel();
    const card = () => wrapper.findAll(".tile-carousel__card")[1];

    await card().trigger("click");
    await card().trigger("click");

    expect(wrapper.emitted("select")?.[0]).toEqual(["chat"]);
  });

  it("emits focus-type as a drag carries a new card past the center", async () => {
    const wrapper = mountCarousel();
    // Dragging left by more than half the card spacing advances the fan.
    await drag(wrapper, -80);

    expect(wrapper.emitted("focus-type")?.[0]).toEqual(["chat"]);
  });

  it("does not commit a card when the pointer was dragged rather than tapped", async () => {
    const wrapper = mountCarousel();
    const track = wrapper.get(".tile-carousel__track");

    await track.trigger("pointerdown", { clientX: 0, button: 0, pointerId: 1 });
    await track.trigger("pointermove", { clientX: -80, pointerId: 1 });
    await track.trigger("pointerup", { clientX: -80, pointerId: 1 });
    await wrapper.findAll(".tile-carousel__card")[0].trigger("click");

    expect(wrapper.emitted("select")).toBeUndefined();
  });

  it("steps the center with the arrow keys", async () => {
    const wrapper = mountCarousel();
    const track = wrapper.get(".tile-carousel__track");

    await track.trigger("keydown", { key: "ArrowRight" });
    expect(wrapper.emitted("focus-type")?.[0]).toEqual(["chat"]);
  });

  it("does not step past the ends of the fan", async () => {
    const wrapper = mountCarousel();
    const track = wrapper.get(".tile-carousel__track");

    await track.trigger("keydown", { key: "ArrowLeft" });
    expect(wrapper.emitted("focus-type")).toBeUndefined();
  });

  it("keeps the centered card centered when the filtered list changes", async () => {
    const wrapper = mountCarousel();
    await wrapper.findAll(".tile-carousel__card")[2].trigger("click");
    expect(wrapper.emitted("focus-type")?.[0]).toEqual(["map"]);

    // The parent stops filtering once a type is active, so the list grows back.
    await wrapper.setProps({
      types: [
        { id: "link", label: "Link", icon: Icon, keywords: [], kind: "command" },
        ...types,
      ],
    });

    const centered = wrapper.find(".tile-carousel__card--center");
    expect(centered.text()).toContain("Map");
    // Re-syncing the list is not the user choosing a card.
    expect(wrapper.emitted("focus-type")).toHaveLength(1);
  });

  it("falls back to the first card when the centered one is filtered out", async () => {
    const wrapper = mountCarousel();
    await wrapper.setProps({ types: [types[1]] });

    const centered = wrapper.find(".tile-carousel__card--center");
    expect(centered.text()).toContain("Chat");
  });
});
