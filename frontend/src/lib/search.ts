/** Free-text search rules shared by every searchable page (mirrors the API's SearchText). */

/** The API rejects shorter search strings; shorter input is treated as "no search". */
export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_LENGTH = 100;

export function normaliseSearch(raw: string | undefined): string | undefined {
  const q = raw?.trim().slice(0, MAX_SEARCH_LENGTH);
  return q && q.length >= MIN_SEARCH_LENGTH ? q : undefined;
}
