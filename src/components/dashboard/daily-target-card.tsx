"use client";

import { CheckCircle2, Pause } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatClock, formatHoursMinutes } from "@/lib/dayjs";
import { useLiveTimerSeconds, useTimerHydrated } from "@/lib/use-timer";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/store/timer";

/** "4h 45m 10s" — whole units only, seconds included so short sessions (1m 10s) visibly count. */
function formatSpan(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours && `${hours}h`, (hours || minutes) && `${minutes}m`, `${seconds}s`].filter(Boolean).join(" ");
}

/**
 * Daily study target counting down in real time: target − (sessions saved today + the running
 * timer). It only moves while the study timer runs — opening the dashboard changes nothing.
 */
export function DailyTargetCard({ dailyTargetMinutes, savedSeconds }: { dailyTargetMinutes: number; savedSeconds: number }) {
  const hydrated = useTimerHydrated();
  const running = useTimerStore((state) => state.running);
  const paused = useTimerStore((state) => state.paused);
  const liveSeconds = useLiveTimerSeconds();

  const targetSeconds = dailyTargetMinutes * 60;
  const studied = savedSeconds + liveSeconds;
  const remaining = Math.max(0, targetSeconds - studied);
  const done = targetSeconds > 0 && remaining === 0;
  const percent = targetSeconds ? Math.min(100, (studied / targetSeconds) * 100) : 0;
  const ticking = hydrated && running && !paused;

  // Phones: a compact half-width card beside "Today's plan"; sm+: the full card.
  return <section className={cn("flex h-full flex-col rounded-2xl border bg-white p-3.5 shadow-sm sm:p-6", done ? "border-emerald-200" : "border-zinc-200")}>
    <div className="flex items-start justify-between gap-2 sm:gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 sm:text-sm">
          {/* On phones the status chip is hidden; this dot shows whether time is counting down. */}
          <span className={cn("size-2 shrink-0 rounded-full sm:hidden", ticking ? "animate-pulse bg-emerald-500" : hydrated && running ? "bg-amber-400" : "bg-zinc-300")} aria-hidden />
          <span className="sm:hidden">Left of {formatHoursMinutes(dailyTargetMinutes)}</span>
          <span className="hidden sm:inline">Daily study target · {formatHoursMinutes(dailyTargetMinutes)}</span>
        </h2>
        {done ? (
          <p className="mt-2 flex items-center gap-1.5 text-lg font-semibold tracking-tight text-emerald-700 sm:gap-2 sm:text-3xl"><CheckCircle2 className="size-5 sm:size-7" /> Target reached</p>
        ) : (
          <p className="mt-1.5 font-mono text-xl font-semibold tracking-tight tabular-nums sm:mt-2 sm:text-4xl">{formatClock(remaining)}<span className="ml-2 hidden font-sans text-base font-medium text-zinc-500 sm:inline">left</span></p>
        )}
      </div>
      <span className={cn(
        "hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:flex",
        ticking ? "bg-emerald-50 text-emerald-700" : hydrated && running ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-500",
      )}>
        {ticking ? <span className="size-2 animate-pulse rounded-full bg-emerald-500" /> : hydrated && running ? <Pause className="size-3" /> : null}
        {ticking ? "Counting down" : hydrated && running ? "Paused" : "Timer off"}
      </span>
    </div>
    <div className="mt-auto pt-3 sm:mt-4 sm:pt-0"><Progress value={percent} /></div>
    <p className="mt-2 text-xs text-zinc-500 sm:text-sm">
      <span className="font-medium tabular-nums text-zinc-800">{formatSpan(studied)}</span> studied<span className="hidden sm:inline"> today</span>
      {done && studied > targetSeconds ? <> · <span className="text-emerald-700">+{formatSpan(studied - targetSeconds)}</span></> : null}
      {!running && hydrated && !done ? <span className="hidden sm:inline"> · starts counting when the study timer runs</span> : null}
    </p>
  </section>;
}
