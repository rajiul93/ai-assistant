import { aiLockOf, type AiLock, type AiQuota } from "@/lib/ai-limits";
import { startOfDay } from "@/lib/dayjs";
import type { AiKind } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { getPlanStatus } from "@/server/billing";
import { runningTier } from "@/server/pricing";
import { isAdminUser } from "@/server/roles";
import { freshUserFlags } from "@/server/user-flags";

/**
 * Tokens against the user's allowance. Admins have no limit. Everyone else has what their plans
 * give (all approved purchases together) until the plan's days run out; no plan means no allowance.
 */
export async function getAiQuota(user: { id: string; email: string }, admin?: boolean): Promise<AiQuota> {
  if (admin ?? await isAdminUser(user)) {
    const usage = await prisma.aiUsage.aggregate({ where: { userId: user.id }, _sum: { totalTokens: true } });
    return { used: usage._sum.totalTokens ?? 0, limit: null };
  }
  const [plan, row] = await Promise.all([getPlanStatus(user.id), freshUserFlags(user.id)]);
  const paused = row?.aiPaused ?? false;
  if (!plan.hasPlan) return { used: 0, limit: 0, planEndsAt: null, paused };
  return { used: plan.tokensUsed, limit: plan.tokensTotal, planEndsAt: plan.endsAt?.toISOString() ?? null, paused };
}

const dailyField = { message: "messagesPerDay", scan: "scansPerDay", suggestion: "suggestionsPerDay" } as const;

/** Today's uses of each kind and the limits of the user's best running tier (null without one). */
export async function aiToday(userId: string) {
  const tierType = await runningTier(userId);
  const tier = tierType ? await prisma.aiTier.findUnique({ where: { planType: tierType } }) : null;
  const counts = await prisma.aiUse.groupBy({ by: ["kind"], where: { userId, createdAt: { gte: startOfDay().toDate() } }, _count: { _all: true } });
  const used = (kind: AiKind) => counts.find((row) => row.kind === kind)?._count._all ?? 0;
  return {
    tier: tier ? { planType: tier.planType, name: tier.name } : null,
    kinds: (Object.keys(dailyField) as AiKind[]).map((kind) => ({ kind, used: used(kind), limit: tier ? tier[dailyField[kind]] : 0 })),
  };
}

/**
 * Checked before every AI call: admins always pass; others need a plan with days and tokens left.
 * With a `kind` it is also one use of the day's limit for that kind (by the user's best running
 * tier) and is counted when allowed; `ref` makes several calls of one action count once (a photo
 * is read twice). Calls without a kind (automatic follow-ups such as the spell check) count nothing.
 * A call that starts just under a limit may finish slightly over it; the next one is then refused.
 */
export async function checkAi(user: { id: string; email: string }, kind?: AiKind, ref?: string) {
  const admin = await isAdminUser(user);
  const quota = await getAiQuota(user, admin);
  let blocked: AiLock = aiLockOf(quota, admin, Date.now());
  if (!blocked && !admin && kind) {
    const since = startOfDay().toDate();
    const counted = ref ? await prisma.aiUse.findFirst({ where: { userId: user.id, ref, createdAt: { gte: since } }, select: { id: true } }) : null;
    if (!counted) {
      const tierType = await runningTier(user.id);
      const tier = tierType ? await prisma.aiTier.findUnique({ where: { planType: tierType } }) : null;
      const used = await prisma.aiUse.count({ where: { userId: user.id, kind, createdAt: { gte: since } } });
      if (!tier || used >= tier[dailyField[kind]]) blocked = "daily";
      else await prisma.aiUse.create({ data: { userId: user.id, kind, ref: ref?.slice(0, 64) ?? null } });
    }
  }
  return { allowed: blocked === null, blocked, quota };
}

/** The allowance and whether the AI is off right now, for the page shell. */
export async function getAiState(user: { id: string; email: string }, admin: boolean) {
  const quota = await getAiQuota(user, admin);
  return { quota, lock: aiLockOf(quota, admin, Date.now()) };
}
