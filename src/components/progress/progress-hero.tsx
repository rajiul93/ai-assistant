import { CalendarClock, Flame } from "lucide-react";
import { formatDurationFromSeconds, formatHoursMinutes } from "@/lib/dayjs";
import { cn } from "@/lib/utils";

/** Today's study as a ring against the daily target. */
function TodayRing({ minutes, target }: { minutes: number; target: number }) {
  const percent = target ? Math.min(100, Math.round((minutes / target) * 100)) : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  return <div className="relative size-[clamp(76px,21vw,116px)] shrink-0">
    <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
      <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="9" className="text-white/20" />
      <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" className="text-white transition-[stroke-dashoffset] duration-700" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)} />
    </svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
      <span className="text-[clamp(19px,5.5vw,28px)] font-extrabold leading-none tabular-nums">{percent}%</span>
      <span className="mt-0.5 text-[9.5px] text-white/80 sm:text-[10.5px]">আজকের লক্ষ্য</span>
    </div>
  </div>;
}

/**
 * The progress page's banner (home-page blue): today against the target, the study streak, this
 * week and month, and how long until the preparation deadline.
 */
export function ProgressHero({ todayMinutes, targetMinutes, streak, weekSeconds, monthSeconds, prepDays }: {
  todayMinutes: number;
  targetMinutes: number;
  streak: number;
  weekSeconds: number;
  monthSeconds: number;
  /** Days to the preparation deadline; negative once passed; null when no plan. */
  prepDays: number | null;
}) {
  const left = Math.max(0, targetMinutes - todayMinutes);
  return <section className="relative overflow-hidden rounded-[28px] bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb] p-3.5 text-white shadow-[0_18px_40px_-18px_rgba(37,99,235,0.6)] sm:p-6">
    <div aria-hidden className="pointer-events-none absolute -left-10 -top-16 size-56 rounded-full bg-white/10 blur-2xl" />
    <div className="relative flex items-center gap-4 sm:gap-6">
      <TodayRing minutes={todayMinutes} target={targetMinutes} />
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-bold tracking-tight sm:text-xl">আমার অগ্রগতি</h1>
        <p className="mt-0.5 text-[13px] text-white/85">
          আজ <b className="font-bold text-white">{formatHoursMinutes(todayMinutes)}</b> / {formatHoursMinutes(targetMinutes)}
        </p>
        <p className="mt-0.5 text-[12px] text-white/80">{left ? `লক্ষ্য পূরণে আর ${formatHoursMinutes(left)}` : "আজকের লক্ষ্য পূরণ হয়েছে 🎉"}</p>
        <span className={cn("mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold", streak ? "bg-orange-400/90 text-white" : "bg-white/20")}>
          <Flame className="size-3.5" /> {streak ? `${streak} দিন টানা` : "আজ পড়ে streak শুরু করো"}
        </span>
      </div>
    </div>
    <dl className="relative mt-2.5 grid grid-cols-3 gap-2">
      {[
        { label: "এই সপ্তাহ", value: formatDurationFromSeconds(weekSeconds) },
        { label: "এই মাস", value: formatDurationFromSeconds(monthSeconds) },
        { label: "প্রস্তুতি শেষ", value: prepDays === null ? "—" : prepDays < 0 ? "পেরিয়েছে" : `${prepDays} দিন`, icon: true },
      ].map((stat) => <div key={stat.label} className="min-w-0 rounded-2xl bg-white/15 px-2 py-1 text-center">
        <dd className="truncate text-[14px] font-bold tabular-nums leading-tight sm:text-lg">{stat.value}</dd>
        <dt className="flex items-center justify-center gap-1 truncate text-[10.5px] text-white/80 sm:text-xs">{stat.icon ? <CalendarClock className="size-3" /> : null}{stat.label}</dt>
      </div>)}
    </dl>
  </section>;
}
