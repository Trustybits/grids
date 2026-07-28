# Accessibility audit & remediation plan

Status: ⬜ NOT STARTED — this is the plan, nothing below is implemented yet.

Working doc (`notes/`). Conventions that prove out here get promoted to
`docs/contributing/accessibility.md`; see `docs/architecture/repository-layout.md`.

## Why now

Grids has no accessibility tooling of any kind today — no lint plugin, no axe, no Lighthouse
budget, no CI job, and no mention of accessibility anywhere in `docs/`. That means every
accessibility property in the app is there because someone hand-wrote it, and there is nothing
stopping the next change from removing it.

The trigger was a narrow question during Mobile 2.0 (whether the carousel/list view toggle needed an
`aria-live` region — [decided no](./mobile-2-early-access-plan.md)). Answering it surfaced that the
real gaps are elsewhere and are structural, so they are worth a deliberate pass rather than
opportunistic fixes.

**Target: WCAG 2.2 Level AA.** AA is the level referenced by essentially every accessibility
regulation, and A alone leaves out contrast and focus visibility — two of this codebase's actual
problems.

## What automated scanning will and will not do

Worth stating up front so the phases below are not oversold: **automated tools detect roughly a
third of WCAG issues.** They are excellent at "this control has no accessible name" and useless at
"this control's name is wrong", "this focus order is baffling", or "this animation causes nausea".
The scan exists to hold a floor and stop regressions. The manual passes in Phase 5 are where the
real bugs get found.

## Findings already in hand

These came out of a first read of the codebase, before any tooling. They are recorded here so the
baseline scan can be checked against them — if a scan misses these, the scan is misconfigured.

### 1. Modal semantics — one file, every modal (highest impact)

`apps/web/src/components/modal/BaseModal.vue` is the shared primitive behind `PromptModal`,
`TransferGridModal`, `SlugClaimModal`, `OgImageModal`, `FileArchiveModal`, `FloatingInputModal` and
`PendingGridTransfers`. It is a plain `<div>` and is missing every part of the dialog contract:

