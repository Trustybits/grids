# Mobile 2.0 — Early Access Implementation Plan

Status: **in progress — Phases 1–3 complete (early-access plumbing + bottom command bar + top AppBar & menu drawer, now extended to the home screen); Phases 4+ pending.**

Mobile 2.0 is a redesign of the Grids editing chrome on mobile: the app bar and toolbars are
combined and collapsed to modernize the interface, minimize on-screen elements, and make the app
feel native on a phone. Desktop/web is impacted long-term, but this effort focuses on the mobile
presentation; the redesigned chrome only renders on a mobile device (see the gating model below).

Design source (Figma `grids.so`):
- App bar / toolbars / menu / preview: node `1497-9435`
- New Tile Carousel: node `1497-9533`
- Tile thumbnails (coverflow card artwork): node `1605-7314`
- Grid Settings Menu: node `1497-9949`

## Product decisions (confirmed with the maintainer)

1. **Gating: native PostHog Early Access enrollment.** The `beta-mobile-2` feature flag, wired to a
   PostHog Early Access Feature, is the single source of truth for opt-in. No Firebase-persisted
   opt-in field (the earlier `UserProfile.mobile2Enabled` was removed).
2. **Enrollment is open to everyone eligible** — no per-user targeting gate on who may opt in.
3. **The opt-in toggle is available on all devices, including desktop/web.** Users can enroll ahead
   of time; the redesigned chrome still only renders when they are actually on a mobile device.
   Opt-out placement: on desktop/web the toggle lives in the `UserMenu`; on mobile it lives in the
   **app-level menu drawer** (hamburger → Account). **Decision (updated):** the opt-out stays at the
   app level — it is *not* duplicated into the per-grid Grid Settings sheet, because early access is
   an account-level preference, not a property of an individual grid page.
4. **"Mobile" = touch-primary device **and** a small viewport** (grid `sm` breakpoint, derived from
   the existing responsive grid layout utilities). Both conditions must hold for the chrome to show.
5. **Add-a-Tile list behavior.** Backspacing the type filter (e.g. "Link") shows the full list of
   tile types. Searching a term (e.g. "youtube") surfaces every matching subtype (both the YouTube
   Link subtype and the YouTube Embed subtype).
6. **"N times used" counts are scoped to the current grid.**
7. **Context-aware command input.** The bottom input carries a mode chip and filters the surface it
   belongs to:
   - **`/TILE`** (tile carousel) uses a rotating, typed-then-backspaced placeholder cycling through:
     `paste a URL`, `paste embed code`, `type to filter/search`, `paste text or md`, `paste files`,
     `paste videos/images`, `paste color values`. Pasting a supported payload may show additional UI,
     but in most cases pressing ENTER creates the tile on the grid canvas. More payload types later.
   - **`/GRID`** (grid settings menu) filters the settings list as you type (e.g. typing "gravity"
     narrows the sheet to the Grid Gravity toggle), per the updated Figma.
8. **Omitted desktop menu items** (those reachable from other buttons/interactions) are removed from
   the mobile menu list — **except Debug**, which remains available for Trustybits developers as it
   is today.
9. **Share** opens a new modal (absorbing the old `OgImageModal`):
   - **Hybrid** sharing mechanics.
   - **Big-4** social platform selectors, each with a **per-platform post preview**.
   - OG image tools stay **inside** the modal (not a separate surface).
   - Text area for a message, plus copy-link.
10. **Preview transition** animates between the `MobileCommandBar`, the `AppBar`, and `Toolbar:Top`
    when entering/exiting preview mode.
11. **Housekeeping is in-scope.** Track new UI vs. old UI to be removed; follow repo conventions and
    skills; write tests where appropriate; maintain separation of concerns (data vs. functions);
    apply existing design tokens and flag any new token needs. When anything is in question, check in
    before proceeding.

## Components in scope

From the original brief, the core elements changing (plus subcomponents):

1. Layout Title
2. Analytics — `grid-stats-bar`, `gs-views`, `gs-panel`
3. Breakpoint-Switcher
4. Undo-redo-wrapper
5. LeftNavBar
6. bottom-left-buttons
7. GridToolbar
8. Tile Toolbar
9. TileAction Toolbar

Figma frames that map onto these: **Default** (top `AppBar` = GridMenu + editable title + Undo;
bottom `GridToolbar` pill = AddTile, GridSettings, Preview | Share), **PreviewMode** (`Toolbar:Top`
pill with Desktop/Tablet/Mobile + Close, bottom toolbar hidden), **Menu** drawer (Home, Analytics,
Recent layouts, Discord support link, Account), **New Tile Carousel**, **Grid Settings Menu**.

