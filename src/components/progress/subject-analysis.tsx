import Link from "next/link";
import { AlertTriangle, Clock, Hourglass, Trophy } from "lucide-react";
import { formatDateTime, formatDurationFromSeconds } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import type { SubjectStat } from "@/server/queries";

export const analysisPeriods = [
  { key: "30d", label: "Last 30 days", short: "30 days" },
  { key: "7d", label: "Last 7 days", short: "7 days" },
  { key: "month", label: "This month", short: "Month" },
  { key: "all", label: "All time", short: "All" },
] as const;
export type AnalysisPeriod = (typeof analysisPeriods)[number]["key"];

/** `share` (0–100) draws a bar: that subject's part of all study time in the period. */
type Insight = { icon: React.ReactNode; label: string; value: string; detail: string; warn?: boolean; share?: number };

function duration(seconds: number) {
  return seconds > 0 && seconds < 60 ? `${seconds}s` : formatDurationFromSeconds(seconds);
}

/** Plain-language findings from the numbers: where time went, what lags, what needs attention. */
function buildInsights(stats: SubjectStat[], now: number): Insight[] {
  const subjects = stats.filter((stat) => stat.subjectId);
  const studied = subjects.filter((stat) => stat.seconds > 0);
  if (studied.length === 0) return [];

  const most = studied[0];
  const totalSeconds = subjects.reduce((sum, stat) => sum + stat.seconds, 0) || 1;
  const shareOf = (seconds: number) => Math.round((seconds / totalSeconds) * 100);
  const minSeconds = Math.min(...subjects.map((stat) => stat.seconds));
  const least = subjects.filter((stat) => stat.seconds === minSeconds);

  const perTask = subjects
    .filter((stat) => stat.finishedTasks > 0 && stat.seconds > 0)
    .map((stat) => ({ stat, seconds: Math.round(stat.seconds / stat.finishedTasks) }))
    .sort((a, b) => b.seconds - a.seconds);

  const average = subjects.reduce((sum, stat) => sum + stat.seconds, 0) / subjects.length;
  const weekAgo = now - 7 * 86_400_000;
  const attention = subjects
    .filter((stat) => stat.openTasks > 0 && (stat.seconds < average * 0.5 || !stat.lastStudiedAt || stat.lastStudiedAt.getTime() < weekAgo))
    .sort((a, b) => a.seconds - b.seconds)
    .slice(0, 3);

  return [
    { icon: <Trophy className="size-4" />, label: "Most time", value: most.name, share: shareOf(most.seconds), detail: `${duration(most.seconds)} · ${most.sessions} session${most.sessions === 1 ? "" : "s"}` },
    {
      icon: <Clock className="size-4" />,
      label: "Least time",
      share: shareOf(minSeconds),
      value: least.length > 2 ? `${least.length} subjects` : least.map((stat) => stat.name).join(", "),
      detail: minSeconds === 0 ? (least.length > 2 ? `Not studied: ${least.map((stat) => stat.name).join(", ")}` : "Not studied in this period") : duration(minSeconds),
    },
    perTask.length
      ? { icon: <Hourglass className="size-4" />, label: "Takes longest to learn", value: perTask[0].stat.name, detail: `${duration(perTask[0].seconds)} per finished task` }
      : { icon: <Hourglass className="size-4" />, label: "Takes longest to learn", value: "Not enough data", detail: "Finish tasks with a subject to compare" },
    attention.length
      ? { icon: <AlertTriangle className="size-4" />, label: "Needs attention", value: attention.map((stat) => stat.name).join(", "), detail: `Open tasks but little recent study`, warn: true }
      : { icon: <AlertTriangle className="size-4" />, label: "Needs attention", value: "All on track", detail: "Every subject with open tasks is getting time" },
  ];
}

/** Subject-wise study analysis: where the time went, shown as insight cards for the chosen period. */
export function SubjectAnalysis({ stats, period, comparable, now }: { stats: SubjectStat[]; period: AnalysisPeriod; comparable: boolean; now: number }) {
  const total = stats.reduce((sum, stat) => sum + stat.seconds, 0);
  const insights = buildInsights(stats, now);

  // Header, a full-width period switch on phones, then the insight cards.
  return <section className="space-y-4" aria-labelledby="subject-analysis">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 id="subject-analysis" className="text-lg font-semibold tracking-tight">Subject analysis</h2>
        <p className="text-sm text-zinc-500">{duration(total)} studied{comparable ? " · vs. the period before" : ""}</p>
      </div>
      <nav aria-label="Period" className="grid grid-cols-4 gap-1 rounded-xl bg-zinc-100 p-1 sm:flex">
        {analysisPeriods.map((item) => <Link
          key={item.key}
          href={`/progress?period=${item.key}`}
          scroll={false}
          aria-current={item.key === period ? "page" : undefined}
          className={cn("flex min-h-9 items-center justify-center rounded-lg px-2 text-xs font-medium transition sm:px-3", item.key === period ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}
        ><span className="sm:hidden">{item.short}</span><span className="hidden sm:inline">{item.label}</span></Link>)}
      </nav>
    </div>

    {insights.length ? <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4 xl:gap-3">
      {insights.map((insight) => <div key={insight.label} className={cn("min-w-0 rounded-xl border p-3 sm:p-4", insight.warn ? "border-amber-200 bg-amber-50/60" : "border-zinc-200 bg-white")}>
        <p className={cn("flex items-center gap-1.5 text-[11px] font-medium sm:text-xs", insight.warn ? "text-amber-800" : "text-zinc-500")}>{insight.icon}<span className="truncate">{insight.label}</span></p>
        <p className="mt-1.5 truncate text-sm font-semibold text-zinc-950 sm:text-base" title={insight.value}>{insight.value}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-500 sm:text-xs">{insight.detail}</p>
        {insight.share !== undefined ? <div className="mt-2.5">
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuenow={insight.share} aria-valuemin={0} aria-valuemax={100} aria-label={`${insight.value}: ${insight.share}% of study time`}>
              <div className="h-full rounded-full bg-zinc-900" style={{ width: `${insight.share}%` }} />
            </div>
            <span className="shrink-0 text-[11px] font-medium tabular-nums text-zinc-600">{insight.share}%</span>
          </div>
        </div> : null}
      </div>)}
    </div> : null}

    {stats.length === 0 ? (
      <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">Add subjects and study with the timer to see your analysis.</p>
    ) : total === 0 ? (
      <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">No study time in this period yet. Start the timer and pick a subject — it will show up here.</p>
    ) : null}

    <p className="text-[11px] text-zinc-400 sm:text-xs">Updated {formatDateTime(new Date(now))}. “Takes longest to learn” = study time ÷ tasks finished in the period.</p>
  </section>;
}
