# Mobile 2.0 — Early Access Implementation Plan

Status: **in progress — Phase 1 (early-access plumbing) complete; UI build not yet started.**

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
4. **"Mobile" = touch-primary device **and** a small viewport** (grid `sm` breakpoint, derived from
   the existing responsive grid layout utilities). Both conditions must hold for the chrome to show.
5. **Add-a-Tile list behavior.** Backspacing the type filter (e.g. "Link") shows the full list of
   tile types. Searching a term (e.g. "youtube") surfaces every matching subtype (both the YouTube
   Link subtype and the YouTube Embed subtype).
6. **"N times used" counts are scoped to the current grid.**
7. **`/TILE` input** uses a rotating, typed-then-backspaced placeholder cycling through:
   `paste a URL`, `paste embed code`, `type to filter/search`, `paste text or md`, `paste files`,
   `paste videos/images`, `paste color values`. Pasting a supported payload may show additional UI,
   but in most cases pressing ENTER creates the tile on the grid canvas. More payload types will be
   added later.
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

### Phase 2 — Shared mobile chrome foundation ⬜ NOT STARTED

- [ ] Extract the reusable `MobileCommandBar` pattern (shared by the tile carousel and grid settings)
- [ ] Wire `isMobile2` into the app shell so chrome swaps behind the gate
- [ ] Audit design tokens needed for the new chrome; reuse existing tokens, flag any new ones

### Phase 3 — AppBar + Menu drawer ⬜ NOT STARTED

- [ ] Redesigned top `AppBar`: GridMenu button, editable grid title, Undo (replaces Layout Title +
      Undo-redo-wrapper on mobile)
- [ ] Consolidated Menu drawer merging LeftNavBar, grid-stats/analytics, and the user menu
      (Home, Analytics, Recent layouts, Discord support, Account); Debug retained for developers

### Phase 4 — Mobile GridToolbar (bottom pill) ⬜ NOT STARTED

- [ ] Bottom-center pill: AddTile, GridSettings, Preview, divider, Share
- [ ] Reconcile with existing `GridToolbar` / `bottom-left-buttons`

### Phase 5 — Add-a-Tile carousel + `/TILE` input ⬜ NOT STARTED

- [ ] Tile carousel (Figma `1497-9533`)
- [ ] `/TILE` input with rotating typed placeholder + smart paste → tile on ENTER
- [ ] Tile-type filter/search (full list on empty; matching subtypes on search)
- [ ] Per-grid "N times used" counts

### Phase 6 — Grid Settings sheet ⬜ NOT STARTED

- [ ] Grid Settings menu (Figma `1497-9949`); omit desktop-only items reachable elsewhere (keep Debug)

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
