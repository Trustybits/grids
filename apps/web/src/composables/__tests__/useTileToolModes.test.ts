import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { ContentType } from "@grids/contracts/types";
import type { TileChildComponent } from "@/types/Tile";
import { toolModeFor, useTileToolModes } from "../useTileToolModes";

const setup = (type: string) => {
  const isEditing = ref(false);
  const isExitingCropMode = ref(false);
  const isEmbedInteractive = ref(false);
  const child = {
    isEditing: false,
    toggleEditMode: vi.fn(() => {
      child.isEditing = !child.isEditing;
    }),
    onExitClick: vi.fn(() => {
      child.isEditing = false;
    }),
  };
  const childComponent = ref(child as unknown as TileChildComponent);
  const toggleCropMode = vi.fn(() => {
    isEditing.value = !isEditing.value;
  });
  const modes = useTileToolModes({
    type: () => type,
    childComponent,
    isEditing,
    isExitingCropMode,
    isEmbedInteractive,
    toggleCropMode,
  });
  return { modes, isEditing, isExitingCropMode, isEmbedInteractive, child, toggleCropMode };
};

describe("toolModeFor", () => {
  it("maps each mode tool to the tile types that have it", () => {
    expect(toolModeFor("crop", ContentType.IMAGE)).toBe("crop");
    expect(toolModeFor("crop", ContentType.VIDEO)).toBe("crop");
    expect(toolModeFor("pan", ContentType.MAP)).toBe("pan");
    expect(toolModeFor("interact", ContentType.EMBED)).toBe("interact");
    expect(toolModeFor("crop", ContentType.TEXT)).toBeNull();
    expect(toolModeFor("fill", ContentType.IMAGE)).toBeNull();
  });
});

describe("useTileToolModes", () => {
  it("crop goes in and out through the tile's crop toggle", () => {
    const { modes, toggleCropMode, isExitingCropMode } = setup(ContentType.IMAGE);
    modes.enterMode("crop");
    expect(modes.activeMode.value).toBe("crop");
    modes.enterMode("crop"); // already in: no second toggle
    expect(toggleCropMode).toHaveBeenCalledTimes(1);

    // Mid exit animation, a second exit doesn't toggle back in.
    isExitingCropMode.value = true;
    modes.exitMode();
    expect(toggleCropMode).toHaveBeenCalledTimes(1);
    isExitingCropMode.value = false;
    modes.exitMode();
    expect(toggleCropMode).toHaveBeenCalledTimes(2);
    expect(modes.activeMode.value).toBeNull();
  });

  it("pan uses the map's edit mode and its saving exit", () => {
    const { modes, child, isEditing } = setup(ContentType.MAP);
    modes.enterMode("pan");
    expect(child.toggleEditMode).toHaveBeenCalledTimes(1);
    expect(isEditing.value).toBe(true);
    expect(modes.activeMode.value).toBe("pan");
    modes.exitMode();
    expect(child.onExitClick).toHaveBeenCalledTimes(1);
    expect(modes.activeMode.value).toBeNull();
  });

  it("interact lifts the embed's cover, and exit puts it back", () => {
    const { modes, isEmbedInteractive } = setup(ContentType.EMBED);
    modes.enterMode("interact");
    expect(isEmbedInteractive.value).toBe(true);
    expect(modes.activeMode.value).toBe("interact");
    modes.exitMode();
    expect(isEmbedInteractive.value).toBe(false);
  });

  it("exiting with no mode does nothing", () => {
    const { modes, toggleCropMode, child } = setup(ContentType.IMAGE);
    modes.exitMode();
    expect(toggleCropMode).not.toHaveBeenCalled();
    expect(child.onExitClick).not.toHaveBeenCalled();
  });
});
