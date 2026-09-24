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

const units = [
  { key: "years", label: "Years" },
  { key: "months", label: "Months" },
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Minutes" },
  { key: "seconds", label: "Seconds" },
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
      "relative overflow-hidden rounded-2xl p-5 text-white shadow-[0_20px_50px_-24px_rgba(0,0,0,0.6)] sm:p-6",
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
      <dl className="relative mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
        {units.map((unit) => <div key={unit.key} className="flex flex-col-reverse rounded-xl bg-white/7 px-2 py-3 text-center ring-1 ring-white/10 backdrop-blur-sm">
          <dt className="mt-1 text-[11px] font-medium uppercase tracking-wider text-white/55">{unit.label}</dt>
          <dd className="text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
            {parts ? String(parts[unit.key]).padStart(unit.key === "years" ? 1 : 2, "0") : "–"}
          </dd>
        </div>)}
      </dl>
      {/* Screen readers get one summary instead of an announcement every second. */}
      {age ? <p className="relative mt-4 text-sm text-white/60">Current age: <span className="font-medium tabular-nums text-white/85">{age.years} years, {age.months} months, {age.days} days</span></p> : null}
      {parts ? <p className="sr-only">{`${parts.years} years, ${parts.months} months, ${parts.days} days left`}</p> : null}
    </>}
  </section>;
}
