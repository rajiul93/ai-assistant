"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { CalendarClock, Check, Minus, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Revision, Subject, Topic } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { VoiceFormAssistant } from "@/components/voice-form-assistant";
import { APP_TIMEZONE, dayjs, formatDate } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { changeRevisionCount, completeRevision, createRevision, deleteRevision } from "@/server/actions/revisions";
import { useTimerStore } from "@/store/timer";
import { useTimerStartStore } from "@/store/timer-start";

export type RevisionRow = Revision & { topic: Topic; subject: Subject | null };
type RevisionFilter = "DUE" | "UPCOMING" | "DONE" | "ALL";

/** Days from today to the revision date in the app timezone (negative = late). */
function daysFromToday(date: Date, todayMs: number) {
  return dayjs(date).tz(APP_TIMEZONE).startOf("day").diff(dayjs(todayMs).tz(APP_TIMEZONE).startOf("day"), "day");
}

/** Pending revisions due today or earlier — the number shown on the Revisions tab. */
export function dueRevisionCount(revisions: RevisionRow[], todayMs: number) {
  return revisions.filter((revision) => revision.status !== "COMPLETED" && daysFromToday(revision.revisionDate, todayMs) <= 0).length;
}

function whenLabel(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "1 day late";
  return days < 0 ? `${-days} days late` : `in ${days} days`;
}

/**
 * "− 3× +" — how many times this topic has been revised. Updates instantly on tap and saves in
 * the background; a failed save puts the number back.
 */
function RevisionCounter({ revision, todayMs }: { revision: RevisionRow; todayMs: number }) {
  const router = useRouter();
  const [count, setCount] = useState(revision.timesRevised);
  const [lastRevisedAt, setLastRevisedAt] = useState(revision.lastRevisedAt);

  async function change(delta: 1 | -1) {
    if (delta === -1 && count === 0) return;
    const before = { count, lastRevisedAt };
    setCount(count + delta);
    if (delta === 1) setLastRevisedAt(new Date());
    try {
      const saved = await changeRevisionCount(revision.id, delta);
      setCount(saved);
      if (delta === 1) toast.success(`${revision.topic.name}: revised ${saved}×`);
      router.refresh();
    } catch (error) {
      setCount(before.count);
      setLastRevisedAt(before.lastRevisedAt);
      toast.error(error instanceof Error ? error.message : "Couldn't update the count");
    }
  }

  const since = lastRevisedAt ? -daysFromToday(lastRevisedAt, todayMs) : null;
  return <div className="flex items-center gap-2">
    <div className="flex items-center rounded-xl border border-zinc-200 bg-white" role="group" aria-label={`Times revised: ${count}`}>
      <button type="button" onClick={() => void change(-1)} disabled={count === 0} aria-label="One less revision" className="flex size-10 items-center justify-center rounded-l-xl text-zinc-600 transition hover:bg-zinc-100 active:scale-95 disabled:opacity-30 sm:size-8"><Minus className="size-4" /></button>
      <span className="min-w-10 text-center text-sm font-semibold tabular-nums" aria-live="polite">{count}×</span>
      <button type="button" onClick={() => void change(1)} aria-label="Revised once more" className="flex size-10 items-center justify-center rounded-r-xl text-zinc-900 transition hover:bg-zinc-100 active:scale-95 sm:size-8"><Plus className="size-4" /></button>
    </div>
    <span className="text-xs text-zinc-500">{since === null ? "not revised yet" : since <= 0 ? "last: today" : since === 1 ? "last: yesterday" : `last: ${since} days ago`}</span>
  </div>;
}

