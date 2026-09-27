/** Page sizes offered to the user; anything else in the URL falls back to the default. */
export const PAGE_LIMITS = [10, 20, 50, 100] as const;
export const DEFAULT_LIMIT = 20;

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Page and page size from the URL (?page=2&limit=50), so a reload or a shared link shows the same
 * page. Bad values fall back safely: an unknown limit to the default, a page below 1 to 1.
 */
export function readPagination(params: SearchParams) {
  const limitValue = Number(first(params.limit));
  const limit = (PAGE_LIMITS as readonly number[]).includes(limitValue) ? limitValue : DEFAULT_LIMIT;
  const pageValue = Math.floor(Number(first(params.page)));
  const page = Number.isFinite(pageValue) && pageValue >= 1 ? pageValue : 1;
  return { page, limit, skip: (page - 1) * limit };
}

export function readQuery(params: SearchParams, key = "q") {
  return (first(params[key]) ?? "").trim().slice(0, 100);
}

/** Keeps a requested page inside the real range once the total is known (e.g. after deletions). */
export function lastPage(total: number, limit: number) {
  return Math.max(1, Math.ceil(total / limit));
}
