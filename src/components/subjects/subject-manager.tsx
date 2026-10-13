"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { Check, ChevronDown, CornerDownRight, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { createSubject, createTopic, deleteSubject, deleteTopic, reorderSubjects, reorderTopics, updateSubject, updateTopic } from "@/server/actions/subjects";
import { createTask } from "@/server/actions/tasks";
import { SortableList } from "@/components/sortable-list";
import { VoiceFormAssistant } from "@/components/voice-form-assistant";
import { MathText } from "@/components/math-text";

type Topic = { id: string; name: string; parentId: string | null };
type Subject = { id: string; name: string; topics: Topic[] };
type Pending = { kind: "subject" | "topic"; id: string; name: string } | null;

/** The home page's pastel tones, one per subject in turn, so subjects are told apart at a glance. */
const tones = ["bg-blue-50 text-blue-600", "bg-rose-50 text-rose-500", "bg-emerald-50 text-emerald-600", "bg-orange-50 text-orange-500", "bg-violet-50 text-violet-600", "bg-sky-50 text-sky-600", "bg-pink-50 text-pink-500", "bg-teal-50 text-teal-600", "bg-amber-50 text-amber-600", "bg-indigo-50 text-indigo-600"];
const cardShadow = "shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)]";

/** A small "…" menu: rename, add a sub-topic (topics), delete. */
function RowMenu({ label, items }: { label: string; items: Array<{ label: string; icon: ReactNode; onSelect: () => void; danger?: boolean }> }) {
  const [open, setOpen] = useState(false);
  return <div className="relative shrink-0">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label={label} aria-expanded={open} className="flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900">
      <MoreHorizontal className="size-5" />
    </button>
    {open ? <>
      <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
      <div role="menu" className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-lg">
        {items.map((item) => <button key={item.label} type="button" role="menuitem" onClick={() => { setOpen(false); item.onSelect(); }} className={cn("flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm", item.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50")}>
          {item.icon}{item.label}
        </button>)}
      </div>
    </> : null}
  </div>;
}

/** Renaming in place: the name turns into a box; Enter (or ✓) saves, Esc (or ✕) cancels. */
function RenameForm({ initial, label, onSave, onCancel }: { initial: string; label: string; onSave: (name: string) => Promise<unknown>; onCancel: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const save = useMutation({
    mutationFn: () => onSave(name.trim()),
    onSuccess: () => { toast.success("নাম বদলানো হলো"); onCancel(); router.refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const submit = () => { if (!name.trim() || name.trim() === initial) { onCancel(); return; } save.mutate(); };
  return <form className="flex min-w-0 flex-1 items-center gap-1.5" onSubmit={(event) => { event.preventDefault(); submit(); }}>
    <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") onCancel(); }} maxLength={80} autoFocus aria-label={label} className="h-10 min-w-0 flex-1 rounded-xl border border-blue-300 bg-white px-3 text-[15px] outline-none ring-4 ring-blue-50" />
    <button type="submit" disabled={save.isPending} aria-label="সেভ" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"><Check className="size-4" /></button>
    <button type="button" onClick={onCancel} aria-label="বাতিল" className="flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
  </form>;
}

/** Small inline "name + যোগ" form, used for new topics and sub-topics. */
function AddTopicForm({ subjectId, parentId, placeholder, onDone, autoFocus }: { subjectId: string; parentId?: string; placeholder: string; onDone?: () => void; autoFocus?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => createTopic({ name, subjectId, parentId: parentId ?? "" }),
    onSuccess: () => {
      toast.success("Topic যোগ হলো");
      setName("");
      onDone?.();
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (name.trim()) create.mutate(); }}>
    <input value={name} onChange={(event) => setName(event.target.value)} placeholder={placeholder} autoFocus={autoFocus} aria-label={placeholder} className="h-11 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-[15px] outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white" />
    <button type="submit" disabled={create.isPending || !name.trim()} className="flex h-11 shrink-0 items-center gap-1 rounded-2xl bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"><Plus className="size-4" /> যোগ</button>
  </form>;
}

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
  return <SortableList items={topics} className={className} onReorder={(ids) => reorderTopics({ subjectId: subject.id, parentId, ids })}>
    {(topic, handle) => <TopicRow topic={topic} subject={subject} depth={depth} openTasks={openTasks} onDelete={onDelete} path={path} handle={handle} />}
  </SortableList>;
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
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
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
      toast.success(`“${topic.name}” tasks-এ যোগ হলো`, { action: { label: "দেখো", onClick: () => router.push("/tasks") } });
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return <>
    <div className="flex min-h-12 items-center gap-1 rounded-2xl py-1 pr-0.5">
      {handle}
      {depth > 0 ? <CornerDownRight className="size-3.5 shrink-0 text-slate-300" aria-hidden /> : null}
      {renaming ? <RenameForm initial={topic.name} label="Topic-এর নতুন নাম" onSave={(name) => updateTopic(topic.id, { name })} onCancel={() => setRenaming(false)} /> : <>
        <button type="button" onClick={() => setRenaming(true)} title="নাম বদলাতে চাপুন" className="min-w-0 flex-1 truncate py-1.5 text-left text-[15px] font-medium text-slate-800"><MathText text={topic.name} /></button>
        {inTasks
          ? <Link href="/tasks" className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-700" title="আগেই tasks-এ আছে">
            <Check className="size-3.5" /> Tasks-এ
          </Link>
          : <button type="button" onClick={() => addTask.mutate()} disabled={addTask.isPending} aria-label={`“${topic.name}” tasks-এ যোগ করো`} className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 active:scale-95 disabled:opacity-50">
            <Plus className="size-3.5" /> Task
          </button>}
        <RowMenu label={`${topic.name}-এর আরও কাজ`} items={[
          { label: "নাম বদলাও", icon: <Pencil className="size-4" />, onSelect: () => setRenaming(true) },
          { label: "Sub-topic যোগ", icon: <Plus className="size-4" />, onSelect: () => setAdding(true) },
          ...(inTasks ? [{ label: "আবার task বানাও", icon: <Plus className="size-4" />, onSelect: () => addTask.mutate() }] : []),
          { label: "মুছে ফেলো", icon: <Trash2 className="size-4" />, onSelect: () => onDelete({ kind: "topic", id: topic.id, name: topic.name }), danger: true },
        ]} />
      </>}
    </div>
    {adding ? <div className="mb-2 ml-6 space-y-1">
      <AddTopicForm subjectId={subject.id} parentId={topic.id} placeholder={`${topic.name}-এর sub-topic`} onDone={() => setAdding(false)} autoFocus />
      <button type="button" onClick={() => setAdding(false)} className="px-1 text-xs text-slate-500 hover:text-slate-800">বাতিল</button>
    </div> : null}
    <TopicLevel subject={subject} parentId={topic.id} depth={depth + 1} openTasks={openTasks} onDelete={onDelete} path={[...path, topic.name]} className="ml-4 border-l-2 border-slate-100 pl-1" />
  </>;
}

function SubjectCard({ subject, index, startOpen, openTasks, onDelete, handle }: { subject: Subject; index: number; startOpen: boolean; openTasks: Record<string, number>; onDelete: (pending: Pending) => void; handle: ReactNode }) {
  const [open, setOpen] = useState(startOpen);
  const [renaming, setRenaming] = useState(false);
  const hasRoots = subject.topics.some((topic) => !topic.parentId);
  const inTasks = subject.topics.filter((topic) => openTasks[topic.id]).length;
  const tone = tones[index % tones.length];
  return <section className={cn("rounded-3xl bg-white", cardShadow)}>
    <div className="flex items-center gap-1.5 py-3 pl-1.5 pr-2">
      {handle}
      {renaming ? <RenameForm initial={subject.name} label="Subject-এর নতুন নাম" onSave={(name) => updateSubject(subject.id, { name })} onCancel={() => setRenaming(false)} /> : <>
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl text-lg font-bold", tone)}>{subject.name.trim().charAt(0).toUpperCase() || "?"}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-bold text-slate-900"><MathText text={subject.name} /></span>
            <span className="block text-xs text-slate-500">{subject.topics.length}টি topic{inTasks ? ` · ${inTasks}টি tasks-এ` : ""}</span>
          </span>
          <ChevronDown className={cn("size-5 shrink-0 text-slate-400 transition-transform", !open && "-rotate-90")} />
        </button>
        <RowMenu label={`${subject.name}-এর আরও কাজ`} items={[
          { label: "নাম বদলাও", icon: <Pencil className="size-4" />, onSelect: () => setRenaming(true) },
          { label: "মুছে ফেলো", icon: <Trash2 className="size-4" />, onSelect: () => onDelete({ kind: "subject", id: subject.id, name: subject.name }), danger: true },
        ]} />
      </>}
    </div>
    {open ? <div className="border-t border-slate-100 px-2.5 pb-3 pt-1.5">
      {hasRoots
        ? <TopicLevel subject={subject} parentId={null} depth={0} openTasks={openTasks} onDelete={onDelete} path={[]} className="mb-2" />
        : <p className="px-2 py-3 text-sm text-slate-500">এখনো কোনো topic নেই — নিচে প্রথমটা যোগ করুন।</p>}
      <div className="px-1"><AddTopicForm subjectId={subject.id} placeholder="নতুন topic" /></div>
    </div> : null}
  </section>;
}

/**
 * Subjects and their topic trees, in the home page's look: pastel subject cards that open to their
 * topics, a one-tap "+ Task" per topic, and rename/delete under each "…". With more than two
 * subjects the cards start closed, so a phone shows them all on one screen.
 */
export function SubjectManager({ subjects, openTasks }: { subjects: Subject[]; openTasks: Record<string, number> }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Pending>(null);

  const create = useMutation({
    mutationFn: () => createSubject({ name }),
    onSuccess: () => {
      toast.success("Subject যোগ হলো");
      setName("");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (pending: NonNullable<Pending>) => (pending.kind === "subject" ? deleteSubject(pending.id) : deleteTopic(pending.id)),
    onSuccess: (_, pending) => {
      toast.success(pending.kind === "subject" ? "Subject মুছে ফেলা হলো" : "Topic মুছে ফেলা হলো");
      setPendingDelete(null);
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <form className={cn("flex gap-2 rounded-3xl bg-white p-2", cardShadow)} onSubmit={(event) => { event.preventDefault(); if (name.trim()) create.mutate(); }}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="নতুন subject, যেমন: English" aria-label="নতুন subject" className="h-12 min-w-0 flex-1 rounded-2xl bg-transparent px-3 text-[15px] outline-none placeholder:text-slate-400" />
        <button type="submit" disabled={create.isPending || !name.trim()} className="flex h-12 shrink-0 items-center gap-1 rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/30 transition hover:bg-blue-700 disabled:opacity-50"><Plus className="size-5" /> Subject</button>
      </form>
      <VoiceFormAssistant title="Subject voice form" steps={[{ key: "name", label: "Subject", question: "কোন subject যোগ করতে চান?" }]} onComplete={(answers) => setName(answers.name)} />

      {subjects.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <p className="font-semibold text-slate-800">এখনো কোনো subject নেই</p>
          <p className="mt-1 text-sm text-slate-500">বাংলা, English, গণিত — যেগুলো পড়ছেন সেগুলো যোগ করুন।</p>
        </div>
      ) : (
        <SortableList items={subjects} className="space-y-3" onReorder={(ids) => reorderSubjects(ids)}>
          {(subject, handle) => <SubjectCard subject={subject} index={subjects.indexOf(subject)} startOpen={subjects.length <= 2} openTasks={openTasks} onDelete={setPendingDelete} handle={handle} />}
        </SortableList>
      )}

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>{pendingDelete?.kind === "subject" ? "Subject" : "Topic"} “{pendingDelete?.name}” মুছে ফেলবেন?</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingDelete?.kind === "subject" ? "এর সব topic-ও মুছে যাবে।" : "এর sub-topic-গুলোও মুছে যাবে।"}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>রাখো</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => pendingDelete && remove.mutate(pendingDelete)}>মুছে ফেলো</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
