"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Lightbulb, Play, RotateCcw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { isRevisionTask, lastRevisedLabel, needsRevision, nextRevisionLabel, STALE_DAYS } from "@/lib/revisions";
import { cn } from "@/lib/utils";
import { changeTaskRevisionCount, updateTaskStatus } from "@/server/actions/tasks";
import type { TaskWithRelations } from "@/server/queries";
import { useTimerStore } from "@/store/timer";
import { useTimerStartStore } from "@/store/timer-start";
import { MathText } from "@/components/math-text";

type RevisionFilter = "NEEDS" | "REVISED" | "ALL";

const bn = (value: number) => String(value).replace(/\d/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)]);
const card = "rounded-3xl bg-white shadow-[0_6px_24px_-14px_rgba(15,23,42,0.18)]";

/** What this tab is for, folded into one line until tapped. */
function HowItWorks() {
  const [open, setOpen] = useState(false);
  return <section className={cn(card, "overflow-hidden")}>
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 p-3.5 text-left">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-amber-300 to-orange-400 text-white"><Lightbulb className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-slate-900">রিভিশন কী কাজে লাগে?</span>
        <span className="block text-[12.5px] text-slate-500">পড়া শেষ হলেও মনে রাখতে মাঝে মাঝে আবার পড়তে হয়</span>
      </span>
      <ChevronDown className={cn("size-5 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
    </button>
    {open ? <ol className="space-y-2.5 border-t border-slate-100 px-4 py-3.5 text-[14px] text-slate-700">
      {[
        ["১", "কোনো task শেষ করলে সেটা নিজে থেকেই এখানে চলে আসে।"],
        ["২", "সেই পড়াটা আবার পড়ো, তারপর “রিভিশন দিলাম” চাপো — কতবার পড়েছ তা গোনা থাকে।"],
        ["৩", `${bn(STALE_DAYS)} দিন আর রিভিশন না দিলে এটা আবার “রিভিশন বাকি”-তে আসে, যাতে ভুলে না যাও।`],
      ].map(([step, text]) => <li key={step} className="flex gap-2.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{step}</span>
        <span>{text}</span>
      </li>)}
    </ol> : null}
  </section>;
}

/**
 * One task to revise: what it is, when it was last revised and when it is due again, a big
 * "রিভিশন দিলাম" that counts one revision (saved in the background; a failed save is undone),
 * and quieter actions to study it with the timer, take one back, or return it to the task list.
 */
function RevisionCard({ task, todayMs, timerRunning, onStudy, onBack, onSaved }: { task: TaskWithRelations; todayMs: number; timerRunning: boolean; onStudy: () => void; onBack: () => void; onSaved: () => void }) {
  const [count, setCount] = useState(task.timesRevised);
  const [lastRevisedAt, setLastRevisedAt] = useState(task.lastRevisedAt);
  const due = needsRevision({ status: task.status, lastRevisedAt }, todayMs);

  async function change(delta: 1 | -1) {
    if (delta === -1 && count === 0) return;
    const before = { count, lastRevisedAt };
    setCount(count + delta);
    if (delta === 1) setLastRevisedAt(new Date());
    try {
      const saved = await changeTaskRevisionCount(task.id, delta);
      setCount(saved);
      toast.success(delta === 1 ? `দারুণ! “${task.title}” — ${bn(saved)} বার রিভিশন হলো` : "একটা রিভিশন কমানো হলো");
      onSaved();
    } catch (error) {
      setCount(before.count);
      setLastRevisedAt(before.lastRevisedAt);
      toast.error(error instanceof Error ? error.message : "সেভ করা গেল না");
    }
  }

  return <li className={cn(card, "p-4 ring-1", due ? "ring-amber-200" : "ring-transparent")}>
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-bold leading-snug text-slate-900"><MathText text={task.title} /></p>
        <p className="mt-0.5 text-[13px] text-slate-500">{task.subject?.name ?? "কোনো বিষয় নেই"}{task.topic ? ` · ${task.topic.name}` : ""}</p>
      </div>
      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold", count ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{bn(count)} বার</span>
    </div>

    <div className={cn("mt-3 flex items-center gap-2 rounded-2xl px-3 py-2 text-[13px]", due ? "bg-amber-50 text-amber-900" : "bg-emerald-50/70 text-emerald-900")}>
      <span className={cn("size-2 shrink-0 rounded-full", due ? "bg-amber-500" : "bg-emerald-500")} />
      <span className="min-w-0 flex-1">{lastRevisedLabel(lastRevisedAt, todayMs)} · <b>{nextRevisionLabel(lastRevisedAt, todayMs)}</b></span>
    </div>

    <button type="button" onClick={() => void change(1)} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 text-[15px] font-bold text-white shadow-[0_10px_20px_-12px_rgba(5,150,105,0.9)] transition active:scale-[0.98]">
      <Check className="size-5" strokeWidth={2.6} /> রিভিশন দিলাম
    </button>

    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={onStudy} disabled={timerRunning} title={timerRunning ? "আগে চলমান টাইমার শেষ করো" : undefined} className="flex h-9 items-center gap-1.5 rounded-full bg-blue-50 px-3 text-[13px] font-semibold text-blue-700 disabled:opacity-40"><Play className="size-3.5" /> টাইমার চালিয়ে পড়ো</button>
      {count > 0 ? <button type="button" onClick={() => void change(-1)} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-slate-500 hover:bg-slate-100"><RotateCcw className="size-3.5" /> ভুলে চেপেছি, একটা কমাও</button> : null}
      <button type="button" onClick={onBack} title="আসলে শেষ হয়নি — task-এর তালিকায় ফেরত পাঠাও" className="ml-auto flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-slate-500 hover:bg-slate-100"><Undo2 className="size-3.5" /> শেষ হয়নি</button>
    </div>
  </li>;
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
  const revised = revisionTasks.filter((task) => task.timesRevised > 0);
  const total = revisionTasks.reduce((sum, task) => sum + task.timesRevised, 0);
  const visible = (filter === "NEEDS" ? needs : filter === "REVISED" ? revised : revisionTasks)
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
      toast.success(`“${task.title}” task-এর তালিকায় ফেরত গেল`);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "সরানো গেল না");
    }
  }

  const chips: Array<{ id: RevisionFilter; label: string; count: number }> = [
    { id: "NEEDS", label: "রিভিশন বাকি", count: needs.length },
    { id: "REVISED", label: "রিভিশন দেওয়া", count: revised.length },
    { id: "ALL", label: "সব", count: revisionTasks.length },
  ];

  return <div className="space-y-3">
    <HowItWorks />

    <section className="grid grid-cols-3 gap-2">
      {[
        { label: "রিভিশন বাকি", value: needs.length, tone: needs.length ? "from-amber-400 to-orange-500" : "from-slate-300 to-slate-400" },
        { label: "শেষ করা task", value: revisionTasks.length, tone: "from-blue-400 to-indigo-500" },
        { label: "মোট রিভিশন", value: total, tone: "from-emerald-400 to-teal-500" },
      ].map((tile) => <div key={tile.label} className={cn(card, "p-3 text-center")}>
        <p className={cn("bg-linear-to-br bg-clip-text text-2xl font-bold tabular-nums text-transparent", tile.tone)}>{bn(tile.value)}</p>
        <p className="text-[11.5px] font-medium text-slate-500">{tile.label}</p>
      </div>)}
    </section>

    <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-200/60 p-1">
      {chips.map((chip) => <button
        key={chip.id}
        type="button"
        onClick={() => setFilter(chip.id)}
        aria-pressed={filter === chip.id}
        className={cn("h-10 rounded-xl text-[13px] font-semibold transition", filter === chip.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
      >{chip.label} <span className="tabular-nums opacity-60">{bn(chip.count)}</span></button>)}
    </div>

    {visible.length === 0 ? (
      <div className={cn(card, "px-6 py-10 text-center")}>
        <p className="text-[15px] font-bold text-slate-900">{revisionTasks.length === 0 ? "এখনো কোনো task শেষ হয়নি" : filter === "NEEDS" ? "সব রিভিশন হয়ে গেছে 🎉" : "এখানে কিছু নেই"}</p>
        <p className="mt-1 text-sm text-slate-500">{revisionTasks.length === 0 ? "কোনো task শেষ করলে সেটা এখানে আসবে, তখন রিভিশন দিতে পারবে।" : filter === "NEEDS" ? `${bn(STALE_DAYS)} দিন পর আবার এখানে মনে করিয়ে দেবে।` : "অন্য ট্যাব দেখো।"}</p>
      </div>
    ) : (
      <ul className="space-y-2.5">
        {visible.map((task) => <RevisionCard
          // Keyed on the saved count so a refresh resets the optimistic value.
          key={`${task.id}-${task.timesRevised}`}
          task={task}
          todayMs={todayMs}
          timerRunning={timerRunning}
          onStudy={() => study(task)}
          onBack={() => void backToTasks(task)}
          onSaved={refresh}
        />)}
      </ul>
    )}
  </div>;
}
