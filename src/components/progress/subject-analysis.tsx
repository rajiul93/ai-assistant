import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Clock, Hourglass, Trophy } from "lucide-react";
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

type Insight = { icon: React.ReactNode; label: string; value: string; detail: string; warn?: boolean };

function duration(seconds: number) {
  return seconds > 0 && seconds < 60 ? `${seconds}s` : formatDurationFromSeconds(seconds);
}

function sinceLabel(date: Date | null, now: number) {
  if (!date) return "never studied";
  const days = Math.floor((now - date.getTime()) / 86_400_000);
  return days <= 0 ? "studied today" : days === 1 ? "last studied yesterday" : `last studied ${days} days ago`;
}

/** Plain-language findings from the numbers: where time went, what lags, what needs attention. */
function buildInsights(stats: SubjectStat[], now: number): Insight[] {
  const subjects = stats.filter((stat) => stat.subjectId);
  const studied = subjects.filter((stat) => stat.seconds > 0);
  if (studied.length === 0) return [];

  const most = studied[0];
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
    { icon: <Trophy className="size-4" />, label: "Most time", value: most.name, detail: `${duration(most.seconds)} · ${most.sessions} session${most.sessions === 1 ? "" : "s"}` },
    {
      icon: <Clock className="size-4" />,
      label: "Least time",
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

function Trend({ stat }: { stat: SubjectStat }) {
  if (stat.previousSeconds === 0) return stat.seconds > 0 ? <span className="text-zinc-500">new this period</span> : null;
  const change = Math.round(((stat.seconds - stat.previousSeconds) / stat.previousSeconds) * 100);
  if (change === 0) return <span className="text-zinc-500">same as before</span>;
  const up = change > 0;
  return <span className={cn("inline-flex items-center gap-0.5", up ? "text-emerald-700" : "text-red-700")}>
    {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
    {Math.abs(change)}% {up ? "more" : "less"} than before
  </span>;
}

/**
 * Subject-wise study analysis: insight tiles plus a single-series bar list (one color, value
 * labels on every row so the list doubles as the table view).
 */
export function SubjectAnalysis({ stats, period, comparable, now }: { stats: SubjectStat[]; period: AnalysisPeriod; comparable: boolean; now: number }) {
  const total = stats.reduce((sum, stat) => sum + stat.seconds, 0);
  const max = Math.max(...stats.map((stat) => stat.seconds), 1);
  const insights = buildInsights(stats, now);

  // Phones: header, a full-width period switch, 2×2 insight cards, then one card per subject.
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
      </div>)}
    </div> : null}

    {stats.length === 0 ? (
      <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">Add subjects and study with the timer to see your analysis.</p>
    ) : total === 0 ? (
      <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">No study time in this period yet. Start the timer and pick a subject — it will show up here.</p>
    ) : null}

    {total > 0 ? <ul className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
      {stats.map((stat) => {
        const share = Math.round((stat.seconds / total) * 100);
        const average = stat.sessions ? Math.round(stat.seconds / stat.sessions) : 0;
        const tooltip = `${stat.name}: ${duration(stat.seconds)} (${share}%) · ${stat.sessions} sessions · ${stat.activeDays} days · ${stat.finishedTasks} tasks finished · ${stat.openTasks} open`;
        return <li key={stat.subjectId ?? "none"} title={tooltip} className="rounded-xl border border-zinc-200 bg-white p-3.5 sm:p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className={cn("truncate font-semibold", !stat.subjectId && "text-zinc-500")}>{stat.name}</span>
            <span className="shrink-0 tabular-nums"><span className="text-lg font-semibold">{stat.seconds ? duration(stat.seconds) : "—"}</span><span className="ml-1.5 text-xs text-zinc-500">{share}%</span></span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-zinc-900" style={{ width: `${(stat.seconds / max) * 100}%` }} />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] text-zinc-600 sm:text-xs">
            {stat.seconds
              ? <>
                <span className="rounded-md bg-zinc-100 px-2 py-0.5">{stat.sessions} session{stat.sessions === 1 ? "" : "s"}</span>
                <span className="rounded-md bg-zinc-100 px-2 py-0.5">avg {duration(average)}</span>
                <span className="rounded-md bg-zinc-100 px-2 py-0.5">{stat.activeDays} day{stat.activeDays === 1 ? "" : "s"}</span>
              </>
              : <span className="rounded-md bg-zinc-100 px-2 py-0.5">{sinceLabel(stat.lastStudiedAt, now)}</span>}
            {stat.finishedTasks ? <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700">{stat.finishedTasks} finished</span> : null}
            {stat.openTasks ? <span className="rounded-md bg-zinc-100 px-2 py-0.5">{stat.openTasks} open</span> : null}
          </div>
          {comparable ? <p className="mt-2 text-[11px] sm:text-xs"><Trend stat={stat} /></p> : null}
        </li>;
      })}
    </ul> : null}

    <p className="text-[11px] text-zinc-400 sm:text-xs">Updated {formatDateTime(new Date(now))}. “Takes longest to learn” = study time ÷ tasks finished in the period.</p>
  </section>;
}
