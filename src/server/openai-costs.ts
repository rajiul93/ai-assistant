/**
 * Dollars spent on the OpenAI account, from OpenAI's own Costs API — the same numbers as its
 * billing page. It needs an **Admin key** (`OPENAI_ADMIN_KEY`, made under Organization → Admin
 * keys); the normal API key cannot read costs, and no OpenAI API tells the prepaid balance.
 */

export type OpenAiCosts = { since: Date; totalUsd: number; days: Array<{ day: Date; usd: number }> };
export type CostsResult = { ok: true; costs: OpenAiCosts } | { ok: false; reason: "no_key" | "failed"; detail?: string };

type Bucket = { start_time: number; results?: Array<{ amount?: { value?: number | string } }> };
type Page = { data?: Bucket[]; has_more?: boolean; next_page?: string | null };

// The page is opened now and then by one person; five minutes keeps it fresh without hammering OpenAI.
const CACHE_MS = 5 * 60_000;
let cache: { key: string; at: number; result: CostsResult } | null = null;

/** Daily costs from `since` (rounded down to that UTC day) until now. */
export async function getOpenAiCosts(since: Date): Promise<CostsResult> {
  const adminKey = process.env.OPENAI_ADMIN_KEY;
  if (!adminKey) return { ok: false, reason: "no_key" };
  const start = Math.floor(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()) / 1000);
  const cacheKey = String(start);
  if (cache && cache.key === cacheKey && Date.now() - cache.at < CACHE_MS) return cache.result;

  const days: OpenAiCosts["days"] = [];
  let page: string | null | undefined;
  try {
    // 180 daily buckets a page; a long history takes a few pages.
    for (let guard = 0; guard < 20; guard++) {
      const url = new URL("https://api.openai.com/v1/organization/costs");
      url.searchParams.set("start_time", String(start));
      url.searchParams.set("bucket_width", "1d");
      url.searchParams.set("limit", "180");
      if (page) url.searchParams.set("page", page);
      const response = await fetch(url, { headers: { Authorization: `Bearer ${adminKey}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (!response.ok) {
        const result: CostsResult = { ok: false, reason: "failed", detail: response.status === 401 || response.status === 403 ? "Admin key রাজি হয়নি (ঠিক key আর Costs পড়ার অনুমতি আছে তো?)" : `OpenAI HTTP ${response.status}` };
        return result;
      }
      const payload = (await response.json()) as Page;
      for (const bucket of payload.data ?? []) {
        const usd = (bucket.results ?? []).reduce((sum, item) => sum + Number(item.amount?.value ?? 0), 0);
        days.push({ day: new Date(bucket.start_time * 1000), usd });
      }
      if (!payload.has_more || !payload.next_page) break;
      page = payload.next_page;
    }
  } catch (error) {
    return { ok: false, reason: "failed", detail: error instanceof Error && error.name === "TimeoutError" ? "OpenAI সময়মতো উত্তর দেয়নি" : "OpenAI-তে যাওয়া গেল না" };
  }

  days.sort((a, b) => a.day.getTime() - b.day.getTime());
  const result: CostsResult = { ok: true, costs: { since: new Date(start * 1000), totalUsd: days.reduce((sum, day) => sum + day.usd, 0), days } };
  cache = { key: cacheKey, at: Date.now(), result };
  return result;
}