function AddRevisionForm({ topics, onDone }: { topics: { id: string; name: string; subjectName: string }[]; onDone: () => void }) {
  const router = useRouter();
  const [topicId, setTopicId] = useState("");
  const [revisionDate, setRevisionDate] = useState(() => dayjs().tz(APP_TIMEZONE).add(1, "day").format("YYYY-MM-DD"));
  const [notes, setNotes] = useState("");
  const create = useMutation({
    mutationFn: () => createRevision({ topicId, revisionDate, notes }),
    onSuccess: () => { toast.success("Revision scheduled"); router.refresh(); onDone(); },
    onError: (error: Error) => toast.error(error.message),
  });

  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
    <VoiceFormAssistant title="Revision voice form" steps={[
      { key: "topic", label: "Topic", question: "কোন topic revise করবেন?" },
      { key: "date", label: "Date", question: "কোন তারিখে revision করবেন? YYYY-MM-DD format-এ বলুন" },
      { key: "notes", label: "Notes", question: "কোন note যোগ করবেন? না থাকলে skip বলুন" },
    ]} onComplete={(answers) => {
      const spoken = answers.topic.toLowerCase();
      const topic = topics.find((item) => item.name.toLowerCase() === spoken) ?? topics.find((item) => item.name.toLowerCase().includes(spoken) || spoken.includes(item.name.toLowerCase()));
      if (topic) setTopicId(topic.id);
      if (/^\d{4}-\d{2}-\d{2}$/.test(answers.date)) setRevisionDate(answers.date);
      setNotes(answers.notes === "skip" ? "" : answers.notes);
    }} />
    <NativeSelect aria-label="Topic" value={topicId} onChange={(event) => setTopicId(event.target.value)} required>
      <option value="">Select topic</option>
      {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.subjectName} · {topic.name}</option>)}
    </NativeSelect>
    {topics.length === 0 ? <p className="text-sm text-zinc-500">Add topics to your subjects first (More → Subjects).</p> : null}
    <Input aria-label="Revision date" type="date" value={revisionDate} onChange={(event) => setRevisionDate(event.target.value)} />
    <Textarea placeholder="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
    <div className="flex justify-end">
      <Button type="submit" disabled={create.isPending || !topicId}>{create.isPending ? "Adding…" : "Add revision"}</Button>
    </div>
  </form>;
}

