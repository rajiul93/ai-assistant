"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { Check, ChevronDown, CornerDownRight, ListPlus, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { createSubject, createTopic, deleteSubject, deleteTopic, reorderSubjects, reorderTopics } from "@/server/actions/subjects";
import { createTask } from "@/server/actions/tasks";
import { SortableList } from "@/components/sortable-list";
import { VoiceFormAssistant } from "@/components/voice-form-assistant";

type Topic = { id: string; name: string; parentId: string | null };
type Subject = { id: string; name: string; topics: Topic[] };
type Pending = { kind: "subject" | "topic"; id: string; name: string } | null;

/** The topics under one parent (or a subject's top level), reorderable among themselves. */
function TopicLevel({ subject, parentId, depth, openTasks, onDelete, path, className }: {
  subject: Subject;
  parentId: string | null;
  depth: number;
  openTasks: Record<string, number>;
  onDelete: (pending: Pending) => void;
  path: string[];
  className?: string;
}) {
  const topics = subject.topics.filter((topic) => (topic.parentId ?? null) === parentId);
  if (!topics.length) return null;
  return <SortableList
    items={topics}
    className={className}
    onReorder={(ids) => reorderTopics({ subjectId: subject.id, parentId, ids })}
  >
    {(topic, handle) => <TopicRow topic={topic} subject={subject} depth={depth} openTasks={openTasks} onDelete={onDelete} path={path} handle={handle} />}
  </SortableList>;
}

