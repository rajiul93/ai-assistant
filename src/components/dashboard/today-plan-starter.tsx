"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { APP_TIMEZONE, dayjs, formatClock, formatHoursMinutes } from "@/lib/dayjs";
import { useLiveTimerSeconds, useTimerHydrated } from "@/lib/use-timer";
import { startTodayPlan } from "@/server/actions/plan";
import { useTimerStore } from "@/store/timer";
import { useTimerStartStore } from "@/store/timer-start";

type FirstTask = { title: string; subjectId: string; topicId: string; subjectName: string } | null;

/**
 * "Start Today's Plan" card. Nothing starts on page load or refresh: only pressing the button
 * asks which subject to study, then records today's start (server) and starts the study timer.
 */
export function TodayPlanStarter({
  startedAt,
  firstTask,
  taskCount,
  revisionCount,
  dailyTargetMinutes,
}: {
  startedAt: string | null;
  firstTask: FirstTask;
  taskCount: number;
  revisionCount: number;
  dailyTargetMinutes: number;
}) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const hydrated = useTimerHydrated();
  const running = useTimerStore((state) => state.running);
  const paused = useTimerStore((state) => state.paused);
  const elapsed = useLiveTimerSeconds();

  // Suggest the first task's subject; the picker still asks, so every session has a subject.
  function pickSubject(onStarted?: () => Promise<void>) {
    useTimerStartStore.getState().open({
      suggestedSubjectId: firstTask?.subjectId,
      topicId: firstTask?.topicId,
      onStarted,
    });
  }

  function startPlan() {
    pickSubject(async () => {
      setStarting(true);
      try {
        await startTodayPlan();
        toast.success("Today's plan started — good luck!");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't start today's plan");
      } finally {
        setStarting(false);
      }
    });
  }

  const summary = [
    `${taskCount} task${taskCount === 1 ? "" : "s"}`,
    `${revisionCount} revision${revisionCount === 1 ? "" : "s"}`,
    `${formatHoursMinutes(dailyTargetMinutes)} target`,
  ].join(" · ");

  if (!startedAt) {
    // Phones: a compact half-width card beside the daily target; sm+: a full-width row.
    return <section className="flex h-full flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-6">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight sm:text-lg">Today&apos;s plan</h2>
        <p className="mt-1 text-xs leading-snug text-zinc-500 sm:text-sm">{summary}</p>
        {firstTask ? <p className="mt-2 hidden truncate text-sm text-zinc-700 sm:block">Start with: <span className="font-medium">{firstTask.title}</span>{firstTask.subjectName ? ` · ${firstTask.subjectName}` : ""}</p> : null}
      </div>
      <Button onClick={startPlan} disabled={starting} className="mt-auto h-10 w-full shrink-0 gap-1.5 rounded-xl px-3 text-sm sm:mt-0 sm:h-11 sm:w-auto sm:px-5">
        <Play className="size-4" /> {starting ? "Starting…" : <><span className="sm:hidden">Start plan</span><span className="hidden sm:inline">Start Today&apos;s Plan</span></>}
      </Button>
    </section>;
  }

  const startedLabel = dayjs(startedAt).tz(APP_TIMEZONE).format("h:mm A");

  return <section className="flex h-full flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-6">
    <div className="min-w-0">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-emerald-900 sm:gap-2 sm:text-lg">
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600 sm:size-5" />
        <span className="sm:hidden">Started {startedLabel}</span>
        <span className="hidden sm:inline">Today&apos;s plan started at {startedLabel}</span>
      </h2>
      <p className="mt-1 text-xs leading-snug text-emerald-800/80 sm:text-sm">{summary}</p>
    </div>
    {!hydrated ? null : running ? (
      <Link href="/tasks" className="mt-auto flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-emerald-200 transition hover:ring-emerald-300 sm:mt-0 sm:gap-3 sm:px-4 sm:py-2.5">
        {paused ? <Pause className="size-4 text-amber-600" /> : <span className="size-2.5 animate-pulse rounded-full bg-emerald-500" />}
        <span className="font-mono text-base tabular-nums sm:text-lg">{formatClock(elapsed)}</span>
        <span className="hidden text-sm text-zinc-500 sm:inline">{paused ? "Paused" : "Studying"} · Open tasks</span>
      </Link>
    ) : (
      <Button variant="outline" onClick={() => pickSubject()} className="mt-auto h-10 w-full shrink-0 gap-1.5 rounded-xl bg-white px-3 text-sm sm:mt-0 sm:h-10 sm:w-auto">
        <Play className="size-4" /> <span className="sm:hidden">Continue</span><span className="hidden sm:inline">Continue studying</span>
      </Button>
    )}
  </section>;
}
