import type { InjectionKey, Ref } from 'vue';
import type { AuthUser } from '@/auth/AuthProvider';

export const marketingUserKey: InjectionKey<Ref<AuthUser | null>> =
  Symbol('marketingUser');

export const MARKETING_PATHS = [
  '/',
  '/pricing',
  '/showcase',
  '/templates',
  '/blog',
] as const;

export type MarketingPath = (typeof MARKETING_PATHS)[number];

export const MARKETING_NAV_ITEMS = [
  { id: 'home', label: 'Home', path: '/' },
  { id: 'pricing', label: 'Pricing', path: '/pricing' },
  { id: 'showcase', label: 'Showcase', path: '/showcase' },
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
