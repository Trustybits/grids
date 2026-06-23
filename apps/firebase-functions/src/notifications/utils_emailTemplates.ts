const SITE_BASE = "https://grids.so";

function greeting(displayName: string | null): string {
  return displayName ? `Hi ${displayName},` : "Hi there,";
}

export function buildWelcomeEmail({
  displayName,
}: {
  displayName: string | null;
}): { subject: string; html: string } {
  return {
    subject: "Welcome to Grids",
    html: `
      <p>${greeting(displayName)}</p>
      <p>Welcome to <a href="${SITE_BASE}">grids.so</a> — your space to build a personal page with interactive tiles.</p>
      <p>Claim your URL, arrange your tiles, and share one link that stays in sync.</p>
      <p><a href="${SITE_BASE}/dashboard">Open your dashboard</a></p>
      <p>— The Grids team</p>
    `.trim(),
  };
}

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

  return {
    subject: "Your grid is ready",
    html: `
      <p>${greeting(displayName)}</p>
      <p>Your grid <strong>${gridName}</strong> is ready to share.</p>
      <p><a href="${gridUrl}">${gridUrl}</a></p>
      <p>Add tiles, tweak the layout, and send your link anywhere — it stays up to date as you edit.</p>
      <p><a href="${gridUrl}">View your grid</a></p>
      <p>— The Grids team</p>
    `.trim(),
  };
}

export function buildSupporterBadgeEmail({
  displayName,
}: {
  displayName: string | null;
}): { subject: string; html: string } {
  return {
    subject: "Thank you for supporting Grids",
    html: `
      <p>${greeting(displayName)}</p>
      <p>Thank you for supporting Grids. You've earned the <strong>Supporter</strong> badge — we really appreciate it.</p>
      <p>Your badge is visible on your profile and grids. Thanks for helping us build something people love.</p>
      <p><a href="${SITE_BASE}/dashboard">Visit your dashboard</a></p>
      <p>— The Grids team</p>
    `.trim(),
  };
}
