import type { BankExam } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPremium } from "@/server/premium";
import { canOpenExam } from "@/server/pricing";
import { isAdminUser } from "@/server/roles";
import { userError } from "@/lib/user-error";

/**
 * Who may open and take what in the Question Bank (docs/question-bank-v2-plan.md). Checked on the
 * server: a locked item never reaches the page. Server-only (takes the user), so never export it
 * from a "use server" file.
 */

type Viewer = { id: string; email: string };

/** Past-year sets a user without access may open for good, of their own choosing (owner, 2026-10-16). */
export const FREE_SET_UNLOCKS = 3;
/** Sets from the bank a user may have going at once, per kind, until one is passed or deleted. */
export const BANK_SLOTS = 2;
/** The score (percent) that passes a set and frees its slot. */
export const PASS_PERCENT = 60;

/** Access by plan alone: the set is free, or its category's exam is in a running plan (any plan for an admin-added category). */
async function planOpens(user: Viewer, set: { free: boolean; category: { exam: BankExam | null } }) {
  if (set.free) return true;
  return set.category.exam ? canOpenExam(user, set.category.exam) : hasPremium(user);
}

/** A past-year set: open by plan, or one of the user's 3 own picks. */
export async function canOpenBankSet(user: Viewer, set: { id: string; free: boolean; category: { exam: BankExam | null } }) {
  if (await planOpens(user, set)) return true;
  return Boolean(await prisma.bankSetUnlock.findUnique({ where: { userId_setId: { userId: user.id, setId: set.id } }, select: { setId: true } }));
}

/** The same for a whole category at once (the set cards): which set ids the user picked, and whether the plan opens paid ones. */
export async function categoryAccess(user: Viewer, category: { exam: BankExam | null }, setIds: string[]) {
  const [paid, unlocks] = await Promise.all([
    planOpens(user, { free: false, category }),
    prisma.bankSetUnlock.findMany({ where: { userId: user.id, setId: { in: setIds } }, select: { setId: true } }),
  ]);
  return { paid, unlocked: new Set(unlocks.map((unlock) => unlock.setId)) };
}

/** How many of the 3 picks are used. */
export async function unlocksUsed(user: Viewer) {
  return prisma.bankSetUnlock.count({ where: { userId: user.id } });
}

/** A General chapter item (article, MCQ, short question): free, else any running plan. Staff always. */
export async function canOpenChapterItem(user: Viewer, item: { free: boolean }) {
  return item.free || hasPremium(user);
}

/** How many questions of a locked set are shown as a taste of it. */
export const LOCKED_SET_PREVIEW = 3;

const passed = (attempts: Array<{ total: number; correct: number }>) => attempts.some((attempt) => attempt.total > 0 && attempt.correct * 100 >= PASS_PERCENT * attempt.total);

/**
 * Sending to Preliminary / Short Question from the bank needs a running plan, and at most
 * BANK_SLOTS sets from the bank of that kind may be going at once: one counts until any of its tests
 * scores PASS_PERCENT or more, or the user deletes it (owner, 2026-10-16). Staff have no limit.
 * Throws the Bangla message the page shows.
 */
export async function assertCanTakeFromBank(user: Viewer, kind: "mcq" | "short") {
  if (!(await hasPremium(user))) throw userError(`${kind === "mcq" ? "Preliminary" : "Short Question"}-এ নিতে একটা চালু plan লাগবে।`);
  if (await isAdminUser(user)) return;
  const going = kind === "mcq"
    ? (await prisma.questionSet.findMany({ where: { userId: user.id, fromBank: true }, select: { topicName: true, attempts: { select: { total: true, correct: true } } } }))
    : (await prisma.shortQuestionSet.findMany({ where: { userId: user.id, fromBank: true }, select: { topicName: true, attempts: { select: { total: true, correct: true } } } }));
  const open = going.filter((set) => !passed(set.attempts));
  if (open.length >= BANK_SLOTS) {
    throw userError(`প্রশ্ন ব্যাংক থেকে একসাথে ${BANK_SLOTS}টার বেশি ${kind === "mcq" ? "MCQ" : "Short Question"} set নেওয়া যায় না। আগে নেওয়া ${open.map((set) => `"${set.topicName}"`).join(", ")}-এর test দিয়ে ${PASS_PERCENT}% পাও (বা set মুছে দাও), তারপর নতুনটা নাও।`);
  }
}
