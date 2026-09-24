# Unified Text Editor — Implementation Plan

Status: **planning.** No code yet. Branch `claude/unified-text-editor`, stacked on PR #238 (text tile
caret-on-first-click and drag-select fixes). It gets rebased onto `main` once #238 merges.

The goal is one editable-text component that behaves the same wherever a tile has editable text. It
replaces the separate `text` and `smart_text` tiles. Each place that uses it gets a *profile* that
decides which `/commands`, formatting controls and preset styles are available. Text formatting moves
into a Notion-style toolbar that floats over the text being edited. Tile-level controls stay in the
tile toolbar.

## Product decisions (confirmed with the maintainer)

1. **One tile type.** New content is stored as `text`. Existing `smart_text` tiles are read and
   rendered as `text`, with no bulk Firestore migration. Stop creating `smart_text` anywhere.
2. **First pass covers the text tile only.** Other tiles move over one at a time once it is solid
   (see *Later phases*).
3. **Formatting follows Notion.** A change applies to the selection if there is one. With just a
   caret, it applies from the caret onward (stored marks), so the next typed text picks it up. A
   picked text color overrides the automatic contrast color. With no picked color, text falls back
   to the automatic color computed from the tile background (`useColorPicker`).
4. **Auto size scales everything by one factor.** Relative sizes (heading vs body) are kept, and the
   whole tile's content scales to fit. Pretext does the measuring (see *Auto size*).
5. **The size menu is FigJam-style.** Presets Small / Medium / Large / Larger, then **Auto** at the
   end of the list, then a manual size input below it. Auto size is computed at view time for each
   screen size, so the same tile fits on desktop, tablet and mobile.
6. **Mobile.** The formatting bar is docked above the on-screen keyboard instead of floating. The
   Mobile 2.0 `/EDIT` sheet keeps only tile-level controls.
7. **`/link` and `/button` get inline inputs** instead of `window.prompt()`.
8. **Rollout.** Behind a new feature flag that also requires Early Access enrollment (see *Gating*).
9. **Alignment is per block.** Notion has no left/center/right alignment, so this follows Google
   Docs or Craft instead. It applies to every block the selection touches and lives in the floating
   toolbar. The existing tile-level `textAlign` becomes the default for blocks with no alignment of
   their own, so current tiles look the same. **Vertical** alignment stays per tile, in the tile
   toolbar.
10. **Size menu vs Auto.** Auto is a tile-level switch (`autoSize: true`). While it's on, the
    presets still set relative sizes, which Auto then scales. The manual input shows the rendered
    size, and typing a number turns Auto off. Picking a preset or typing a size applies to the
    selection or caret (decision 3).
11. **Marks.** The floating toolbar offers bold, italic, **underline, strikethrough and inline
    code**.

## Gating

A new flag, `editor-unified-text`, in `FEATURE_FLAGS` under *Editor features*. It is active only when
the user is enrolled in `beta-early-access` **and** the flag is on. This is the same pattern
`beta-desktop-2` uses in `useMobileExperience`: the flag acts as a kill switch that affects only
enrolled users.

**The flag only controls the editing UI, not rendering.** Visitors aren't enrolled, but they still
have to see anything an enrolled owner made. There is also a data-loss risk: today's `TextContent.vue`
schema has no table, image, link or smart-button nodes. When Tiptap loads a document containing a
node type it doesn't know, it doesn't just drop that node. It warns and replaces the **entire
document with an empty one**. This was checked with the text tile's extension set and a smart-text
document holding a paragraph plus a table: the result was
`{"type":"doc","content":[{"type":"paragraph"}]}`. The next save would then write the empty tile
back.
So **Phase 0 moves every text tile to the full shared schema for everyone**, before any tile can
contain the new content. The flag then only turns on the new editing affordances: the floating
toolbar, the slash menu on `text` tiles, auto size and the new size menu.

## Current state (survey, 2026-09-24)

- `TextContent` and `SmartTextContent` (`packages/contracts/src/types/TileContent.ts`) differ only
  by `verticalAlign`. `text` is a stringified Tiptap doc, and an empty doc is stored as `""`. The
  fields `font`, `fontSize`, `isBold`, `isItalic`, `textType` and `color` are legacy and unused:
  styling lives as marks inside the doc.
- **SmartTextContent.vue** (about 1,480 lines):
  - Custom slash menu (no Tiptap suggestion plugin) with `/h1 /h2 /bullet /numbered /todo /quote
    /divider /image /link /button /table`.
  - A table toolbar that is teleported to the page body.
  - `DragHandle`, `ResizableImage`, `SmartButton` and `Link` extensions.
  - No vertical align.
