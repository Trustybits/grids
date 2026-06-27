# Toolbar UX Audit

_Date: 2026-06-27 · Scope: the grid "add tile" toolbar and the per-tile contextual toolbar._

## What was reviewed

Two distinct toolbar surfaces plus their supporting code:

| Surface | File | Role |
| --- | --- | --- |
| **Grid toolbar** | `apps/web/src/components/grid/GridToolbar.vue` | Bottom bar for adding new tiles (Text, Image, Link, Map, …). Horizontally scrollable. |
| **Tile toolbar** | `apps/web/src/components/tile/TileToolbar.vue` | Per-tile contextual controls (resize, color, crop, align, more-menu) with pop-up menus and panels. |
| Button registry | `apps/web/src/registries/tileToolbar/*` | Declarative `ToolbarButton` / `ToolbarMenuItem` definitions per tile type. |
| Tooltip | `apps/web/src/components/ui-elements/FloatingTooltip.vue` | Teleported hover tooltip used by both toolbars. |
| Types | `apps/web/src/types/TileToolbar.ts` | `ToolbarButton`, `ToolbarMenuItem`, `ToolbarContext`. |

Findings are grouped by theme and tagged **[High] / [Med] / [Low]**. High = blocks a class of users or causes real confusion; Med = noticeable friction or inconsistency; Low = polish / cleanup.

---

## 1. Accessibility

The toolbars are entirely **icon-only buttons with no accessible name**. This is the single biggest UX gap and affects screen-reader, keyboard, and (indirectly) touch users.

- **[High] No accessible name on any icon button.** Every `<button class="toolbar-btn">` in both `GridToolbar.vue` (lines 20–78) and `TileToolbar.vue` (lines 14–32) renders only an SVG. The human-readable `title` already exists on every `ToolbarButton` (`TileToolbar.ts:30`) and every grid-toolbar `FloatingTooltip text="…"`, but it is wired **only** to the visual hover tooltip — never to `aria-label` or the native `title` attribute. A screen reader announces each as a bare "button". Fix: bind `:aria-label="resolveTitle(item)"` on the tile-toolbar button and add `:aria-label` (or `title`) to each grid-toolbar button.

- **[High] Tooltips are mouse-only — invisible to keyboard users.** `FloatingTooltip.vue` listens for `mouseenter` / `mouseleave` only (lines 59–60). A keyboard user tabbing through the toolbar gets no label at all, and the tooltip is the *sole* source of the label today (see above). Add `focus` / `blur` (or `focusin`/`focusout`) listeners alongside the mouse ones. The tooltip `<div>` also has no `role="tooltip"`.

- **[Med] Toggle buttons don't expose pressed state.** Buttons that toggle (Bold, Italic, Border, Map pan/plane/clouds, Link background) compute `isActive` and reflect it only with a background/color swap (`TileToolbar.vue` `.is-active`, lines 802–808). There is no `aria-pressed`, so the on/off state is invisible to assistive tech. Bind `:aria-pressed` when `item.isActive` is defined.

- **[Med] Pop-up menus and panels can't be dismissed with the keyboard.** `handleClickOutside` is registered on `click` and `contextmenu` (`TileToolbar.vue:672–673`) but there is **no `Escape` handler**. Once the more-menu, color picker, or search panel opens, a keyboard user has no standard way to close it. Add a `keydown` listener for `Escape` that calls `closeMenu()`.

- **[Med] No focus management for teleported menus/panels.** The more-menu, color picker, and text-align panel teleport to `<body>` (`TileToolbar.vue:94–179`). Focus is not moved into them on open (except search/imageUrl inputs) and not restored to the trigger on close, and focus is not trapped. Keyboard/screen-reader users can tab "behind" an open menu.

- **[Low] Color swatch communicates only via color.** The color button renders the current fill as a CSS swatch (`resolveButtonStyle`, `TileToolbar.vue:376–396`) with no textual indication of the selected color — fine as a control, but the `aria-label` should at least say "Tile color" (covered by the accessible-name fix).

---

## 2. Consistency between the two toolbars

- **[Med] Two divergent `.toolbar-btn` definitions.** Grid toolbar buttons are **40×40** with a **28px** icon dimmed to **`opacity: 0.55`** that brightens on hover (`GridToolbar.vue:520–553`). Tile toolbar buttons are **36×36** with a **28px** icon at full opacity and a `scale(1.05)` hover (`TileToolbar.vue:774–808`). Same class name, different size, different icon treatment, different hover affordance. They read as two different design languages. Pick one button spec (size, icon size, hover, idle opacity) and share it.

- **[Med] Inconsistent tooltip/title casing.** Mix of sentence case and Title Case across the registry:
  - Sentence case: "Tile color", "Hide border", "Pan / Zoom", "Default view", "Re-center on location".
  - Title Case: "Add a Link" (`textButtons.ts:66`), "Change Font", "Change Font Size" (`textButtons.ts:41,46`).
  - Plus a casing mismatch for the *same* concept: `sharedTileLinkButton.ts` says **"Add a link"** while `textButtons.ts` says **"Add a Link"**. Standardize on sentence case.