/** Revisions tab of the Tasks page: what's due, what's late, and one tap to study or finish it. */
export function RevisionManager({
  revisions,
  topics,
  todayMs,
  adding,
  onAddingChange,
}: {
  revisions: RevisionRow[];
  topics: { id: string; name: string; subjectName: string }[];
  todayMs: number;
  adding: boolean;
  onAddingChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<RevisionFilter>("DUE");
  const timerRunning = useTimerStore((state) => state.running);

  const complete = useMutation({
    mutationFn: completeRevision,
    onSuccess: () => { toast.success("Topic finished — no more revisions needed"); router.refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: deleteRevision,
    onSuccess: () => { toast.success("Revision removed"); router.refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const pending = revisions.filter((revision) => revision.status !== "COMPLETED");
  const counts = {
    today: pending.filter((revision) => daysFromToday(revision.revisionDate, todayMs) === 0).length,
    late: pending.filter((revision) => daysFromToday(revision.revisionDate, todayMs) < 0).length,
    upcoming: pending.filter((revision) => daysFromToday(revision.revisionDate, todayMs) > 0).length,
    done: revisions.length - pending.length,
  };
  const visible = revisions
    .filter((revision) => {
      const days = daysFromToday(revision.revisionDate, todayMs);
      if (filter === "DUE") return revision.status !== "COMPLETED" && days <= 0;
      if (filter === "UPCOMING") return revision.status !== "COMPLETED" && days > 0;
      if (filter === "DONE") return revision.status === "COMPLETED";
      return true;
    })
    .sort((a, b) => (filter === "DONE" ? b.revisionDate.getTime() - a.revisionDate.getTime() : a.revisionDate.getTime() - b.revisionDate.getTime()));

  function study(revision: RevisionRow) {
    useTimerStartStore.getState().open({
      suggestedSubjectId: revision.subjectId ?? revision.topic.subjectId,
      topicId: revision.topicId,
      label: `Revision: ${revision.topic.name}`,
    });
  }

  const chips: Array<{ id: RevisionFilter; label: string; count: number }> = [
    { id: "DUE", label: "Due", count: counts.today + counts.late },
    { id: "UPCOMING", label: "Upcoming", count: counts.upcoming },
    { id: "DONE", label: "Finished", count: counts.done },
    { id: "ALL", label: "All", count: revisions.length },
  ];

  return <div className="space-y-5">
    <section className="grid grid-cols-4 gap-2">
      {[
        { label: "Today", value: counts.today, tone: "text-zinc-950" },
        { label: "Late", value: counts.late, tone: counts.late ? "text-red-700" : "text-zinc-950" },
        { label: "Upcoming", value: counts.upcoming, tone: "text-zinc-950" },
        { label: "Finished", value: counts.done, tone: "text-emerald-700" },
      ].map((tile) => <div key={tile.label} className="rounded-xl border border-zinc-200 bg-white p-3 text-center">
        <p className={cn("text-xl font-semibold tabular-nums", tile.tone)}>{tile.value}</p>
        <p className="text-[11px] text-zinc-500">{tile.label}</p>
      </div>)}
    </section>

    <p className="text-sm text-zinc-500">Revised <span className="font-semibold tabular-nums text-zinc-900">{revisions.reduce((sum, revision) => sum + revision.timesRevised, 0)}</span> times in total · tap <span className="font-medium">+</span> each time you revise a topic.</p>

    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => <button
        key={chip.id}
        type="button"
        onClick={() => setFilter(chip.id)}
        className={cn("min-h-10 rounded-lg px-3 text-sm sm:min-h-0 sm:py-1.5", filter === chip.id ? "bg-zinc-950 text-white" : "border border-zinc-200 bg-white text-zinc-700")}
      >{chip.label} <span className="ml-1 opacity-60 tabular-nums">{chip.count}</span></button>)}
    </div>

    {visible.length === 0 ? (
      <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-6 py-12 text-center">
        <p className="font-medium">{filter === "DUE" ? "Nothing to revise right now 🎉" : "No revisions here"}</p>
        <p className="mt-1 text-sm text-zinc-500">Schedule a topic to revisit, or set a task&apos;s status to “Revision”.</p>
      </div>
    ) : (
      <ul className="space-y-3">
        {visible.map((revision) => {
          const days = daysFromToday(revision.revisionDate, todayMs);
          const done = revision.status === "COMPLETED";
          return <li key={revision.id} className={cn("rounded-lg border bg-white p-4", !done && days < 0 ? "border-red-200" : "border-zinc-200")}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className={cn("font-medium", done && "text-zinc-500 line-through")}>{revision.topic.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-zinc-500">
                  <span>{revision.subject?.name ?? "Subject"}</span>
                  <span className={cn("flex items-center gap-1", !done && days < 0 && "font-medium text-red-700", !done && days === 0 && "font-medium text-zinc-900")}>
                    <CalendarClock className="size-3.5" /> {formatDate(revision.revisionDate)}{done ? " · done" : ` · ${whenLabel(days)}`}
                  </span>
                </p>
                {revision.notes ? <p className="mt-1 text-sm text-zinc-600">{revision.notes}</p> : null}
                <div className="mt-2.5">
                  {/* Keyed on the saved count so a server refresh resets the optimistic value. */}
                  <RevisionCounter key={`${revision.id}-${revision.timesRevised}`} revision={revision} todayMs={todayMs} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!done ? <>
                  <Button size="sm" variant="secondary" onClick={() => study(revision)} disabled={timerRunning} className="h-10 sm:h-8"><Play className="size-3.5" /> Start</Button>
                  <Button size="sm" variant="outline" onClick={() => complete.mutate(revision.id)} disabled={complete.isPending} title="Finished for good — no more revisions needed" className="h-10 sm:h-8"><Check className="size-3.5" /> Finish</Button>
                </> : null}
                <Button size="sm" variant="outline" onClick={() => remove.mutate(revision.id)} disabled={remove.isPending} aria-label="Delete revision" className="h-10 sm:h-8"><Trash2 className="size-3.5" /></Button>
              </div>
            </div>
          </li>;
        })}
      </ul>
    )}

    <Dialog open={adding} onOpenChange={onAddingChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Schedule a revision</DialogTitle></DialogHeader>
        <AddRevisionForm topics={topics} onDone={() => onAddingChange(false)} />
      </DialogContent>
    </Dialog>
  </div>;
}
