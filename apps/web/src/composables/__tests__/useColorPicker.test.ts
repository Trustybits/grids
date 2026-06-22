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
import { useThemeStore } from "@/stores/theme";
import { useColorPicker, computeTextColor } from "@/composables/useColorPicker";
import {
  ContentType,
  type TextContent,
  type ImageContent,
  type LinkContent,
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

  it("promotes a legacy tint to a remembered overlay when a fill is chosen", () => {
    const content = makeImageContent({ backgroundColor: "var(--color-red)" });
    const {
      backgroundColor,
      overlayColor,
      pickerOverlayColor,
      colorMode,
      handleBackgroundColorChange,
    } = useColorPicker("t1", content, noopEmit, imageOptions);

    handleBackgroundColorChange("#FFE299");

    expect(content.overlayColor).toBe("var(--color-red)"); // remembered
    expect(backgroundColor.value).toBe("#FFE299");
    expect(colorMode.value).toBe("fill");
    expect(overlayColor.value).toBeNull(); // fill is active, overlay not rendered
    expect(pickerOverlayColor.value).toBe("var(--color-red)"); // still shown in picker
  });

  it("toggles the active treatment without losing either color", () => {
    const content = makeImageContent();
    const {
      overlayColor,
      pickerFillColor,
      pickerOverlayColor,
      colorMode,
      setColorMode,
      handleBackgroundColorChange,
      handleOverlayColorChange,
    } = useColorPicker("t1", content, noopEmit, imageOptions);

    handleBackgroundColorChange("#F39600"); // fill active
    handleOverlayColorChange("#413F65"); // overlay active
    expect(colorMode.value).toBe("overlay");
    expect(overlayColor.value).toBe("#413F65");

    // Toggle to fill: overlay stops rendering but its color is remembered.
    setColorMode("fill");
    expect(colorMode.value).toBe("fill");
    expect(overlayColor.value).toBeNull();
    expect(content.overlayColor).toBe("#413F65");
    expect(pickerFillColor.value).toBe("#F39600");
    expect(pickerOverlayColor.value).toBe("#413F65");

    // Toggle back to overlay: the overlay is re-applied.
    setColorMode("overlay");
    expect(overlayColor.value).toBe("#413F65");
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

// ── computeTextColor ────────────────────────────────────────────────────────
// Picks black or white text for legibility against a background, via relative
// luminance. Structural CSS-variable backgrounds resolve through the theme
// store (dark vs. light mode). The "low" modifier appends a 0x57 alpha.

describe("computeTextColor", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("returns black for a light hex background", () => {
    expect(computeTextColor("#FFFFFF")).toBe("#000000");
  });

  it("returns white for a dark hex background", () => {
    expect(computeTextColor("#000000")).toBe("#FFFFFF");
  });

  it("resolves a named palette color and chooses by its luminance", () => {
    // #FFAFA3 (var(--color-red)) is light → black text.
    expect(computeTextColor("var(--color-red)")).toBe("#000000");
    // #33312C (var(--color-dark-0)) is dark → white text.
    expect(computeTextColor("var(--color-dark-0)")).toBe("#FFFFFF");
  });

  it("returns an empty string for an unknown color token", () => {
    expect(computeTextColor("var(--color-unknown)")).toBe("");
  });

  it("returns an empty string for an empty background", () => {
    expect(computeTextColor("")).toBe("");
  });

  describe("structural tile background by theme", () => {
    it("resolves var(--color-tile-background) to white text in dark mode", () => {
      useThemeStore().currentThemeId = "dark"; // isDarkMode → true, bg #000000
      expect(computeTextColor("var(--color-tile-background)")).toBe("#FFFFFF");
    });

    it("resolves var(--color-tile-background) to black text in light mode", () => {
      useThemeStore().currentThemeId = "light"; // bg #FFFEF5 (light)
      expect(computeTextColor("var(--color-tile-background)")).toBe("#000000");
    });

    it("resolves var(--color-content-background) to white text in dark mode", () => {
      useThemeStore().currentThemeId = "dark"; // bg #10100E (dark)
      expect(computeTextColor("var(--color-content-background)")).toBe(
        "#FFFFFF",
      );
    });

    it("resolves var(--color-content-background) to black text in light mode", () => {
      useThemeStore().currentThemeId = "light"; // bg #FFFEF5 (light)
      expect(computeTextColor("var(--color-content-background)")).toBe(
        "#000000",
      );
    });
  });

  describe("low modifier", () => {
    it("appends the alpha suffix to black text", () => {
      expect(computeTextColor("#FFFFFF", "low")).toBe("#00000057");
    });

    it("appends the alpha suffix to white text", () => {
      expect(computeTextColor("#000000", "low")).toBe("#FFFFFF57");
    });

    it("still returns empty for an unknown color even with the modifier", () => {
      expect(computeTextColor("nonsense", "low")).toBe("");
    });
  });
});

// ── Edit-permission guard + persistence target ──────────────────────────────

describe("useColorPicker — canEdit guard", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("ignores fill changes when the user cannot edit", () => {
    const grid = useGridStore();
    grid.isOwner = false; // canEdit → false
    const patchSpy = vi.spyOn(grid, "patchTileContent");
    const content = makeImageContent();

    const { handleBackgroundColorChange } = useColorPicker(
      "t1",
      content,
      noopEmit,
      imageOptions,
    );
    handleBackgroundColorChange("#FFE299");

    expect(content.backgroundColor).toBeUndefined();
    expect(patchSpy).not.toHaveBeenCalled();
  });

  it("ignores overlay changes and mode toggles when the user cannot edit", () => {
    const grid = useGridStore();
    grid.isOwner = false;
    const patchSpy = vi.spyOn(grid, "patchTileContent");
    const content = makeImageContent();

    const { handleOverlayColorChange, setColorMode } = useColorPicker(
      "t1",
      content,
      noopEmit,
      imageOptions,
    );
    handleOverlayColorChange("#413F65");
    setColorMode("overlay");

    expect(content.overlayColor).toBeUndefined();
    expect(content.colorMode).toBeUndefined();
    expect(patchSpy).not.toHaveBeenCalled();
  });
});

describe("useColorPicker — persistence with a null tileId", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("saves the grid instead of patching a tile when tileId is null", () => {
    const grid = useGridStore();
    grid.isOwner = true;
    const patchSpy = vi
      .spyOn(grid, "patchTileContent")
      .mockImplementation(() => {});
    const saveSpy = vi.spyOn(grid, "saveGrid").mockImplementation(async () => {});
    const content = makeImageContent();

    const { handleBackgroundColorChange } = useColorPicker(
      null,
      content,
      noopEmit,
      imageOptions,
    );
    handleBackgroundColorChange("#FFE299");

    expect(content.backgroundColor).toBe("#FFE299");
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(patchSpy).not.toHaveBeenCalled();
  });
});

