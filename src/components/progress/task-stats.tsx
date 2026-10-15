import Link from "next/link";
import { ChevronRight, ListTodo } from "lucide-react";

const card = "rounded-3xl bg-white p-3.5 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] sm:p-5";

/** Task counts in one row: finished, pending, revisions done, waiting for revision. */
export function TaskStats({ counts }: { counts: { completedTasks: number; pendingTasks: number; timesRevised: number; tasksToRevise: number } }) {
  const stats = [
    { label: "শেষ", value: counts.completedTasks, tone: "text-emerald-700" },
    { label: "বাকি", value: counts.pendingTasks, tone: "text-slate-900" },
    { label: "রিভিশন হয়েছে", value: `${counts.timesRevised}×`, tone: "text-blue-700" },
    { label: "রিভিশন লিস্টে", value: counts.tasksToRevise, tone: "text-amber-700" },
  ];
  return <section className={card} aria-labelledby="task-stats">
    <Link href="/tasks" className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-full bg-violet-50"><ListTodo className="size-5 text-violet-600" /></span>
        <h2 id="task-stats" className="text-[15px] font-bold text-slate-900">কাজের হিসাব</h2>
      </span>
      <ChevronRight className="size-4 text-slate-400" />
    </Link>
    <dl className="mt-2 grid grid-cols-4 gap-1.5 text-center">
      {stats.map((stat) => <div key={stat.label} className="flex min-w-0 flex-col-reverse rounded-2xl bg-slate-50 px-1 py-1.5">
        <dt className="truncate text-[10.5px] text-slate-500">{stat.label}</dt>
        <dd className={`text-lg font-bold tabular-nums leading-tight ${stat.tone}`}>{stat.value}</dd>
      </div>)}
    </dl>
  </section>;
}
