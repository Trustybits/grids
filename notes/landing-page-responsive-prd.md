# Landing Page — Responsive Pass (PRD)

Status: **not started.** An interim one-line fix has shipped (see "Already shipped" below); this
document covers the real responsive work that replaces it.

Owner: TBD · Tracking issue: [#200](https://github.com/Trustybits/grids/issues/200)

## Problem

`/` (the marketing landing page) is authored desktop-only. `LandingPage.vue` and
`styles/marketing-page.scss` carry **no mobile breakpoints** — the only `@media` rules in the whole
marketing surface live in `LandingPageGridEmbed.vue`, `MarketingFooter.vue`, and
`MarketingNavBar.vue`. Everything else assumes a wide viewport.

On a phone the page did not merely reflow badly, it was **amputated**: the hero rendered 1120px wide
inside a 375px viewport and `.mkt` clipped the overflow with `overflow-x: clip`, so the headline,
subtitle, and URL pill were cut off with no way to scroll to them.

### Root cause (measured, not inferred)

`.mkt__body` is a column flex container. `.mkt__hero` had `max-width: 1120px; margin: 0 auto` and
**no `width`**, so it sized to fit-content — which is floored by its min-content width.
`LandingShowcaseMarquee`, nested *inside* the hero, carries a **~5364px** marquee track, and that
set the floor. The hero was pinned at its 1120px max-width on every viewport narrower than that.

Confirmed by isolation: `display: none` on `.mkt__landing-showcase` collapsed the hero to 375px
immediately. Containing the marquee at the `-row` level did **not** help (hero stayed 1120px), so the
containment has to sit on the marquee root or the showcase section — not yet isolated.

### Not the cause

`LandingPageGridEmbed` was initially suspected and is **fine**. On a fresh load at 375px it degrades
correctly: `is-static`, `--sm` frame, 343px device, "Phone" chip active. An earlier reading that
suggested otherwise was an artifact of resizing the pane after mount — `viewportWidth` only refreshes
on the `resize` event.

## Already shipped (interim)

`.mkt__hero { width: 100% }` in `styles/marketing-page.scss`, matching the `.mkt__section` rule
directly below it, which already had it. An explicit width removes the min-content floor.

Verified at 375px: hero 375px, `document.scrollWidth` 375px, hero title right edge 347px, **zero
cut-off elements**. Verified unregressed at 1425px: hero 1120px and centred, `--lg` frame at 1040px,
no horizontal overflow.

**This stops the clipping; it does not make the page mobile-friendly.** Type scale, spacing, and
section layout are still desktop values on a phone — legible but cramped. It also masks rather than
fixes the marquee containment defect. Both are this PRD's job.

## Goals

1. The landing page reads as *designed for* a phone, not as a desktop page squeezed into one.
2. No element ever exceeds the viewport; no reliance on `overflow-x: clip` to hide layout mistakes.
3. The marquee's intrinsic width is contained at its source so it can never floor an ancestor again.
4. Touch targets, type scale, and section rhythm appropriate to small screens.

## Non-goals

- Redesigning the landing page's content, copy, or visual identity.
- The `LandingPageGridEmbed` scroll-jack behaviour — it already has its own mobile path.
- Mobile 2.0 app chrome. That is a separate effort (`notes/mobile-2-early-access-plan.md`); this PRD
  covers only the marketing surface. Reuse its design language where it applies.

## Scope

| Area | Work |
| --- | --- |
| `styles/marketing-page.scss` | Add the mobile breakpoints the file currently lacks. `--mkt-section-x` is a fixed `40px` and should step down (~16px) on small screens; `--mkt-section-y` (`128px`) likewise. |
| Hero | Type scale already uses `clamp()` so it is partly ready; verify against real device widths. Re-check the URL pill and CTA at 320px. |
| `LandingShowcaseMarquee` | Contain the 5364px track properly (`min-width: 0` + `overflow: hidden` on the correct ancestor). Once contained, the `width: 100%` interim on `.mkt__hero` can likely be reconsidered. |
| Sections below the hero | Audit each for fixed widths and multi-column layouts that need stacking. |
| `MarketingNavBar` / `MarketingFooter` | Already have `max-width: 800px` rules; confirm they hold at 320–430px. |

## Acceptance criteria

- At 320px, 375px, 390px, and 430px: `document.scrollWidth === clientWidth`, and no element's
  right edge exceeds the viewport (excluding the marquee track, which is intentionally wide and
  must be clipped by a containing ancestor).
- The page renders correctly with `overflow-x: clip` removed from `.mkt` — i.e. nothing depends on
  clipping to look right.
- No regression at 1024px, 1440px, and 1920px.
- Verified on a real device, not only an emulated viewport.

## Separate but related — desktop embed scroll

Not part of this PRD's mobile work; recorded here because it surfaced in the same investigation and
is also a landing-page defect.

At `lg`, `.grid-jack__viewport` measures `scrollHeight` **683px** against `clientHeight` **562px** —
**121px of real overflow** — so the desktop device frame scrolls even though all demo tiles appear
visible. The declared geometry predicts it should fit: frame inner width 1008px,
`DEMO_GRID_DIMENSIONS.lg` 1524×786 → scale 0.661 → ~520px scaled height against ~564px available.
So the rendered content is ~163px taller than `scrollSizerStyle` accounts for. Leading hypothesis is
that the scroll sizer under-reports actual rendered height (the scaled grid element is sized
1524×786 with a `transform: scale()`, which does not affect layout). **Not isolated — needs a
devtools pass.**

Also noted: `DEMO_GRID_DIMENSIONS.lg` declares **12 columns**, but the demo grid's tiles only span
**11** (`max(x + w) = 11`). That renders the grid ~7% smaller than the frame with a dead column on
the right. It does not cause the scrollbar (it makes content smaller, not taller) but should be
corrected.

## Open questions

- Does the landing page want a distinct mobile *composition* (reordered/omitted sections), or the
  same sections responsively restyled? The former is more work but likely the better result.
- Should the showcase marquee appear on phones at all, or be replaced with a static set of cards?
- Does the hero's device-frame scroll-jack earn its runway on a phone, or should the static phone
  view be the permanent mobile treatment?
