import { SubjectAnalysis, analysisPeriods, type AnalysisPeriod } from "@/components/progress/subject-analysis";
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

  const studyTime = [
    { label: "Today", value: formatHoursMinutes(todayMinutes), detail: `of ${formatHoursMinutes(target)}` },
    { label: "This week", value: formatDurationFromSeconds(weekly) },
    { label: "This month", value: formatDurationFromSeconds(monthly) },
  ];
  const taskStats = [
    { label: "Done", value: counts.completedTasks, tone: "text-emerald-700" },
    { label: "Pending", value: counts.pendingTasks, tone: "text-zinc-950" },
    { label: "Revised", value: counts.timesRevised, tone: "text-emerald-700", suffix: "×" },
    { label: "To revise", value: counts.tasksToRevise, tone: "text-amber-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="mt-1 text-sm text-zinc-500">Study time and completion, calculated from your records.</p>
      </div>

      {/* Two compact summary cards: study time and tasks — one row of numbers each, even on phones. */}
      <section className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Study time</h2>
          <dl className="mt-3 grid grid-cols-3 divide-x divide-zinc-100">
            {studyTime.map((item) => (
              <div key={item.label} className="flex flex-col-reverse px-2 text-center first:pl-0 last:pr-0">
                <dt className="text-[11px] text-zinc-500 sm:text-xs">{item.label}</dt>
                <dd className="text-lg font-semibold tabular-nums sm:text-2xl">
                  {item.value}
                  {item.detail ? <span className="block text-[11px] font-normal text-zinc-400 sm:text-xs">{item.detail}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-3">
            <Progress value={todayPercent} aria-label="Today's target" />
            <p className="mt-1.5 text-xs text-zinc-500">{todayPercent}% of today&apos;s target</p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Tasks</h2>
          <dl className="mt-3 grid grid-cols-4 divide-x divide-zinc-100">
            {taskStats.map((item) => (
              <div key={item.label} className="flex flex-col-reverse px-1 text-center first:pl-0 last:pr-0">
                <dt className="truncate text-[11px] text-zinc-500 sm:text-xs">{item.label}</dt>
                <dd className={`text-xl font-semibold tabular-nums sm:text-2xl ${item.tone}`}>{item.value}{item.suffix ?? ""}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-zinc-500">“Revised” counts every revision; “To revise” is finished tasks in the revision list.</p>
        </div>
      </section>

      <SubjectAnalysis stats={subjectStats} period={period} comparable={range.previous !== null} now={range.to.getTime()} />
    </div>
  );
}