// ── legacyBackgroundAlsoOverlay (link / document tiles) ─────────────────────
// Unlike legacyBackgroundAsOverlay (image/video), here a chromatic background
// drives the overlay tint AND keeps acting as the fill color.

describe("useColorPicker — legacyBackgroundAlsoOverlay", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const grid = useGridStore();
    grid.isOwner = true;
    vi.spyOn(grid, "patchTileContent").mockImplementation(() => {});
  });

  const makeLinkContent = (backgroundColor: string): LinkContent =>
    reactive({
      type: ContentType.LINK,
      link: "https://example.com",
      backgroundColor,
    }) as unknown as LinkContent;

  const linkOptions = {
    overlayCapable: true,
    legacyBackgroundAlsoOverlay: true,
  };

  it("renders a chromatic background as both the fill and the overlay tint", () => {
    const content = makeLinkContent("var(--color-red)");
    const { backgroundColor, overlayColor, colorMode } = useColorPicker(
      "t1",
      content,
      noopEmit,
      linkOptions,
    );

    // Defaults to overlay treatment because a tint is present...
    expect(colorMode.value).toBe("overlay");
    expect(overlayColor.value).toBe("var(--color-red)");
    // ...but the fill keeps the color (not reset to default like image/video).
    expect(backgroundColor.value).toBe("var(--color-red)");
  });

  it("shows the chromatic background in both picker targets", () => {
    const content = makeLinkContent("var(--color-red)");
    const { pickerFillColor, pickerOverlayColor } = useColorPicker(
      "t1",
      content,
      noopEmit,
      linkOptions,
    );

    expect(pickerFillColor.value).toBe("var(--color-red)");
    expect(pickerOverlayColor.value).toBe("var(--color-red)");
  });
});
