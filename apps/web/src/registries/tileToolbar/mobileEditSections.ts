/**
 * Registry → Mobile 2.0 `/EDIT` sheet mapping.
 *
 * The sheet is built from the same `getTileToolbarButtons` registry the desktop
 * toolbar renders, so a control added for one surface appears on both. This
 * module is the translation layer, and it is deliberately pure so the mapping
 * can be tested without mounting anything.
 *
 * Three things it does:
 *
 *   1. **Flattens containers.** The desktop toolbar hides text styling behind a
 *      "More" overflow menu. A sheet has room, so a container contributes its
 *      children and then disappears.
 *   2. **Assigns sections.** The registry's `group` is coarser than the sheet's
 *      headings — text alignment is grouped `appearance` on desktop but belongs
 *      under TEXT here — so per-id overrides win over the group default.
 *   3. **Promotes tooltips to labels.** Overflow items carry only a `tooltip`,
 *      which is hover-only and invisible to a screen reader on a touch device.
 *      Normalizing to `label` is what lets every row be named out loud.
 *
 * Some registry entries are *capability declarations* rather than buttons: the
 * desktop `text-align` / `font-family` / `font-size` / `color` items only open a
 * floating panel. The sheet renders its own inline control for those, so they
 * are marked `inline` — their presence still comes from the registry, which is
 * what keeps the two surfaces offering the same set.
 */

import type { Component } from "vue";
import type {
  ToolbarButton,
  ToolbarContext,
  ToolbarMenuItem,
} from "@/types/TileToolbar";

export type MobileEditSection =
  | "size"
  | "appearance"
  | "text"
  | "link"
  | "actions";

/** Section order in the sheet, and the heading each one shows. */
export const MOBILE_EDIT_SECTIONS: {
  id: MobileEditSection;
  label: string;
}[] = [
  { id: "size", label: "SIZE" },
  { id: "appearance", label: "APPEARANCE" },
  { id: "text", label: "TEXT" },
  { id: "link", label: "LINK" },
  { id: "actions", label: "ACTIONS" },
];

/** Registry ids the sheet renders as its own inline control. */
const INLINE_CONTROL_IDS = new Set([
  "text-align",
  "font-family",
  "font-size",
]);

/**
 * Registry ids the sheet does not offer yet, dropped rather than rendered.
 *
 * `color` opens the desktop floating picker via `panelId`, and its registry
 * `action` is a deliberate no-op — rendering it here would put a button in the
 * sheet that does nothing at all. It returns once tile fill can be driven from
 * the `/HEX` command input the way the grid background already is.
 */
const DEFERRED_IDS = new Set(["color"]);

/** Where an id lands when the registry `group` is too coarse to say. */
const SECTION_BY_ID: Record<string, MobileEditSection> = {
  "text-align": "text",
  "font-family": "text",
  "font-size": "text",
  "bold-toggle": "text",
  "italic-toggle": "text",
  "tile-link": "link",
};

const SECTION_BY_GROUP: Record<string, MobileEditSection> = {
  resize: "size",
  appearance: "appearance",
  "map-style": "appearance",
  actions: "actions",
};

export interface MobileEditEntry {
  id: string;
  section: MobileEditSection;
  /** The sheet supplies the control; `action` is not used for these. */
  inline: boolean;
  icon?: Component | ((ctx: ToolbarContext) => Component);
  /** Accessible name — always present, unlike the registry's optional tooltip. */
  label: string | ((ctx: ToolbarContext) => string);
  action: (ctx: ToolbarContext) => void;
  isActive?: (ctx: ToolbarContext) => boolean;
  visible?: (ctx: ToolbarContext) => boolean;
  danger?: boolean | ((ctx: ToolbarContext) => boolean);
}

function sectionFor(id: string, group: string | undefined): MobileEditSection {
  return SECTION_BY_ID[id] ?? SECTION_BY_GROUP[group ?? ""] ?? "actions";
}

function fromMenuItem(
  item: ToolbarMenuItem,
  group: string | undefined,
): MobileEditEntry {
  return {
    id: item.id,
    section: sectionFor(item.id, group),
    inline: INLINE_CONTROL_IDS.has(item.id),
    ...(item.icon ? { icon: item.icon } : {}),
    label: item.tooltip ?? item.label ?? item.id,
    action: item.action,
    ...(item.isActive ? { isActive: item.isActive } : {}),
    ...(item.visible ? { visible: item.visible } : {}),
    ...(item.danger !== undefined ? { danger: item.danger } : {}),
  };
}

function fromButton(button: ToolbarButton): MobileEditEntry {
  return {
    id: button.id,
    section: sectionFor(button.id, button.group),
    inline: INLINE_CONTROL_IDS.has(button.id),
    icon: button.icon,
    label: button.title,
    action: button.action,
    ...(button.isActive ? { isActive: button.isActive } : {}),
    ...(button.visible ? { visible: button.visible } : {}),
    ...(button.danger !== undefined ? { danger: button.danger } : {}),
  };
}

/**
 * Normalize a tile's toolbar buttons into flat, section-tagged sheet rows.
 * Containers are replaced by their children; everything else maps one to one.
 */
export function toMobileEditEntries(
  buttons: ToolbarButton[],
): MobileEditEntry[] {
  return buttons
    .flatMap((button) =>
      button.menuItems?.length
        ? button.menuItems.map((item) => fromMenuItem(item, button.group))
        : [fromButton(button)],
    )
    .filter((entry) => !DEFERRED_IDS.has(entry.id));
}

/**
 * Extra search terms per entry id, so filtering "align" or "typeface" finds the
 * inline controls whose labels alone would not match. Shared by the sheet's
 * live filter and the `/EDIT` input's Enter-to-execute matching.
 */
export const ENTRY_SEARCH_TERMS: Record<string, string> = {
  "text-align": "align text alignment",
  "font-family": "font family typeface",
  "font-size": "font size text",
};

/** An entry's accessible name, resolved against the toolbar context. */
export function resolveEntryLabel(
  entry: MobileEditEntry,
  ctx: ToolbarContext | null,
): string {
  if (typeof entry.label !== "function") return entry.label;
  return ctx ? entry.label(ctx) : entry.id;
}

/** Case-insensitive match of a filter query against an entry's label + terms. */
export function entryMatchesQuery(
  entry: MobileEditEntry,
  ctx: ToolbarContext | null,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack =
    `${resolveEntryLabel(entry, ctx)} ${ENTRY_SEARCH_TERMS[entry.id] ?? ""}`.toLowerCase();
  return haystack.includes(needle);
}
