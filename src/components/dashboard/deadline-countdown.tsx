"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Hourglass } from "lucide-react";
import { birthdayAtAge, countdownParts, dayjs, diffParts } from "@/lib/dayjs";
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

// Short labels keep all six units in one row on a phone.
const units = [
  { key: "years", label: "Years", short: "Yrs" },
  { key: "months", label: "Months", short: "Mos" },
  { key: "days", label: "Days", short: "Days" },
  { key: "hours", label: "Hours", short: "Hrs" },
  { key: "minutes", label: "Minutes", short: "Min" },
  { key: "seconds", label: "Seconds", short: "Sec" },
] as const;

/**
 * Live countdown on the dashboard. With a date of birth saved on the Study Plan page it counts down
 * to the day the user reaches their age limit (birth date + ageLimitYears); otherwise to the
 * long-term deadline. Only those dates are stored — the remaining time is recalculated from the
 * current time every second in the browser.
 */
export function DeadlineCountdown({ deadline, dateOfBirth, ageLimitYears }: { deadline: string | null; dateOfBirth: string | null; ageLimitYears: number }) {
  const now = useNow();
  const target = dateOfBirth ? birthdayAtAge(dateOfBirth, ageLimitYears).toDate() : deadline ? new Date(deadline) : null;

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

  return <section aria-labelledby="long-term-countdown" className={cn("flex h-full flex-col rounded-[clamp(18px,5vw,28px)] p-[clamp(11px,3.4vw,24px)]", expired ? "bg-red-50" : "bg-[#eef1fb]")}>
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
      <h2 id="long-term-countdown" className="flex items-center gap-[clamp(4px,1.2vw,10px)] whitespace-nowrap text-[clamp(12.5px,3.6vw,20px)] font-bold tracking-tight text-slate-900">
        <Hourglass className="size-[clamp(15px,4.2vw,26px)] shrink-0 text-amber-500" />
        {dateOfBirth ? `Until you turn ${ageLimitYears}` : "Long-term deadline"}
      </h2>
      <p className="whitespace-nowrap text-[clamp(10px,2.8vw,15px)] text-slate-500">{dayjs(target).format("D MMM YYYY")}</p>
    </div>

    {expired ? <div className="mt-3">
      <p className="text-xl font-bold text-red-700 sm:text-2xl">{dateOfBirth ? `You've reached ${ageLimitYears}` : "Deadline passed"}</p>
      <p className="mt-1 text-sm text-red-800/80">লক্ষ্য বদলালে <Link href="/plan" className="underline underline-offset-4">Study Plan</Link> ঠিক করে নিন।</p>
    </div> : <>
      <dl className="mt-[clamp(8px,2.6vw,18px)] grid grid-cols-6 gap-[clamp(3px,1.1vw,10px)]">
        {units.map((unit) => <div key={unit.key} className="flex min-w-0 flex-col-reverse rounded-[clamp(8px,2.4vw,16px)] bg-white/85 py-[clamp(6px,2vw,14px)] text-center">
          <dt className="mt-0.5 text-[clamp(8.5px,2.3vw,12px)] font-medium uppercase tracking-wide text-slate-500">{unit.short}</dt>
          <dd className="text-[clamp(15px,4.6vw,32px)] font-bold tabular-nums leading-tight text-slate-900">
            {parts ? String(parts[unit.key]).padStart(unit.key === "years" ? 1 : 2, "0") : "–"}
          </dd>
        </div>)}
      </dl>
      {/* Screen readers get one summary instead of an announcement every second. */}
      {age ? <p className="mt-auto pt-[clamp(8px,2.6vw,18px)] text-[clamp(10.5px,2.9vw,15px)] leading-snug text-slate-600">Current age: <span className="font-medium tabular-nums text-slate-800">{age.years} years, {age.months} months, {age.days} days</span></p> : null}
      {parts ? <p className="sr-only">{`${parts.years} years, ${parts.months} months, ${parts.days} days left`}</p> : null}
    </>}
  </section>;
}
