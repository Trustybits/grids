const SITE_BASE = "https://grids.so";
const SITE_SHOWCASE = "https://grids.so/showcase";
// ─── Design tokens ────────────────────────────────────────────────────────────
//
// All values are resolved to static strings because email clients strip CSS
// custom properties. Sources:
//
//   apps/web/src/styles/tokens.scss       → app palette, spacing, radii
//   apps/web/src/styles/claude-tokens.scss → marketing brand gradient + fonts
//   apps/web/src/themes/index.ts           → rawColors (contentBg, textPrimary …)
//
// Light-theme app palette  ──────────────────────────────────────────────
//   contentBg    → #FFFEF5       outerBg / url pill background
//   textPrimary  → #33312C       high-emphasis text
//   dark-0-55    → rgba(51,49,44,0.55)   body copy
//   dark-0-34    → rgba(51,49,44,0.34)   muted / footer text
//   dark-0-8     → rgba(51,49,44,0.08)   card border, divider, pill border
//   brand purple → #9f40ff (--grids-brand-purple)
//
// Marketing brand gradient  (135° cyan → blue → indigo → violet → magenta)
//   #8dd8fc  #6da6fd  #838bfb  #a47cf9  #ef6fc4
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  outerBg:    "#FFFEF5",
  cardBg:     "#ffffff",
  cardBorder: "rgba(51,49,44,0.08)",
  textHigh:   "#33312C",
  textMid:    "rgba(51,49,44,0.55)",
  textLow:    "rgba(51,49,44,0.34)",
  divider:    "rgba(51,49,44,0.08)",
  brandPurple: "#9f40ff",
  // Simplified 3-stop gradient works well as a horizontal bar
  gradientBar: "linear-gradient(90deg, #8dd8fc 0%, #838bfb 50%, #ef6fc4 100%)",
} as const;

// Google Fonts @import is stripped by most email clients, so Inter will render
// only where the user already has it installed. The fallback stack is chosen to
// look clean regardless: -apple-system renders San Francisco on Apple devices,
// Segoe UI on Windows, Roboto on Android.
const FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// MarketingNavBar brand word uses Orbitron (see apps/web claude-tokens.scss).
const FONT_BRAND =
  "'Orbitron', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const LOGO_URL = `${SITE_BASE}/grids_logo.png`;
const DISCORD_SUPPORT_URL = "https://discord.gg/5dVU9EPPAY";

// ─── Primitive helpers ────────────────────────────────────────────────────────

function greeting(displayName: string | null): string {
  return displayName ? `Hi ${displayName},` : "Hi there,";
}

/**
 * Table-based pill button. The `<td>` carries the background so it renders
 * in Outlook for Windows (which ignores border-radius but respects bgcolor).
 */
function btn(label: string, href: string): string {
  return `
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:32px 0 0;">
  <tr>
    <td style="border-radius:9999px;background-color:${C.brandPurple};">
      <a href="${href}"
         style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:9999px;letter-spacing:-0.01em;"
      >${label}</a>
    </td>
  </tr>
</table>`.trim();
}

/**
 * 1 px hairline divider as a table row — survives clients that strip <hr>.
 */
function hr(): string {
  return `
<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="margin:28px 0;">
  <tr>
    <td height="1" style="font-size:0;line-height:0;background-color:${C.divider};">&nbsp;</td>
  </tr>
</table>`.trim();
}

/**
 * Landing-page header wordmark: grids_logo.png icon + lowercase "grids" in Orbitron.
 * Matches MarketingNavBar.vue (.mkt__brand-mark + .mkt__brand-word).
 */
function wordmark(): string {
  return `
<table cellpadding="0" cellspacing="0" border="0" role="presentation">
  <tr>
    <td align="center">
      <a href="${SITE_BASE}"
         style="display:inline-block;text-decoration:none;"
      >
        <table cellpadding="0" cellspacing="0" border="0" role="presentation">
          <tr>
            <td valign="middle" style="padding-right:10px;">
              <img src="${LOGO_URL}"
                   width="30" height="30"
                   alt=""
                   style="display:block;width:30px;height:30px;border:0;border-radius:8px;"
              />
            </td>
            <td valign="middle"
                style="font-family:${FONT_BRAND};font-size:20px;font-weight:700;line-height:1;letter-spacing:0.02em;color:${C.textHigh};text-transform:lowercase;"
            >grids</td>
          </tr>
        </table>
      </a>
    </td>
  </tr>
</table>`.trim();
}

