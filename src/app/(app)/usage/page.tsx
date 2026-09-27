import { AiUsageView, CustomerUsageView, usagePeriods } from "@/components/usage/ai-usage-view";
import { requireUser } from "@/lib/auth";
import { now, startOfDay } from "@/lib/dayjs";
import { prisma } from "@/lib/prisma";
import { getAiQuota } from "@/server/ai-access";
import { getPlanStatus, getTodayUsageShare } from "@/server/billing";
import { getAiUsage } from "@/server/queries";
import { isAdminUser } from "@/server/roles";

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
  const [usage, quota] = await Promise.all([getAiUsage({ from }), getAiQuota(user)]);
  return <AiUsageView usage={usage} period={period} admin quota={quota} />;
}
