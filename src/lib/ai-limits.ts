export type AiQuota = {
  used: number;
  limit: number | null;
  /** For non-admins: when their plan's days run out (ISO), or null when they have no plan. */
  planEndsAt?: string | null;
  /** An admin paused this user's AI. */
  paused?: boolean;
};

/** Why the AI is unavailable: paused by an admin, no plan yet, the plan's days ran out, or its tokens are used up. */
export type AiLock = "paused" | "noplan" | "expired" | "quota" | null;

export function aiLockOf(quota: AiQuota, admin: boolean, nowMs: number): AiLock {
  if (admin) return null;
  if (quota.paused) return "paused";
  if (!quota.planEndsAt) return "noplan";
  if (new Date(quota.planEndsAt).getTime() <= nowMs) return "expired";
  return quotaExceeded(quota) ? "quota" : null;
}

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
