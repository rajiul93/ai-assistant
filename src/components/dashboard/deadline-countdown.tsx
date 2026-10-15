"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { BookOpenCheck, Hourglass } from "lucide-react";
import { APP_TIMEZONE, birthdayAtAge, countdownParts, dayjs, diffParts } from "@/lib/dayjs";
import { cn } from "@/lib/utils";

// One shared 1-second clock for every countdown on the page.
let nowMs = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    nowMs = Date.now();
    timer = setInterval(() => {
      nowMs = Date.now();
      listeners.forEach((notify) => notify());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) { clearInterval(timer); timer = undefined; }
  };
}

/** Current time on the client, ticking every second; null during server rendering. */
function useNow() {
  return useSyncExternalStore(subscribe, () => nowMs, () => null);
}

// Phones show only years, months and days (the card is half the screen wide); hours, minutes and
// seconds join from the sm breakpoint.
const units = [
  { key: "years", label: "Years", short: "Yrs", phone: true },
  { key: "months", label: "Months", short: "Mos", phone: true },
  { key: "days", label: "Days", short: "Days", phone: true },
  { key: "hours", label: "Hours", short: "Hrs", phone: false },
  { key: "minutes", label: "Minutes", short: "Min", phone: false },
  { key: "seconds", label: "Seconds", short: "Sec", phone: false },
] as const;

/**
 * Live countdown on the dashboard. With a date of birth saved on the Study Plan page it counts down
 * to the day the user reaches their age limit (birth date + ageLimitYears), and shows the days left
 * until the preparation deadline under it; without one it counts down to the preparation deadline.
 * Only those dates are stored — the remaining time is recalculated every second in the browser.
 */
export function DeadlineCountdown({ preparationDeadline, dateOfBirth, ageLimitYears }: { preparationDeadline: string | null; dateOfBirth: string | null; ageLimitYears: number }) {
  const now = useNow();
  const target = dateOfBirth ? birthdayAtAge(dateOfBirth, ageLimitYears).toDate() : preparationDeadline ? new Date(preparationDeadline) : null;
  // Calendar days to the preparation deadline, shown separately when the countdown runs to the age limit.
  const prepDays = now !== null && dateOfBirth && preparationDeadline
    ? dayjs(preparationDeadline).tz(APP_TIMEZONE).startOf("day").diff(dayjs(now).tz(APP_TIMEZONE).startOf("day"), "day")
    : null;

  if (!target) {
    return <section className="flex h-full flex-col justify-center rounded-3xl bg-[#eef1fb] p-4 sm:p-6">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Hourglass className="size-5 text-amber-500" /> বয়সের কাউন্টডাউন</p>
      <p className="mt-2 text-sm text-slate-600 sm:text-base">জন্মতারিখ দিলে চাকরির বয়স শেষ হওয়া পর্যন্ত কত সময় বাকি, এখানে দেখাবে।</p>
      <Link href="/plan" className="mt-3 text-sm font-semibold text-blue-700 underline underline-offset-4">Study Plan-এ দিন →</Link>
    </section>;
  }

  const parts = now === null ? null : countdownParts(target, now);
  const age = now !== null && dateOfBirth ? diffParts(dateOfBirth, now) : null;
  const expired = parts?.expired ?? false;

  return <section aria-labelledby="long-term-countdown" className={cn("flex h-full flex-col rounded-[clamp(18px,5vw,28px)] px-[clamp(12px,3.6vw,24px)] py-[clamp(12px,3.6vw,22px)]", expired ? "bg-red-50" : "bg-[#eef1fb]")}>
    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
      <h2 id="long-term-countdown" className="flex items-center gap-[clamp(4px,1.2vw,10px)] whitespace-nowrap text-[clamp(12px,3.3vw,18px)] font-semibold tracking-tight text-slate-900">
        <Hourglass className="size-[clamp(14px,3.8vw,22px)] shrink-0 self-center text-amber-500" />
        {dateOfBirth ? `Until you turn ${ageLimitYears}` : "Preparation deadline"}
      </h2>
      <p className="whitespace-nowrap text-[clamp(10px,2.6vw,14px)] text-slate-500">{dayjs(target).format("D MMM YYYY")}</p>
    </div>

    {expired ? <div className="mt-3">
      <p className="text-xl font-bold text-red-700 sm:text-2xl">{dateOfBirth ? `You've reached ${ageLimitYears}` : "Deadline passed"}</p>
      <p className="mt-1 text-sm text-red-800/80">লক্ষ্য বদলালে <Link href="/plan" className="underline underline-offset-4">Study Plan</Link> ঠিক করে নিন।</p>
    </div> : <>
      <dl className="mt-[clamp(10px,3vw,18px)] grid grid-cols-3 gap-[clamp(4px,1.3vw,10px)] sm:grid-cols-6">
        {units.map((unit) => <div key={unit.key} className={cn("min-w-0 flex-col-reverse rounded-[clamp(8px,2.4vw,14px)] bg-white/85 px-0.5 pb-[clamp(5px,1.6vw,10px)] pt-[clamp(6px,2vw,12px)] text-center", unit.phone ? "flex" : "hidden sm:flex")}>
          <dt className="mt-[clamp(2px,0.6vw,4px)] text-[clamp(8px,2vw,11px)] font-medium uppercase tracking-wide text-slate-500">{unit.short}</dt>
          <dd className="text-[clamp(13px,3.8vw,28px)] font-semibold tabular-nums leading-none text-slate-900">
            {parts ? String(parts[unit.key]).padStart(unit.key === "years" ? 1 : 2, "0") : "–"}
          </dd>
        </div>)}
      </dl>
      {prepDays !== null ? <Link href="/plan" className={cn("mt-[clamp(8px,2.4vw,14px)] flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[clamp(11px,2.9vw,14px)] font-semibold", prepDays < 0 ? "bg-red-100 text-red-700" : prepDays <= 30 ? "bg-amber-100 text-amber-800" : "bg-white/85 text-slate-700")}>
        <BookOpenCheck className="size-[clamp(13px,3.4vw,16px)] shrink-0 text-blue-600" />
        <span className="truncate">{prepDays < 0 ? "প্রস্তুতির তারিখ পেরিয়ে গেছে" : prepDays === 0 ? "আজ প্রস্তুতি শেষের দিন" : <>প্রস্তুতি শেষ হতে <span className="tabular-nums">{prepDays}</span> দিন</>}</span>
      </Link> : null}
      {/* Screen readers get one summary instead of an announcement every second. */}
      {age ? <p className="mt-auto pt-[clamp(10px,3vw,18px)] text-[clamp(10px,2.65vw,14px)] leading-relaxed text-slate-500">Current age: <span className="whitespace-nowrap font-medium tabular-nums text-slate-700">{age.years} years, {age.months} months, {age.days} days</span></p> : null}
      {parts ? <p className="sr-only">{`${parts.years} years, ${parts.months} months, ${parts.days} days left`}</p> : null}
    </>}
  </section>;
}
