import type { PaymentMethod } from "@prisma/client";
import { startOfDay } from "@/lib/dayjs";
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export type PlanStatus = {
  /** Ever had an approved purchase: the plan rules apply instead of the older admin-approval rules. */
  hasPlan: boolean;
  active: boolean;
  /** When the last purchased period ends (periods stack back to back). */
  endsAt: Date | null;
  tokensTotal: number;
  tokensUsed: number;
  tokensLeft: number;
  /** Whole days until the plan ends (0 once it has). */
  daysLeft: number;
  /** Where the current plan's counting starts (usage, requests); null when nothing counts. */
  countingFrom: Date | null;
};

type EntitlementRow = { tokens: number; startsAt: Date; endsAt: Date; createdAt: Date; canceledAt: Date | null };

/**
 * Which purchases count toward the current plan, and from when its usage is counted. A cancelled
 * subscription closes the book: only purchases made after the latest cancellation count, and usage
 * is counted from that cancellation on, so a new plan never shows the old plan's spending.
 * Without a cancellation every purchase counts (unused days and use carry over), from the first one.
 */
export function currentPlanWindow(entitlements: EntitlementRow[]) {
  const lastCancel = entitlements.reduce<Date | null>((latest, item) => (item.canceledAt && (!latest || item.canceledAt > latest) ? item.canceledAt : latest), null);
  const counted = lastCancel ? entitlements.filter((item) => item.createdAt > lastCancel) : entitlements;
  const firstStart = counted.length ? new Date(Math.min(...counted.map((item) => item.startsAt.getTime()))) : null;
  const usageFrom = firstStart && lastCancel ? new Date(Math.max(firstStart.getTime(), lastCancel.getTime())) : firstStart;
  return { counted, lastCancel, usageFrom };
}

function loadEntitlements(userId: string) {
  return prisma.entitlement.findMany({ where: { userId }, select: { tokens: true, startsAt: true, endsAt: true, createdAt: true, canceledAt: true } });
}

/**
 * The user's benefit from the purchases that count (see currentPlanWindow): tokens add up and
 * unused ones carry over; the days run back to back, so buying early doesn't lose any.
 */
export async function getPlanStatus(userId: string): Promise<PlanStatus> {
  const entitlements = await loadEntitlements(userId);
  if (!entitlements.length) return { hasPlan: false, active: false, endsAt: null, tokensTotal: 0, tokensUsed: 0, tokensLeft: 0, daysLeft: 0, countingFrom: null };
  const { counted, usageFrom } = currentPlanWindow(entitlements);
  // After a cancellation with nothing bought since, the plan simply shows as ended.
  const endsAt = new Date(Math.max(...(counted.length ? counted : entitlements).map((item) => item.endsAt.getTime())));
  const tokensTotal = counted.reduce((total, item) => total + item.tokens, 0);
  const usage = usageFrom ? await prisma.aiUsage.aggregate({ where: { userId, createdAt: { gte: usageFrom } }, _sum: { totalTokens: true } }) : null;
  const tokensUsed = usage?._sum.totalTokens ?? 0;
  const msLeft = counted.length ? endsAt.getTime() - Date.now() : 0;
  return { hasPlan: true, active: msLeft > 0, endsAt, tokensTotal, tokensUsed, tokensLeft: Math.max(0, tokensTotal - tokensUsed), daysLeft: Math.max(0, Math.ceil(msLeft / DAY_MS)), countingFrom: usageFrom };
}

/** Packages on sale, cheapest first within each plan. */
export function listActivePackages() {
  return prisma.planPackage.findMany({ where: { active: true }, orderBy: [{ planType: "asc" }, { sortOrder: "asc" }, { priceBdt: "asc" }] });
}

export function listPaymentAccounts() {
  return prisma.paymentAccount.findMany({ where: { enabled: true }, orderBy: { method: "asc" } });
}

export const methodLabels: Record<PaymentMethod, string> = { BKASH: "bKash", NAGAD: "Nagad" };