function discordSupportLine(): string {
  return `Questions? Reach us in the <a href="${DISCORD_SUPPORT_URL}" style="color:${C.textLow};text-decoration:underline;">support channel on Discord</a>.`;
}

// ─── Shell ────────────────────────────────────────────────────────────────────

/**
 * Wraps arbitrary body HTML in the full branded email chrome:
 *
 *  ┌─ outer (#FFFEF5) ──────────────────────────────┐
 *  │  Grids wordmark (brand purple, centred)         │
 *  │  ┌─ card (white, 24px radius, subtle border) ─┐ │
 *  │  │  ▔▔▔▔ gradient accent strip (4px) ▔▔▔▔▔▔  │ │
 *  │  │  {body}                                     │ │
 *  │  └─────────────────────────────────────────────┘ │
 *  │  footer (muted account context)                  │
 *  └───────────────────────────────────────────────────┘
 *
 * Note: the gradient strip and border-radius degrade gracefully in Outlook
 * for Windows — the email remains fully readable, just without rounded corners
 * or the top strip.
 */
function wrapEmail(
  subject: string,
  body: string,
): { subject: string; html: string } {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${subject}</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap" rel="stylesheet">
  <style>
    /* Reset — kept minimal to avoid fighting email client overrides */
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    img{-ms-interpolation-mode:bicubic;border:0;outline:0;text-decoration:none}
    body{margin:0;padding:0;background-color:${C.outerBg}}
  </style>
</head>
<body style="margin:0;padding:0;background-color:${C.outerBg};">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
         style="background-color:${C.outerBg};padding:40px 16px 56px;">
    <tr>
      <td align="center" valign="top">

        <!-- Wordmark ─────────────────────────────────────── -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
               style="max-width:560px;margin-bottom:16px;">
          <tr>
            <td align="center" style="padding-bottom:16px;">
              ${wordmark()}
            </td>
          </tr>
        </table>

        <!-- Card ─────────────────────────────────────────── -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
               style="max-width:560px;background-color:${C.cardBg};border-radius:24px;border:1px solid ${C.cardBorder};box-shadow:0 2px 8px rgba(51,49,44,0.07);">

          <!-- Gradient accent strip (cyan → indigo → magenta) -->
          <tr>
            <td height="4"
                style="font-size:0;line-height:0;padding:0;background:${C.gradientBar};border-radius:24px 24px 0 0;"
            >&nbsp;</td>
          </tr>

          <!-- Body content -->
          <tr>
            <td style="padding:40px 44px 44px;font-family:${FONT};color:${C.textHigh};">
              ${body}
            </td>
          </tr>

        </table>

        <!-- Footer ───────────────────────────────────────── -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
               style="max-width:560px;margin-top:20px;">
          <tr>
            <td align="center" style="padding:0 16px;">
              <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.textLow};">
                You received this because you have a
                <a href="${SITE_BASE}" style="color:${C.textLow};text-decoration:underline;">grids.so</a>
                account.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;

  return { subject, html };
}

// ─── Welcome ──────────────────────────────────────────────────────────────────

export function buildWelcomeEmail({
  displayName,
}: {
  displayName: string | null;
}): { subject: string; html: string } {
  const body = `
<p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:${C.textMid};">${greeting(displayName)}</p>

<h1 style="margin:0 0 14px;font-size:28px;font-weight:800;letter-spacing:-0.04em;line-height:1.1;color:${C.textHigh};">
  Your canvas is ready.
</h1>

<p style="margin:0 0 12px;font-size:16px;line-height:1.65;color:${C.textMid};">
  Welcome to <a href="${SITE_BASE}" style="color:${C.brandPurple};text-decoration:none;font-weight:600;">grids.so</a> — the place to build a personal page that actually looks like you.
</p>

<p style="margin:0;font-size:16px;line-height:1.65;color:${C.textMid};">
  Claim your URL, drop in some tiles, and share one link that stays in sync as you update.
</p>

${btn("Open your dashboard →", `${SITE_BASE}/dashboard`)}

${hr()}

<p style="margin:0;font-size:13px;line-height:1.6;color:${C.textLow};">
  ${discordSupportLine()}
</p>`.trim();

  return wrapEmail("Welcome to Grids", body);
}

