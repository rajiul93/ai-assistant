import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getPlanStatus } from "@/server/billing";
import { canOpenExam } from "@/server/pricing";
import { isAdminUser } from "@/server/roles";

/**
 * Paid features of the study content (owner, 2026-10-13): solutions and explanations, and sending
 * a Question Bank set to Preliminary. Open to anyone whose bought plan is still running, and always
 * to admins and the super admin. Checked on the server — a locked solution never reaches the page.
 * Server-only (not a server action), once per request.
 */
export const hasPremium = cache(async (user: { id: string; email: string }) => {
  if (await isAdminUser(user)) return true;
  return (await getPlanStatus(user.id)).active;
});

/**
 * Solutions in one of the user's own sets: a copy of a question-bank set follows that set's access
 * (free, or its exam in a running plan — the same rule as bank-access `canOpenBankSet`); a set they
 * made themselves, or a chapter's MCQs, needs any running plan.
 */
export async function premiumForSet(user: { id: string; email: string }, bankSetId: string | null) {
  if (!bankSetId) return hasPremium(user);
  const bank = await prisma.bankSet.findUnique({ where: { id: bankSetId }, select: { free: true, category: { select: { exam: true } } } });
  if (!bank) return hasPremium(user);
  if (bank.free) return true;
  return bank.category.exam ? canOpenExam(user, bank.category.exam) : hasPremium(user);
}

/** Solutions/explanations as the user may see them: the text when allowed, else only whether one exists. */
export function gateNotes<T extends { solution: string | null; explanation: string | null }>(question: T, premium: boolean) {
  return { ...question, solution: premium ? question.solution : null, explanation: premium ? question.explanation : null, hasSolution: Boolean(question.solution), hasExplanation: Boolean(question.explanation) };
}
