"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { formatClock } from "@/lib/dayjs";
import { useLiveTimerSeconds, useTimerHydrated } from "@/lib/use-timer";
import { cn } from "@/lib/utils";
import { saveStudySession } from "@/server/actions/sessions";
import { updateTaskStatus } from "@/server/actions/tasks";
import { useTimerStore } from "@/store/timer";

/**
 * The running study session, pinned above the tab bar on every page (like a music mini-player):
 * what is being studied, elapsed time, goal progress, pause/resume and stop & save.
 * Sessions are started from a task (or "Start session") on the Tasks page, or by voice.
 */
export function SessionBar() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hydrated = useTimerHydrated();
  const running = useTimerStore((state) => state.running);
  const paused = useTimerStore((state) => state.paused);
  const label = useTimerStore((state) => state.label);
  const targetMinutes = useTimerStore((state) => state.targetMinutes);
  const elapsed = useLiveTimerSeconds();
  const [saving, setSaving] = useState(false);

  if (!hydrated || !running) return null;

  const target = targetMinutes ? targetMinutes * 60 : null;
  const progress = target ? Math.min(100, (elapsed / target) * 100) : null;

  async function stopAndSave() {
    const timer = useTimerStore.getState();
    const seconds = Math.max(1, timer.elapsedSeconds());
    const endedAt = new Date();
    const { taskId, label: sessionLabel } = timer;
    setSaving(true);
    try {
      await saveStudySession({
        subjectId: timer.subjectId,
        topicId: timer.topicId,
        startedAt: new Date(endedAt.getTime() - seconds * 1000).toISOString(),
        endedAt: endedAt.toISOString(),
        durationSeconds: seconds,
      });
      timer.reset();
      router.refresh();
      toast.success(`Saved ${formatClock(seconds)} of study`, taskId ? {
        description: sessionLabel,
        duration: 8000,
        action: {
          label: "Mark task done",
          onClick: () => void updateTaskStatus(taskId, "FINISHED")
            .then(async () => { toast.success("Task marked done"); await queryClient.invalidateQueries({ queryKey: ["tasks"] }); router.refresh(); })
            .catch((error: Error) => toast.error(error.message)),
        },
      } : undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the session");
    } finally {
      setSaving(false);
    }
  }

  return <section
    aria-label="Study session"
    className="assistant-in fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 right-[5.25rem] z-40 overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.55)] lg:bottom-6 lg:left-[16.5rem] lg:right-auto lg:w-[26rem]"
  >
    <div className="flex items-center gap-3 py-2 pl-3.5 pr-2">
      <span className={cn("size-2.5 shrink-0 rounded-full", paused ? "bg-amber-400" : "animate-pulse bg-emerald-400")} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label || "Study session"}</p>
        <p className="font-mono text-xs tabular-nums text-white/70">
          {formatClock(elapsed)}{target ? ` / ${formatClock(target)}` : ""}{paused ? " · paused" : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={() => (paused ? useTimerStore.getState().resume() : useTimerStore.getState().pause())}
        aria-label={paused ? "Resume" : "Pause"}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl transition hover:bg-white/10 active:scale-95"
      >{paused ? <Play className="size-5" /> : <Pause className="size-5" />}</button>
      <button
        type="button"
        onClick={() => void stopAndSave()}
        disabled={saving}
        aria-label="Stop and save"
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-zinc-950 transition hover:bg-white/90 active:scale-95 disabled:opacity-60"
      ><Square className="size-3.5 fill-current" /> {saving ? "Saving…" : "Save"}</button>
    </div>
    {progress !== null ? <div className="h-1 bg-white/15"><div className="h-full bg-emerald-400 transition-[width] duration-1000" style={{ width: `${progress}%` }} /></div> : null}
  </section>;
}