---

## Phased plan

### Phase 1 — Early-access plumbing ✅ COMPLETE

- [x] Create `beta-mobile-2` feature flag + Early Access Feature in PostHog
- [x] Rework `useMobileExperience` to use PostHog enrollment as the single source of truth
      (`apps/web/src/composables/useMobileExperience.ts`)
- [x] Remove `mobile2Enabled` from the `UserProfile` contract
      (`packages/contracts/src/types/UserProfile.ts`) and rebuild
- [x] Add the "Mobile 2.0" opt-in toggle to the user menu
      (`apps/web/src/components/app/UserMenu.vue`)
- [x] Make the opt-in toggle available on all devices (desktop/web included)
- [x] Initialize the composable + reload flags after identify in `apps/web/src/App.vue`
- [x] Tests for the enrollment model green
      (`apps/web/src/composables/__tests__/useMobileExperience.test.ts`)
- [x] typecheck + lint clean

Exposed API (the single gate the chrome branches on): `isMobile2 = isMobileDevice && enrolled`.
`canUseMobile2` (toggle availability) is now always true; `isMobile2Enabled` reflects enrollment.

### Phase 2 — Shared mobile chrome foundation + working bottom bar ✅ COMPLETE

Scope was pulled forward (maintainer decision): rather than an empty shell, Phase 2 ships a working
bottom command bar that hides the desktop tile toolbar + bottom corner buttons for enrolled owners.

- [x] Reusable `MobileCommandBar` pill primitive + tests
      (`apps/web/src/components/ui-collections/MobileCommandBar.vue`)
- [x] Design-token audit — reuse existing theme-aware toolbar tokens for the pill (no new tokens;
      maintainer chose `--color-toolbar-background` over an always-dark token)
- [x] `MobileGridBar` bottom command bar (`apps/web/src/components/app/MobileGridBar.vue`) wired to
      existing destinations as an interim (each replaced in its own phase):
  - AddTile → popover with existing `GridToolbar` (→ Tile Carousel, Phase 5)
  - GridSettings → existing `GridSettings` menu, dropdown repositioned via scoped `:deep` (→ Phase 6)
  - Preview → popover with existing `BreakpointSwitcher` (→ Toolbar:Top, Phase 7)
  - Share → copy grid link (→ Share modal, Phase 9)
- [x] Gate wired: `App.vue` renders `MobileGridBar` and passes `compact` to `BottomLeftButtons`
      (keeps only `UserMenu` so the opt-out stays reachable); `GridPage.vue` hides the desktop
      `.toolbar` + floating breakpoint switcher when `mobile2Active`
- [x] typecheck + lint + tests green

### Phase 3 — AppBar + Menu drawer ✅ COMPLETE

- [x] Redesigned top `MobileAppBar` (`apps/web/src/components/app/MobileAppBar.vue`): GridMenu
      hamburger, editable grid title (reuses `renameCurrentGrid` + breakpoint edit-permission checks),
      Undo (reuses `gridHistory` + `controller.undo`) — replaces the desktop Layout Title top-bar and
      the floating Undo-redo-wrapper on mobile-2 grid pages
