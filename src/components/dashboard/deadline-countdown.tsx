"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { birthdayAtAge, countdownParts, diffParts, formatDate } from "@/lib/dayjs";
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
    return <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6">
      <p className="text-sm font-medium text-zinc-500">Age-limit countdown</p>
      <p className="mt-2 text-lg font-semibold">Add your date of birth to start the countdown</p>
      <Link href="/plan" className="mt-3 inline-block text-sm font-medium text-zinc-950 underline underline-offset-4">Set it in Study Plan →</Link>
    </section>;
  }

  const parts = now === null ? null : countdownParts(target, now);
  const age = now !== null && dateOfBirth ? diffParts(dateOfBirth, now) : null;
  const expired = parts?.expired ?? false;

  return <section
    aria-labelledby="long-term-countdown"
    className={cn(
      "relative overflow-hidden rounded-2xl p-4 text-white shadow-[0_20px_50px_-24px_rgba(0,0,0,0.6)] sm:p-6",
      expired ? "bg-linear-to-br from-red-700 to-red-900" : "bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-800",
    )}
  >
    <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-white/5 blur-2xl" />
    <div className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id="long-term-countdown" className="text-sm font-medium text-white/70">⏳ {dateOfBirth ? `Until you turn ${ageLimitYears}` : "Long-term deadline"}</h2>
      <p className="text-sm text-white/60">{formatDate(target)}</p>
    </div>

    {expired ? <div className="relative mt-4">
      <p className="text-3xl font-semibold tracking-tight">{dateOfBirth ? `You've reached ${ageLimitYears}` : "Deadline passed"}</p>
      <p className="mt-1 text-sm text-white/70">The countdown has ended. Update <Link href="/plan" className="underline underline-offset-4">Study Plan</Link> if your goal changed.</p>
    </div> : <>
      <dl className="relative mt-3 grid grid-cols-6 gap-1.5 sm:mt-4 sm:gap-3">
        {units.map((unit) => <div key={unit.key} className="flex flex-col-reverse rounded-lg bg-white/7 px-0.5 py-2 text-center ring-1 ring-white/10 backdrop-blur-sm sm:rounded-xl sm:px-2 sm:py-3">
          <dt className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/55 sm:mt-1 sm:text-[11px] sm:tracking-wider"><span className="sm:hidden">{unit.short}</span><span className="hidden sm:inline">{unit.label}</span></dt>
          <dd className="text-xl font-semibold tabular-nums tracking-tight sm:text-4xl">
            {parts ? String(parts[unit.key]).padStart(unit.key === "years" ? 1 : 2, "0") : "–"}
          </dd>
        </div>)}
      </dl>
      {/* Screen readers get one summary instead of an announcement every second. */}
      {age ? <p className="relative mt-3 text-xs text-white/60 sm:mt-4 sm:text-sm">Current age: <span className="font-medium tabular-nums text-white/85">{age.years} years, {age.months} months, {age.days} days</span></p> : null}
      {parts ? <p className="sr-only">{`${parts.years} years, ${parts.months} months, ${parts.days} days left`}</p> : null}
    </>}
  </section>;
}