- **[Low] Two different buttons share the Color icon with different meaning.** `COLOR_BUTTON` (opens the color panel, `baseButtons.ts:124`) and `LINK_BG_TOGGLE` (toggles the link background image, `linkButtons.ts:7`) both render `ColorIcon`. On a link tile a user could see the same glyph meaning two different things. Consider a distinct icon for the background-image toggle.

---

## 3. Icon ↔ action mismatches (tile resize)

The resize presets in `baseButtons.ts` map several distinct sizes to icons that depict a *different* shape:

- **[Med] `RESIZE_8x1` uses `ResizePortraitIcon`** (`baseButtons.ts:98–104`) — a portrait (tall) glyph for an 8×1 *wide* shape. Orientation is backwards.
- **[Med] `RESIZE_2x3` uses `Resize2x4Icon`** (`baseButtons.ts:49–55`) — the icon literally depicts 2×4 for a 2×3 button.
- **[Low] `RESIZE_5x1` and `RESIZE_3x1` both use `ResizeWideIcon`** (lines 35–41, 56–62) — two different sizes, identical icon. (Only `RESIZE_1x1/3x1/4x4/2x2` are surfaced in `RESIZE_PRESETS`, so some mismatches are latent, but they'll bite whoever wires the others up.)

These directly undercut the "what will this button do" expectation a toolbar should set.

---

## 4. Error / feedback patterns

- **[High] Upload failures use blocking `alert()`.** `GridToolbar.vue` calls `alert(...)` on image (line 307) and document (line 290) upload errors. The app already has a non-blocking toast system (`stores/toast.ts`, `useToastStore().addToast(msg, 'error')`) used in `TileActions.vue`, `ColorPicker.vue`, etc. `alert()` is jarring, unstyled, and blocks the main thread. Replace with an error toast for consistency with the rest of the app.

---

## 5. Discoverability / responsive

- **[Med] Icon-only + hover-only tooltips hurt touch & first-time discoverability.** With no labels and tooltips that never fire on touch, a new or mobile user must tap each tile-add button to learn what it does. Worth considering text labels (at least on first run / wider viewports) or an accessible-name pass so long-press/AT can surface them. (The accessible-name + focus-tooltip fixes in §1 also partially address this.)

- **[Low] Long tooltip strings can overflow.** The tile-link tooltip embeds the full URL: `Remove link to ${url}` (`sharedTileLinkButton.ts:18`, `textButtons.ts:69`). The floating tooltip has no `max-width`/wrapping, so a long URL produces a tooltip that can run off-screen. Truncate the URL or cap tooltip width.

- **[Low] Hard-coded viewport math.** `.toolbar-scroll-wrapper { max-width: calc(100vw - 128px) }` (`GridToolbar.vue:441`) is a magic number; if surrounding chrome changes, the toolbar can crowd or clip. Tie it to the actual layout instead.

---

## 6. Dead code / cruft (Low, but it obscures the real UX)

- **[Low] Large commented-out blocks** in `GridToolbar.vue`: legacy emoji buttons (3–8), the roadmap button (79–85), the `.toolbarAlpha::before` gradient (507–518).
- **[Low] Unused dev styling** with no matching markup: `.devToolbar`, `.devToolMenu`, `.content`, `.devOptions`, `.form-check-label`, `.checkmark` (`GridToolbar.vue:555–631`).
- **[Low] Returned-but-unused setup members** in `GridToolbar.vue`: `addRoadmapFeedElement`, `updateMetaData`, `isDarkMode` are exposed from `setup()` but not referenced in the template; `_addOtherElement` uses a raw `prompt()`. Remove or wire up.
- **[Low] Duplicated tile-link logic.** `sharedTileLinkButton.ts` and the `tile-link` entry inside `textButtons.ts` (`TEXT_MORE_MENU`) reimplement the same `hasTileLink`, icon-swap, danger flag, and add/remove action. Extract one shared definition.

---

## Suggested priority order

1. **Accessible names + keyboard tooltips** (§1, first two items) — wire the existing `title` to `aria-label` and add focus listeners to `FloatingTooltip`. Highest impact, low effort, no design change.
2. **Replace `alert()` with toasts** (§4) — small, aligns with existing patterns.
3. **`aria-pressed` on toggles + `Escape` to close menus** (§1) — completes the keyboard/AT story.
4. **Fix resize icon/size mismatches** (§3) and **unify the two `.toolbar-btn` specs + tooltip casing** (§2).
5. **Cleanup** (§6) and the responsive/overflow polish (§5).

None of the above changes behavior the way a user relies on today; items 1–3 are additive and safe to land independently. I can implement any subset on this branch on request — recommend starting with #1 and #2.
