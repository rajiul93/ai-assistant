/** Token limits an admin can give a user; null means unlimited. */
export const TOKEN_LIMIT_OPTIONS = [1_000_000, 2_000_000, 5_000_000, 10_000_000] as const;

export type AiQuota = { used: number; limit: number | null };

export function formatTokens(value: number) {
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(value % 1_000_000 ? 2 : 0))}M`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}k`;
  return value.toLocaleString("en-US");
}

/** Share of the limit used, 0–100 (0 when unlimited). */
export function quotaPercent({ used, limit }: AiQuota) {
  return limit ? Math.min(100, Math.round((used / limit) * 1000) / 10) : 0;
}

export function quotaExceeded({ used, limit }: AiQuota) {
  return limit !== null && used >= limit;
}
