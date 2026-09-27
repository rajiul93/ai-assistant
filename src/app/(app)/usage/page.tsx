import { AiUsageView, CustomerUsageView, usagePeriods } from "@/components/usage/ai-usage-view";
import { isAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { now, startOfDay } from "@/lib/dayjs";
import { prisma } from "@/lib/prisma";
import { getAiQuota } from "@/server/ai-access";
import { getAiUsage } from "@/server/queries";

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const user = await requireUser();
  // Customers get only their own totals — the detailed breakdown is never loaded for them.
  if (!isAdmin(user.email)) {
    const [quota, requests, failed] = await Promise.all([
      getAiQuota(user),
      prisma.aiUsage.count({ where: { userId: user.id } }),
      prisma.aiUsage.count({ where: { userId: user.id, status: { not: "ok" } } }),
    ]);
    return <CustomerUsageView quota={quota} requests={requests} failed={failed} />;
  }
  const requested = (await searchParams).period;
  const period = usagePeriods.find((item) => item.key === requested)?.key ?? "30d";
  const from = period === "all" ? null : startOfDay(now().subtract(period === "7d" ? 6 : 29, "day")).toDate();
  const [usage, quota] = await Promise.all([getAiUsage({ from }), getAiQuota(user)]);
  return <AiUsageView usage={usage} period={period} admin quota={quota} />;
}
