import { cache } from "react";
import { getPlanStatus } from "@/server/billing";
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

/** Solutions/explanations as the user may see them: the text when allowed, else only whether one exists. */
export function gateNotes<T extends { solution: string | null; explanation: string | null }>(question: T, premium: boolean) {
  return { ...question, solution: premium ? question.solution : null, explanation: premium ? question.explanation : null, hasSolution: Boolean(question.solution), hasExplanation: Boolean(question.explanation) };
}
