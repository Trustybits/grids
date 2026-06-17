import { mount } from "@vue/test-utils";
import {
  defineComponent,
  h,
  nextTick,
  reactive,
  ref,
  toRef,
  type PropType,
} from "vue";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useGridStore } from "@/stores/grid";
import { useColorPicker } from "@/composables/useColorPicker";
import {
  ContentType,
  type TextContent,
  type ImageContent,
} from "@grids/contracts/types";

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

const DEFAULT_FILL = "var(--color-tile-background)";

const makeImageContent = (
  overrides: Partial<ImageContent> = {},
): ImageContent =>
  reactive({
    type: ContentType.IMAGE,
    src: "https://example.com/x.png",
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    ...overrides,
  }) as ImageContent;

const imageOptions = {
  overlayCapable: true,
  legacyBackgroundAsOverlay: true,
};

const noopEmit = () => {};

describe("useColorPicker — fill vs overlay separation", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const grid = useGridStore();
    grid.isOwner = true; // makes canEdit true
    // Persist is exercised in the suite above; here we assert in-memory behaviour.
    vi.spyOn(grid, "patchTileContent").mockImplementation(() => {});
  });

  it("applies Fill as the background and not as an overlay on a fresh image", () => {
    const content = makeImageContent();
    const { backgroundColor, overlayColor, handleBackgroundColorChange } =
      useColorPicker("t1", content, noopEmit, imageOptions);

    handleBackgroundColorChange("#FFE299");

    expect(content.backgroundColor).toBe("#FFE299");
    // An explicit (empty) overlay is persisted so the fill is never re-read
    // as a tint.
    expect(content.overlayColor).toBe("");
    expect(backgroundColor.value).toBe("#FFE299");
    expect(overlayColor.value).toBeNull();
  });

  it("renders a legacy chromatic background as a tint until it is edited", () => {
    const content = makeImageContent({ backgroundColor: "var(--color-red)" });
    const { backgroundColor, overlayColor } = useColorPicker(
      "t1",
      content,
      noopEmit,
      imageOptions,
    );

    expect(overlayColor.value).toBe("var(--color-red)");
    expect(backgroundColor.value).toBe(DEFAULT_FILL);
  });

  it("promotes a legacy tint to the overlay when a fill is chosen", () => {
    const content = makeImageContent({ backgroundColor: "var(--color-red)" });
    const { backgroundColor, overlayColor, handleBackgroundColorChange } =
      useColorPicker("t1", content, noopEmit, imageOptions);

    handleBackgroundColorChange("#FFE299");

    expect(content.overlayColor).toBe("var(--color-red)");
    expect(backgroundColor.value).toBe("#FFE299");
    expect(overlayColor.value).toBe("var(--color-red)");
  });

  it("sets an overlay independently and clears the legacy background", () => {
    const content = makeImageContent({ backgroundColor: "var(--color-red)" });
    const { backgroundColor, overlayColor, handleOverlayColorChange } =
      useColorPicker("t1", content, noopEmit, imageOptions);

    handleOverlayColorChange("var(--color-blue)");

    expect(content.backgroundColor).toBe("");
    expect(content.overlayColor).toBe("var(--color-blue)");
    expect(overlayColor.value).toBe("var(--color-blue)");
    expect(backgroundColor.value).toBe(DEFAULT_FILL);
  });

  it("preserves an explicit fill when an overlay is later set", () => {
    // No legacy ambiguity here: overlayColor is already "", so backgroundColor
    // is a true fill and must survive an overlay change.
    const content = makeImageContent({
      backgroundColor: "#123456",
      overlayColor: "",
    });
    const { backgroundColor, overlayColor, handleOverlayColorChange } =
      useColorPicker("t1", content, noopEmit, imageOptions);

    handleOverlayColorChange("var(--color-blue)");

    expect(content.backgroundColor).toBe("#123456");
    expect(backgroundColor.value).toBe("#123456");
    expect(overlayColor.value).toBe("var(--color-blue)");
  });

  it("clears the overlay when a structural color is chosen for it", () => {
    const content = makeImageContent({ overlayColor: "var(--color-blue)" });
    const { overlayColor, handleOverlayColorChange } = useColorPicker(
      "t1",
      content,
      noopEmit,
      imageOptions,
    );

    handleOverlayColorChange("var(--color-tile-background)");

    expect(content.overlayColor).toBe("");
    expect(overlayColor.value).toBeNull();
  });

  it("reads and writes through a ref source (undo/redo identity swaps)", () => {
    const contentRef = ref(makeImageContent());
    const { backgroundColor, overlayColor, handleBackgroundColorChange } =
      useColorPicker("t1", contentRef, noopEmit, imageOptions);

    handleBackgroundColorChange("#FFE299");

    expect(contentRef.value.backgroundColor).toBe("#FFE299");
    expect(backgroundColor.value).toBe("#FFE299");
    expect(overlayColor.value).toBeNull();
  });

  it("presents picker values consistent with what is rendered (legacy)", () => {
    // Legacy image: chromatic backgroundColor renders as a tint. The picker
    // should show Fill as empty and Overlay as that tint.
    const content = makeImageContent({ backgroundColor: "var(--color-red)" });
    const { pickerFillColor, pickerOverlayColor } = useColorPicker(
      "t1",
      content,
      noopEmit,
      imageOptions,
    );

    expect(pickerFillColor.value).toBe("");
    expect(pickerOverlayColor.value).toBe("var(--color-red)");
  });

  it("presents independent picker values once fill and overlay are set", () => {
    const content = makeImageContent();
    const {
      pickerFillColor,
      pickerOverlayColor,
      handleBackgroundColorChange,
      handleOverlayColorChange,
    } = useColorPicker("t1", content, noopEmit, imageOptions);

    handleBackgroundColorChange("#F39600");
    handleOverlayColorChange("#413F65");

    expect(pickerFillColor.value).toBe("#F39600");
    expect(pickerOverlayColor.value).toBe("#413F65");
  });

  it("never exposes an overlay for non-overlay-capable tiles", () => {
    const content = makeImageContent({ backgroundColor: "var(--color-red)" });
    const { backgroundColor, overlayColor } = useColorPicker(
      "t1",
      content,
      noopEmit,
    );

    expect(overlayColor.value).toBeNull();
    // Without overlay capability the chromatic color is a plain fill.
    expect(backgroundColor.value).toBe("var(--color-red)");
  });
});