- [x] New icons `MenuIcon` (hamburger) + `UndoIcon` (`apps/web/src/components/icons/`)
- [x] Consolidated `MobileMenuDrawer` (`apps/web/src/components/app/MobileMenuDrawer.vue`), slide-in
      from the hamburger, merging LeftNavBar + grid-stats + user-menu essentials:
  - Home → `/dashboard`
  - Analytics → reuses the existing `GridStats` component (owner-only)
  - Recent Grid Pages → recent grids (mirrors `LeftNavBar`'s `valueToMillis` recency logic)
  - Need Support? → Discord link
  - Account → the two essentials for now: **Mobile 2.0 opt-out toggle** + **Logout**
- [x] Gate wired in `App.vue`: renders `MobileAppBar` + `MobileMenuDrawer` and hides `LeftNavBar`,
      the desktop `.top-bar` (title editor), and `BottomLeftButtons` entirely when `mobile2GridActive`
- [x] Retired the Phase 2 interim: removed the `compact` prop from `AppBar.vue` (the drawer now owns
      account/opt-out, so the bottom-left bar is fully hidden on mobile-2 grid pages)
- [x] Tests: `MobileAppBar.test.ts` (hamburger emit, rename, undo state) + `MobileMenuDrawer.test.ts`
      (open/close, recent grids, opt-out toggle, owner-gated analytics)
- [x] typecheck + lint + full suite (2562 tests) green

Interim notes to revisit in later phases:
- The drawer **Account** row is minimal (opt-out + Logout). Full account management (handle, billing,
  file archive) still lives in the desktop `UserMenu`; reconcile the two in Phase 6/10.
- The **Mobile 2.0 opt-out lives in the app-level drawer** (maintainer decision) — it is *not*
  mirrored into the per-grid Grid Settings sheet.
- Analytics is the whole `GridStats` bar embedded in a drawer row; Phase 8/10 may extract a shared
  `useGridStats` composable if the desktop bar and drawer diverge.

#### Phase 3.1 — Home chrome + fixes (follow-up)

- [x] **Bug fix:** removed the `backdrop-filter: blur()` from the drawer scrim. A full-viewport
      backdrop-filter forced the browser to re-rasterize the whole grid behind it on open/close,
      which read as the tiles "redrawing/reloading". The drawer is now a pure overlay (plain scrim).
      Also made the drawer's `fetchGrids()` idempotent (only when the collection is empty).
- [x] **AppBar on the home screen:** the `MobileAppBar` + drawer now also render on `/dashboard`
      (`mobile2HomeActive`), not just owned grid pages. New `mode` prop:
  - `grid` → editable title + Undo (as before)
  - `home` → static **"Your Grids"** title (non-editable) + a **New Grid** button in place of Undo
- [x] `App.vue` hides `LeftNavBar` + `BottomLeftButtons` whenever the mobile chrome is active
      (`mobile2ChromeActive = mobile2GridActive || mobile2HomeActive`); `DashboardPage` hides its own
      in-page "Your Grids" header on mobile 2.0 and pads for the fixed bar. New Grid creates a grid
      with a default name and routes to it (rename-in-place via the grid AppBar title).
- [x] **Dashboard list on mobile:** `DashboardGridCard` reflows to two rows under 600px (star + name
      on top, timestamp + actions beneath) and the name truncates instead of wrapping mid-word.
- [x] Tests updated (`MobileAppBar` home mode, drawer idempotent fetch); full suite green.

### Phase 4 — Mobile GridToolbar (bottom pill) ✅ COMPLETE (delivered in Phase 2)

- [x] Bottom-center pill: AddTile, GridSettings, Preview, divider, Share
      (`MobileGridBar` on `MobileCommandBar`)
- [x] Reconcile with existing `GridToolbar` / `bottom-left-buttons` (bottom-left bar hidden
      on mobile-2; the pill is the single command surface)

### Phase 5 — Add-a-Tile carousel + `/TILE` input 🟡 IN PROGRESS (5.1 + 5.1.1 done, 5.2 next)

Product decisions (confirmed): the pill **is** the command input — one morphing component.
Tapping **Add Tile** grows the pill (the shell never fades — it transforms via a FLIP width
animation); the four commands are replaced by the `/TILE` input, and a tile-type carousel
slides up **from behind** the pill. The `/TILE` chip is a **static, non-removable** label for
now (`x | /TILE` removal is deferred until the general "omni" search is designed), and the
**close button sits at the far right** of the input. `MobileCommandInput` is built to be reused
for the `/GRID` settings input in Phase 6. "N times used" counts are **per-grid** (computed live
from the current grid's tiles).

#### Phase 5.1 — Command input + tile-type carousel ✅ COMPLETE

- [x] `useTileCreation` composable (`apps/web/src/composables/useTileCreation.ts`): single
      tile-type registry (flag-gated, mirrors `GridToolbar`) + `createTile` / `submitCommand`
      (smart-paste via `useTileInput`). Keeps creation logic in one place.
- [x] `MobileCommandInput.vue` (reusable): static `/TILE` chip, animated typewriter placeholder
      (product-specified phrases, respects `prefers-reduced-motion`), carousel/list view toggle,
      far-right close button, `submit` on ENTER.
- [x] `MobileTileCarousel.vue`: scroll-snap row of tile-type cards (+ vertical `list` layout for
      the view toggle); filtered live by the input query.
- [x] `MobileGridBar.vue` reworked: morphs default ↔ add mode; carousel select creates the tile
      (create-kind), opens the file picker (image/document), or focuses the input (link/embed);
      ENTER smart-pastes a URL/embed or creates a keyword-matched tile.
- [x] New icons `CloseIcon` + `ListIcon`; tests for the composable + all three components
      (2587 tests green); typecheck + lint clean.

Post-review polish (from maintainer feedback):
- [x] Pill radius is `--radius-md` for both the default gridbar and the add-mode command input
      (single change in `MobileCommandBar`).
- [x] Selecting a command-type card (link / embed / map) no longer filters the carousel — the full
      list stays visible with the active type highlighted, and the typed text populates that tile's
      content instead of searching.
- [x] Selecting a command-type card **pins** it: the chip prefix switches from `/TILE` to `/MAP` /
      `/LINK` / `/EMBED` so the user sees which context ENTER acts on. Re-tapping the pinned card
      toggles it off (chip reverts to `/TILE`); the typed text is preserved. ENTER is routed through
      `useTileCreation.submitCommand(text, forcedType)` so the pinned type builds the correct tile
      (map location, link URL, or embed URL) — this fixes "ENTER does nothing" after switching types.
      Superseded by 5.1.1: every type now pins its prefix, and the pin follows the centered card.
- [x] Inline quick command: typing a command-type name + space in the generic `/TILE` input (e.g.
      `map japan`, `link example.com`, `embed <url>`) pins that type and keeps the rest as content —
      identical to tapping the card then typing. Parsing lives in
      `useTileCreation.matchCommandPrefix` / `submitCommand`; `MobileGridBar` watches the query and
      strips the recognized prefix live so the field shows only the content. Matches on the type's
      id/label (command-kind only); a trailing space alone pins with empty content.
- [x] Un-pin via keyboard: two backspaces on an empty field revert a pinned type back to `/TILE`
      (chip + highlight clear) instead of closing the surface. `MobileCommandInput` counts the empty
      backspaces and emits `unpin`; `MobileGridBar` clears `activeType`.
- [x] The map tile's rough first-load appearance (compact Mapbox attribution "ℹ" button + default
      framing) is tracked separately as [#183](https://github.com/Trustybits/grids/issues/183); it
      is pre-existing and unrelated to the Mobile 2.0 chrome (same creation path as desktop).

#### Phase 5.1.1 — 3D coverflow carousel ✅ COMPLETE

Figma "Tiles" (`1605-7314`). Product decisions (confirmed): use the **Figma wireframe thumbnails**
rebuilt as token-driven markup rather than live tile renders — Map needs a Mapbox instance and
Embed needs a third-party iframe plus content that does not exist at carousel time, and mounting
those in a surface being dragged would cost the 60fps swipe. The `/command` chip **tracks the
centered card live**. Subtypes (`/SPOTIFY` et al.) stay in 5.2.

- [x] `MobileTileThumbnail.vue`: the per-type wireframe artwork (heading/body bars for Text,
      message bubbles for Chat, crossing roads for Map, dashed webpage for Embed, …). Geometry is
      transcribed from Figma's 150x150 tile box and emitted as percentages so it scales to any card
      size; fills are `currentColor` at two "ink" opacities (Figma's #222 / #333) so the artwork
      follows the theme instead of hard-coding greys. The type's **registry icon** stands in for
      Figma's bespoke glyph, so the carousel can never drift from the types the toolbar offers.
- [x] `MobileTileCarousel.vue` rebuilt as a coverflow: cards are absolutely positioned and
      transformed from a continuous `scroll` position (`translateX` + `translateZ` + `rotateY`
      under a 700px perspective), so the tilt tracks the finger frame-by-frame rather than easing
      after it. Pointer drag with rubber-banded ends, velocity projection capped at
      `MAX_FLING = 2` cards, and an ease-out settle; `prefers-reduced-motion` skips the settle.
- [x] Interaction: drag/swipe spins the fan, tapping a side card centers it, tapping the centered
      card commits it, ← / → step the center. The logical center is tracked separately from the
      animated position so selection never waits on the animation.
- [x] The centered card **is** the active type: it drives the chip (`/TEXT`, `/MAP`), the
      placeholder, and what ENTER builds. The carousel emits `focus-type` only for user-driven
      movement, so typing still filters until the user touches the fan; it also renders a frozen
      copy of the list while dragging so a parent-driven list change can't reshuffle the fan
      mid-gesture. Re-tapping no longer toggles a type off — releasing is Backspace-Backspace.
- [x] `useTileCreation.submitCommand` extended: a pinned create-kind type adds that tile on ENTER
      with an empty field, while text present still falls through to smart-paste so a pasted URL
      never becomes an empty tile of the wrong kind. Placeholders for non-command types are derived
      from the descriptor's kind ("Press enter to add a Chat tile" / "Tap … to choose a file").
- [x] The carousel panel lost its stray debug border and runs the **full width of the screen**
      (unlike the pill, which keeps `--mgb-width`), so the fan spreads edge to edge and its outer
      cards are cut off by the screen rather than stopping short of it. The clip stays on the
      carousel so no stray horizontal scrollbar reaches the document.
- [x] The fan **peeks out from behind the pill** rather than floating above it: the panel is taken
      out of the bar's flex column and pushed down past the pill's top edge by `--mgb-tuck` (24px),
      so the bottom of every card is hidden behind the bar.
- [x] Cards are **bottom-aligned**, via a `perspective-origin` on the track's bottom edge — the
      vanishing point sits on that line, so receding cards shrink towards it instead of towards the
      middle. With the tuck above, every card is cut off at the same line.
- [x] No card carries a **visible name** — the command chip already names the centered type. The
      label survives as each card's `aria-label`, which is what the tests locate cards by.
- [x] Cards stack by their **unclamped** distance from center. Off the `REACH`-clamped value every
      card past the limit tied on one layer and DOM order broke the tie rightwards, so the right of
      the fan stacked outermost-in-front — mirroring the left instead of matching it.
- [x] Depth is **never** carried by card transparency. Fading the whole card let the grid show
      through and read as muddy rather than distant, badly so over a busy or light background. The
      card surface is always opaque; the fall-off (100 / 89 / 76 / … floored at 55%) applies to the
      **artwork inside**, alongside a static shadow. Considered and rejected: `backdrop-filter`
      blur (per-element GPU cost across ~10 cards being dragged would cost the 60fps swipe) and
      backing each card with the grid's own background color (breaks down for image backgrounds,
      where any fallback can clash with the photo).
- [x] Tests: new `MobileTileThumbnail` suite, rewritten `MobileTileCarousel` suite (geometry, drag,
      tap-to-center vs tap-to-commit, keyboard, list re-sync), and `MobileGridBar` coverage for
      chip tracking + the create-type prompt. Full suite green; typecheck + lint clean.

#### Phase 5.2 — Subtype list + usage counts ⬜ NOT STARTED

- [ ] List view rows for link/embed **subtypes** (Music, YouTube, Twitter, Instagram, …) with
      icons (Figma `1534-7792`) — needs a curated subtype registry (no such registry today)
- [ ] Per-grid **"N times used"** counts, computed from the current grid's tiles
- [ ] `/TILE` (tile types) vs general-search (subtypes/content) semantics once the list exists

### Phase 6 — Grid Settings sheet 🟡 IN PROGRESS (6.1 + 6.2 + 6.3 done)

Product decisions (confirmed): extract a shared `useGridSettings` composable so the desktop
`GridSettings` dropdown and the mobile sheet share one implementation (same pattern as
`useTileCreation`). Ship the **core sheet (6.1)** first and defer the heavy Grid Background tools +
theme-card visuals to **6.2**. "Publish Template" maps to the existing **Allow Public Template**
(`duplicatable`) toggle for now. The GRID ID copy button copies the **grid link/URL** (matches the
desktop behavior). The Mobile 2.0 opt-out is intentionally *not* here — it lives in the app-level
menu drawer (Account), since early access is an account preference, not a per-grid setting.

#### Phase 6.1 — Core sheet + `/GRID` filter ✅ COMPLETE

- [x] `useGridSettings` composable (`apps/web/src/composables/useGridSettings.ts`): shared
      state + actions — ownership, GRID ID, dark-mode / gravity / publish-template toggles,
      default-grid (per-user profile) toggle, duplicate (+ storage plan) / delete / transfer flows,
      breakpoint save/reset, debug toggles, Pixel Racers, and the delete/transfer modal visibility.
- [x] Desktop `GridSettings.vue` refactored to consume the composable (template + background /
      color-picker / debug DOM unchanged), so the two surfaces can't drift.
- [x] `MobileGridSettingsSheet.vue`: the sheet contents mirroring the Figma menu (`1497-9949`) — a
      fixed **GRID ID + copy** header, a separator, then a scrollable, live-filterable list: Dark Mode,
      Gravity, Default Grid, Publish Template, Duplicate, Transfer (or Cancel Transfer when pending),
      Delete, and a **collapsed "Debug"** disclosure (hidden by default, auto-expanded while filtering
      — mirrors the desktop Debug accordion). Renders the shared delete/transfer modals. Bottom corners
      squared, no scrim. Toggle rows carry no padding of their own so their labels line up flush-left
      with the action rows.
- [x] **Debug gating (`isStaff`):** a shared `isStaff` computed on `useGridSettings` (signed-in email
      ends with `@trustybits.com`) gates the developer **Metadata / Verbose Metadata** toggles. On
      **mobile** the whole Debug section is staff-only (its only contents are those toggles), and
      **Pixel Racers is omitted entirely** — it's a keyboard easter egg that doesn't work on touch.
      On **desktop**, Pixel Racers stays available to all users under the Debug accordion, while the
      metadata toggles are staff-gated. Note: this is the *first* real gate — the metadata tooling was
      previously visible to everyone (just collapsed).
- [x] **Grid Settings uses the exact Add-a-tile morph** (per feedback): tapping Grid Settings morphs
      the pill into the `/GRID` command input (top corners squared, `radius-md` bottom), and the sheet
      rises from behind and rests **flush** on top of the bar as one connected surface. The `/GRID`
      filter lives in the pill (reuses `MobileCommandInput` with the new `showViewToggle=false` prop);
      typing narrows the rows live. Both the sheet and the bar share a dynamic width
      (`min(520px, 100vw − var(--spacing-md))` → 8px either side, 304px on iPhone SE) so the grid stays
      visible behind.
- [x] `MobileGridBar` reworked: `settings` is now a third pill mode alongside `default`/`add` (same
      FLIP width morph, same rise-from-behind panel). Opening it dismisses Preview/Add and vice-versa;
      Escape/outside-tap closes it — but taps inside a teleported `.modal-overlay` are ignored so the
      delete/transfer confirmation can't unmount itself.
- [x] Tests for the composable + the sheet (`query`-driven filtering, copy/duplicate/delete/transfer,
      mount refresh) + the new `showViewToggle`; `MobileGridBar` test covers the settings morph + close.
      Full suite green (excluding the pre-existing `@griddle/*` dependency gap); typecheck + lint clean.

Motion / layout polish (applies to the whole mobile bar, Phase 5 + 6):

- [x] **New design token `--easing-gentle`** (`cubic-bezier(0.32, 0.72, 0, 1)`) — a soft, no-overshoot
      ease-out approximating Figma's "Gentle" preset. The pill width morph and the settings/carousel
      rise now use it at `--duration-slow` (400ms) instead of the bouncy `--easing-spring`.
- [x] The bar rests **8px** (`--spacing-sm`) above the viewport bottom, but hugs the on-screen
      keyboard flush when it opens (visual-viewport-driven `keyboardInset` → inline `bottom`).
- [x] Settings sheet body (excludes the `/GRID` bar) capped at **~190px on an iPhone SE** (`33.5vh`),
      scaling up on larger screens; the row list scrolls when it overflows.

#### Phase 6.2 — Grid Background + theme cards ✅ COMPLETE

- [x] **Background handlers moved into `useGridSettings`** — `uploadBackgroundImage(file)` (wraps
      `useFileUpload` + `controller.addBackgroundImage`, toasts on failure), `setBackgroundColor`,
      `removeBackgroundImage`, `removeBackgroundColor`, plus a `backgroundColor` getter. Desktop
      `GridSettings.vue` now consumes these (its file input / `ColorPicker` / dropdown DOM unchanged),
      so the two surfaces share one implementation and can't drift. Dropped the now-unused
      `useFileUpload` / `useGridSessionStore` / `useToastStore` imports from the desktop component.
- [x] **`GRID THEME` light/dark theme-card visual** — two selectable preview cards (a small 2×2 tile
      mock) replace the old Dark Mode toggle on mobile; tapping a card drives the shared `isDarkMode`.
      The mock surfaces use fixed light/dark neutrals (`--color-light-100` / `--color-dark-0` +
      `color-mix`) so each card always reads as its theme regardless of the active app theme. The
      selected card gets a `--color-purple` outline.
- [x] **`GRID BACKGROUND` selector** — three tiles: **image** (opens the hidden file picker →
      `uploadBackgroundImage`), **Default** (dashed; resets by clearing image + color, selected when
      neither is set), and **color** (rainbow swatch; shows the current color when one is set).
      Selection is shown with the purple emphasis border. The color tile originally opened the desktop
      `ColorPicker` popover; **6.3** replaced that with the dedicated mobile `/HEX` picker (the tile now
      emits `open-color` up to the bar).
- [x] **New token `--border-width-lg` (2px)** for the selected/active swatch + preview-card outlines.
- [x] Sheet tests extended (theme/background sections render, light-card selected by default, Default
      tile selected when no bg, reset clears image+color, color tile opens the picker) and the
      `useGridSettings` mock updated with the new background surface. Suite green; typecheck clean.

Deferred: a "Save Mobile Layout" affordance (breakpoint override) — revisit if wanted on mobile.

#### Phase 6.3 — `/HEX` color picker sheet ✅ COMPLETE

Figma "Grid Settings — Color" (1588-7129). Selecting the background **color** tile morphs the pill into
a `/HEX` command input and raises a full HSB picker sheet — the same morph/rise/flush pattern as the
`/GRID` settings sheet and the add-a-tile carousel.

Product decisions (confirmed): **live** apply, **per-user** saved swatches, close returns **back to
the Grid Settings sheet**, SLIDERS-only. The **eyedropper** and the **VALUE BOX** numeric-entry tab are
deferred (see below).

- [x] **Color utilities** `src/utils/color.ts` — pure `normalizeHex` / `isValidHex` / `hexToRgb` /
      `rgbToHex` / `rgbToHsv` / `hsvToRgb` / `hexToHsv` / `hsvToHex` (hue 0–360, s/v 0–1). 12 unit tests.
- [x] **Per-user saved colors** — new optional `savedColors: string[]` on the `UserProfile` contract;
      `useSavedColors` composable loads them (module-level shared state), and `addColor` prepends /
      de-dupes case-insensitively / caps at 24 / persists via `userService.updateUserProfile`
      (optimistic with rollback). 7 unit tests.
- [x] **`MobileColorPicker.vue`** — saturation/brightness HSB pad + hue slider (pointer-drag, HSV kept
      as the source of truth so a channel bottoming out doesn't lose the hue) + a horizontally
      -scrollable swatch row (**saved customs newest-first, then the preset brand palette** so a freshly
      added color lands at the far left). Emits `update:modelValue` continuously, `preview` continuously
      during a pad/hue drag (drives the **live** grid background, history-free), and `commit` once at the
      end of a gesture (pad/hue pointer-up, swatch tap). The pad/hue gradients are clipped with
      `background-clip: padding-box` so they don't bleed under the translucent border as a colored rim.
- [x] **`/HEX` bar mode** in `MobileGridBar` — static `/HEX` chip, hex input (typing a full 6-digit
      value live-updates the pad/hue; Enter/blur commits), and right-anchored **Add color (+)** +
      **Close (×)**. **Live drag apply**: `preview` calls a new history-free
      `previewBackgroundColor` controller op each frame for immediate feedback; on release the pre-drag
      color is restored and `setBackgroundColor` is called once, so the drag collapses to a **single**
      undo entry + one save. Swatch taps / typed hex commit directly (one entry each). Close returns to
      the Grid Settings sheet, Escape mirrors it, an outside tap dismisses the whole surface. The
      connected flush-surface styling (squared top corners / dynamic width) is shared with settings mode.
- [x] Bar + sheet + controller tests updated (color mode morph + back-to-settings, Add saves, typed hex
      commits, **live-drag preview + single commit**, `previewBackgroundColor` writes no history/save;
      the sheet asserts it emits `open-color`). Suites green; typecheck + lint clean.

Deferred follow-ups:

- **Grid eyedropper** — the native `EyeDropper` API is Chromium-desktop only (absent on mobile), and
  sampling arbitrary grid pixels requires rasterizing the DOM to a canvas (cross-origin images taint
  it; embeds/iframes + Mapbox WebGL can't be captured), so it's its own sub-phase. Options captured:
  snapshot-loupe (html-to-image, graceful degradation) vs element-color loupe (reliable, solid colors
  only). No client-side grid snapshot exists to reuse (OG images are generated server-side).
- **VALUE BOX tab** — the SLIDERS/VALUE BOX segmented toggle + numeric entry fields are deferred; only
  the SLIDERS pad/slider ship now (the toggle is omitted until VALUE BOX exists rather than shipping a
  no-op control).

#### Phase 6.4 — Theme / background buttons (Figma match) + active-source model ✅ COMPLETE

Figma "Grid Settings" theme cards (1516-10776 / 1529-911 / 1529-913) and background tiles
(Upload 1529-907 / Default 1529-908 / Custom Color 1529-909). Matches the designed visuals and
introduces a retained, toggleable active background source.

- [x] **Retained active background source** — new optional `backgroundActiveSource`
      (`'image' | 'color' | 'default'`) on the `Grid` contract (mapped in both `FirebaseUtils` and the
      stubbed DB). A grid keeps **both** an uploaded image and a custom color at once; this flag decides
      which renders, so the user can switch back and forth without losing either. Absent on legacy grids
      → renderer falls back to presence precedence (color over image over none).
- [x] **Controller** — `GridSettingsController.setBackgroundActiveSource(source)` (history + save, no
      value mutation); `setBackgroundColor` / `previewBackgroundColor` now mark **color** active and
      `addBackgroundImage` marks **image** active; `removeBackground{Color,Image}` fall back to the other
      retained source, else default. Facaded on `GridController`.
- [x] **Rendering (`GridPage`)** — an `activeBackgroundSource` computed resolves the flag (with the
      legacy fallback); `backgroundStyle` paints only the active source, the embed iframe is gated to an
      active image, and the background-contrast CSS vars are driven only while **color** is active. The
      old image+color blend overlay (`background-color-overlay`) is retired — sources are now exclusive.
- [x] **`useGridSettings`** — exposes `backgroundImageSrc`, `activeBackgroundSource`, the
      `is{Image,Color,Default}BackgroundActive` computeds, and `activate{Image,Color,Default}Background`
      actions (which never discard the other stored value).
- [x] **GRID THEME cards** — rebuilt as faithful CSS/inline-SVG mini-grid mockups (Profile / Document /
      tall Chat / wide Image-with-mountains tiles) matching the Figma thumbnail, with fixed light/dark
      neutrals so each card always reads as its theme. No external image assets committed.
- [x] **GRID BACKGROUND tiles** — Upload shows a framed-photo illustration, replaced by the image
      **thumbnail** once one exists (optimistic object-URL while uploading); Default is dashed; Color
      fills with the chosen color (rainbow when unset). Tap logic: inactive tile → activate that source;
      active **color** tile → open `/HEX`; no color yet → open `/HEX`; active **image** tile → open the
      `/background` image-swap sheet (Phase 6.5).
- [x] **Selected ring** — the active choice gets a **2px** `--color-purple` ring sitting **2px** off the
      illustration, implemented with `outline` + `outline-offset` (no layout shift, follows the radius),
      per the Figma spec.
- [x] Tests updated/added (contract active-source on controller commits/removes/toggle, sheet tile
      activate + thumbnail + `/HEX` open paths). Suites green; typecheck + lint clean.

#### Phase 6.5 — `/background` image-swap sheet ✅ COMPLETE

Tapping the **active** image tile now opens a dedicated swap sheet instead of re-opening the OS file
picker, following the same morph/rise/flush pattern as `/GRID` and `/HEX`.

- [x] **`MobileImageSwapSheet.vue`** — rises flush behind the morphed `/background` pill. Previews the
      current background image, then a horizontally-scrollable strip of the user's archive images
      (newest-first, images-only, failed uploads skipped) plus a dashed **Upload** tile. Tapping a
      thumbnail sets it as the background; the active image is ringed (matched by hash, URL fallback).
      Uploading a new image applies it and refreshes the strip. Reads the archive via `useFileArchive`.
- [x] **`/background` bar mode** in `MobileGridBar` — new `image` mode: static `/BACKGROUND` chip + a URL
      field to **link** an external image (paste-a-URL, Enter commits and clears, sheet preview updates)
      + right-anchored **Close (×)**. Two Backspaces on an empty field step up to `/GRID`; Escape mirrors
      it; an outside tap dismisses the whole surface. Shares the connected flush-surface styling.
- [x] **`useGridSettings`** — `setBackgroundImageFromArchive(doc)` (resolves a fresh download URL for the
      archive path, URL fallback, sets it archive-backed with its hash) and `linkBackgroundImage(url)`
      (links an external URL, non-embed, **no hash** — not re-hosted). Exposes `backgroundImageHash` for
      the active-tile match. The Grid Settings sheet's active image tile now emits `open-image`.
- [x] Tests added/updated (composable link + archive-resolve + URL fallback; sheet renders/selects/
      highlights/uploads; bar `/background` morph + link-on-Enter + double-backspace step-up; settings
      sheet emits `open-image`). Suites green; typecheck + lint clean.

### Phase 7 — Preview mode transition ⬜ NOT STARTED

- [ ] `Toolbar:Top` breakpoint switcher (Desktop/Tablet/Mobile) + Close (replaces Breakpoint-Switcher)
- [ ] Animated transition between `MobileCommandBar`, `AppBar`, and `Toolbar:Top`

### Phase 8 — Tile Toolbar + TileAction Toolbar ⬜ NOT STARTED

- [ ] Mobile treatment of the Tile Toolbar and TileAction Toolbar

### Phase 9 — Share modal ⬜ NOT STARTED

- [ ] New Share modal: message text area, copy-link, big-4 platform selectors with per-platform
      previews, OG image tools inside, hybrid share mechanics
- [ ] Absorb / retire `OgImageModal`

### Phase 10 — Housekeeping & GA cutover ⬜ NOT STARTED

- [ ] Inventory old UI superseded by Mobile 2.0; remove after validation
- [ ] Confirm tests, separation of concerns, and token usage across all phases
- [ ] Retire the `beta-mobile-2` gate at GA

---

## Open questions / to confirm before building

- Exact desktop rollout timing (chrome is mobile-only for now — when does desktop adopt it?).
- Which "desktop-only" menu items are considered reachable elsewhere vs. must stay in the mobile menu.
- Final list of the "big-4" platforms for Share and their preview requirements.
