import type { LocationQuery, LocationQueryRaw } from 'vue-router';

/**
 * Route query that opens a grid as visitors see it, even for its owner:
 * `/grid/:id?view=published`. The owner's session becomes read-only and no
 * draft is resolved, so the live version can be inspected in-app without
 * logging out. Visitors are unaffected by the query.
 */
export const PUBLISHED_VIEW_QUERY_KEY = 'view';
export const PUBLISHED_VIEW_QUERY_VALUE = 'published';

export function isPublishedViewQuery(query: LocationQuery): boolean {
  const value = query[PUBLISHED_VIEW_QUERY_KEY];
  const first = Array.isArray(value) ? value[0] : value;
  return first === PUBLISHED_VIEW_QUERY_VALUE;
}

export function withPublishedView(query: LocationQuery): LocationQueryRaw {
  return { ...query, [PUBLISHED_VIEW_QUERY_KEY]: PUBLISHED_VIEW_QUERY_VALUE };
}

export function withoutPublishedView(query: LocationQuery): LocationQueryRaw {
  const rest: LocationQueryRaw = { ...query };
  delete rest[PUBLISHED_VIEW_QUERY_KEY];
  return rest;
}

/** Append the published-view query to an absolute or relative URL string. */
export function publishedViewUrl(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${PUBLISHED_VIEW_QUERY_KEY}=${PUBLISHED_VIEW_QUERY_VALUE}`;
}
