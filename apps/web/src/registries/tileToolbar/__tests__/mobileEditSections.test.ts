import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import type { ToolbarButton, ToolbarContext } from "@/types/TileToolbar";
import {
  MOBILE_EDIT_SECTIONS,
  toMobileEditEntries,
} from "../mobileEditSections";

const IconStub = { template: "<span />" };

/** Enough of a context to resolve the function-valued label/icon/danger fields. */
const makeCtx = (content: Record<string, unknown> = {}) =>
  ({
    tile: { i: "tile-1", content },
    childComponent: ref(null),
    gridView: {},
    resizeTile: vi.fn(),
    isEditing: ref(false),
    isExitingCropMode: ref(false),
  }) as unknown as ToolbarContext;

describe("toMobileEditEntries", () => {
  it("flattens a container button into its menu items", () => {
    const buttons: ToolbarButton[] = [
      {
        id: "more-menu",
        icon: IconStub,
        title: "More",
        group: "actions",
        action: vi.fn(),
        menuItems: [
          { id: "bold-toggle", tooltip: "Bold", action: vi.fn() },
          { id: "italic-toggle", tooltip: "Italic", action: vi.fn() },
        ],
      },
    ];

    // The container itself is gone — a sheet has room for the children, so
    // there is nothing left for a "More" row to reveal.
    expect(toMobileEditEntries(buttons).map((entry) => entry.id)).toEqual([
      "bold-toggle",
      "italic-toggle",
    ]);
  });

  it("promotes a menu item's tooltip to its label", () => {
    const buttons: ToolbarButton[] = [
      {
        id: "more-menu",
        icon: IconStub,
        title: "More",
        action: vi.fn(),
        menuItems: [{ id: "bold-toggle", tooltip: "Bold", action: vi.fn() }],
      },
    ];

    // Hover-only tooltip text becomes the row's accessible name, which is the
    // whole reason a touch user can hear what the control does.
    expect(toMobileEditEntries(buttons)[0]!.label).toBe("Bold");
  });

  it("carries a function-valued label through unresolved", () => {
    const label = (ctx: ToolbarContext) =>
      (ctx.tile.content as { tileLink?: string }).tileLink
        ? "Remove link"
        : "Add a Link";
    const buttons: ToolbarButton[] = [
      {
        id: "more-menu",
        icon: IconStub,
        title: "More",
        action: vi.fn(),
        menuItems: [{ id: "tile-link", tooltip: label, action: vi.fn() }],
      },
    ];

    const entry = toMobileEditEntries(buttons)[0]!;
    expect(typeof entry.label).toBe("function");
    expect((entry.label as typeof label)(makeCtx())).toBe("Add a Link");
    expect(
      (entry.label as typeof label)(makeCtx({ tileLink: "https://a.co" })),
    ).toBe("Remove link");
  });

  it("prefers a per-id section over the container's group", () => {
    const buttons: ToolbarButton[] = [
      {
        id: "more-menu",
        icon: IconStub,
        title: "More",
        // Desktop files text styling under the "actions" overflow menu; the
        // sheet has a TEXT heading for it, and the id override wins.
        group: "actions",
        action: vi.fn(),
        menuItems: [
          { id: "bold-toggle", tooltip: "Bold", action: vi.fn() },
          { id: "tile-link", tooltip: "Add a Link", action: vi.fn() },
        ],
      },
    ];

    expect(
      toMobileEditEntries(buttons).map((entry) => [entry.id, entry.section]),
    ).toEqual([
      ["bold-toggle", "text"],
      ["tile-link", "link"],
    ]);
  });

  it("falls back to the group, then to actions", () => {
    const buttons: ToolbarButton[] = [
      {
        id: "resize-2x2",
        icon: IconStub,
        title: "Resize",
        group: "resize",
        action: vi.fn(),
      },
      {
        id: "border-toggle",
        icon: IconStub,
        title: "Border",
        group: "appearance",
        action: vi.fn(),
      },
      { id: "mystery", icon: IconStub, title: "Mystery", action: vi.fn() },
    ];

    expect(toMobileEditEntries(buttons).map((entry) => entry.section)).toEqual([
      "size",
      "appearance",
      "actions",
    ]);
  });

  it("marks the controls the sheet renders itself as inline", () => {
    const buttons: ToolbarButton[] = [
      {
        id: "text-align",
        icon: IconStub,
        title: "Text align",
        group: "appearance",
        action: vi.fn(),
      },
      {
        id: "more-menu",
        icon: IconStub,
        title: "More",
        action: vi.fn(),
        menuItems: [
          { id: "font-family", tooltip: "Change Font", action: vi.fn() },
          { id: "font-size", tooltip: "Change Font Size", action: vi.fn() },
          { id: "bold-toggle", tooltip: "Bold", action: vi.fn() },
        ],
      },
    ];

    // The three that open a floating panel on desktop are declarations only;
    // `bold-toggle` does its own work and stays a plain row.
    expect(
      toMobileEditEntries(buttons).map((entry) => [entry.id, entry.inline]),
    ).toEqual([
      ["text-align", true],
      ["font-family", true],
      ["font-size", true],
      ["bold-toggle", false],
    ]);
  });

  it("drops deferred controls rather than rendering them inert", () => {
    const buttons: ToolbarButton[] = [
      {
        id: "color",
        icon: IconStub,
        title: "Tile color",
        group: "appearance",
        panelId: "color",
        // Desktop opens a floating picker via panelId; the action is a no-op,
        // so a sheet row built from it would do nothing when tapped.
        action: vi.fn(),
      },
      {
        id: "border-toggle",
        icon: IconStub,
        title: "Border",
        group: "appearance",
        action: vi.fn(),
      },
    ];

    expect(toMobileEditEntries(buttons).map((entry) => entry.id)).toEqual([
      "border-toggle",
    ]);
  });

  it("only assigns sections the sheet knows how to render", () => {
    const known = new Set(MOBILE_EDIT_SECTIONS.map((section) => section.id));
    const buttons: ToolbarButton[] = [
      {
        id: "map-style-dark",
        icon: IconStub,
        title: "Dark",
        group: "map-style",
        action: vi.fn(),
      },
      { id: "unknown-id", icon: IconStub, title: "?", action: vi.fn() },
    ];

    for (const entry of toMobileEditEntries(buttons)) {
      expect(known).toContain(entry.section);
    }
  });
});
