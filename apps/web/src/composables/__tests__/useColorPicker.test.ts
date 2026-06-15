import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, toRef, type PropType } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useGridStore } from "@/stores/grid";
import { useColorPicker } from "@/composables/useColorPicker";
import { ContentType, type TextContent } from "@grids/contracts/types";

const makeTextContent = (backgroundColor: string): TextContent => ({
  type: ContentType.TEXT,
  text: "",
  font: "Arial",
  fontSize: 16,
  isBold: false,
  isItalic: false,
  textType: "paragraph",
  color: "#000000",
  backgroundColor,
});

describe("useColorPicker", () => {
  it("reacts when the content prop object is replaced", async () => {
    const events: Array<[string, string]> = [];

    const wrapper = mount(
      defineComponent({
        props: {
          content: {
            type: Object as PropType<TextContent>,
            required: true,
          },
        },
        emits: ["background-color-change", "text-color-change"],
        setup(props, { emit }) {
          const { backgroundColor } = useColorPicker(
            "tile-1",
            toRef(props, "content"),
            emit,
          );

          return () => h("div", backgroundColor.value);
        },
      }),
      {
        props: {
          content: makeTextContent("#FFAFA3"),
          onBackgroundColorChange: (color: string) => {
            events.push(["background-color-change", color]);
          },
          onTextColorChange: (color: string) => {
            events.push(["text-color-change", color]);
          },
        },
      },
    );

    await nextTick();
    await wrapper.setProps({ content: makeTextContent("#B3EFBD") });
    await nextTick();

    expect(wrapper.text()).toBe("#B3EFBD");
    expect(events).toContainEqual(["background-color-change", "#B3EFBD"]);
  });

  it("writes changes to the latest content prop object", async () => {
    let changeColor: (color: string) => void = () => {
      throw new Error("handleBackgroundColorChange was not registered");
    };
    const originalContent = makeTextContent("#FFAFA3");
    const replacementContent = makeTextContent("#B3EFBD");

    const wrapper = mount(
      defineComponent({
        props: {
          content: {
            type: Object as PropType<TextContent>,
            required: true,
          },
        },
        setup(props, { emit }) {
          const { handleBackgroundColorChange } = useColorPicker(
            "tile-1",
            toRef(props, "content"),
            emit,
          );
          changeColor = handleBackgroundColorChange;

          return () => null;
        },
      }),
      { props: { content: originalContent } },
    );

    const gridStore = useGridStore();
    gridStore.isOwner = true;
    gridStore.currentGrid = {
      id: "grid-1",
      name: "Grid",
      userId: "user-1",
      colNum: 4,
      verticalCompact: true,
      backgroundImageSrc: "",
      backgroundEmbed: false,
      tiles: [
        {
          i: "tile-1",
          x: 0,
          y: 0,
          w: 1,
          h: 1,
          caption: "",
          content: replacementContent,
        },
      ],
    };

    await wrapper.setProps({ content: replacementContent });
    changeColor("#A8DAFF");

    expect(originalContent.backgroundColor).toBe("#FFAFA3");
    expect(replacementContent.backgroundColor).toBe("#A8DAFF");
    expect(
      (gridStore.currentGrid?.tiles[0].content as TextContent).backgroundColor,
    ).toBe("#A8DAFF");
  });

  it("patches the store before mutating the current content object", async () => {
    let changeColor: (color: string) => void = () => {
      throw new Error("handleBackgroundColorChange was not registered");
    };
    const content = makeTextContent("#B3EFBD");

    const wrapper = mount(
      defineComponent({
        props: {
          content: {
            type: Object as PropType<TextContent>,
            required: true,
          },
        },
        setup(props, { emit }) {
          const { handleBackgroundColorChange } = useColorPicker(
            "tile-1",
            toRef(props, "content"),
            emit,
          );
          changeColor = handleBackgroundColorChange;

          return () => null;
        },
      }),
      { props: { content } },
    );

    const gridStore = useGridStore();
    gridStore.isOwner = true;
    const observedColors: string[] = [];
    const patchTileContent = vi
      .spyOn(gridStore, "patchTileContent")
      .mockImplementation(() => {
        observedColors.push(content.backgroundColor ?? "");
      });

    changeColor("#A8DAFF");

    expect(observedColors).toStrictEqual(["#B3EFBD"]);
    expect(content.backgroundColor).toBe("#A8DAFF");

    patchTileContent.mockRestore();
    wrapper.unmount();
  });
});
