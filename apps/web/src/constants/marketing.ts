export const MARKETING_PATHS = [
  '/',
  '/pricing',
  '/templates',
  '/blog',
] as const;

export type MarketingPath = (typeof MARKETING_PATHS)[number];

export const MARKETING_NAV_ITEMS = [
  { id: 'home', label: 'Home', path: '/' },
  { id: 'pricing', label: 'Pricing', path: '/pricing' },
] as const;

export type MarketingNavId = (typeof MARKETING_NAV_ITEMS)[number]['id'];

export const NON_GRID_PATHS = [
  ...MARKETING_PATHS,
  '/dashboard',
  '/login',
  '/signup',
  '/privacy',
  '/terms',
  '/notion-callback',
] as const;

export function isMarketingPath(path: string): boolean {
  return (MARKETING_PATHS as readonly string[]).includes(path);
}

export function isNonGridPath(path: string): boolean {
  return (NON_GRID_PATHS as readonly string[]).includes(path);
}