/** Small inline "name + Add" form, used for new topics and sub-topics. */
function AddTopicForm({ subjectId, parentId, placeholder, onDone, autoFocus }: { subjectId: string; parentId?: string; placeholder: string; onDone?: () => void; autoFocus?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => createTopic({ name, subjectId, parentId: parentId ?? "" }),
    onSuccess: () => {
      toast.success("Topic added");
      setName("");
      onDone?.();
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return <form
    className="flex gap-2"
    onSubmit={(event) => { event.preventDefault(); if (name.trim()) create.mutate(); }}
  >
    <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={placeholder} autoFocus={autoFocus} className="h-10" />
    <Button type="submit" variant="secondary" disabled={create.isPending || !name.trim()} className="h-10 shrink-0">Add</Button>
  </form>;
}

/**
 * One topic and, below it, its sub-topics (any depth). Children are picked from the subject's full
 * flat topic list by parentId, so no depth limit applies.
 */
function TopicRow({ topic, subject, depth, openTasks, onDelete, path, handle }: {
  topic: Topic;
  subject: Subject;
  depth: number;
  openTasks: Record<string, number>;
  onDelete: (pending: Pending) => void;
  path: string[];
  handle: ReactNode;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const inTasks = openTasks[topic.id] ?? 0;

  // One tap: the topic becomes a task under its subject and topic, ready on the Tasks page.
  const addTask = useMutation({
    mutationFn: () => createTask({
      title: topic.name,
      // The parent topics say where it sits ("Grammar › Tense"), which the bare name may not.
      description: path.length ? path.join(" › ") : "",
      subjectId: subject.id,
      topicId: topic.id,
      estimatedMinutes: 30,
      priority: "MEDIUM",
      status: "NOT_STARTED",
    }),
    onSuccess: () => {
      toast.success(`“${topic.name}” added to tasks`, { action: { label: "View", onClick: () => router.push("/tasks") } });
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return <>
    <div className="flex items-center gap-1.5 rounded-xl py-1 pr-1">
      {handle}
      {depth > 0 ? <CornerDownRight className="size-3.5 shrink-0 text-zinc-300" aria-hidden /> : null}
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900" title={topic.name}>{topic.name}</p>
      {inTasks ? <Link href="/tasks" className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50" title="Already in your tasks">
        <Check className="size-3.5" /> In tasks
      </Link> : null}
      <button
        type="button"
        onClick={() => addTask.mutate()}
        disabled={addTask.isPending}
        className={cn(
          "flex h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition active:scale-95 disabled:opacity-50",
          inTasks ? "text-zinc-500 hover:bg-zinc-100" : "bg-zinc-950 text-white hover:bg-zinc-800",
        )}
        aria-label={`Add “${topic.name}” to tasks`}
        title={inTasks ? "Add another task for this topic" : "Add to tasks"}
      >
        <ListPlus className="size-3.5" />{inTasks ? <span className="sr-only">Add again</span> : "Task"}
      </button>
      <div className="relative shrink-0">
        <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={`More for ${topic.name}`} aria-expanded={menuOpen} className="flex size-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
          <MoreHorizontal className="size-4" />
        </button>
        {menuOpen ? <>
          <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} />
          <div role="menu" className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setAdding(true); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-zinc-50"><Plus className="size-4" /> Add sub-topic</button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete({ kind: "topic", id: topic.id, name: topic.name }); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 className="size-4" /> Delete</button>
          </div>
        </> : null}
      </div>
    </div>
    {adding ? <div className="mb-2 ml-5">
      <AddTopicForm subjectId={subject.id} parentId={topic.id} placeholder={`Sub-topic of ${topic.name}`} onDone={() => setAdding(false)} autoFocus />
      <button type="button" onClick={() => setAdding(false)} className="mt-1 px-1 text-xs text-zinc-500 hover:text-zinc-800">Cancel</button>
    </div> : null}
    <TopicLevel subject={subject} parentId={topic.id} depth={depth + 1} openTasks={openTasks} onDelete={onDelete} path={[...path, topic.name]} className="ml-3 border-l border-zinc-100 pl-1" />
  </>;
}

function SubjectCard({ subject, openTasks, onDelete, handle }: { subject: Subject; openTasks: Record<string, number>; onDelete: (pending: Pending) => void; handle: ReactNode }) {
  const [open, setOpen] = useState(true);
  const hasRoots = subject.topics.some((topic) => !topic.parentId);
  const inTasks = subject.topics.filter((topic) => openTasks[topic.id]).length;
  return <section className="rounded-2xl border border-zinc-200 bg-white">
    <div className="flex items-center gap-1.5 py-3 pl-2 pr-3">
      {handle}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <ChevronDown className={cn("size-4 shrink-0 text-zinc-400 transition-transform", !open && "-rotate-90")} />
        <span className="min-w-0">
          <span className="block truncate text-base font-semibold">{subject.name}</span>
          <span className="block text-xs text-zinc-500">{subject.topics.length} topic{subject.topics.length === 1 ? "" : "s"}{inTasks ? ` · ${inTasks} in tasks` : ""}</span>
        </span>
      </button>
      <button type="button" onClick={() => onDelete({ kind: "subject", id: subject.id, name: subject.name })} aria-label={`Delete ${subject.name}`} title="Delete subject" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600">
        <Trash2 className="size-4" />
      </button>
    </div>
    {open ? <div className="border-t border-zinc-100 px-3 pb-3 pt-2">
      {hasRoots
        ? <TopicLevel subject={subject} parentId={null} depth={0} openTasks={openTasks} onDelete={onDelete} path={[]} className="mb-2" />
        : <p className="px-1 pb-2 text-sm text-zinc-500">No topics yet. Add the first one below.</p>}
      <AddTopicForm subjectId={subject.id} placeholder="Add topic" />
    </div> : null}
  </section>;
}

export function SubjectManager({ subjects, openTasks }: { subjects: Subject[]; openTasks: Record<string, number> }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Pending>(null);

  const create = useMutation({
    mutationFn: () => createSubject({ name }),
    onSuccess: () => {
      toast.success("Subject created");
      setName("");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (pending: NonNullable<Pending>) => (pending.kind === "subject" ? deleteSubject(pending.id) : deleteTopic(pending.id)),
    onSuccess: (_, pending) => {
      toast.success(pending.kind === "subject" ? "Subject deleted" : "Topic deleted");
      setPendingDelete(null);
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (name.trim()) create.mutate(); }}>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="New subject, e.g. English" className="h-11" />
        <Button type="submit" disabled={create.isPending || !name.trim()} className="h-11 shrink-0 gap-1"><Plus className="size-4" /> Subject</Button>
      </form>
      <VoiceFormAssistant title="Subject voice form" steps={[{ key: "name", label: "Subject", question: "কোন subject যোগ করতে চান?" }]} onComplete={(answers) => setName(answers.name)} />

      {subjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center">
          <p className="font-medium">No subjects yet</p>
          <p className="mt-1 text-sm text-zinc-500">Add English, Math, or any subject you are preparing.</p>
        </div>
      ) : (
        <SortableList items={subjects} className="space-y-3" onReorder={(ids) => reorderSubjects(ids)}>
          {(subject, handle) => <SubjectCard subject={subject} openTasks={openTasks} onDelete={setPendingDelete} handle={handle} />}
        </SortableList>
      )}

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete {pendingDelete?.kind === "subject" ? "subject" : "topic"} “{pendingDelete?.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingDelete?.kind === "subject" ? "This deletes all of its topics as well." : "This deletes its sub-topics as well."}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingDelete && remove.mutate(pendingDelete)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
