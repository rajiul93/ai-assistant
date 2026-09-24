import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Clock, Hourglass, Trophy } from "lucide-react";
import { formatDateTime, formatDurationFromSeconds } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import type { SubjectStat } from "@/server/queries";

export const analysisPeriods = [
  { key: "30d", label: "Last 30 days" },
  { key: "7d", label: "Last 7 days" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
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

  return <section className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Subject analysis</h2>
        <p className="text-sm text-zinc-500">{duration(total)} studied{comparable ? " · compared with the period before" : ""}</p>
      </div>
      <nav aria-label="Period" className="flex flex-wrap gap-1 rounded-xl bg-zinc-100 p-1">
        {analysisPeriods.map((item) => <Link
          key={item.key}
          href={`/progress?period=${item.key}`}
          scroll={false}
          aria-current={item.key === period ? "page" : undefined}
          className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", item.key === period ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}
        >{item.label}</Link>)}
      </nav>
    </div>

    {insights.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {insights.map((insight) => <div key={insight.label} className={cn("rounded-xl border p-4", insight.warn ? "border-amber-200 bg-amber-50/60" : "border-zinc-200")}>
        <p className={cn("flex items-center gap-1.5 text-xs font-medium", insight.warn ? "text-amber-800" : "text-zinc-500")}>{insight.icon}{insight.label}</p>
        <p className="mt-1.5 truncate font-semibold text-zinc-950" title={insight.value}>{insight.value}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{insight.detail}</p>
      </div>)}
    </div> : null}

    {stats.length === 0 ? (
      <p className="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">Add subjects and study with the timer to see your analysis.</p>
    ) : total === 0 ? (
      <p className="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">No study time in this period yet. Start the timer and pick a subject — it will show up here.</p>
    ) : null}

    {total > 0 ? <ul className="space-y-4">
      {stats.map((stat) => {
        const share = Math.round((stat.seconds / total) * 100);
        const average = stat.sessions ? Math.round(stat.seconds / stat.sessions) : 0;
        const tooltip = `${stat.name}: ${duration(stat.seconds)} (${share}%) · ${stat.sessions} sessions · ${stat.activeDays} days · ${stat.finishedTasks} tasks finished · ${stat.openTasks} open`;
        return <li key={stat.subjectId ?? "none"} title={tooltip}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className={cn("truncate font-medium", !stat.subjectId && "text-zinc-500")}>{stat.name}</span>
            <span className="shrink-0 tabular-nums"><span className="font-semibold">{stat.seconds ? duration(stat.seconds) : "—"}</span><span className="ml-2 text-zinc-500">{share}%</span></span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-zinc-900" style={{ width: `${(stat.seconds / max) * 100}%` }} />
          </div>
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500">
            {stat.seconds ? <span>{stat.sessions} session{stat.sessions === 1 ? "" : "s"} · avg {duration(average)} · {stat.activeDays} day{stat.activeDays === 1 ? "" : "s"}</span> : <span>{sinceLabel(stat.lastStudiedAt, now)}</span>}
            {comparable ? <Trend stat={stat} /> : null}
            {stat.finishedTasks ? <span>{stat.finishedTasks} task{stat.finishedTasks === 1 ? "" : "s"} finished</span> : null}
            {stat.openTasks ? <span>{stat.openTasks} open</span> : null}
          </p>
        </li>;
      })}
    </ul> : null}

    <p className="text-xs text-zinc-400">Updated {formatDateTime(new Date(now))}. “Takes longest to learn” = study time ÷ tasks finished in the period.</p>
  </section>;
}
