export type AiQuota = {
  used: number;
  limit: number | null;
  /** For non-admins: when their plan's days run out (ISO), or null when they have no plan. */
  planEndsAt?: string | null;
  /** An admin paused this user's AI. */
  paused?: boolean;
};

/**
 * Why the AI is unavailable: paused by an admin, no plan yet, the plan's days ran out, its tokens
 * are used up, or today's limit for this kind of use is reached (it opens again tomorrow).
 */
export type AiLock = "paused" | "noplan" | "expired" | "quota" | "daily" | null;

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

/** One sentence for a refused AI call, in Bangla or English. */
export function aiBlockedMessage(blocked: Exclude<AiLock, null>, lang: "bn" | "en" = "bn") {
  const en = lang === "en";
  switch (blocked) {
    case "paused": return en ? "An admin has paused your AI for now." : "Admin আপনার AI সাময়িকভাবে বন্ধ রেখেছে।";
    case "expired": return en ? "Your plan has run out. Choose a plan on the Plans page." : "আপনার plan-এর মেয়াদ শেষ। Plans পাতা থেকে একটা plan নিন।";
    case "quota": return en ? "Your plan's AI use is used up. Buying another plan adds more." : "আপনার plan-এর AI ব্যবহার শেষ। আরেকটা plan নিলে আরও যোগ হবে।";
    case "daily": return en ? "Today's AI limit for this is reached. It resets tomorrow — Professional AI has higher limits." : "আজকের AI সীমা শেষ, কাল আবার পাবেন। Professional AI-তে সীমা বেশি।";
    default: return en ? "To use the AI, choose a plan." : "AI ব্যবহার করতে একটা plan নিন।";
  }
}
