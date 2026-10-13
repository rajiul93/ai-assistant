"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CalendarCheck2, CheckCircle2, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { APP_TIMEZONE, dayjs, formatClock, formatHoursMinutes } from "@/lib/dayjs";
import { useLiveTimerSeconds, useTimerHydrated } from "@/lib/use-timer";
import { startTodayPlan } from "@/server/actions/plan";
import { useTimerStore } from "@/store/timer";
import { useTimerStartStore } from "@/store/timer-start";

export type FirstTask = { title: string; subjectId: string; topicId: string; subjectName: string } | null;

/**
 * Starting today's plan: asks which subject to study, then records today's start (server) and starts
 * the study timer. Nothing starts on page load — only a button press. Shared by the banner and the card.
 */
export function useStartPlan(firstTask: FirstTask) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  // Suggest the first task's subject; the picker still asks, so every session has a subject.
  const pickSubject = (onStarted?: () => Promise<void>) => {
    useTimerStartStore.getState().open({ suggestedSubjectId: firstTask?.subjectId, topicId: firstTask?.topicId, onStarted });
  };

  const start = () => pickSubject(async () => {
    setStarting(true);
    try {
      await startTodayPlan();
      toast.success("আজকের প্ল্যান শুরু হলো — শুভকামনা!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "আজকের প্ল্যান শুরু করা গেল না।");
    } finally {
      setStarting(false);
    }
  });

  return { start, starting, pickSubject };
}

/** The home banner's button: start today's plan, or go back to studying once it has started. */
export function HeroPlanButton({ startedAt, firstTask }: { startedAt: string | null; firstTask: FirstTask }) {
  const { start, starting } = useStartPlan(firstTask);
  const style = "inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 text-[13px] font-semibold text-slate-900 shadow-sm transition hover:bg-blue-50 active:scale-95 disabled:opacity-60 sm:h-12 sm:px-6 sm:text-base";
  if (startedAt) return <Link href="/tasks" className={style}>পড়া চালিয়ে যান <ArrowRight className="size-4" /></Link>;
  return <button type="button" onClick={start} disabled={starting} className={style}>{starting ? "শুরু হচ্ছে…" : "আজকের প্ল্যান শুরু করুন"} <ArrowRight className="size-4" /></button>;
}

/** "Today's Plan" card: what's planned, and Start Plan (or the running timer once started). */
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
  const { start, starting, pickSubject } = useStartPlan(firstTask);
  const hydrated = useTimerHydrated();
  const running = useTimerStore((state) => state.running);
  const paused = useTimerStore((state) => state.paused);
  const elapsed = useLiveTimerSeconds();

  return <section className="flex h-full flex-col rounded-3xl bg-[#e8f8ef] p-3.5 sm:p-5">
    <h2 className="flex items-center gap-1.5 whitespace-nowrap text-sm font-bold tracking-tight text-slate-900 sm:gap-2 sm:text-lg">
      {startedAt ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600 sm:size-6" /> : <CalendarCheck2 className="size-4 shrink-0 text-emerald-600 sm:size-6" />}
      Today&apos;s Plan
    </h2>
    <p className="mt-1.5 text-xs leading-relaxed text-slate-500 sm:text-sm">
      {taskCount} tasks · {revisionCount} revision<br />{formatHoursMinutes(dailyTargetMinutes)} target
      {startedAt ? <><br /><span className="font-medium text-emerald-800">শুরু {dayjs(startedAt).tz(APP_TIMEZONE).format("h:mm A")}</span></> : null}
    </p>
    <div className="mt-auto pt-3">
      {!startedAt
        ? <button type="button" onClick={start} disabled={starting} className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-95 disabled:opacity-60 sm:h-12 sm:text-base">
          <Play className="size-4 fill-current" /> {starting ? "Starting…" : "Start Plan"}
        </button>
        : !hydrated ? null : running
          ? <Link href="/tasks" className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-slate-900 ring-1 ring-emerald-200 sm:h-12">
            {paused ? <Pause className="size-4 text-amber-600" /> : <span className="size-2.5 animate-pulse rounded-full bg-emerald-500" />}
            <span className="font-mono tabular-nums">{formatClock(elapsed)}</span>
          </Link>
          : <button type="button" onClick={() => pickSubject()} className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-95 sm:h-12">
            <Play className="size-4 fill-current" /> Continue
          </button>}
    </div>
  </section>;
}
