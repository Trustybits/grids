<!--
  MobileTileArt.vue

  The animated artwork on an Add-a-Tile card (Figma "Animated icons" 1933-555).
  Successor to the static wireframes in MobileTileThumbnail: the same abstract
  mock of what a tile type looks like once it is on the grid, but each one now
  assembles itself — Text writes its heading and body lines under a swooping
  pencil, Chat posts its messages in order, Image raises two ridges behind a
  rising sun, Map unfolds and drops its pin.

  Playback is deliberately not ambient. The artwork rests fully drawn and only
  animates while `active`, which the carousel passes for the centered card, so
  the loop starts when the user navigates to a tile type rather than ten
  timelines running at once behind a drag.

  Geometry is transcribed from Figma's 150x150 tile in Figma pixels, and `--u`
  converts one of those into a hundredth of the rendered box (container query
  units) — so every coordinate below reads exactly as it does in the file while
  the artwork still scales to whatever size the card is drawn at.

  Colors follow MobileTileThumbnail's convention rather than Figma's literals:
  the greys are `currentColor` at two ink levels (Figma's #222 / #333 on the
  #0f0f0f card is precisely what those opacities already reproduce) so the
  artwork tracks the theme, while the accent is Figma's `color/primary/default`
  — a real hue in both themes, and one no project token maps to yet.

  Every animated node is a wrapper plus a leaf: the wrapper owns the timeline
  (opacity, transform, width) and the leaf owns the ink level, so an animated
  opacity multiplies with a static one instead of overwriting it. Where Figma
  eased two tracks on one node differently, the wrapper takes one and the leaf
  the other; where the two curves were near-identical they are merged onto a
  single transform, since CSS animates transform as one property.
-->
<template>
  <div
    class="mta"
    :class="[`mta--${typeId}`, { 'mta--playing': active }]"
    aria-hidden="true"
  >
    <!-- ── Text · Profile ──────────────────────────────────────────────────
         Both lay out the same heading and three body lines on the same
         timings; only the glyph above them differs. -->
    <template v-if="typeId === 'text' || typeId === 'profile'">
      <span class="mta-el mta-heading"><span class="mta-leaf mta-fillA" /></span>
      <span class="mta-el mta-line mta-line--1"><span class="mta-leaf mta-fill1" /></span>
      <span class="mta-el mta-line mta-line--2"><span class="mta-leaf mta-fill1" /></span>
      <span class="mta-el mta-line mta-line--3"><span class="mta-leaf mta-fill1" /></span>

      <!-- Pencil: travels in from the left, then turns a full circle as it
           settles over the heading it has just drawn. -->
      <span v-if="typeId === 'text'" class="mta-el mta-text__pencil">
        <span class="mta-text__spin">
          <svg
            class="mta-text__pencil-svg mta-art2"
            viewBox="0 0 55.9861 20"
            fill="none"
            preserveAspectRatio="none"
          >
            <path
              d="M9.7265 0.839748C10.5478 0.292189 11.5129 0 12.5 0H50.9861C53.7475 0 55.9861 2.23858 55.9861 5V15C55.9861 17.7614 53.7475 20 50.9861 20H12.5C11.5129 20 10.5478 19.7078 9.7265 19.1603L2.2265 14.1602C-0.742169 12.1811 -0.742164 7.81886 2.2265 5.83975L9.7265 0.839748Z"
              fill="currentColor"
            />
          </svg>
        </span>
      </span>

      <!-- Gallery mark: the two vectors pop from nothing about their own
           centers, which is why each carries the scale rather than the group. -->
      <template v-if="typeId === 'profile'">
        <span class="mta-el mta-profile__frame">
          <span class="mta-profile__pop mta-art2">
            <svg viewBox="0 0 32.4997 32.4996" fill="none" preserveAspectRatio="none">
              <path
                d="M32.4997 17.3835C32.4972 19.7716 32.479 21.8014 32.3433 23.4669C32.1859 25.3997 31.8632 27.0146 31.1408 28.3559C30.8223 28.9474 30.4309 29.4773 29.9543 29.9539C28.6016 31.3064 26.8783 31.9192 24.6945 32.2128C22.5607 32.4996 19.8261 32.4996 16.3368 32.4996H16.1632C12.6738 32.4996 9.93925 32.4996 7.80561 32.2128C5.6217 31.9192 3.89841 31.3064 2.54579 29.9539C1.34665 28.7546 0.727399 27.2622 0.398093 25.4107C0.0746041 23.592 0.0154215 21.3292 0.00312022 18.5192C2.20011e-07 17.8046 2.44578e-07 17.0486 2.44578e-07 16.2511V16.1628C-1.60054e-05 12.6735 -3.21083e-05 9.93886 0.286829 7.80522C0.58045 5.62131 1.19317 3.89802 2.54579 2.5454C3.89841 1.19278 5.6217 0.580061 7.80561 0.286439C9.70305 0.0313307 12.1444 0.0031044 15.1157 6.54778e-07C15.7419 -0.000665595 16.25 0.507195 16.25 1.13332C16.25 1.75947 15.7417 2.26681 15.1156 2.26748C12.1022 2.27066 9.8597 2.29811 8.10773 2.53365C6.17526 2.79347 5.01022 3.28762 4.14911 4.14872C3.28801 5.00983 2.79386 6.17487 2.53404 8.10734C2.26985 10.0724 2.26744 12.6546 2.26744 16.2496C2.26744 16.6887 2.26744 17.1131 2.26796 17.5243L3.78131 16.2002C5.15881 14.9948 7.23491 15.064 8.52917 16.3582L15.0137 22.8427C16.0526 23.8816 17.6878 24.0231 18.8898 23.1784L19.3406 22.8616C21.0702 21.6461 23.4104 21.787 24.9818 23.2012L29.2604 27.052C29.691 26.1475 29.9468 24.9591 30.0833 23.2828C30.212 21.7033 30.2297 19.7848 30.2321 17.3837C30.2328 16.7576 30.7401 16.2496 31.3662 16.2496C31.9923 16.2496 32.5003 16.7574 32.4997 17.3835Z"
                fill="currentColor"
              />
            </svg>
          </span>
        </span>
        <span class="mta-el mta-profile__badge">
          <span class="mta-profile__pop mta-art2">
            <svg viewBox="0 0 14.625 14.625" fill="none" preserveAspectRatio="none">
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M7.3125 14.625C3.86539 14.625 2.14175 14.625 1.07088 13.5541C6.78003e-07 12.4832 0 10.7596 0 7.3125C0 3.86535 6.78003e-07 2.14178 1.07088 1.07089C2.14175 -9.68575e-08 3.86539 0 7.3125 0C10.7596 0 12.4832 -9.68575e-08 13.5541 1.07089C14.625 2.14178 14.625 3.86535 14.625 7.3125C14.625 10.7596 14.625 12.4832 13.5541 13.5541C12.4832 14.625 10.7596 14.625 7.3125 14.625ZM10.9072 3.7179C11.531 4.34179 11.531 5.3533 10.9072 5.97717L10.8131 6.07116C10.7224 6.16184 10.5958 6.20292 10.4696 6.18026C10.3901 6.16601 10.2741 6.13961 10.1354 6.09154C9.85855 5.99542 9.49488 5.81393 9.15298 5.47206C8.81108 5.13019 8.62956 4.76652 8.53352 4.48949C8.48542 4.35095 8.45894 4.23486 8.4448 4.15547C8.42205 4.02924 8.46316 3.90257 8.55384 3.81189L8.64776 3.7179C9.27176 3.09403 10.2832 3.09403 10.9072 3.7179ZM7.06875 9.81549C6.83426 10.05 6.7171 10.1672 6.58775 10.268C6.43533 10.387 6.27039 10.4889 6.0957 10.5721C5.94782 10.6426 5.79053 10.6951 5.47593 10.7999L3.81712 11.3529C3.66226 11.4045 3.49164 11.3642 3.37626 11.2488C3.26089 11.1334 3.22059 10.9628 3.2721 10.8079L3.82509 9.14909C3.9299 8.83451 3.98239 8.67722 4.05291 8.52924C4.13611 8.35466 4.238 8.18968 4.35695 8.03719C4.45786 7.90793 4.57502 7.79069 4.80951 7.55625L7.73256 4.63314C7.80325 4.56246 7.92496 4.5948 7.95779 4.68923C8.07739 5.03427 8.30212 5.48309 8.72202 5.90294C9.14192 6.32279 9.59075 6.54755 9.93574 6.66725C10.0301 6.70001 10.0625 6.82173 9.9918 6.8924L7.06875 9.81549Z"
                fill="currentColor"
              />
            </svg>
          </span>
        </span>
      </template>
    </template>

    <!-- ── Chat ────────────────────────────────────────────────────────────
         The three bubbles share one rise; their phase offsets are delays, so
         the conversation posts itself in Figma's order (1 → 3 → 2). -->
    <template v-else-if="typeId === 'chat'">
      <span class="mta-el mta-chat__msg mta-chat__msg--1"><span class="mta-leaf mta-fillA" /></span>
      <span class="mta-el mta-chat__msg mta-chat__msg--2"><span class="mta-leaf mta-fill2" /></span>
      <span class="mta-el mta-chat__msg mta-chat__msg--3"><span class="mta-leaf mta-fill1" /></span>
      <span class="mta-el mta-chat__box"><span class="mta-leaf mta-fill1" /></span>
      <!-- The send arrow sits outside Figma's timeline: it never animates. -->
      <span class="mta-el mta-chat__send mta-art1">
        <svg viewBox="0 0 21.5107 21.5107" fill="none" preserveAspectRatio="none">
          <path
            d="M4.03097 18.6739L18.8283 12.0751C20.0147 11.546 20.0147 9.96464 18.8283 9.43556L4.03097 2.83668C2.69029 2.2388 1.29966 3.56641 1.96374 4.81022L4.78883 10.1016C5.00855 10.5132 5.00856 10.9975 4.78883 11.4091L1.96374 16.7004C1.29967 17.9443 2.69029 19.2719 4.03097 18.6739Z"
            fill="currentColor"
          />
        </svg>
      </span>
    </template>

    <!-- ── Image ───────────────────────────────────────────────────────────
         Both ridges climb in from below the card's bottom edge, which is why
         the root clips. -->
    <template v-else-if="typeId === 'image'">
      <span class="mta-el mta-image__bg">
        <span class="mta-image__lift">
          <span class="mta-leaf mta-art1">
            <svg viewBox="0 0 96.0761 81.8164" fill="none" preserveAspectRatio="none">
              <path
                d="M93.1684 64.7868C99.4113 71.1031 94.937 81.8164 86.0561 81.8164H10C4.47715 81.8164 0 77.3392 0 71.8164V24.9585C0 22.3064 1.05357 19.7628 2.92893 17.8875L17.8875 2.92893C21.8089 -0.992468 28.1724 -0.973862 32.0708 2.9704L93.1684 64.7868Z"
                fill="currentColor"
              />
            </svg>
          </span>
        </span>
      </span>
      <span class="mta-el mta-image__fg">
        <span class="mta-image__lift">
          <span class="mta-leaf mta-art2">
            <svg viewBox="0 0 82.1635 53.2768" fill="none" preserveAspectRatio="none">
              <path
                d="M82.1635 43.2768V20.0156C82.1635 17.0162 80.8172 14.1753 78.4959 12.276L66.2546 2.26043C62.6809 -0.663538 57.5698 -0.760447 53.8878 2.02594L2.78952 40.6949C-2.56253 44.7451 0.301799 53.2768 7.01361 53.2768H72.1635C77.6863 53.2768 82.1635 48.7996 82.1635 43.2768Z"
                fill="currentColor"
              />
            </svg>
          </span>
        </span>
      </span>
      <span class="mta-el mta-image__sun"><span class="mta-leaf mta-fillA" /></span>
    </template>

    <!-- ── Document ────────────────────────────────────────────────────────
         The page drops in, the tab slides on from the left and pulses once,
         and the lines type in from the right. -->
    <template v-else-if="typeId === 'document'">
      <span class="mta-el mta-doc__page">
        <span class="mta-leaf mta-art1">
          <svg viewBox="0 0 85 100" fill="none" preserveAspectRatio="none">
            <path
              d="M2.5 52V85C2.5 91.9036 8.09644 97.5 15 97.5H70C76.9036 97.5 82.5 91.9036 82.5 85V31.1777C82.5 27.8625 81.183 24.683 78.8388 22.3388L62.6612 6.16117C60.317 3.81696 57.1375 2.5 53.8223 2.5H13C7.20101 2.5 2.5 7.20101 2.5 13"
              stroke="currentColor"
              stroke-width="5"
              stroke-linecap="round"
            />
          </svg>
        </span>
      </span>
      <span class="mta-el mta-doc__tab" />
      <span class="mta-el mta-doc__line mta-doc__line--1"><span class="mta-leaf mta-fill2" /></span>
      <span class="mta-el mta-doc__line mta-doc__line--2"><span class="mta-leaf mta-fill2" /></span>
      <span class="mta-el mta-doc__line mta-doc__line--3"><span class="mta-leaf mta-fill2" /></span>
    </template>

    <!-- ── Link ────────────────────────────────────────────────────────────
         The two halves of the chain arrive from opposite directions and meet. -->
    <template v-else-if="typeId === 'link'">
      <span class="mta-el mta-link__half mta-link__half--top">
        <span class="mta-link__slide">
          <span class="mta-link__tilt mta-artA">
            <svg viewBox="0 0 31.1151 24.9802" fill="none" preserveAspectRatio="none">
              <path
                d="M12.4901 22.9802C6.69658 22.9802 2 18.2836 2 12.4901C2 6.69658 6.69658 2 12.4901 2L19.3748 2C24.3789 2 27.5215 6.70954 29.1146 10.6922"
                stroke="currentColor"
                stroke-width="4"
                stroke-linecap="round"
              />
            </svg>
          </span>
        </span>
      </span>
      <span class="mta-el mta-link__half mta-link__half--bottom">
        <span class="mta-link__slide">
          <span class="mta-link__tilt mta-artA">
            <svg viewBox="0 0 31.1151 24.9802" fill="none" preserveAspectRatio="none">
              <path
                d="M18.625 2C24.4185 2 29.1151 6.69658 29.1151 12.4901C29.1151 18.2836 24.4185 22.9802 18.625 22.9802H11.7403C6.73622 22.9802 3.59359 18.2707 2.00053 14.288"
                stroke="currentColor"
                stroke-width="4"
                stroke-linecap="round"
              />
            </svg>
          </span>
        </span>
      </span>
      <span class="mta-el mta-link__desc mta-link__desc--1"><span class="mta-leaf mta-fill1" /></span>
      <span class="mta-el mta-link__desc mta-link__desc--2"><span class="mta-leaf mta-fill1" /></span>
    </template>

    <!-- ── Embed ───────────────────────────────────────────────────────────
         The laptop unfolds from a squashed sliver, then the code bubble pops
         above it with an overshoot. -->
    <template v-else-if="typeId === 'embed'">
      <span class="mta-el mta-embed__laptop mta-art2">
        <svg viewBox="0 0 61 61" fill="none" preserveAspectRatio="none">
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M2.54167 51.4433C2.54167 50.3766 3.41498 49.5117 4.49224 49.5117H56.5079C57.585 49.5117 58.4583 50.3766 58.4583 51.4433C58.4583 52.5101 57.585 53.375 56.5079 53.375H4.49224C3.41498 53.375 2.54167 52.5101 2.54167 51.4433Z"
            fill="currentColor"
          />
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M9.37827 9.8881C7.09303 12.1512 7.09303 15.7936 7.09303 23.0783V35.9562C7.09303 40.8126 7.09303 43.2409 8.61653 44.7496C10.14 46.2583 12.5921 46.2583 17.4961 46.2583H43.5039C48.4078 46.2583 50.86 46.2583 52.3835 44.7496C53.907 43.2409 53.907 40.8126 53.907 35.9562V23.0783C53.907 15.7936 53.907 12.1512 51.6218 9.8881C49.3365 7.625 45.6585 7.625 38.3024 7.625H22.6977C15.3416 7.625 11.6635 7.625 9.37827 9.8881ZM20.7471 38.5317C20.7471 37.4649 21.6204 36.6 22.6977 36.6H38.3024C39.3796 36.6 40.2529 37.4649 40.2529 38.5317C40.2529 39.5984 39.3796 40.4633 38.3024 40.4633H22.6977C21.6204 40.4633 20.7471 39.5984 20.7471 38.5317Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span class="mta-el mta-embed__code">
        <span class="mta-embed__pop mta-artA">
          <svg viewBox="0 0 37 37" fill="none" preserveAspectRatio="none">
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M20.1753 32.9727L21.0111 31.5607C21.6592 30.4655 21.9834 29.9179 22.504 29.6151C23.0246 29.3123 23.68 29.3011 24.991 29.2786C26.9264 29.2451 28.1402 29.1266 29.1582 28.7049C31.047 27.9225 32.5475 26.422 33.3299 24.5332C33.9167 23.1167 33.9167 21.3208 33.9167 17.7292V16.1875C33.9167 11.141 33.9167 8.61768 32.7808 6.76408C32.1451 5.72688 31.2732 4.85483 30.2359 4.21923C28.3822 3.08333 25.859 3.08333 20.8125 3.08333H16.1875C11.141 3.08333 8.61769 3.08333 6.76408 4.21923C5.72688 4.85483 4.85483 5.72688 4.21923 6.76408C3.08333 8.61768 3.08333 11.141 3.08333 16.1875V17.7292C3.08333 21.3208 3.08333 23.1167 3.67009 24.5332C4.45244 26.422 5.95305 27.9225 7.84181 28.7049C8.85979 29.1266 10.0736 29.2451 12.0089 29.2786C13.3199 29.3011 13.9753 29.3123 14.496 29.6151C15.0166 29.918 15.3407 30.4655 15.9889 31.5607L16.8247 32.9727C17.5696 34.2312 19.4304 34.2312 20.1753 32.9727ZM23.0783 11.253C23.5298 10.8015 24.2618 10.8015 24.7134 11.253L25.0347 11.5742C26.0141 12.5536 26.8309 13.3704 27.392 14.1059C27.9845 14.8823 28.4 15.7026 28.4 16.6956C28.4 17.6886 27.9845 18.5089 27.392 19.2853C26.8309 20.0209 26.0141 20.8376 25.0347 21.817L24.7134 22.1382C24.2618 22.5897 23.5298 22.5897 23.0783 22.1382C22.6267 21.6866 22.6267 20.9546 23.0783 20.5031L23.3427 20.2385C24.3936 19.1876 25.0979 18.48 25.5536 17.8826C25.989 17.312 26.0875 16.9798 26.0875 16.6956C26.0875 16.4115 25.989 16.0793 25.5536 15.5087C25.0979 14.9113 24.3936 14.2036 23.3427 13.1527L23.0783 12.8882C22.6267 12.4367 22.6267 11.7046 23.0783 11.253ZM21.6117 9.54925C21.777 8.93245 21.411 8.29842 20.7942 8.13315C20.1773 7.96787 19.5432 8.33393 19.378 8.95075L15.3879 23.842C15.2226 24.4588 15.5886 25.0929 16.2054 25.2582C16.8222 25.4235 17.4563 25.0575 17.6216 24.4407L21.6117 9.54925ZM13.9218 11.253C14.3733 11.7046 14.3733 12.4367 13.9218 12.8882L13.6573 13.1527C12.6064 14.2036 11.9022 14.9113 11.4464 15.5087C11.011 16.0793 10.9126 16.4115 10.9126 16.6956C10.9126 16.9798 11.011 17.312 11.4464 17.8826C11.9022 18.48 12.6064 19.1876 13.6573 20.2385L13.9218 20.5031C14.3733 20.9546 14.3733 21.6866 13.9218 22.1382C13.4702 22.5897 12.7381 22.5897 12.2866 22.1382L12.0221 21.8736L11.9654 21.817C10.9859 20.8376 10.1691 20.0209 9.60791 19.2853C9.01556 18.5089 8.60008 17.6886 8.60008 16.6956C8.60008 15.7026 9.01556 14.8823 9.60791 14.1059C10.1691 13.3704 10.9859 12.5536 11.9654 11.5742L12.0221 11.5175L12.2866 11.253C12.7381 10.8015 13.4702 10.8015 13.9218 11.253Z"
              fill="currentColor"
            />
          </svg>
        </span>
      </span>
    </template>

    <!-- ── Map ─────────────────────────────────────────────────────────────
         The map unfolds along its width, then the pin drops in and overshoots. -->
    <template v-else-if="typeId === 'map'">
      <span class="mta-el mta-map__sheet">
        <span class="mta-map__unfold mta-art2">
          <svg viewBox="0 0 111 111" fill="none" preserveAspectRatio="none">
            <path
              d="M11.2677 23.8042C9.25 26.101 9.25 30.0388 9.25 37.9145V81.3584C9.25 86.9361 9.25 89.725 10.705 91.8247C12.16 93.924 14.7038 94.806 19.7915 96.57L25.7771 98.6448C29.0189 99.7691 31.5134 100.634 33.6068 101.19C34.9724 101.554 36.2292 100.482 36.2292 99.0689V28.9992C36.2292 27.848 35.3796 26.8764 34.2637 26.5933C32.4635 26.1367 30.2996 25.3865 27.3338 24.3583C20.15 21.8678 16.5581 20.6226 13.8251 21.8871C12.8548 22.3361 11.9841 22.9887 11.2677 23.8042Z"
              fill="currentColor"
            />
            <path
              d="M58.3694 16.0994L51.2654 21.0251C48.6952 22.807 46.8119 24.1129 45.2036 25.044C44.4414 25.4852 43.9375 26.2835 43.9375 27.1642V96.7564C43.9375 98.4704 45.7134 99.5402 47.1574 98.6166C48.7068 97.6254 50.4814 96.3952 52.6306 94.9045L59.7346 89.9789C62.3043 88.1974 64.1881 86.8913 65.7962 85.9603C66.5588 85.519 67.0625 84.7207 67.0625 83.8401V14.2479C67.0625 12.5339 65.2865 11.4638 63.8426 12.3874C62.2932 13.3788 60.5186 14.6092 58.3694 16.0994Z"
              fill="currentColor"
            />
            <path
              d="M91.2087 14.4343L85.223 12.3592C81.9809 11.2352 79.4866 10.3705 77.3934 9.81365C76.0276 9.4504 74.771 10.5223 74.771 11.9355V82.005C74.771 83.1561 75.6206 84.1278 76.7362 84.4109C78.5367 84.8674 80.7007 85.6175 83.6662 86.6457C90.8498 89.1362 94.442 90.3818 97.1749 89.1173C98.1453 88.6682 99.0157 88.0156 99.7321 87.1997C101.75 84.9034 101.75 80.9652 101.75 73.0898V29.6457C101.75 24.068 101.75 21.2792 100.295 19.1796C98.8399 17.08 96.2962 16.1981 91.2087 14.4343Z"
              fill="currentColor"
            />
          </svg>
        </span>
      </span>
      <span class="mta-el mta-map__pin">
        <span class="mta-map__tilt mta-artA">
          <svg viewBox="0 0 19 24" fill="none" preserveAspectRatio="none">
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M9.5 24C6.175 20.64 0 14.9019 0 9.6C0 4.29807 4.25329 0 9.5 0C14.7467 0 19 4.29807 19 9.6C19 14.9019 12.825 20.64 9.5 24ZM9.5 4.8C12.1234 4.8 14.25 6.94903 14.25 9.6C14.25 12.251 12.1234 14.4 9.5 14.4C6.87665 14.4 4.75 12.251 4.75 9.6C4.75 6.94903 6.87665 4.8 9.5 4.8Z"
              fill="currentColor"
            />
          </svg>
        </span>
      </span>
    </template>

    <!-- ── Campfire ────────────────────────────────────────────────────────
         The flame catches — squashing, overshooting, settling — and the two
         logs scale open into their X underneath. -->
    <template v-else-if="typeId === 'campfire'">
      <span class="mta-el mta-fire__flame">
        <span class="mta-fire__flicker mta-artA">
          <svg viewBox="0 0 36 40.5" fill="none" preserveAspectRatio="none">
            <path
              d="M18 40.5C27.9412 40.5 36 32.9488 36 23.634C36 15.2158 31.4222 8.63575 28.2645 5.49981C27.6788 4.91814 26.7037 5.17514 26.3727 5.92399C24.692 9.72653 21.1901 15.2012 16.7144 15.2012C13.9444 15.5719 9.71298 13.204 13.1284 1.45954C13.4359 0.402035 12.3069 -0.447452 11.4445 0.259633C6.53535 4.28482 0 12.4007 0 23.634C0 32.9488 8.05887 40.5 18 40.5Z"
              fill="currentColor"
            />
          </svg>
        </span>
      </span>
      <span class="mta-el mta-fire__log mta-fire__log--1">
        <span class="mta-fire__tilt"><span class="mta-fire__bar mta-fill1" /></span>
      </span>
      <span class="mta-el mta-fire__log mta-fire__log--2">
        <span class="mta-fire__tilt"><span class="mta-fire__bar mta-fill1" /></span>
      </span>
    </template>
  </div>
</template>

<script lang="ts">
/**
 * Tile types this component has artwork for. Anything else keeps the static
 * wireframe in MobileTileThumbnail — `smart_text` has no design in the Figma
 * set, and a new tile type still gets a card without needing one here first.
 */
export const ANIMATED_TILE_ART_TYPES: ReadonlySet<string> = new Set([
  "text",
  "profile",
  "chat",
  "image",
  "document",
  "link",
  "embed",
  "map",
  "campfire",
]);

export const hasAnimatedTileArt = (typeId: string): boolean =>
  ANIMATED_TILE_ART_TYPES.has(typeId);
</script>

<script setup lang="ts">
withDefaults(
  defineProps<{
    typeId: string;
    /** Run the loop. The carousel passes this for the centered card only. */
    active?: boolean;
  }>(),
  { active: false },
);
</script>

<style lang="scss" scoped>
// ── Frame ───────────────────────────────────────────────────────────────────

.mta {
  position: absolute;
  inset: 0;
  // Several icons animate in from outside Figma's 150x150 tile.
  overflow: hidden;
  // Matches the card the artwork sits on, so nothing shows in its rounded
  // corners while a shape is still travelling.
  border-radius: var(--radius-lg);
  color: var(--color-text-primary);
  // 1cqw is a hundredth of the box, so one Figma pixel of a 150 tile is
  // 100/150 of that. Every coordinate below is written in Figma pixels.
  container-type: inline-size;
  --u: 0.666667cqw;
  // Figma variable `color/primary/default`. No project token maps to it yet;
  // move this into tokens.scss if the Figma primary lands app-wide.
  --mta-accent: #908bff;
  --mta-accent-soft: #ebe8ff;
  --mta-dur: 2s;
}

// Text and Profile run a longer loop than the rest.
.mta--text,
.mta--profile {
  --mta-dur: 2.5s;
}

.mta-el {
  position: absolute;
}

.mta-leaf {
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

// ── Ink ─────────────────────────────────────────────────────────────────────
// Two levels, reproducing Figma's #222 / #333 on the #0f0f0f card while
// following the theme. Kept identical to MobileTileThumbnail so the animated
// and static artwork cannot drift apart.

.mta-fill1 {
  background: currentColor;
  opacity: 0.1;
}

.mta-fill2 {
  background: currentColor;
  opacity: 0.18;
}

.mta-fillA {
  background: var(--mta-accent);
}

// Leaves carrying an SVG rather than a block colour.
.mta-art1,
.mta-art2,
.mta-artA {
  position: absolute;
  inset: 0;
  line-height: 0;

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
}

.mta-art1 {
  opacity: 0.1;
}

.mta-art2 {
  opacity: 0.18;
}

.mta-artA {
  color: var(--mta-accent);
}

// ── Text · Profile ──────────────────────────────────────────────────────────

.mta-heading {
  left: calc(19 * var(--u));
  top: calc(74 * var(--u));
  width: calc(50 * var(--u));
  height: calc(10 * var(--u));
  border-radius: calc(10 * var(--u));
}

.mta-line {
  left: calc(19 * var(--u));
  height: calc(5 * var(--u));
  border-radius: calc(10 * var(--u));
}

.mta-line--1 {
  top: calc(94 * var(--u));
  width: calc(95 * var(--u));
}

.mta-line--2 {
  top: calc(109 * var(--u));
  width: calc(70 * var(--u));
}

.mta-line--3 {
  top: calc(124 * var(--u));
  width: calc(35 * var(--u));
}

.mta-text__pencil {
  left: calc(72 * var(--u));
  top: calc(19 * var(--u));
  width: calc(56.569 * var(--u));
  height: calc(56.569 * var(--u));
  transform: translate(calc(3.094 * var(--u)), calc(0.331 * var(--u)));
}

.mta-text__spin {
  position: absolute;
  inset: 0;
  // 315deg rather than -45: the pencil arrives by turning a full circle, and
  // the resting frame is the end of that turn.
  transform: rotate(315deg);
}

.mta-text__pencil-svg {
  position: absolute;
  left: calc(2.2984 * var(--u));
  top: calc(18.2845 * var(--u));
  width: calc(55.9861 * var(--u));
  height: calc(20 * var(--u));
}

.mta-profile__frame {
  left: calc(22.2487 * var(--u));
  top: calc(27.2487 * var(--u));
  width: calc(32.4997 * var(--u));
  height: calc(32.4997 * var(--u));
}

.mta-profile__badge {
  left: calc(40.126 * var(--u));
  top: calc(27.2487 * var(--u));
  width: calc(14.625 * var(--u));
  height: calc(14.625 * var(--u));
}

.mta-profile__pop {
  position: absolute;
  inset: 0;
  line-height: 0;
  opacity: 0.18;

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
}

// ── Chat ────────────────────────────────────────────────────────────────────

.mta-chat__msg {
  height: calc(20 * var(--u));
}

.mta-chat__msg--1 {
  left: calc(19 * var(--u));
  top: calc(19 * var(--u));
  width: calc(60 * var(--u));
  border-radius: calc(10 * var(--u)) calc(10 * var(--u)) calc(10 * var(--u))
    calc(3 * var(--u));
}

.mta-chat__msg--2 {
  left: calc(19 * var(--u));
  top: calc(75 * var(--u));
  width: calc(50 * var(--u));
  border-radius: calc(10 * var(--u)) calc(10 * var(--u)) calc(10 * var(--u))
    calc(3 * var(--u));
}

.mta-chat__msg--3 {
  left: calc(79 * var(--u));
  top: calc(54 * var(--u));
  width: calc(50 * var(--u));
  border-radius: calc(10 * var(--u)) calc(10 * var(--u)) calc(3 * var(--u))
    calc(10 * var(--u));
}

.mta-chat__box {
  left: calc(19 * var(--u));
  top: calc(110 * var(--u));
  width: calc(85 * var(--u));
  height: calc(17 * var(--u));
  border-radius: calc(8 * var(--u));
}

.mta-chat__send {
  left: calc(109.205 * var(--u));
  top: calc(103.825 * var(--u));
  width: calc(21.5107 * var(--u));
  height: calc(21.5107 * var(--u));
}

// ── Image ───────────────────────────────────────────────────────────────────

.mta-image__bg {
  left: calc(19 * var(--u));
  top: calc(47.18 * var(--u));
  width: calc(96.0761 * var(--u));
  height: calc(81.8164 * var(--u));
}

.mta-image__fg {
  left: calc(46.834 * var(--u));
  top: calc(75.72 * var(--u));
  width: calc(82.1635 * var(--u));
  height: calc(53.2768 * var(--u));
}

.mta-image__lift {
  position: absolute;
  inset: 0;
}

.mta-image__sun {
  left: calc(89 * var(--u));
  top: calc(24 * var(--u));
  width: calc(35 * var(--u));
  height: calc(35 * var(--u));
  border-radius: 50%;
}

// ── Document ────────────────────────────────────────────────────────────────

.mta-doc__page {
  left: calc(33 * var(--u));
  top: calc(25.5 * var(--u));
  width: calc(85 * var(--u));
  height: calc(100 * var(--u));
}

.mta-doc__tab {
  left: calc(27 * var(--u));
  top: calc(44.5 * var(--u));
  width: calc(50 * var(--u));
  height: calc(25 * var(--u));
  border-radius: calc(5 * var(--u));
  background: var(--mta-accent);
}

.mta-doc__line {
  left: calc(45 * var(--u));
  height: calc(5 * var(--u));
  border-radius: calc(5 * var(--u));
}

.mta-doc__line--1 {
  top: calc(83.5 * var(--u));
  width: calc(55 * var(--u));
}

.mta-doc__line--2 {
  top: calc(93.5 * var(--u));
  width: calc(45 * var(--u));
}

.mta-doc__line--3 {
  top: calc(103.5 * var(--u));
  width: calc(25 * var(--u));
}

// ── Link ────────────────────────────────────────────────────────────────────

.mta-link__half {
  width: calc(34.008 * var(--u));
  height: calc(34.008 * var(--u));
}

.mta-link__half--top {
  left: calc(51 * var(--u));
  top: calc(37 * var(--u));
}

.mta-link__half--bottom {
  left: calc(63.48 * var(--u));
  top: calc(49.48 * var(--u));
}

.mta-link__slide {
  position: absolute;
  inset: 0;
}

.mta-link__tilt {
  position: absolute;
  left: calc(1.4455 * var(--u));
  top: calc(4.514 * var(--u));
  width: calc(31.1151 * var(--u));
  height: calc(24.9802 * var(--u));
  // Both halves are the same arc, turned onto the diagonal.
  transform: rotate(45deg);
}

.mta-link__desc {
  height: calc(5 * var(--u));
  border-radius: calc(10 * var(--u));
}

.mta-link__desc--1 {
  left: calc(29 * var(--u));
  top: calc(93 * var(--u));
  width: calc(90 * var(--u));
}

.mta-link__desc--2 {
  left: calc(49 * var(--u));
  top: calc(108 * var(--u));
  width: calc(50 * var(--u));
}

// ── Embed ───────────────────────────────────────────────────────────────────

.mta-embed__laptop {
  left: calc(44 * var(--u));
  top: calc(60 * var(--u));
  width: calc(61 * var(--u));
  height: calc(61 * var(--u));
}

.mta-embed__code {
  left: calc(57 * var(--u));
  top: calc(28 * var(--u));
  width: calc(37 * var(--u));
  height: calc(37 * var(--u));
}

.mta-embed__pop {
  position: absolute;
  inset: 0;
  line-height: 0;
}

// ── Map ─────────────────────────────────────────────────────────────────────

.mta-map__sheet {
  left: calc(19 * var(--u));
  top: calc(18 * var(--u));
  width: calc(111 * var(--u));
  height: calc(111 * var(--u));
}

.mta-map__unfold {
  position: absolute;
  inset: 0;
}

.mta-map__pin {
  left: calc(87 * var(--u));
  top: calc(24 * var(--u));
  width: calc(30.579 * var(--u));
  height: calc(30.081 * var(--u));
}

.mta-map__tilt {
  position: absolute;
  left: calc(5.7895 * var(--u));
  top: calc(3.0405 * var(--u));
  width: calc(19 * var(--u));
  height: calc(24 * var(--u));
  transform: rotate(-49.04deg);
}

// ── Campfire ────────────────────────────────────────────────────────────────

.mta-fire__flame {
  left: calc(56 * var(--u));
  top: calc(37.75 * var(--u));
  width: calc(36 * var(--u));
  height: calc(40.5 * var(--u));
}

.mta-fire__flicker {
  position: absolute;
  inset: 0;
  line-height: 0;
}

.mta-fire__log {
  left: calc(52 * var(--u));
  top: calc(85 * var(--u));
  width: calc(43.657 * var(--u));
  height: calc(16.891 * var(--u));
}

.mta-fire__tilt {
  position: absolute;
  inset: 0;
}

.mta-fire__bar {
  position: absolute;
  left: calc(0.006 * var(--u));
  top: calc(5.5495 * var(--u));
  width: calc(43.645 * var(--u));
  height: calc(5.792 * var(--u));
  border-radius: calc(10 * var(--u));
}

// The logs cross: 165deg and 15deg read as a -15/+15 pair once the bar's own
// symmetry is taken into account.
.mta-fire__log--1 .mta-fire__tilt {
  transform: rotate(165deg);
}

.mta-fire__log--2 .mta-fire__tilt {
  transform: rotate(15deg);
}

// ── Timelines ───────────────────────────────────────────────────────────────
// Every keyframe percentage is Figma's normalised time for that icon's own
// loop, so they read straight across from the motion spec. Everything above
// this line is the resting frame — the last frame of the loop — which is what
// an inactive card shows.

@keyframes mta-heading {
  0% {
    opacity: 0;
    width: calc(1 * var(--u));
    animation-timing-function: cubic-bezier(0, 0, 0.35, 1);
  }
  12% {
    opacity: 1;
  }
  18% {
    width: calc(50 * var(--u));
  }
  100% {
    opacity: 1;
    width: calc(50 * var(--u));
  }
}

@keyframes mta-line-1 {
  0%,
  17.16% {
    opacity: 0;
    width: calc(1 * var(--u));
    animation-timing-function: cubic-bezier(0, 0, 0.35, 1);
  }
  24.96% {
    opacity: 1;
  }
  34.32% {
    width: calc(95 * var(--u));
  }
  100% {
    opacity: 1;
    width: calc(95 * var(--u));
  }
}

@keyframes mta-line-2 {
  0%,
  30.58% {
    opacity: 0;
    width: calc(1 * var(--u));
    animation-timing-function: cubic-bezier(0, 0, 0.35, 1);
  }
  36.95% {
    opacity: 1;
  }
  43.32% {
    width: calc(70 * var(--u));
  }
  100% {
    opacity: 1;
    width: calc(70 * var(--u));
  }
}

@keyframes mta-line-3 {
  0%,
  44.32% {
    opacity: 0;
    width: calc(1 * var(--u));
    animation-timing-function: cubic-bezier(0, 0, 0.35, 1);
  }
  49.24% {
    opacity: 1;
  }
  52.94% {
    width: calc(35 * var(--u));
  }
  100% {
    opacity: 1;
    width: calc(35 * var(--u));
  }
}

@keyframes mta-text-pencil {
  0% {
    transform: translate(calc(-55 * var(--u)), calc(10 * var(--u)));
    animation-timing-function: cubic-bezier(0, 0, 0.35, 1);
  }
  18% {
    transform: translate(calc(-5 * var(--u)), calc(10 * var(--u)));
  }
  36%,
  100% {
    transform: translate(calc(3.094 * var(--u)), calc(0.331 * var(--u)));
  }
}

@keyframes mta-text-spin {
  0%,
  18% {
    transform: rotate(-45deg);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  36%,
  100% {
    transform: rotate(315deg);
  }
}

@keyframes mta-profile-fade {
  0% {
    opacity: 0;
    animation-timing-function: cubic-bezier(0, 0, 0.35, 1);
  }
  14%,
  100% {
    opacity: 1;
  }
}

@keyframes mta-profile-pop {
  0% {
    transform: scale(0);
    animation-timing-function: cubic-bezier(0.45, 1.45, 0.8, 1);
  }
  20%,
  100% {
    transform: scale(1);
  }
}

@keyframes mta-chat-rise {
  0% {
    opacity: 0;
    transform: translateY(calc(8 * var(--u)));
    animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
  }
  15%,
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes mta-chat-box {
  0% {
    opacity: 0;
    transform: translateY(calc(12 * var(--u)));
    animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
  }
  12.5%,
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes mta-image-bg-fade {
  0%,
  7.5% {
    opacity: 0;
  }
  12.5%,
  100% {
    opacity: 1;
  }
}

@keyframes mta-image-bg-lift {
  0%,
  7.5% {
    transform: translateY(calc(130 * var(--u))) scale(0.95);
    animation-timing-function: cubic-bezier(0.6, 0, 0.2, 1);
  }
  22.5%,
  100% {
    transform: translateY(0) scale(1);
  }
}

@keyframes mta-image-fg-fade {
  0%,
  25% {
    opacity: 0;
  }
  29%,
  100% {
    opacity: 1;
  }
}

@keyframes mta-image-fg-lift {
  0%,
  25% {
    transform: translateY(calc(110 * var(--u))) scale(0.95);
    animation-timing-function: cubic-bezier(0.7, 0, 0.15, 1);
  }
  39%,
  100% {
    transform: translateY(0) scale(1);
  }
}

@keyframes mta-image-sun {
  0%,
  15% {
    opacity: 0;
    transform: translate(calc(60 * var(--u)), calc(-70 * var(--u))) scale(0.4);
    animation-timing-function: cubic-bezier(0.7, 0, 0.15, 1);
  }
  17.5% {
    opacity: 1;
  }
  27.5% {
    transform: translate(0, 0) scale(1);
  }
  100% {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
}

@keyframes mta-doc-page {
  0% {
    opacity: 0;
    transform: translateY(calc(40 * var(--u)));
    animation-timing-function: cubic-bezier(0, 0, 0.35, 1);
  }
  22.5% {
    opacity: 1;
  }
  25% {
    transform: translateY(0);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

// The tab slides on, then pulses once to the soft tint and back.
@keyframes mta-doc-tab {
  0%,
  10% {
    opacity: 0;
    transform: translateX(calc(-35 * var(--u)));
    background: var(--mta-accent);
    animation-timing-function: cubic-bezier(0, 0, 0.35, 1);
  }
  27.5% {
    opacity: 1;
  }
  30% {
    transform: translateX(0);
  }
  45% {
    background: var(--mta-accent);
    animation-timing-function: cubic-bezier(0, 0, 0.1, 1);
  }
  55% {
    background: var(--mta-accent-soft);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  77.5%,
  100% {
    opacity: 1;
    transform: translateX(0);
    background: var(--mta-accent);
  }
}

@keyframes mta-doc-line {
  0% {
    opacity: 0;
    transform: translateX(calc(30 * var(--u)));
    animation-timing-function: cubic-bezier(0, 0, 0.35, 1);
  }
  17.5%,
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes mta-link-top-fade {
  0% {
    opacity: 0;
    animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  }
  20%,
  100% {
    opacity: 1;
  }
}

@keyframes mta-link-top-slide {
  0% {
    transform: translateY(calc(-20 * var(--u)));
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  32.5%,
  100% {
    transform: translateY(0);
  }
}

@keyframes mta-link-bottom-fade {
  0%,
  2.5% {
    opacity: 0;
    animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  }
  22.5%,
  100% {
    opacity: 1;
  }
}

@keyframes mta-link-bottom-slide {
  0%,
  2.5% {
    transform: translateY(calc(20 * var(--u)));
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  35%,
  100% {
    transform: translateY(0);
  }
}

@keyframes mta-link-desc {
  0% {
    opacity: 0;
    transform: translateY(calc(8 * var(--u)));
    animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  }
  22.5%,
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes mta-embed-laptop {
  0% {
    transform: translateY(calc(51.85 * var(--u))) scaleY(0.15);
    animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  }
  35%,
  100% {
    transform: translateY(0) scaleY(1);
  }
}

@keyframes mta-embed-code {
  0%,
  25% {
    opacity: 0;
    transform: translateY(calc(15 * var(--u)));
    animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  }
  45% {
    opacity: 1;
  }
  55% {
    transform: translateY(0);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes mta-embed-pop {
  0%,
  25% {
    transform: scale(0);
    animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  50%,
  100% {
    transform: scale(1);
  }
}

@keyframes mta-map-fade {
  0% {
    opacity: 0.3;
    animation-timing-function: cubic-bezier(0, 0, 0.35, 1);
  }
  20%,
  100% {
    opacity: 1;
  }
}

@keyframes mta-map-unfold {
  0% {
    transform: rotate(3deg) scale(0.05, 0.9);
    animation-timing-function: cubic-bezier(0, 0, 0.35, 1);
  }
  35%,
  100% {
    transform: rotate(0deg) scale(1, 1);
  }
}

@keyframes mta-map-pin {
  0%,
  37.5% {
    opacity: 0;
    transform: translateY(calc(-10 * var(--u))) scale(0);
    animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  42.5% {
    opacity: 1;
  }
  52.5% {
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes mta-fire-flame {
  0% {
    opacity: 0;
    transform: translateY(calc(10 * var(--u)));
    animation-timing-function: ease-out;
  }
  7.5% {
    opacity: 0.3;
  }
  25% {
    opacity: 0.85;
  }
  35% {
    transform: translateY(calc(-3 * var(--u)));
  }
  40% {
    opacity: 1;
  }
  65%,
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

// The catch: squash, overshoot, settle.
@keyframes mta-fire-flicker {
  0% {
    transform: scale(0.1, 0.1);
    animation-timing-function: ease-out;
  }
  17.5% {
    transform: scale(0.4, 0.6);
    animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  }
  35% {
    transform: scale(1.12, 1.12);
    animation-timing-function: ease-in-out;
  }
  50% {
    transform: scale(0.95, 0.95);
    animation-timing-function: ease-out;
  }
  65%,
  100% {
    transform: scale(1, 1);
  }
}

@keyframes mta-fire-log-1 {
  0%,
  25% {
    opacity: 0;
    transform: scale(0.6);
    animation-timing-function: ease-out;
  }
  50% {
    opacity: 1;
  }
  55% {
    transform: scale(1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes mta-fire-log-2 {
  0%,
  32.5% {
    opacity: 0;
    transform: scale(0.6);
    animation-timing-function: ease-out;
  }
  60% {
    opacity: 1;
  }
  65% {
    transform: scale(1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

// ── Playback ────────────────────────────────────────────────────────────────
// Only the active card runs. `backwards` holds the first frame through a
// delay, so a bubble that has not been posted yet is not briefly visible.

.mta--playing {
  .mta-heading {
    animation: mta-heading var(--mta-dur) linear infinite backwards;
  }

  .mta-line--1 {
    animation: mta-line-1 var(--mta-dur) linear infinite backwards;
  }

  .mta-line--2 {
    animation: mta-line-2 var(--mta-dur) linear infinite backwards;
  }

  .mta-line--3 {
    animation: mta-line-3 var(--mta-dur) linear infinite backwards;
  }

  .mta-text__pencil {
    animation: mta-text-pencil var(--mta-dur) linear infinite backwards;
  }

  .mta-text__spin {
    animation: mta-text-spin var(--mta-dur) linear infinite backwards;
  }

  .mta-profile__frame,
  .mta-profile__badge {
    animation: mta-profile-fade var(--mta-dur) linear infinite backwards;
  }

  .mta-profile__pop {
    animation: mta-profile-pop var(--mta-dur) linear infinite backwards;
  }

  // The bubbles share one rise; Figma's stagger becomes a phase offset.
  .mta-chat__msg {
    animation: mta-chat-rise var(--mta-dur) linear infinite backwards;
  }

  .mta-chat__msg--1 {
    animation-delay: calc(var(--mta-dur) * 0.1);
  }

  .mta-chat__msg--3 {
    animation-delay: calc(var(--mta-dur) * 0.35);
  }

  .mta-chat__msg--2 {
    animation-delay: calc(var(--mta-dur) * 0.6);
  }

  .mta-chat__box {
    animation: mta-chat-box var(--mta-dur) linear infinite backwards;
    animation-delay: calc(var(--mta-dur) * 0.05);
  }

  .mta-image__bg {
    animation: mta-image-bg-fade var(--mta-dur) linear infinite backwards;
  }

  .mta-image__bg .mta-image__lift {
    animation: mta-image-bg-lift var(--mta-dur) linear infinite backwards;
  }

  .mta-image__fg {
    animation: mta-image-fg-fade var(--mta-dur) linear infinite backwards;
  }

  .mta-image__fg .mta-image__lift {
    animation: mta-image-fg-lift var(--mta-dur) linear infinite backwards;
  }

  .mta-image__sun {
    animation: mta-image-sun var(--mta-dur) linear infinite backwards;
  }

  .mta-doc__page {
    animation: mta-doc-page var(--mta-dur) linear infinite backwards;
  }

  .mta-doc__tab {
    animation: mta-doc-tab var(--mta-dur) linear infinite backwards;
  }

  .mta-doc__line {
    animation: mta-doc-line var(--mta-dur) linear infinite backwards;
  }

  .mta-doc__line--1 {
    animation-delay: calc(var(--mta-dur) * 0.2);
  }

  .mta-doc__line--2 {
    animation-delay: calc(var(--mta-dur) * 0.25);
  }

  .mta-doc__line--3 {
    animation-delay: calc(var(--mta-dur) * 0.3);
  }

  .mta-link__half--top {
    animation: mta-link-top-fade var(--mta-dur) linear infinite backwards;
  }

  .mta-link__half--top .mta-link__slide {
    animation: mta-link-top-slide var(--mta-dur) linear infinite backwards;
  }

  .mta-link__half--bottom {
    animation: mta-link-bottom-fade var(--mta-dur) linear infinite backwards;
  }

  .mta-link__half--bottom .mta-link__slide {
    animation: mta-link-bottom-slide var(--mta-dur) linear infinite backwards;
  }

  .mta-link__desc {
    animation: mta-link-desc var(--mta-dur) linear infinite backwards;
  }

  .mta-link__desc--1 {
    animation-delay: calc(var(--mta-dur) * 0.25);
  }

  .mta-link__desc--2 {
    animation-delay: calc(var(--mta-dur) * 0.325);
  }

  .mta-embed__laptop {
    animation: mta-embed-laptop var(--mta-dur) linear infinite backwards;
  }

  .mta-embed__code {
    animation: mta-embed-code var(--mta-dur) linear infinite backwards;
  }

  .mta-embed__pop {
    animation: mta-embed-pop var(--mta-dur) linear infinite backwards;
  }

  .mta-map__sheet {
    animation: mta-map-fade var(--mta-dur) linear infinite backwards;
  }

  .mta-map__unfold {
    animation: mta-map-unfold var(--mta-dur) linear infinite backwards;
  }

  .mta-map__pin {
    animation: mta-map-pin var(--mta-dur) linear infinite backwards;
  }

  .mta-fire__flame {
    animation: mta-fire-flame var(--mta-dur) linear infinite backwards;
  }

  .mta-fire__flicker {
    animation: mta-fire-flicker var(--mta-dur) linear infinite backwards;
  }

  .mta-fire__log--1 {
    animation: mta-fire-log-1 var(--mta-dur) linear infinite backwards;
  }

  .mta-fire__log--2 {
    animation: mta-fire-log-2 var(--mta-dur) linear infinite backwards;
  }
}

// The artwork already reads at rest, so reduced motion simply keeps it there.
@media (prefers-reduced-motion: reduce) {
  .mta--playing * {
    animation: none !important;
  }
}
</style>
