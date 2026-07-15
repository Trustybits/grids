# Mobile 2.0 — Early Access Implementation Plan

Status: **in progress — Phases 1–3 complete (early-access plumbing + bottom command bar + top AppBar & menu drawer, now extended to the home screen); Phases 4+ pending.**

Mobile 2.0 is a redesign of the Grids editing chrome on mobile: the app bar and toolbars are
combined and collapsed to modernize the interface, minimize on-screen elements, and make the app
feel native on a phone. Desktop/web is impacted long-term, but this effort focuses on the mobile
presentation; the redesigned chrome only renders on a mobile device (see the gating model below).

Design source (Figma `grids.so`):
- App bar / toolbars / menu / preview: node `1497-9435`
- New Tile Carousel: node `1497-9533`
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

### Phase 5 — Add-a-Tile carousel + `/TILE` input 🟡 IN PROGRESS (5.1 done, 5.2 next)

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
      Note: for now only link / embed / map pin the chip (they require input before creating). When
      the 3D "coverflow" carousel lands, every type will pin its prefix.
- [x] The map tile's rough first-load appearance (compact Mapbox attribution "ℹ" button + default
      framing) is tracked separately as [#183](https://github.com/Trustybits/grids/issues/183); it
      is pre-existing and unrelated to the Mobile 2.0 chrome (same creation path as desktop).

Deferred polish: the Figma 3D "coverflow" fan is a clean scroll-snap row for now.

#### Phase 5.2 — Subtype list + usage counts ⬜ NOT STARTED

- [ ] List view rows for link/embed **subtypes** (Music, YouTube, Twitter, Instagram, …) with
      icons (Figma `1534-7792`) — needs a curated subtype registry (no such registry today)
- [ ] Per-grid **"N times used"** counts, computed from the current grid's tiles
- [ ] `/TILE` (tile types) vs general-search (subtypes/content) semantics once the list exists

### Phase 6 — Grid Settings sheet ⬜ NOT STARTED

- [ ] Grid Settings menu (Figma `1497-9949`); omit desktop-only items reachable elsewhere (keep Debug)
- [ ] Sheet contents per updated Figma: Grid ID + copy, Default Grid toggle, Publish Template,
      Duplicate Grid, Transfer Grid, Grid Gravity / Dark Mode toggles, Delete Grid
- [ ] Filterable via the `/GRID` command input (typing narrows the settings list)
- [ ] **Note:** the Mobile 2.0 opt-out is intentionally *not* here — it lives in the app-level menu
      drawer (Account), since early access is an account preference, not a per-grid setting

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
