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
    return <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">Today&apos;s plan</h2>
        <p className="mt-1 text-sm text-zinc-500">{summary}</p>
        {firstTask ? <p className="mt-2 truncate text-sm text-zinc-700">Start with: <span className="font-medium">{firstTask.title}</span>{firstTask.subjectName ? ` · ${firstTask.subjectName}` : ""}</p> : null}
      </div>
      <Button size="lg" onClick={startPlan} disabled={starting} className="shrink-0 gap-2 rounded-xl">
        <Play className="size-4" /> {starting ? "Starting…" : "Start Today's Plan"}
      </Button>
    </section>;
  }

  const startedLabel = dayjs(startedAt).tz(APP_TIMEZONE).format("h:mm A");

  return <section className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
    <div className="min-w-0">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-emerald-900"><CheckCircle2 className="size-5 text-emerald-600" /> Today&apos;s plan started at {startedLabel}</h2>
      <p className="mt-1 text-sm text-emerald-800/80">{summary}</p>
    </div>
    {!hydrated ? null : running ? (
      <Link href="/tasks" className="flex shrink-0 items-center gap-3 rounded-xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-emerald-200 transition hover:ring-emerald-300">
        {paused ? <Pause className="size-4 text-amber-600" /> : <span className="size-2.5 animate-pulse rounded-full bg-emerald-500" />}
        <span className="font-mono text-lg tabular-nums">{formatClock(elapsed)}</span>
        <span className="text-sm text-zinc-500">{paused ? "Paused" : "Studying"} · Open tasks</span>
      </Link>
    ) : (
      <Button variant="outline" onClick={() => pickSubject()} className="shrink-0 gap-2 rounded-xl bg-white">
        <Play className="size-4" /> Continue studying
      </Button>
    )}
  </section>;
}