- **TextContent.vue**: base extensions only. It has vertical align and the overflow and
  center-lock logic in `utils/textTileAlign.ts`.
- **Toolbars**: the two tiles have identical toolbars (`registries/tiles/text.ts`,
  `smartText.ts`). Font family, font size, bold, italic and tile link live under the "More" menu
  (`registries/tileToolbar/textButtons.ts`).
- **Creation paths**:
  - Desktop toolbar: "Smart Text" is gated by `editor-smart-text`.
  - Mobile `useTileCreation`: also gated.
  - **Paste creates `smart_text` without checking the flag** (`useDragAndPaste.ts:120`).
  - The suggestion tile and the starter-grid welcome tile create `text`.
- **Server and contracts**:
  - `GridStorageReferences` and `GridStorageRewrite` only scan **`smart_text`** docs for inline
    images, as does `utils_storageMigration.ts`.
  - The OG renderer relies on the `.text-container` class.
  - Suggestion-action mapping: `utils_gridTransferAcceptance.ts`.
- **No component tests** exist for either text component.

## Architecture

- **`components/text/RichText.vue`**: the one editor component. It takes a **profile** plus the
  content (a Tiptap JSON string, or a plain string for plain-storage profiles). It owns:
  - Editing-lifecycle wiring, reusing `useEditingLifecycle`, including the #238 caret-at-click and
    drag-select behavior.
  - Autosave, content sync, the slash menu, the floating toolbar, and auto size.
- **`text/profiles.ts`**: a `TextEditorProfile` describes:
  - `blocks`: which block nodes are allowed (paragraph, headings, lists, to-do, quote, divider,
    table, image).
  - `marks`: which marks and styles are allowed (family, size, color, bold, italic, …).
  - `commands`: which slash commands are available, derived from `blocks` plus a per-profile
    deny-list.
  - `singleLine`: whether Enter is blocked and the document is kept to one paragraph.
  - `storage`: `"tiptap-json"` or `"plain"`.
  - `presets`: named styles for fields with fixed looks, such as a link title.

  The text tile uses the `full` profile. Later tiles each get their own.
- **`text/extensions.ts`**: a single function builds the Tiptap extension list from a profile. The
  full schema is always *registered* for rendering (the data-loss point above). Profiles only
  restrict what can be *inserted*.
- **Slash menu**: extracted from SmartTextContent into a composable plus a menu component. It keeps
  the current detection and keyboard handling. There is currently a duplicate list in
  `SmartTextHelpers.SLASH_COMMAND_DEFS`, which gets folded into the single command registry.
- **Floating toolbar**: a teleported toolbar anchored to the selection rectangle, or to the caret
  when nothing is selected, using `view.coordsAtPos`. It holds font family, the size menu, marks,
  text color (with an "Auto" swatch), per-block alignment and link. It hides while typing and comes
  back on selection change or a pause, like Notion.
- **Tile toolbar** keeps tile-level controls: resize presets, border, background color, vertical
  align and tile link. Font family and font size leave the "More" menu when the flag is on, which
  also resolves #231.

## Auto size

- **Model:** the tile stores `autoSize?: boolean`. When it's on, the component computes one scale
  factor `k`, and the rendered size of every run is its stored size × `k`. `k` is never stored. It
  is computed for the tile's current size at the current screen size.
- **Measuring:**
  - Each block (paragraph, heading, list item) is prepared once with pretext's
    `prepareRichInline`. Each text run carries its own font string, built from its marks at the
    base size.
  - A binary search over `k` only re-runs the cheap `layout` step. Block margins and list indents
    are added to get the total height, which is compared with the tile's inner box.
  - Width changes (resize, breakpoint) re-run `layout` only. Content or font changes re-run
    `prepare`.
- **Fallback:** if a tile contains a table or image, which pretext can't measure, it falls back to
  the same binary search using DOM measurement (`scrollHeight`), throttled with rAF.
- **Fonts:** measuring waits for `document.fonts.ready` and for the specific families in the doc,
  because pretext's canvas measurements are only accurate once the font has loaded.
- **Bounds:** clamp `k` to a readable minimum and a sensible maximum, and snap it to avoid
  sub-pixel jitter. If content still overflows at the minimum, fall back to the existing scroll or
  clip behavior in `textTileAlign`.
- **Package:** add `@chenglou/pretext` as a dependency of `apps/web`. The OG renderer already uses it
  from esm.sh.

## Phases

