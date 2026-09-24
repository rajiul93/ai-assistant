import { SubjectAnalysis, analysisPeriods, type AnalysisPeriod } from "@/components/progress/subject-analysis";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth";
import { formatDurationFromSeconds, formatHoursMinutes, now as appNow, startOfDay, startOfMonth } from "@/lib/dayjs";
import {
  getMonthlyStudySeconds,
  getProgressCounts,
  getStudyPlan,
  getSubjectAnalysis,
  getTodayStudySeconds,
  getWeeklyStudySeconds,
} from "@/server/queries";

/** The analysis window and the equally long window just before it (for "more/less than before"). */
function periodRange(period: AnalysisPeriod) {
  const current = appNow();
  const to = current.toDate();
  if (period === "all") return { from: null, to, previous: null };
  if (period === "month") {
    const from = startOfMonth();
    const previousFrom = from.subtract(1, "month");
    // Same number of elapsed days in the previous month, so mid-month isn't compared to a full month.
    return { from: from.toDate(), to, previous: { from: previousFrom.toDate(), to: previousFrom.add(current.diff(from)).toDate() } };
  }
  const days = period === "7d" ? 7 : 30;
  const from = startOfDay(current.subtract(days - 1, "day"));
  return { from: from.toDate(), to, previous: { from: from.subtract(days, "day").toDate(), to: from.subtract(1, "millisecond").toDate() } };
}

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const user = await requireUser();
  const requested = (await searchParams).period;
  const period = analysisPeriods.find((item) => item.key === requested)?.key ?? "30d";
  const range = periodRange(period);
  const [plan, today, weekly, monthly, subjectStats, counts] = await Promise.all([
    getStudyPlan(user.id),
    getTodayStudySeconds(user.id),
    getWeeklyStudySeconds(user.id),
    getMonthlyStudySeconds(user.id),
    getSubjectAnalysis(user.id, range.from, range.to, range.previous),
    getProgressCounts(user.id),
  ]);

  const target = plan?.dailyStudyTargetMinutes ?? 180;
  const todayMinutes = Math.floor(today / 60);
  const todayPercent = Math.min(100, Math.round((todayMinutes / target) * 100));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="mt-1 text-sm text-zinc-500">Study time and completion, calculated from your records.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-zinc-500">Today</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatHoursMinutes(todayMinutes)} / {formatHoursMinutes(target)}
          </p>
          <Progress className="mt-4" value={todayPercent} />
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">This week</p>
          <p className="mt-2 text-2xl font-semibold">{formatDurationFromSeconds(weekly)}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">This month</p>
          <p className="mt-2 text-2xl font-semibold">{formatDurationFromSeconds(monthly)}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">Completed / pending</p>
          <p className="mt-2 text-2xl font-semibold">
            {counts.completedTasks} / {counts.pendingTasks}
          </p>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-zinc-500">Times revised</p>
          <p className="mt-2 text-2xl font-semibold text-green-700">{counts.timesRevised}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">Tasks in revision list</p>
          <p className="mt-2 text-2xl font-semibold text-yellow-700">{counts.tasksToRevise}</p>
        </Card>
      </section>

      <SubjectAnalysis stats={subjectStats} period={period} comparable={range.previous !== null} now={range.to.getTime()} />
    </div>
  );
}
