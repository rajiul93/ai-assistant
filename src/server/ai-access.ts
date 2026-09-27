import { aiLockOf, type AiQuota } from "@/lib/ai-limits";
import { prisma } from "@/lib/prisma";
import { getPlanStatus } from "@/server/billing";
import { isAdminUser } from "@/server/roles";

/**
 * Tokens against the user's allowance. Admins have no limit. Everyone else has what their plans
 * give (all approved purchases together) until the plan's days run out; no plan means no allowance.
 */
export async function getAiQuota(user: { id: string; email: string }, admin?: boolean): Promise<AiQuota> {
  if (admin ?? await isAdminUser(user)) {
    const usage = await prisma.aiUsage.aggregate({ where: { userId: user.id }, _sum: { totalTokens: true } });
    return { used: usage._sum.totalTokens ?? 0, limit: null };
  }
  const [plan, row] = await Promise.all([getPlanStatus(user.id), prisma.user.findUnique({ where: { id: user.id }, select: { aiPaused: true } })]);
  const paused = row?.aiPaused ?? false;
  if (!plan.hasPlan) return { used: 0, limit: 0, planEndsAt: null, paused };
  return { used: plan.tokensUsed, limit: plan.tokensTotal, planEndsAt: plan.endsAt?.toISOString() ?? null, paused };
}

/**
 * Checked before every AI call: admins always pass; others need a plan with days and tokens left.
 * A call that starts just under the limit may finish slightly over it; the next one is then refused.
 */
export async function checkAi(user: { id: string; email: string }) {
  const admin = await isAdminUser(user);
  const quota = await getAiQuota(user, admin);
  const blocked = aiLockOf(quota, admin, Date.now());
  return { allowed: blocked === null, blocked, quota };
}

/** The allowance and whether the AI is off right now, for the page shell. */
export async function getAiState(user: { id: string; email: string }, admin: boolean) {
  const quota = await getAiQuota(user, admin);
  return { quota, lock: aiLockOf(quota, admin, Date.now()) };
}