### Phase 0: Foundations (no visible change, not gated) ✅
- [x] Shared schema builder `extensions/tiptap/richTextExtensions.ts`, used by both
      `TextContent.vue` and `SmartTextContent.vue`. A text tile now loads smart-text docs intact.
      `extensions/tiptap/__tests__/richTextExtensions.test.ts` checks that every node smart text can
      insert survives a load/save/reload round trip.
- [x] Contracts: `GridStorageReferences` and `GridStorageRewrite` scan `text` as well as
      `smart_text` for inline images. The reference location keeps its original name,
      `tile.smartText.inlineImage`. The same applies to `utils_storageMigration.ts`. Tests added in
      all three suites.
- [x] Audited every `TEXT` / `SMART_TEXT` branch. OG category, suggestion-action mapping (client
      and server) and `copyContent` already treat both alike. The only gap was the `Tile.vue` debug
      meta. The shared `isRichTextContentType()` helper is deferred to Phase 1, where the renderer
      and flag logic will use it.
- Note: the root `.gitignore` rule `extensions/` also matches `apps/web/src/extensions/`, so new
  files there need `git add -f`, as the existing Tiptap extensions were added.
- Known gap until Phase 1: a text tile holding tables, images or buttons renders them with default
  styles. Their CSS still lives in SmartTextContent.vue. The content is safe; the styling gets
  unified with the component.

### Phase 1: `RichText` component, text tile only (gated)
- [ ] Build `RichText.vue` with the `full` profile, merging TextContent and SmartTextContent. Keep
      `.text-container` (the OG renderer depends on it), vertical align and overflow behavior.
- [ ] Render `text` and `smart_text` tiles through it, with the old components as the fallback when
      the flag is off.
- [ ] Creation (flag on): the toolbar, mobile carousel, paste and suggestion tile all create `text`.
      Hide "Smart Text" in the add-tile UI.
- [ ] Slash menu available on `text` tiles. `/link` and `/button` use inline inputs.
- [ ] Component tests (none exist today): editing entry, caret-at-click, slash commands, autosave,
      and no content lost between the old and new component.

### Phase 2: Floating toolbar (desktop, gated)
- [ ] Anchored toolbar: font family, size menu (presets, Auto, manual input), marks, text color
      with Auto, per-block alignment, link.
- [ ] Changes apply to the selection, or from the caret onward (stored marks).
- [ ] Take font and size out of the tile toolbar's "More" menu when the flag is on.

### Phase 3: Mobile (gated)
- [ ] A formatting bar docked above the keyboard, positioned with `visualViewport`.
- [ ] The `/EDIT` sheet keeps only tile-level controls: size, border, background, vertical align
      and link.
- [ ] Check on real iOS and Android devices: the native selection menu, keyboard behavior, and
      swipe-to-scroll over a tile being edited.

### Phase 4: Auto size (gated)
- [ ] Pretext measuring and scale-factor search, with the DOM fallback, as described above.
- [ ] Wire the Auto option into the size menu, and store `autoSize` on the tile.
- [ ] Performance check on a grid with many text tiles.

### Phase 5: GA and cleanup
- [ ] Remove the `editor-unified-text` and `editor-smart-text` flags, SmartTextContent.vue, the
      old TextContent.vue, `registries/tiles/smartText.ts` and the smart text thumbnail.
- [ ] Keep reading `smart_text` as `text` permanently (older grids and exports still contain it).

## Later phases: other tiles, one at a time

Each tile adopts `RichText` with its own profile. It keeps that tile's existing hover, selected,
resting and editing styles, and gains caret-at-click and drag-to-select.

| Tile | Fields today | Proposed profile |
|---|---|---|
| Link | title (`<input>` or `<textarea>` depending on layout), description (`<textarea>`), subtitle (`<input>`), plain strings | `link-field`: preset styles per field, limited or no marks, plain storage (no data migration). Keeps the `.tile-field` / `.tile-field-wrap` state styling. |
| Documents | title, description (`DocumentDetailsFields`, the same `.tile-field` styling as link), plain strings | Same `link-field` profile. |
| Profile | name, title, bio: three Tiptap editors with their own editing logic | `heading-line` (single line) for name and title; `bio` has no table or image commands. Moves onto the shared lifecycle. |
| Tile caption (every tile) | `contenteditable` in `TileCaption.vue`, plain string | `caption`: single line, preset style, plain storage. |

**Not in scope:** the chat composer (a visitor message input, not tile content), sliders and filter
checkboxes (music, video, roadmap), and the grid name editor (page chrome, not a tile).