- no `role="dialog"` / `aria-modal="true"`, so assistive tech does not know a dialog opened
- no accessible name (`aria-labelledby` pointing at each modal's heading)
- no Escape-to-close — the only ways out are the backdrop click and whatever button the slot renders
- focus is never moved into the dialog on open, and never restored to the trigger on close
- no focus trap: Tab walks straight out into the page behind the overlay
- background content is not hidden from assistive tech (`inert` on the app root, or `aria-hidden`)

A keyboard or screen reader user can currently open a modal and be left with focus on the page
behind it, reading content the overlay is visually covering. Fixing the one primitive fixes every
modal, which makes this the best value in the whole plan.

### 2. Focus visibility is actively suppressed

`outline: none` / `outline: 0` appears in **23 files**, while `:focus-visible` appears in only
**8**. So the default focus ring is removed in far more places than it is replaced. Keyboard
navigation through much of the app is currently invisible — WCAG 2.4.7 (Focus Visible) and 2.4.13
(Focus Appearance).

This wants a single tokenized focus ring rather than 23 local fixes. **New design tokens needed**
(flagging per the standing instruction to ask before inventing tokens): something like
`--focus-ring-width`, `--focus-ring-offset`, `--focus-ring-color`, chosen to clear 3:1 against both
themes' surfaces.

### 3. `<html lang="">` is empty

`apps/web/index.html` line 2. A one-character-class fix (`lang="en"`) that currently fails WCAG
3.1.1 for the entire app and leaves screen readers guessing at pronunciation.

### 4. Landmarks and skip link

`<main>` exists only in `AuthPage.vue` and `MarketingLayout.vue`. The two primary app surfaces —
`GridPage` and `DashboardPage` — have no `<main>` landmark, and there is no skip link anywhere.
Screen reader users navigate by landmark first, so this is the difference between jumping to content
and tabbing through the whole app bar every page load.

### 5. Clickable non-interactive elements

At least 8 `@click` handlers on `<div>` / `<span>` / `<li>` / `<p>` across 7 files (`GridSettings`,
`UserMenu`, `MobileMenuDrawer`, `VideoContent`, `MusicContent`, `MobileMenu`,
`DashboardGridCardActions`). Each is unreachable by keyboard and invisible to assistive tech as a
control. This is a floor, not a count — the grep only catches single-line tags.

### 6. Carousel: active option is never announced

`MobileTileCarousel.vue` is a `role="listbox"` of `role="option"` buttons, and the centered card
changes as the user drags or arrows. But focus stays on the track, so `aria-selected` /
`aria-current` flipping is never spoken. The idiomatic fix is `aria-activedescendant` on the track
pointing at the centered option — that is the purpose-built mechanism for "the active option changed
without focus moving", and it is better here than a live region. Related: `role="option"` on a
`<button>` overrides the button role, so the listbox pattern needs reviewing as a whole (roving
tabindex vs `aria-activedescendant`).

### 7. A live region that announces nothing

In `apps/web/src/components/app/MobileImageSwapSheet.vue`:

```vue
<span v-if="loading" class="mis-status" aria-live="polite">
  <SpinnerIcon :size="18" />
</span>
```

Two independent bugs: `v-if` means the region does not exist in the DOM before its content changes
(most screen readers will not announce it), and it contains no text, so there would be nothing to
announce anyway. Needs text, and needs to be always-rendered-then-filled.

### 8. No visually-hidden utility exists

There is no `.sr-only` (or equivalent) anywhere in `src/styles/`. Any text meant for screen readers
only — skip links, live region content, extra button context — has nowhere to live. Needs to be a
shared utility, not a local class, since findings 4, 6 and 7 all want it.

### 9. Icon SVGs are not hidden from the accessibility tree

Only the two badge icons carry `aria-hidden="true"`; the rest of `src/components/icons/` does not.
Not a live bug — a labelled button's `aria-label` wins the name computation — but nested `<svg>` can
be exposed as a graphics object by some assistive tech. Cheap hardening, best done as one sweep.

## Tooling to add

Three layers, because each catches a class the others cannot.

### Layer 1 — `eslint-plugin-vuejs-accessibility` (static, author-time)

Catches template-level mistakes as they are typed: click handlers without keyboard handlers, missing
`alt`, form controls without labels, invalid ARIA attribute/role combinations, `tabindex` misuse.

Note that the current config only extends `pluginVue.configs['flat/essential']`
(`apps/web/eslint.config.js`), which contains **no** accessibility rules — so this is purely
additive. Fits the existing `web-lint` CI job with no new infrastructure.

Ratchet, do not big-bang: land the plugin with its rules as `warn`, and since `lint` runs with
`--max-warnings 0` the initial commit must either fix or explicitly disable each hit. Flip rules to
`error` per-rule as each category reaches zero.

### Layer 2 — `axe-core` in component tests (rendered DOM, jsdom)

Catches what static analysis cannot: computed roles and accessible names on actually-rendered
output, including whatever the component tree assembles at runtime. Slots into the existing Vitest
setup, so a component's a11y assertion sits beside its behavior tests.

Its limits matter: jsdom computes no layout, so **contrast, visibility and focus-order checks do not
work here**. Do not mistake a green axe run in jsdom for a clean component.

### Layer 3 — full-page scan in a real browser

This is the layer that catches contrast, focus order, reflow and reading order. Either
`@axe-core/playwright` driving the built app, or Lighthouse CI with an accessibility budget.

Recommend starting this **manually and locally** against a `npm run build && preview`, once, to size
the problem — before deciding whether it earns a permanent CI job and the browser download that
comes with it. CI currently has no browser-based job at all, so this is the only phase that adds
real infrastructure.

## Phases

### Phase 0 — Baseline, no fixes ⬜

- [ ] Add Layer 1 + Layer 2 tooling, all rules non-blocking
- [ ] Run Layer 3 manually against a production build; save the report
- [ ] Record the failure count per rule/category — this is the number the ratchet works down
- [ ] Confirm the scan reproduces findings 1–9 above; if not, fix the scan config first
- [ ] **Do not fix anything in this phase.** A baseline that moves while you measure it is not one.

### Phase 1 — Quick wins ⬜

Wide reach, low risk, no design decisions:

- [ ] `<html lang="en">` (finding 3)
- [ ] Shared visually-hidden utility in `src/styles/` (finding 8) — unblocks Phases 2 and 4
- [ ] `<main>` landmarks on `GridPage` and `DashboardPage` + a skip link (finding 4)
- [ ] `aria-hidden="true"` sweep across `src/components/icons/` (finding 9)

### Phase 2 — Modal dialog contract ⬜

The single highest-value change (finding 1). One file, every modal inherits it:

- [ ] `role="dialog"` + `aria-modal="true"` + `aria-labelledby` wired to each modal's heading
- [ ] Escape closes (respecting `closeOnBackdrop`'s intent — a modal that ignores Escape should be a
      deliberate opt-out, not the default)
- [ ] Move focus to the dialog on open; restore it to the trigger on close
- [ ] Trap Tab within the dialog
- [ ] `inert` the app root while a modal is open
- [ ] Tests: focus lands inside on open, returns to trigger on close, Tab cycles, Escape closes
- [ ] Audit each consuming modal for a heading to point `aria-labelledby` at

### Phase 3 — Focus visibility ⬜

- [ ] Agree the focus ring design + **new tokens** (finding 2) before touching components
- [ ] Global `:focus-visible` ring
- [ ] Work through the 23 `outline: none` sites, replacing rather than deleting where a custom ring
      was the intent
- [ ] Verify against both themes and every custom background (including image backgrounds, where a
      ring can vanish into a photo)

### Phase 4 — Keyboard operability ⬜

- [ ] Convert clickable `<div>`/`<span>` to real buttons, or give them role + key handlers + tabindex
      (finding 5)
- [ ] Rework the carousel listbox: `aria-activedescendant` vs roving tabindex (finding 6)
- [ ] Fix the non-announcing live region, and review whether any other async surface needs one
      (finding 7)
- [ ] Full keyboard-only traversal of each primary flow, recording anything unreachable

### Phase 5 — Manual passes ⬜

The two-thirds automation misses:

- [ ] Keyboard-only walkthrough: create a grid, add each tile type, edit, share, delete
- [ ] Screen reader smoke test — VoiceOver on iOS (this is where Mobile 2.0 actually ships) and NVDA
      on Windows
- [ ] Contrast audit across both themes, all tile types, and custom/image backgrounds
- [ ] 200% zoom and 320px reflow
- [ ] `prefers-reduced-motion` honored — the Mobile 2.0 carousel and sheet transitions already check
      it; confirm nothing else animates unconditionally

### Phase 6 — Ratchet and document ⬜

- [ ] Flip lint rules from `warn` to `error` per category as each hits zero
- [ ] Decide whether Layer 3 becomes a CI job, based on what Phase 0 found
- [ ] Promote conventions to `docs/contributing/accessibility.md` and cross-link from
      `docs/contributing/code-style.md`: the focus-ring token, when to use a live region vs
      `aria-activedescendant`, the icon-button labelling pattern, the dialog contract
- [ ] Add an accessibility line to `docs/contributing/testing.md`'s expectations by change type

## Relationship to Mobile 2.0

Mobile 2.0 is in flight and touches most of the chrome this plan covers. Accessibility fixes to
mobile chrome should **ride along with those phases** rather than wait for a separate pass, and this
plan must not block Mobile 2.0's GA cutover. Where the two overlap (the carousel listbox, the
image-swap live region), the Mobile 2.0 plan's housekeeping section is the place to schedule it.

## Non-goals

- Not chasing a Lighthouse score. The score is a proxy and optimizing it directly rewards the
  automatable third while ignoring the rest.
- Not adding an accessibility overlay widget. They do not fix underlying markup and are widely
  regarded as harmful.
- No WCAG AAA. Some AAA criteria (7:1 contrast) would force a visual redesign that is not on the
  table.
