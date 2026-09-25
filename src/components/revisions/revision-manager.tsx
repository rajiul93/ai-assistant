"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Minus, Play, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isRevisionTask, lastRevisedLabel, needsRevision, daysSinceRevised, STALE_DAYS } from "@/lib/revisions";
import { cn } from "@/lib/utils";
import { changeTaskRevisionCount, updateTaskStatus } from "@/server/actions/tasks";
import type { TaskWithRelations } from "@/server/queries";
import { useTimerStore } from "@/store/timer";
import { useTimerStartStore } from "@/store/timer-start";

type RevisionFilter = "NEEDS" | "REVISED" | "ALL";

/**
 * "− 3× +" — how many times this task has been revised. Updates instantly on tap and saves in the
 * background; a failed save puts the number back.
 */
function RevisionCounter({ task, todayMs, onSaved }: { task: TaskWithRelations; todayMs: number; onSaved: () => void }) {
  const [count, setCount] = useState(task.timesRevised);
  const [lastRevisedAt, setLastRevisedAt] = useState(task.lastRevisedAt);

  async function change(delta: 1 | -1) {
    if (delta === -1 && count === 0) return;
    const before = { count, lastRevisedAt };
    setCount(count + delta);
    if (delta === 1) setLastRevisedAt(new Date());
    try {
      const saved = await changeTaskRevisionCount(task.id, delta);
      setCount(saved);
      if (delta === 1) toast.success(`${task.title}: revised ${saved}×`);
      onSaved();
    } catch (error) {
      setCount(before.count);
      setLastRevisedAt(before.lastRevisedAt);
      toast.error(error instanceof Error ? error.message : "Couldn't update the count");
    }
  }

  const since = daysSinceRevised(lastRevisedAt, todayMs);
  return <div className="flex items-center gap-2">
    <div className="flex items-center rounded-xl border border-zinc-200 bg-white" role="group" aria-label={`Times revised: ${count}`}>
      <button type="button" onClick={() => void change(-1)} disabled={count === 0} aria-label="One less revision" className="flex size-10 items-center justify-center rounded-l-xl text-zinc-600 transition hover:bg-zinc-100 active:scale-95 disabled:opacity-30 sm:size-8"><Minus className="size-4" /></button>
      <span className="min-w-10 text-center text-sm font-semibold tabular-nums" aria-live="polite">{count}×</span>
      <button type="button" onClick={() => void change(1)} aria-label="Revised once more" className="flex size-10 items-center justify-center rounded-r-xl text-zinc-900 transition hover:bg-zinc-100 active:scale-95 sm:size-8"><Plus className="size-4" /></button>
    </div>
    <span className={cn("text-xs", since === null || since >= STALE_DAYS ? "font-medium text-amber-700" : "text-zinc-500")}>
      {lastRevisedLabel(lastRevisedAt, todayMs)}
    </span>
  </div>;
}

/**
 * Revisions tab of the Tasks page. Revision belongs to the task: once a task is finished (or set to
 * "Revision") it appears here, and each revision is counted on the task itself.
 */
export function RevisionManager({ tasks, todayMs }: { tasks: TaskWithRelations[]; todayMs: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<RevisionFilter>("NEEDS");
  const timerRunning = useTimerStore((state) => state.running);

  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["tasks"] }); router.refresh(); };
  const revisionTasks = tasks.filter(isRevisionTask);
  const needs = revisionTasks.filter((task) => needsRevision(task, todayMs));
  const total = revisionTasks.reduce((sum, task) => sum + task.timesRevised, 0);
  const visible = (filter === "NEEDS" ? needs : filter === "REVISED" ? revisionTasks.filter((task) => task.timesRevised > 0) : revisionTasks)
    .toSorted((a, b) => new Date(a.lastRevisedAt ?? 0).getTime() - new Date(b.lastRevisedAt ?? 0).getTime());

  function study(task: TaskWithRelations) {
    useTimerStartStore.getState().open({
      suggestedSubjectId: task.subjectId ?? undefined,
      topicId: task.topicId ?? undefined,
      label: `Revision: ${task.title}`,
      taskId: task.id,
    });
  }

  async function backToTasks(task: TaskWithRelations) {
    try {
      await updateTaskStatus(task.id, "IN_PROGRESS");
      toast.success(`“${task.title}” moved back to tasks`);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't move the task");
    }
  }

  const chips: Array<{ id: RevisionFilter; label: string; count: number }> = [
    { id: "NEEDS", label: "Needs revision", count: needs.length },
    { id: "REVISED", label: "Revised", count: revisionTasks.filter((task) => task.timesRevised > 0).length },
    { id: "ALL", label: "All", count: revisionTasks.length },
  ];

  return <div className="space-y-5">
    <section className="grid grid-cols-3 gap-2">
      {[
        { label: "Needs revision", value: needs.length, tone: needs.length ? "text-amber-700" : "text-zinc-950" },
        { label: "In revision list", value: revisionTasks.length, tone: "text-zinc-950" },
        { label: "Times revised", value: total, tone: "text-emerald-700" },
      ].map((tile) => <div key={tile.label} className="rounded-xl border border-zinc-200 bg-white p-3 text-center">
        <p className={cn("text-xl font-semibold tabular-nums", tile.tone)}>{tile.value}</p>
        <p className="text-[11px] text-zinc-500">{tile.label}</p>
      </div>)}
    </section>

    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => <button
        key={chip.id}
        type="button"
        onClick={() => setFilter(chip.id)}
        className={cn("min-h-10 rounded-lg px-3 text-sm sm:min-h-0 sm:py-1.5", filter === chip.id ? "bg-zinc-950 text-white" : "border border-zinc-200 bg-white text-zinc-700")}
      >{chip.label} <span className="ml-1 tabular-nums opacity-60">{chip.count}</span></button>)}
    </div>

    {visible.length === 0 ? (
      <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-6 py-12 text-center">
        <p className="font-medium">{revisionTasks.length === 0 ? "No finished tasks yet" : filter === "NEEDS" ? "Everything is freshly revised 🎉" : "Nothing here"}</p>
        <p className="mt-1 text-sm text-zinc-500">Finish a task and it comes here for revision — tap + each time you revise it.</p>
      </div>
    ) : (
      <ul className="space-y-3">
        {visible.map((task) => <li key={task.id} className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">{task.title}</p>
              <p className="mt-0.5 text-sm text-zinc-500">
                {task.subject?.name ?? "No subject"}{task.topic ? ` · ${task.topic.name}` : ""}{task.status === "REVISION" ? " · marked for revision" : ""}
              </p>
              <div className="mt-2.5">
                {/* Keyed on the saved count so a refresh resets the optimistic value. */}
                <RevisionCounter key={`${task.id}-${task.timesRevised}`} task={task} todayMs={todayMs} onSaved={refresh} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => study(task)} disabled={timerRunning} className="h-10 sm:h-8"><Play className="size-3.5" /> Start</Button>
              <Button size="sm" variant="outline" onClick={() => void backToTasks(task)} title="Not finished after all — move it back to the task list" className="h-10 sm:h-8"><Undo2 className="size-3.5" /> Back to tasks</Button>
            </div>
          </div>
        </li>)}
      </ul>
    )}
  </div>;
}
