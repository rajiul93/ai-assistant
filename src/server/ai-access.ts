import type { AiAccess } from "@prisma/client";
import { isAdmin } from "@/lib/admin";
import { quotaExceeded, type AiQuota } from "@/lib/ai-limits";
import { prisma } from "@/lib/prisma";

/** ADMIN always has the AI; otherwise the user's stored state (only APPROVED may use it). */
export type AiAccessState = AiAccess | "ADMIN";

/** Read fresh from the database (not the cached session user), so an admin's change applies at once. */
export async function getAiAccess(user: { id: string; email: string }): Promise<AiAccessState> {
  if (isAdmin(user.email)) return "ADMIN";
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { aiAccess: true } });
  return row?.aiAccess ?? "NONE";
}

export function canUseAi(state: AiAccessState) {
  return state === "ADMIN" || state === "APPROVED";
}

/** Tokens used so far (all AI calls ever) against the user's limit; admins have none. */
export async function getAiQuota(user: { id: string; email: string }): Promise<AiQuota> {
  const [row, usage] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { aiTokenLimit: true } }),
    prisma.aiUsage.aggregate({ where: { userId: user.id }, _sum: { totalTokens: true } }),
  ]);
  return { used: usage._sum.totalTokens ?? 0, limit: isAdmin(user.email) ? null : row?.aiTokenLimit ?? null };
}

/**
 * Checked before every AI call. A call that starts just under the limit may finish slightly over it;
 * the next one is then refused.
 */
export async function checkAi(user: { id: string; email: string }) {
  const [access, quota] = await Promise.all([getAiAccess(user), getAiQuota(user)]);
  const blocked = !canUseAi(access) ? "access" as const : quotaExceeded(quota) ? "quota" as const : null;
  return { allowed: blocked === null, blocked, access, quota };
}
