"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Square, Timer } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
 * Phones: a small time chip in the top bar (`variant="chip"`) that opens the controls in a sheet,
 * so nothing covers the page; desktop: the bar at the bottom of the content.
 */
export function SessionBar({ variant = "bar" }: { variant?: "bar" | "chip" }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hydrated = useTimerHydrated();
  const running = useTimerStore((state) => state.running);
  const paused = useTimerStore((state) => state.paused);
  const label = useTimerStore((state) => state.label);
  const targetMinutes = useTimerStore((state) => state.targetMinutes);
  const elapsed = useLiveTimerSeconds();
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState(false);

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

  const togglePause = () => (paused ? useTimerStore.getState().resume() : useTimerStore.getState().pause());


  if (variant === "chip") {
    return <>
      {/* Green with a timer icon reads as "studying" at a glance, without the glare of black
          (owner, 2026-10-15); amber with a pause icon while paused. */}
      <button type="button" onClick={() => setSheet(true)} aria-label={`Study session: ${label || "চলছে"} — খোলো`} className={cn("assistant-in flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-linear-to-r pl-2 pr-3 text-white shadow-[0_6px_16px_-8px_rgba(5,150,105,0.8)] transition active:scale-95", paused ? "from-amber-400 to-orange-400" : "from-emerald-500 to-teal-500")}>
        <span className="flex size-6 items-center justify-center rounded-full bg-white/25">{paused ? <Pause className="size-3.5" /> : <Timer className="size-3.5" />}</span>
        <span className="font-mono text-[13px] font-bold tabular-nums">{formatClock(elapsed)}</span>
      </button>
      {/* Everything about the session, in one sheet: what, how long, goal, pause, stop & save. */}
      <Dialog open={sheet} onOpenChange={setSheet}>
        <DialogContent className="sm:max-w-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-400 to-teal-600 text-white"><Timer className="size-5" /></span>
            <div className="min-w-0">
              <DialogTitle className="truncate text-[17px] font-bold">{label || "Study session"}</DialogTitle>
              <p className="text-xs text-slate-500">{paused ? "থেমে আছে" : "পড়া চলছে"}</p>
            </div>
          </div>
          <p className="mt-5 text-center font-mono text-5xl font-bold tabular-nums tracking-tight text-slate-900">{formatClock(elapsed)}</p>
          {target ? <div className="mt-4">
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-linear-to-r from-emerald-400 to-teal-500 transition-[width] duration-1000" style={{ width: `${progress ?? 0}%` }} /></div>
            <p className="mt-1.5 text-center text-xs text-slate-500">লক্ষ্য {targetMinutes} মিনিট · {Math.round(progress ?? 0)}%</p>
          </div> : null}
          <div className="mt-6 grid grid-cols-2 gap-2">
            <button type="button" onClick={togglePause} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-100 text-[15px] font-semibold text-slate-800 active:scale-95">{paused ? <><Play className="size-5" /> চালু করো</> : <><Pause className="size-5" /> থামাও</>}</button>
            <button type="button" onClick={() => { setSheet(false); void stopAndSave(); }} disabled={saving} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-[#3f6ef3] to-[#5a87f8] text-[15px] font-bold text-white shadow-[0_10px_20px_-12px_rgba(37,99,235,0.9)] active:scale-95 disabled:opacity-60"><Square className="size-4 fill-current" /> শেষ করে সেভ</button>
          </div>
        </DialogContent>
      </Dialog>
    </>;
  }

  return <section
    aria-label="Study session"
    className="assistant-in fixed bottom-6 left-[16.5rem] z-40 w-[26rem] overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.55)]"
  >
    <div className="flex items-center gap-2 py-2 pl-3.5 pr-1.5">
      <span className={cn("size-2.5 shrink-0 rounded-full", paused ? "bg-amber-400" : "animate-pulse bg-emerald-400")} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label || "Study session"}</p>
        {/* One line, so the bar stays short: the time, then the goal in minutes. */}
        <p className="truncate whitespace-nowrap text-xs tabular-nums text-white/70">
          <span className="font-mono font-semibold text-white">{formatClock(elapsed)}</span>{targetMinutes ? ` / ${targetMinutes} মি.` : ""}{paused ? " · থেমে আছে" : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={togglePause}
        aria-label={paused ? "Resume" : "Pause"}
        className="flex size-10 shrink-0 items-center justify-center rounded-xl transition hover:bg-white/10 active:scale-95"
      >{paused ? <Play className="size-5" /> : <Pause className="size-5" />}</button>
      <button
        type="button"
        onClick={() => void stopAndSave()}
        disabled={saving}
        aria-label="Stop and save"
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-zinc-950 transition hover:bg-white/90 active:scale-95 disabled:opacity-60"
      ><Square className="size-3.5 fill-current" /> {saving ? "Saving…" : "Save"}</button>
    </div>
    {progress !== null ? <div className="h-1 bg-white/15"><div className="h-full bg-emerald-400 transition-[width] duration-1000" style={{ width: `${progress}%` }} /></div> : null}
  </section>;
}
