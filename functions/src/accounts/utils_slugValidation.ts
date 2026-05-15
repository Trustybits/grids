/**
 * Validates slug format: lowercase alphanumeric and hyphens only, 3-30 characters
 */
export function isValidSlugFormat(slug: string): boolean {
  if (!slug || typeof slug !== "string") return false;
  if (slug.length < 3 || slug.length > 30) return false;
  
  // Must be lowercase alphanumeric and hyphens only
  // Cannot start or end with a hyphen
  const slugRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
  return slugRegex.test(slug);
}
