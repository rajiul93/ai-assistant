import { DailyChart } from "@/components/progress/daily-chart";
import { ProgressHero } from "@/components/progress/progress-hero";
import { ProgressTabs, type ProgressView } from "@/components/progress/progress-tabs";
import { SubjectAnalysis, analysisPeriods, type AnalysisPeriod } from "@/components/progress/subject-analysis";
import { TaskStats } from "@/components/progress/task-stats";
import { TestSummary } from "@/components/progress/test-summary";
import { requireUser } from "@/lib/auth";
import { APP_TIMEZONE, dayjs, now as appNow, startOfDay, startOfMonth } from "@/lib/dayjs";
import {
  getDailyStudySeconds,
  getMonthlyStudySeconds,
  getProgressCounts,
  getStudyPlan,
  getStudyStreak,
  getSubjectAnalysis,
  getTestSummary,
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

const VIEWS: ProgressView[] = ["daily", "subjects", "work"];

/**
 * Progress: a banner with today against the target, the streak and the preparation deadline, then
 * daily time, subjects, and tasks/tests — tabs on phones (one screen, no scrolling), side by side
 * on large screens.
 */
export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const period = analysisPeriods.find((item) => item.key === params.period)?.key ?? "30d";
  const view = VIEWS.find((item) => item === params.view) ?? "daily";
  const range = periodRange(period);
  const [plan, today, weekly, monthly, daily, subjectStats, counts, streak, tests] = await Promise.all([
    getStudyPlan(user.id),
    getTodayStudySeconds(user.id),
    getWeeklyStudySeconds(user.id),
    getMonthlyStudySeconds(user.id),
    getDailyStudySeconds(user.id, 14),
    getSubjectAnalysis(user.id, range.from, range.to, range.previous),
    getProgressCounts(user.id),
    getStudyStreak(user.id),
    getTestSummary(user.id),
  ]);

  const target = plan?.dailyStudyTargetMinutes ?? 180;
  const prepDays = plan ? dayjs(plan.preparationDeadline).tz(APP_TIMEZONE).startOf("day").diff(appNow().startOf("day"), "day") : null;

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <ProgressHero todayMinutes={Math.floor(today / 60)} targetMinutes={target} streak={streak} weekSeconds={weekly} monthSeconds={monthly} prepDays={prepDays} />
      <ProgressTabs initial={view} panels={{
        daily: <DailyChart days={daily} targetMinutes={target} />,
        subjects: <SubjectAnalysis stats={subjectStats} period={period} comparable={range.previous !== null} now={range.to.getTime()} />,
        work: <div className="space-y-2.5"><TaskStats counts={counts} /><TestSummary summary={tests} /></div>,
      }} />
    </div>
  );
}
