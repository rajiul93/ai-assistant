import { AiUsageView, usagePeriods } from "@/components/usage/ai-usage-view";
import { isAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { now, startOfDay } from "@/lib/dayjs";
import { getAiQuota } from "@/server/ai-access";
import { getAiUsage } from "@/server/queries";

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const user = await requireUser();
  const requested = (await searchParams).period;
  const period = usagePeriods.find((item) => item.key === requested)?.key ?? "30d";
  const from = period === "all" ? null : startOfDay(now().subtract(period === "7d" ? 6 : 29, "day")).toDate();
  const admin = isAdmin(user.email);
  // Admins see everyone; other users only ever get their own rows.
  const [usage, quota] = await Promise.all([getAiUsage({ userId: admin ? undefined : user.id, from }), getAiQuota(user)]);
  return <AiUsageView usage={usage} period={period} admin={admin} quota={quota} />;
}
