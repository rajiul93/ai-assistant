import { dayjs, formatDurationFromSeconds, formatHoursMinutes } from "@/lib/dayjs";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি"];
const card = "rounded-3xl bg-white p-4 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] sm:p-5";

/**
 * The last days' study time as bars, with the daily target as a dashed line: blue when the target
 * was met, lighter when not, today outlined. Pure CSS, no chart library.
 */
export function DailyChart({ days, targetMinutes }: { days: Array<{ day: string; seconds: number }>; targetMinutes: number }) {
  const targetSeconds = targetMinutes * 60;
  const top = Math.max(targetSeconds, ...days.map((entry) => entry.seconds)) * 1.1 || 1;
  const total = days.reduce((sum, entry) => sum + entry.seconds, 0);
  const studiedDays = days.filter((entry) => entry.seconds > 0).length;
  const metDays = days.filter((entry) => targetSeconds && entry.seconds >= targetSeconds).length;
  const lastIndex = days.length - 1;

  return <section className={card} aria-labelledby="daily-chart">
    <div className="flex items-end justify-between gap-2">
      <div>
        <h2 id="daily-chart" className="text-[15px] font-bold text-slate-900">গত {days.length} দিন</h2>
        <p className="text-[12px] text-slate-500">মোট {formatDurationFromSeconds(total)} · গড় {formatDurationFromSeconds(Math.round(total / days.length))}/দিন</p>
      </div>
      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-700">{metDays}/{days.length} দিন লক্ষ্য পূরণ</span>
    </div>

    <div className="relative mt-4 h-[clamp(120px,32vh,176px)]">
      {targetSeconds ? <div className="absolute inset-x-0 border-t-2 border-dashed border-amber-400/80" style={{ bottom: `${(targetSeconds / top) * 100}%` }}>
        <span className="absolute -top-5 right-0 rounded bg-white/90 px-1 text-[10px] font-semibold text-amber-600">লক্ষ্য {formatHoursMinutes(targetMinutes)}</span>
      </div> : null}
      <ol className="flex h-full items-end gap-[clamp(2px,1vw,6px)]">
        {days.map((entry, index) => {
          const met = targetSeconds > 0 && entry.seconds >= targetSeconds;
          const height = entry.seconds ? Math.max(4, (entry.seconds / top) * 100) : 0;
          return <li key={entry.day} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${dayjs(entry.day).format("D MMM")}: ${formatDurationFromSeconds(entry.seconds)}`}>
            {entry.seconds ? <div className={cn("w-full rounded-t-md transition-all", met ? "bg-linear-to-t from-blue-600 to-blue-400" : "bg-blue-200", index === lastIndex && "ring-2 ring-blue-600 ring-offset-1")} style={{ height: `${height}%` }} />
              : <div className="h-1 w-full rounded-full bg-slate-100" />}
          </li>;
        })}
      </ol>
    </div>
    <ol className="mt-1.5 flex gap-[clamp(2px,1vw,6px)]" aria-hidden>
      {days.map((entry, index) => <li key={entry.day} className={cn("min-w-0 flex-1 truncate text-center text-[9.5px] sm:text-[11px]", index === lastIndex ? "font-bold text-blue-700" : "text-slate-400")}>
        {index === lastIndex ? "আজ" : WEEKDAYS[dayjs(entry.day).day()]}
      </li>)}
    </ol>
    <p className="sr-only">{studiedDays} দিন পড়েছ, {metDays} দিন লক্ষ্য পূরণ হয়েছে।</p>
  </section>;
}