/**
 * Approves a pending payment and adds its benefit. Runs in one transaction and only moves a
 * PENDING payment, so approving twice (two admins, a double click) can't add the benefit twice.
 */
export async function approvePayment(paymentId: string, reviewer: string, note?: string) {
  return prisma.$transaction(async (tx) => {
    const moved = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: "APPROVED", reviewedAt: new Date(), reviewedBy: reviewer, adminNote: note || null },
    });
    if (!moved.count) throw new Error("This payment was already reviewed.");
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const latest = await tx.entitlement.aggregate({ where: { userId: payment.userId }, _max: { endsAt: true } });
    // The new period starts when the current one ends (or now, if none is running): no days are lost.
    const startsAt = new Date(Math.max(Date.now(), latest._max.endsAt?.getTime() ?? 0));
    const endsAt = new Date(startsAt.getTime() + payment.durationDays * DAY_MS);
    await tx.entitlement.create({ data: { userId: payment.userId, paymentId: payment.id, tokens: payment.tokens, startsAt, endsAt } });
    return { startsAt, endsAt };
  });
}

export async function rejectPayment(paymentId: string, reviewer: string, note?: string) {
  const moved = await prisma.payment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedBy: reviewer, adminNote: note || null },
  });
  if (!moved.count) throw new Error("This payment was already reviewed.");
}

/**
 * Today's AI use (app timezone) as a share of the customer's plan, and the plan's fair daily share
 * (100% spread over all its days). Only today's figure is computed — earlier days aren't shown to
 * customers — and token counts never leave the server.
 */
export async function getTodayUsageShare(userId: string, plan: PlanStatus) {
  const { counted, usageFrom } = currentPlanWindow(await loadEntitlements(userId));
  // Like the plan total, count only use inside the current plan's window (not earlier the same day).
  const since = new Date(Math.max(startOfDay().valueOf(), usageFrom?.getTime() ?? 0));
  const today = await prisma.aiUsage.aggregate({ where: { userId, createdAt: { gte: since } }, _sum: { totalTokens: true } });
  const planDays = counted.reduce((total, item) => total + (item.endsAt.getTime() - item.startsAt.getTime()) / DAY_MS, 0);
  const round = (value: number) => Math.round(value * 10) / 10;
  const todayTokens = today._sum.totalTokens ?? 0;
  return {
    todayPercent: plan.tokensTotal ? round((todayTokens / plan.tokensTotal) * 100) : 0,
    dailySharePercent: planDays ? round(100 / planDays) : 0,
    // Token counts for developers only: sent to the page in development, never in production.
    ...(process.env.NODE_ENV === "development"
      ? { dev: { todayTokens, dailyShareTokens: planDays ? Math.round(plan.tokensTotal / planDays) : 0, planTokens: plan.tokensTotal, planUsedTokens: plan.tokensUsed } }
      : {}),
  };
}

/**
 * Ends a user's subscription now: every running or upcoming period ends at this moment and the
 * unused allowance is taken off, so buying again later starts fresh. The payment and entitlement
 * records stay (marked cancelled) for the history.
 */
export async function cancelSubscription(userId: string, by: string) {
  const plan = await getPlanStatus(userId);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const open = await tx.entitlement.findMany({ where: { userId, endsAt: { gt: now } }, orderBy: { startsAt: "desc" } });
    if (!open.length) throw new Error("This user has no running plan to cancel.");
    let toRemove = plan.tokensLeft;
    for (const item of open) {
      // Take the unused allowance off, latest purchase first.
      const cut = Math.min(item.tokens, toRemove);
      toRemove -= cut;
      await tx.entitlement.update({
        where: { id: item.id },
        data: { endsAt: now, startsAt: item.startsAt > now ? now : item.startsAt, tokens: item.tokens - cut, canceledAt: now, canceledBy: by },
      });
    }
    return { canceled: open.length };
  });
}