// ─── First grid ───────────────────────────────────────────────────────────────

export function buildFirstGridEmail({
  displayName,
  gridName,
  gridId,
  slug,
}: {
  displayName: string | null;
  gridName: string;
  gridId: string;
  slug: string | null;
}): { subject: string; html: string } {
  const gridUrl = slug
    ? `${SITE_BASE}/${slug}`
    : `${SITE_BASE}/grid/${gridId}`;

  const body = `
<p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:${C.textMid};">${greeting(displayName)}</p>

<h1 style="margin:0 0 14px;font-size:28px;font-weight:800;letter-spacing:-0.04em;line-height:1.1;color:${C.textHigh};">
  ${gridName} is live.
</h1>

<p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:${C.textMid};">
  Your grid is ready to share. Send this link anywhere — it stays up to date every time you edit.
</p>

<!-- URL pill -->
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 0 20px;">
  <tr>
    <td style="background-color:${C.outerBg};border:1px solid ${C.cardBorder};border-radius:9999px;padding:11px 20px;">
      <a href="${gridUrl}"
         style="font-family:${FONT};font-size:14px;font-weight:500;color:${C.brandPurple};text-decoration:none;white-space:nowrap;"
      >${gridUrl}</a>
    </td>
  </tr>
</table>

<p style="margin:0;font-size:15px;line-height:1.65;color:${C.textLow};">
  Add tiles, rearrange, pick a theme — your link never changes.
</p>

${btn("View your grid →", gridUrl)}

${hr()}

<p style="margin:0;font-size:13px;line-height:1.6;color:${C.textLow};">
  Need inspiration? Browse public grids at
  <a href="${SITE_SHOWCASE}" style="color:${C.textLow};text-decoration:underline;">grids.so/showcase</a>.
</p>`.trim();

  return wrapEmail(`${gridName} is live`, body);
}

// ─── Supporter badge ──────────────────────────────────────────────────────────

export function buildSupporterBadgeEmail({
  displayName,
}: {
  displayName: string | null;
}): { subject: string; html: string } {
  const body = `
<p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:${C.textMid};">${greeting(displayName)}</p>

<!-- Badge callout card -->
<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%"
       style="margin:0 0 28px;background-color:${C.outerBg};border:1px solid ${C.cardBorder};border-radius:16px;">
  <tr>
    <td style="padding:20px 24px;">
      <p style="margin:0 0 6px;font-family:${FONT};font-size:20px;line-height:1;">✦</p>
      <p style="margin:0 0 4px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1;color:${C.textHigh};">Supporter</p>
      <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.4;color:${C.textLow};">Visible on your profile and grids</p>
    </td>
  </tr>
</table>

<h1 style="margin:0 0 14px;font-size:26px;font-weight:800;letter-spacing:-0.04em;line-height:1.15;color:${C.textHigh};">
  Thank you for supporting Grids.
</h1>

<p style="margin:0 0 12px;font-size:16px;line-height:1.65;color:${C.textMid};">
  You've earned the <strong style="color:${C.textHigh};font-weight:600;">Supporter</strong> badge — it's now showing on your profile and grids.
</p>

<p style="margin:0;font-size:16px;line-height:1.65;color:${C.textMid};">
  Supporters like you keep independent software independent. It genuinely means a lot to us.
</p>

${btn("Visit your dashboard →", `${SITE_BASE}/dashboard`)}

${hr()}

<p style="margin:0;font-size:13px;line-height:1.6;color:${C.textLow};">
  Have ideas or feedback? We'd love to hear from you in our
  <a href="${DISCORD_SUPPORT_URL}" style="color:${C.textLow};text-decoration:underline;">Discord support channel</a>.
</p>`.trim();

  return wrapEmail("Thank you for supporting Grids ✦", body);
}