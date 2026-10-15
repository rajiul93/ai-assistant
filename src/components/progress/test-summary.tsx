import Link from "next/link";
import { ChevronRight, ListChecks } from "lucide-react";
import { dayjs } from "@/lib/dayjs";
import { cn } from "@/lib/utils";

const card = "rounded-3xl bg-white p-3.5 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] sm:p-5";
const tone = (percent: number) => (percent >= 80 ? "bg-emerald-50 text-emerald-700" : percent >= 50 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700");

/** Preliminary (MCQ) tests: overall accuracy and the latest attempts, each linking to its result. */
export function TestSummary({ summary, show = 2 }: { summary: { tests: number; correct: number; total: number; recent: Array<{ id: string; correct: number; total: number; submittedAt: Date; set: { id: string; topicName: string } }> }; show?: number }) {
  const accuracy = summary.total ? Math.round((summary.correct / summary.total) * 100) : 0;
  return <section className={card} aria-labelledby="test-summary">
    <Link href="/preliminary?status=testing" className="flex items-center gap-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-50"><ListChecks className="size-5 text-rose-500" /></span>
      <span className="min-w-0 flex-1">
        <h2 id="test-summary" className="text-[15px] font-bold leading-tight text-slate-900">MCQ test</h2>
        {summary.tests ? <span className="block truncate text-[11.5px] text-slate-500">গড় সঠিক · {summary.tests}টি test · {summary.correct}/{summary.total}</span> : null}
      </span>
      {summary.tests ? <span className={cn("text-2xl font-extrabold tabular-nums", accuracy >= 80 ? "text-emerald-600" : accuracy >= 50 ? "text-amber-600" : "text-red-600")}>{accuracy}%</span> : null}
      <ChevronRight className="size-4 shrink-0 text-slate-400" />
    </Link>

    {summary.tests ? <>
      <ul className="mt-2.5 space-y-1.5">
        {summary.recent.slice(0, show).map((attempt) => {
          const percent = attempt.total ? Math.round((attempt.correct / attempt.total) * 100) : 0;
          return <li key={attempt.id}>
            <Link href={`/preliminary/${attempt.set.id}/result/${attempt.id}`} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-1.5 transition hover:bg-slate-100">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-slate-800">{attempt.set.topicName}</span>
                <span className="block text-[11px] text-slate-500">{dayjs(attempt.submittedAt).format("D MMM")} · {attempt.correct}/{attempt.total}</span>
              </span>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums", tone(percent))}>{percent}%</span>
            </Link>
          </li>;
        })}
      </ul>
    </> : <p className="mt-3 text-[13px] text-slate-500">এখনো কোনো test দাওনি। Preliminary-তে একটা set Testing-এ নিয়ে exam দাও — ফল এখানে জমবে।</p>}
  </section>;
}
