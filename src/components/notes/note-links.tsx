"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListTodo, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { PickDialog } from "@/components/pick-dialog";
import { cn } from "@/lib/utils";
import { attachNoteToTask, createTaskFromNote, detachNoteFromTask, listTaskChoices, setNoteSubject } from "@/server/actions/notes";

export type SubjectOption = { id: string; name: string };
export type TopicOption = { id: string; name: string; subjectId: string; parentName?: string | null };

type LinkedTask = { id: string; title: string; status: string };

const selectClass = "h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-zinc-400 disabled:opacity-50 sm:flex-none sm:max-w-52";

/** Under the note title: its subject and topic, and the tasks it is attached to. */
export function NoteLinks({ noteId, subjectId, topicId, tasks, subjects, topics }: {
  noteId: string;
  subjectId: string | null;
  topicId: string | null;
  tasks: LinkedTask[];
  subjects: SubjectOption[];
  topics: TopicOption[];
}) {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState(subjectId ?? "");
  const [topic, setTopic] = useState(topicId ?? "");
  const [savingSubject, setSavingSubject] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const choices = useQuery({ queryKey: ["task-choices"], queryFn: () => listTaskChoices(), enabled: pickerOpen });
  const subjectTopics = useMemo(() => topics.filter((item) => item.subjectId === subject), [topics, subject]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["note", noteId] }),
      queryClient.invalidateQueries({ queryKey: ["notes"] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["task-choices"] }),
    ]);
  };

  async function saveSubject(nextSubject: string, nextTopic: string) {
    const before = { subject, topic };
    setSubject(nextSubject);
    setTopic(nextTopic);
    setSavingSubject(true);
    try {
      await setNoteSubject(noteId, { subjectId: nextSubject || null, topicId: nextTopic || null });
      await refresh();
    } catch (error) {
      setSubject(before.subject);
      setTopic(before.topic);
      toast.error(error instanceof Error ? error.message : "Couldn't save the subject.");
    } finally {
      setSavingSubject(false);
    }
  }

  async function toggleTask(taskId: string, attach: boolean) {
    setBusyId(taskId);
    try {
      if (attach) await attachNoteToTask(noteId, taskId);
      else await detachNoteFromTask(noteId, taskId);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update the task.");
    } finally {
      setBusyId(null);
    }
  }

  async function newTask() {
    setCreating(true);
    try {
      await createTaskFromNote(noteId);
      await refresh();
      toast.success("এই note দিয়ে নতুন task বানানো হলো");
      setPickerOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create the task.");
    } finally {
      setCreating(false);
    }
  }

  return <div className="mb-3 space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Subject" value={subject} disabled={savingSubject} onChange={(event) => void saveSubject(event.target.value, "")} className={cn(selectClass, !subject && "text-zinc-400")}>
        <option value="">No subject</option>
        {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <select aria-label="Topic" value={topic} disabled={savingSubject || !subject || subjectTopics.length === 0} onChange={(event) => void saveSubject(subject, event.target.value)} className={cn(selectClass, !topic && "text-zinc-400")}>
        <option value="">{subject && subjectTopics.length === 0 ? "No topics yet" : "No topic"}</option>
        {subjectTopics.map((item) => <option key={item.id} value={item.id}>{item.parentName ? `${item.parentName} › ${item.name}` : item.name}</option>)}
      </select>
    </div>

    <div className="flex flex-wrap items-center gap-1.5">
      {tasks.map((task) => <span key={task.id} className="flex max-w-full items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-2.5 pr-1 text-xs text-zinc-700">
        <ListTodo className="size-3.5 shrink-0 text-zinc-500" />
        <Link href="/tasks" className={cn("truncate hover:underline", task.status === "FINISHED" && "line-through text-zinc-400")}>{task.title}</Link>
        <button type="button" disabled={busyId === task.id} onClick={() => void toggleTask(task.id, false)} aria-label={`Remove from “${task.title}”`} className="flex size-6 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-white hover:text-zinc-900 disabled:opacity-50"><X className="size-3.5" /></button>
      </span>)}
      <button type="button" onClick={() => setPickerOpen(true)} className="flex h-8 items-center gap-1 rounded-full border border-dashed border-zinc-300 px-3 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50">
        <Plus className="size-3.5" /> {tasks.length ? "Task" : "Task-এ যোগ করো"}
      </button>
    </div>

    <PickDialog
      open={pickerOpen}
      onOpenChange={setPickerOpen}
      title="কোন task-এ এই note যোগ করবে?"
      placeholder="Search tasks"
      emptyText="এখনো কোনো task নেই।"
      loading={choices.isPending}
      items={(choices.data ?? []).map((task) => ({ id: task.id, title: task.title, hint: task.subject?.name ?? null, muted: task.status === "FINISHED" }))}
      selectedIds={tasks.map((task) => task.id)}
      busyId={busyId}
      onToggle={(item, selected) => void toggleTask(item.id, selected)}
      footer={<button type="button" disabled={creating} onClick={() => void newTask()} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
        <Plus className="size-4" /> {creating ? "Creating…" : "এই note দিয়ে নতুন task"}
      </button>}
    />
  </div>;
}
