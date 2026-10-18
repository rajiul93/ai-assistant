import { AiUsageView, CustomerUsageView, usagePeriods } from "@/components/usage/ai-usage-view";
import { AiProviderSettings } from "@/components/usage/ai-provider";
import { OpenAiBalance, type CostsView } from "@/components/usage/openai-balance";
import { requireUser } from "@/lib/auth";
import { now, startOfDay } from "@/lib/dayjs";
import { prisma } from "@/lib/prisma";
import { getAiSettingsView } from "@/server/actions/ai-settings";
import { getAiQuota } from "@/server/ai-access";
import { getPlanStatus, getTodayUsageShare } from "@/server/billing";
import { getAiUsage } from "@/server/queries";
import { getOpenAiCosts } from "@/server/openai-costs";
import { allQuotes, loadCatalog } from "@/server/pricing";
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

/**
 * Without a running plan: the AI levels on sale, each with its daily limits and the lowest monthly
 * price (from the server's own quotes), so the page can say "no plan — pick one" (owner, 2026-10-17).
 */
async function planOffer(hadPlan: boolean) {
  const [catalog, tiers] = await Promise.all([
    loadCatalog(),
    prisma.aiTier.findMany({ where: { active: true }, orderBy: { priceBdt: "asc" }, select: { planType: true, name: true, messagesPerDay: true, scansPerDay: true, suggestionsPerDay: true } }),
  ]);
  const quotes = allQuotes(catalog);
  return {
    hadPlan,
    tiers: tiers.map((tier) => {
      const prices = quotes.filter((quote) => quote.planType === tier.planType).map((quote) => quote.monthly);
      return { ...tier, fromMonthly: prices.length ? Math.min(...prices) : null };
    }),
  };
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
    return <CustomerUsageView quota={quota} requests={requests} failed={failed} today={today} noPlan={plan.active ? null : await planOffer(plan.hasPlan)} />;
  }
  const requested = (await searchParams).period;
  const period = usagePeriods.find((item) => item.key === requested)?.key ?? "30d";
  const from = period === "all" ? null : startOfDay(now().subtract(period === "7d" ? 6 : 29, "day")).toDate();
  const owner = isSuperAdminEmail(user.email);
  const [usage, quota, balance, aiSettings] = await Promise.all([getAiUsage({ from }), getAiQuota(user), owner ? ownerBalance() : null, owner ? getAiSettingsView().catch(() => null) : null]);
  // The super admin also picks the AI here (ChatGPT or Gemini) and enters the Gemini key.
  const ownerPanel = owner ? <div className="space-y-4">{aiSettings ? <AiProviderSettings view={aiSettings} /> : null}{balance}</div> : null;
  return <AiUsageView usage={usage} period={period} admin quota={quota} balance={ownerPanel} />;
}
