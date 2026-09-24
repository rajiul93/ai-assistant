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

  return <section className={cn("rounded-2xl border bg-white p-5 shadow-sm sm:col-span-2 sm:p-6", done ? "border-emerald-200" : "border-zinc-200")}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-medium text-zinc-500">Daily study target · {formatHoursMinutes(dailyTargetMinutes)}</h2>
        {done ? (
          <p className="mt-2 flex items-center gap-2 text-3xl font-semibold tracking-tight text-emerald-700"><CheckCircle2 className="size-7" /> Target reached</p>
        ) : (
          <p className="mt-2 font-mono text-4xl font-semibold tracking-tight tabular-nums">{formatClock(remaining)}<span className="ml-2 font-sans text-base font-medium text-zinc-500">left</span></p>
        )}
      </div>
      <span className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        ticking ? "bg-emerald-50 text-emerald-700" : hydrated && running ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-500",
      )}>
        {ticking ? <span className="size-2 animate-pulse rounded-full bg-emerald-500" /> : hydrated && running ? <Pause className="size-3" /> : null}
        {ticking ? "Counting down" : hydrated && running ? "Paused" : "Timer off"}
      </span>
    </div>
    <Progress className="mt-4" value={percent} />
    <p className="mt-2 text-sm text-zinc-500">
      Studied <span className="font-medium tabular-nums text-zinc-800">{formatSpan(studied)}</span> today
      {done && studied > targetSeconds ? <> · <span className="text-emerald-700">+{formatSpan(studied - targetSeconds)} extra</span></> : null}
      {!running && hydrated && !done ? " · starts counting when the study timer runs" : null}
    </p>
  </section>;
}
