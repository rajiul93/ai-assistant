import Link from "next/link";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { formatDurationFromSeconds } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import type { SubjectStat } from "@/server/queries";

export const analysisPeriods = [
  { key: "30d", label: "৩০ দিন" },
  { key: "7d", label: "৭ দিন" },
  { key: "month", label: "এই মাস" },
  { key: "all", label: "সব সময়" },
] as const;
export type AnalysisPeriod = (typeof analysisPeriods)[number]["key"];

const card = "rounded-3xl bg-white p-4 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] sm:p-5";
const BAR = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];
const duration = (seconds: number) => (seconds > 0 && seconds < 60 ? `${seconds}s` : formatDurationFromSeconds(seconds));
const SHOWN = 5;

/** Subjects with open tasks but little recent study (under half the average, or none for a week). */
function needsAttention(subjects: SubjectStat[], now: number) {
  const average = subjects.reduce((sum, stat) => sum + stat.seconds, 0) / (subjects.length || 1);
  const weekAgo = now - 7 * 86_400_000;
  return subjects
    .filter((stat) => stat.openTasks > 0 && (stat.seconds < average * 0.5 || !stat.lastStudiedAt || stat.lastStudiedAt.getTime() < weekAgo))
    .sort((a, b) => a.seconds - b.seconds)
    .slice(0, 3);
}

/**
 * Where the study time went, per subject, for the chosen period: a share bar, the time, and the
 * change against the period before. Shows the top five (fits one phone screen) and names the
 * subjects that need attention.
 */
export function SubjectAnalysis({ stats, period, comparable, now }: { stats: SubjectStat[]; period: AnalysisPeriod; comparable: boolean; now: number }) {
  const subjects = stats.filter((stat) => stat.subjectId);
  const total = stats.reduce((sum, stat) => sum + stat.seconds, 0);
  const top = stats.filter((stat) => stat.seconds > 0).slice(0, SHOWN);
  const rest = stats.filter((stat) => stat.seconds > 0).length - top.length;
  const attention = needsAttention(subjects, now);

  return <section className={card} aria-labelledby="subject-analysis">
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <h2 id="subject-analysis" className="text-[15px] font-bold text-slate-900">বিষয়ভিত্তিক সময়</h2>
        <p className="truncate text-[12px] text-slate-500">মোট {duration(total)}{rest > 0 ? ` · আরও ${rest}টি বিষয়` : ""}{comparable ? " · % = আগের তুলনায়" : ""}</p>
      </div>
    </div>
    <nav aria-label="সময়কাল" className="mt-2 grid grid-cols-4 gap-1 rounded-full bg-slate-100 p-1">
      {analysisPeriods.map((item) => <Link
        key={item.key}
        href={`/progress?view=subjects&period=${item.key}`}
        scroll={false}
        aria-current={item.key === period ? "page" : undefined}
        className={cn("flex h-7 items-center justify-center rounded-full text-[12px] font-semibold transition", item.key === period ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")}
      >{item.label}</Link>)}
    </nav>

    {top.length ? <ul className="mt-3 space-y-2">
      {top.map((stat, index) => {
        const share = total ? Math.round((stat.seconds / total) * 100) : 0;
        const change = comparable && stat.previousSeconds ? Math.round(((stat.seconds - stat.previousSeconds) / stat.previousSeconds) * 100) : null;
        // One line each: name · share bar · time · change against the period before.
        return <li key={stat.subjectId ?? "none"} className="flex min-w-0 items-center gap-2 text-[12.5px]" title={`${stat.name}: ${share}%`}>
          <span className="w-[34%] min-w-0 truncate font-semibold text-slate-800">{stat.name}</span>
          <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={share} aria-valuemin={0} aria-valuemax={100} aria-label={`${stat.name}: ${share}%`}>
            <span className={cn("block h-full rounded-full", BAR[index % BAR.length])} style={{ width: `${Math.max(share, 3)}%` }} />
          </span>
          <span className="w-14 shrink-0 text-right tabular-nums text-slate-600">{duration(stat.seconds)}</span>
          {comparable ? change !== null
            ? <span className={cn("flex w-11 shrink-0 items-center justify-end gap-0.5 text-[11px] font-semibold tabular-nums", change >= 0 ? "text-emerald-600" : "text-red-600")}>{change >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{Math.abs(change)}%</span>
            : <span className="w-11 shrink-0 text-right text-[11px] font-semibold text-blue-600">নতুন</span> : null}
        </li>;
      })}
    </ul> : <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-center text-[13px] text-slate-500">{subjects.length ? "এই সময়ে পড়া হয়নি। Timer চালিয়ে subject বেছে নাও — এখানে দেখাবে।" : "Subject যোগ করে timer দিয়ে পড়লে এখানে দেখাবে।"}</p>}

    {attention.length ? <p className="mt-3 flex items-center gap-1.5 rounded-2xl bg-amber-50 px-3 py-1.5 text-[12px] text-amber-900" title="Task বাকি, কিন্তু সম্প্রতি কম পড়া">
      <AlertTriangle className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate"><b>নজর দাও:</b> {attention.map((stat) => stat.name).join(", ")}</span>
    </p> : null}
  </section>;
}
