import { AiUsageView, CustomerUsageView, usagePeriods } from "@/components/usage/ai-usage-view";
import { OpenAiBalance, type CostsView } from "@/components/usage/openai-balance";
import { requireUser } from "@/lib/auth";
import { now, startOfDay } from "@/lib/dayjs";
import { prisma } from "@/lib/prisma";
import { getAiQuota } from "@/server/ai-access";
import { getPlanStatus, getTodayUsageShare } from "@/server/billing";
import { getAiUsage } from "@/server/queries";
import { getOpenAiCosts } from "@/server/openai-costs";
import { isAdminUser, isSuperAdminEmail } from "@/server/roles";

/** The owner's OpenAI money: top-ups entered on the page and costs from OpenAI since the first one (and the last 30 days). */
async function ownerBalance() {
  // Before the AiCredit migration runs the table is missing; the rest of the page still works.
  const credits = await prisma.aiCredit.findMany({ orderBy: { addedAt: "desc" } }).catch(() => null);
  if (!credits) return <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">OpenAI balance দেখাতে database-এ <code>AiCredit</code> টেবিল লাগবে — migration <code>20261022000000_ai_credit</code> চালানো হয়নি।</p>;
  const monthAgo = new Date(Date.now() - 29 * 86_400_000);
  const earliest = credits.at(-1)?.addedAt;
  const result = await getOpenAiCosts(earliest && earliest < monthAgo ? earliest : monthAgo);
  const costs: CostsView = result.ok ? { ok: true, days: result.costs.days.map((day) => ({ day: day.day.toISOString(), usd: day.usd })) } : result;
  return <OpenAiBalance credits={credits.map((credit) => ({ id: credit.id, amountCents: credit.amountCents, addedAt: credit.addedAt.toISOString(), note: credit.note }))} costs={costs} today={new Date().toISOString().slice(0, 10)} />;
}

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const user = await requireUser();
  // Customers get only their own totals — the detailed breakdown is never loaded for them.
  if (!(await isAdminUser(user))) {
    const [quota, plan] = await Promise.all([getAiQuota(user), getPlanStatus(user.id)]);
    // Requests of the current plan only (from where its counting starts), like its usage.
    const inPlan = plan.countingFrom ? { userId: user.id, createdAt: { gte: plan.countingFrom } } : null;
    const [requests, failed] = inPlan
      ? await Promise.all([prisma.aiUsage.count({ where: inPlan }), prisma.aiUsage.count({ where: { ...inPlan, status: { not: "ok" } } })])
      : [0, 0];
    const today = plan.hasPlan ? await getTodayUsageShare(user.id, plan) : null;
    return <CustomerUsageView quota={quota} requests={requests} failed={failed} today={today} />;
  }
  const requested = (await searchParams).period;
  const period = usagePeriods.find((item) => item.key === requested)?.key ?? "30d";
  const from = period === "all" ? null : startOfDay(now().subtract(period === "7d" ? 6 : 29, "day")).toDate();
  const [usage, quota, balance] = await Promise.all([getAiUsage({ from }), getAiQuota(user), isSuperAdminEmail(user.email) ? ownerBalance() : null]);
  return <AiUsageView usage={usage} period={period} admin quota={quota} balance={balance} />;
}
