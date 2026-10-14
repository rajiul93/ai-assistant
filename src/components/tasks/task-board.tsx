"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { TaskStatus } from "@prisma/client";
import { ArrowUpDown, Check, Clock, FileText, ListTodo, MoreHorizontal, Pencil, Play, Plus, RefreshCcw, Search, Share2, Trash2 } from "lucide-react";
import { ShareDialog } from "@/components/collaboration/share-button";
import { RevisionManager } from "@/components/revisions/revision-manager";
import { dueRevisionCount } from "@/lib/revisions";
import { htmlToPlainText, isRichHtml, toEditorHtml } from "@/lib/note-html";
import { MathText, RichHtml } from "@/components/math-text";
import "quill/dist/quill.snow.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TaskForm } from "@/components/tasks/task-form";
import { deleteTask, reorderTasks, updateTaskStatus } from "@/server/actions/tasks";
import { SortableList } from "@/components/sortable-list";
import { listMyTasks } from "@/server/actions/list-tasks";
import { APP_TIMEZONE, dayjs, startOfDay } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/store/timer";
import { useTimerStartStore } from "@/store/timer-start";
import type { TaskWithRelations } from "@/server/queries";

const filters = [
  { id: "ALL", label: "সব" },
  { id: "TODAY", label: "আজ" },
  { id: "OVERDUE", label: "দেরি" },
  { id: "NOT_STARTED", label: "শুরু হয়নি" },
  { id: "IN_PROGRESS", label: "চলছে" },
  { id: "FINISHED", label: "শেষ" },
  { id: "REVISION", label: "রিভিশন" },
] as const;

type FilterId = (typeof filters)[number]["id"];

const DAY_MS = 24 * 60 * 60 * 1000;

function matchesFilter(task: TaskWithRelations, filter: FilterId, todayStart: number, now: number) {
  if (filter === "ALL") return true;
  if (filter === "TODAY") {
    if (!task.dueDate) return false;
    const due = new Date(task.dueDate).getTime();
    return due >= todayStart && due < todayStart + DAY_MS;
  }
  if (filter === "OVERDUE") return Boolean(task.dueDate) && new Date(task.dueDate!).getTime() < now && task.status !== "FINISHED";
  return task.status === filter;
}

/** "আজ 5:00 PM", "কাল", "দেরি · 3 Oct" — short enough for a phone's one meta line. */
function dueLabel(dueDate: Date, todayStart: number, now: number, finished: boolean) {
  const due = dayjs(dueDate).tz(APP_TIMEZONE);
  const at = due.valueOf();
  const time = due.format("h:mm A") === "12:00 AM" ? "" : ` ${due.format("h:mm A")}`;
  if (!finished && at < now) return { text: `দেরি · ${due.format("D MMM")}`, tone: "text-red-600 font-semibold" };
  if (at >= todayStart && at < todayStart + DAY_MS) return { text: `আজ${time}`, tone: "text-amber-700 font-medium" };
  if (at >= todayStart + DAY_MS && at < todayStart + 2 * DAY_MS) return { text: `কাল${time}`, tone: "text-slate-600" };
  return { text: due.format("D MMM"), tone: "text-slate-500" };
}

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: "NOT_STARTED", label: "শুরু হয়নি" },
  { value: "IN_PROGRESS", label: "চলছে" },
  { value: "FINISHED", label: "শেষ" },
  { value: "REVISION", label: "রিভিশন" },
];
const statusDot: Record<TaskStatus, string> = { NOT_STARTED: "bg-slate-300", IN_PROGRESS: "bg-amber-400", FINISHED: "bg-emerald-500", REVISION: "bg-rose-400" };
/** Priority is a coloured bar on the card's left edge, not another chip. */
const priorityBar = { HIGH: "before:bg-red-500", MEDIUM: "before:bg-amber-400", LOW: "before:bg-slate-200" } as const;
const priorityLabel = { HIGH: "জরুরি", MEDIUM: "মাঝারি", LOW: "কম" } as const;

/**
 * One task, made for phones: the circle finishes it, ▶ studies it, ⋯ holds status, edit, share and
 * delete. One meta line (status when it isn't plain, due, minutes, subject); priority is the
 * coloured edge.
 */
function TaskCard({ task, todayStart, now, timerRunning, onStart, onStatus, onEdit, onDelete, handle }: {
  task: TaskWithRelations;
  /** Drag grip, shown while the list is in the user's own order. */
  handle?: ReactNode;
  todayStart: number;
  now: number;
  timerRunning: boolean;
  onStart: () => void;
  onStatus: (status: TaskStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const finished = task.status === "FINISHED";
  const description = task.description ? (isRichHtml(task.description) ? htmlToPlainText(task.description) : task.description).trim() : "";
  const due = task.dueDate ? dueLabel(task.dueDate, todayStart, now, finished) : null;
  return <article className={cn(
    "relative rounded-2xl bg-white py-2.5 pr-1.5 shadow-[0_4px_18px_-12px_rgba(15,23,42,0.25)] before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-full",
    handle ? "pl-0.5" : "pl-3",
    finished ? "before:bg-emerald-300" : priorityBar[task.priority],
  )}>
    <div className="flex items-start gap-1.5">
      {handle ? <div className="-my-0.5">{handle}</div> : null}
      <button
        type="button"
        onClick={() => onStatus(finished ? "NOT_STARTED" : "FINISHED")}
        aria-label={finished ? `“${task.title}” শেষ না` : `“${task.title}” শেষ`}
        title={finished ? "শেষ না" : "শেষ হয়েছে"}
        className={cn("mt-px flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90", finished ? "border-emerald-500 bg-emerald-500 text-white" : task.status === "IN_PROGRESS" ? "border-amber-400 text-transparent hover:text-amber-500" : "border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-500")}
      ><Check className="size-3.5" strokeWidth={3} /></button>

      <div className="min-w-0 flex-1 pl-1">
        <h2 className={cn("line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900", finished && "text-slate-400 line-through")}><MathText text={task.title} /></h2>
        <p className="mt-0.5 flex items-center gap-x-2 overflow-hidden whitespace-nowrap text-[12px] text-slate-500">
          {task.status === "IN_PROGRESS" || task.status === "REVISION" ? <span className={cn("flex shrink-0 items-center gap-1 font-medium", task.status === "IN_PROGRESS" ? "text-amber-700" : "text-rose-600")}><span className={cn("size-1.5 rounded-full", statusDot[task.status])} aria-hidden />{statusOptions.find((option) => option.value === task.status)!.label}</span> : null}
          {due ? <span className={cn("shrink-0", due.tone)}>{due.text}</span> : null}
          <span className="flex shrink-0 items-center gap-0.5"><Clock className="size-3" aria-hidden />{task.estimatedMinutes}m</span>
          {task.subject ? <span className="min-w-0 truncate text-blue-700">{task.subject.name}{task.topic ? ` › ${task.topic.name}` : ""}</span> : null}
        </p>
        {description && detailsOpen ? <RichHtml html={toEditorHtml(task.description)} className="mt-1.5 rounded-lg bg-slate-50" /> : null}
        {task.notes.length || description ? <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {task.notes.map(({ note }) => <Link key={note.id} href={`/notes?id=${encodeURIComponent(note.id)}`} className="flex max-w-full items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11.5px] text-orange-700 hover:bg-orange-100">
            <FileText className="size-3 shrink-0" /><span className="truncate"><MathText text={note.title || "শিরোনাম নেই"} /></span>
          </Link>)}
          {description ? <button type="button" onClick={() => setDetailsOpen((open) => !open)} aria-expanded={detailsOpen} className="rounded-full px-1 text-[11.5px] font-medium text-slate-500 hover:text-slate-900">{detailsOpen ? "কম ▴" : "বিস্তারিত ▾"}</button> : null}
        </div> : null}
      </div>

      <div className="flex shrink-0 items-center">
        {!finished ? <button
          type="button"
          onClick={onStart}
          disabled={timerRunning}
          aria-label={`“${task.title}” পড়া শুরু`}
          title="পড়া শুরু"
          className="flex size-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_6px_14px_-8px_rgba(37,99,235,0.9)] transition hover:bg-blue-700 active:scale-95 disabled:opacity-40"
        ><Play className="size-4 translate-x-px fill-current" /></button> : null}
        <div className="relative">
          <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={`“${task.title}”-এর আরও`} aria-expanded={menuOpen} className="flex h-9 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900">
            <MoreHorizontal className="size-4" />
          </button>
          {menuOpen ? <>
            <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} />
            <div role="menu" className="absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-2xl bg-white py-1 shadow-lg ring-1 ring-slate-200">
              <p className="px-3.5 pb-1 pt-1.5 text-[11px] font-medium text-slate-400">অবস্থা · priority: {priorityLabel[task.priority]}</p>
              {statusOptions.map((option) => <button key={option.value} type="button" role="menuitemradio" aria-checked={task.status === option.value} onClick={() => { setMenuOpen(false); if (option.value !== task.status) onStatus(option.value); }} className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm hover:bg-slate-50">
                <span className={cn("size-2 rounded-full", statusDot[option.value])} aria-hidden />{option.label}{task.status === option.value ? <Check className="ml-auto size-4 text-blue-600" /> : null}
              </button>)}
              <div className="my-1 border-t border-slate-100" />
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEdit(); }} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm hover:bg-slate-50"><Pencil className="size-4" /> বদলান</button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setShareOpen(true); }} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm hover:bg-slate-50"><Share2 className="size-4" /> Share</button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete(); }} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 className="size-4" /> মুছুন</button>
            </div>
          </> : null}
          {shareOpen ? <ShareDialog type="TASK" itemId={task.id} title={task.title} onClose={() => setShareOpen(false)} /> : null}
        </div>
      </div>
    </div>
  </article>;
}

export function TaskBoard({
  initialTasks,
  subjects,
  topics,
}: {
  initialTasks: TaskWithRelations[];
  subjects: { id: string; name: string }[];
  topics: { id: string; name: string; subjectId: string; parentName?: string | null }[];
}) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const router = useRouter();
  // Tasks and revisions share one page; the tab lives in the URL (?view=revisions) so links and voice can open it.
  const view = searchParams.get("view") === "revisions" ? "revisions" : "tasks";
  const setView = (next: "tasks" | "revisions") => router.replace(next === "revisions" ? "/tasks?view=revisions" : "/tasks", { scroll: false });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterId>("ALL");
  // "manual" is the user's own drag-and-drop order (Task.position).
  const [sort, setSort] = useState<"manual" | "dueDate" | "priority" | "createdAt">("manual");
  const [createOpen, setCreateOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("add") === "1");
  const [editing, setEditing] = useState<TaskWithRelations | null>(null);
  const [deleting, setDeleting] = useState<TaskWithRelations | null>(null);

  useEffect(() => {
    if (searchParams.get("add") === "1") {
      window.history.replaceState(null, "", "/tasks");
    }
  }, [searchParams]);

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: listMyTasks,
    initialData: initialTasks,
  });

  const [now] = useState(() => Date.now());
  const openTaskCount = tasksQuery.data.filter((task) => task.status !== "FINISHED").length;
  // Finished tasks never revised or not revised for a week — the number to act on.
  const dueRevisions = dueRevisionCount(tasksQuery.data, now);

  const [todayStart] = useState(() => startOfDay().toDate().getTime());
  const searched = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (tasksQuery.data ?? []).filter((task) => !needle || `${task.title} ${task.subject?.name ?? ""} ${task.topic?.name ?? ""}`.toLowerCase().includes(needle));
  }, [tasksQuery.data, search]);
  // How many tasks each filter chip would show, so empty ones are easy to skip.
  const filterCounts = useMemo(() => Object.fromEntries(filters.map((item) => [item.id, searched.filter((task) => matchesFilter(task, item.id, todayStart, now)).length])) as Record<FilterId, number>, [searched, todayStart, now]);

  const visible = useMemo(() => {
    const filtered = searched.filter((task) => matchesFilter(task, filter, todayStart, now));

    const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return [...filtered].sort((a, b) => {
      if (sort === "manual") return a.position - b.position;
      if (sort === "priority") return priorityRank[a.priority] - priorityRank[b.priority];
      if (sort === "createdAt") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) -
        (b.dueDate ? new Date(b.dueDate).getTime() : Infinity);
    });
  }, [searched, filter, sort, todayStart, now]);

  /**
   * A drag reorders what's on screen, which may be a filtered or searched part of the list: those
   * tasks swap among their own places in the full order, and every other task keeps its place.
   */
  async function saveOrder(visibleIds: string[]) {
    const all = [...(tasksQuery.data ?? [])].sort((a, b) => a.position - b.position);
    const moved = new Set(visibleIds);
    const queue = [...visibleIds];
    const ids = all.map((task) => (moved.has(task.id) ? queue.shift()! : task.id));
    const byId = new Map(all.map((task) => [task.id, task]));
    queryClient.setQueryData<TaskWithRelations[]>(["tasks"], ids.map((id, position) => ({ ...byId.get(id)!, position })));
    try {
      await reorderTasks(ids);
    } catch (error) {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      throw error;
    }
  }

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => updateTaskStatus(id, status),
    onSuccess: async () => {
      toast.success("অবস্থা বদলানো হলো");
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const timerRunning = useTimerStore((state) => state.running);

  /** Study a task: pick/confirm its subject and a goal, then the session bar takes over. */
  function startStudying(task?: TaskWithRelations) {
    if (useTimerStore.getState().running) {
      toast.info("একটা পড়ার session চলছে — আগে নিচের bar থেকে সেটা সেভ করুন।");
      return;
    }
    useTimerStartStore.getState().open({
      suggestedSubjectId: task?.subjectId ?? undefined,
      topicId: task?.topicId ?? undefined,
      label: task?.title,
      taskId: task?.id,
      onStarted: task && task.status === "NOT_STARTED"
        ? async () => { await updateTaskStatus(task.id, "IN_PROGRESS"); await queryClient.invalidateQueries({ queryKey: ["tasks"] }); }
        : undefined,
    });
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: async () => {
      toast.success("Task মুছে ফেলা হলো");
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Today's tasks done, for the header's progress line.
  const todayTasks = (tasksQuery.data ?? []).filter((task) => matchesFilter(task, "TODAY", todayStart, now));
  const todayDone = todayTasks.filter((task) => task.status === "FINISHED").length;

  return (
    <div className="space-y-3">
      {/* One slim header in the home page's blue: tabs, start and add, search and sort, today's progress. */}
      <section className="rounded-3xl bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb] p-3 text-white shadow-[0_14px_32px_-18px_rgba(37,99,235,0.6)]">
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Tasks or revisions" className="grid min-w-0 flex-1 grid-cols-2 gap-1 rounded-full bg-white/15 p-1 ring-1 ring-white/20 sm:max-w-80">
            {([
              { id: "tasks", label: "Tasks", icon: ListTodo, count: openTaskCount },
              { id: "revisions", label: "রিভিশন", icon: RefreshCcw, count: dueRevisions },
            ] as const).map((tab) => {
              const Icon = tab.icon;
              const active = view === tab.id;
              return <button key={tab.id} type="button" role="tab" aria-selected={active} onClick={() => setView(tab.id)} className={cn("flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-full text-[13.5px] font-semibold transition", active ? "bg-white text-blue-700 shadow-sm" : "text-white/90")}>
                <Icon className="hidden size-4 shrink-0 min-[380px]:block" />
                <span className="truncate">{tab.label}</span>
                {tab.count ? <span className={cn("min-w-5 rounded-full px-1.5 text-[11px] font-bold tabular-nums", active ? (tab.id === "revisions" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-700") : "bg-white/25 text-white")}>{tab.count}</span> : null}
              </button>;
            })}
          </div>
          {view === "tasks" ? <>
            <button type="button" onClick={() => startStudying()} disabled={timerRunning} aria-label="পড়ার session শুরু" title="পড়ার session শুরু" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30 transition hover:bg-white/30 active:scale-95 disabled:opacity-50"><Play className="size-4 translate-x-px fill-current" /></button>
            <button type="button" onClick={() => setCreateOpen(true)} className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-white px-3.5 text-[13.5px] font-semibold text-blue-700 shadow-sm transition active:scale-95"><Plus className="size-4" /> নতুন</button>
          </> : null}
        </div>

        {view === "tasks" ? <>
          <div className="mt-2.5 flex gap-2">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Task, subject বা topic খুঁজুন" aria-label="Task খুঁজুন" className="h-10 w-full rounded-full bg-white pl-10 pr-4 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-white/30" />
            </label>
            {/* The ⇅ opens the phone's own picker (an invisible select on top). */}
            <label className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30" title="সাজান">
              <span className="sr-only">সাজান</span>
              <ArrowUpDown className="pointer-events-none size-4" aria-hidden />
              <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="সাজান">
                <option value="manual">আমার সাজানো</option>
                <option value="dueDate">তারিখ অনুযায়ী</option>
                <option value="priority">জরুরি আগে</option>
                <option value="createdAt">নতুন আগে</option>
              </select>
            </label>
          </div>
          {todayTasks.length ? <div className="mt-2.5 flex items-center gap-2.5 px-1">
            <span className="shrink-0 text-[12.5px] font-semibold">আজ {todayDone}/{todayTasks.length} শেষ</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25"><span className="block h-full rounded-full bg-white" style={{ width: `${Math.round((todayDone / todayTasks.length) * 100)}%` }} /></span>
          </div> : null}
        </> : null}
      </section>

      {view === "tasks" ? <>
        {/* One scrollable chip row; counts tell which are worth a tap. */}
        <div role="tablist" aria-label="Task ছাঁকুন" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          {filters.map((item) => <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={cn("flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold transition", filter === item.id ? "bg-blue-600 text-white" : "bg-white text-slate-600 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.2)]")}
          >
            {item.label}
            <span className={cn("text-[11.5px] tabular-nums", filter === item.id ? "text-white/80" : item.id === "OVERDUE" && filterCounts.OVERDUE ? "font-bold text-red-600" : "text-slate-400")}>{filterCounts[item.id]}</span>
          </button>)}
        </div>

        {visible.length === 0 ? (
          <div className="rounded-3xl bg-white px-6 py-10 text-center shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)]">
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-blue-50"><ListTodo className="size-6 text-blue-600" /></span>
            <p className="font-semibold text-slate-800">{(tasksQuery.data ?? []).length ? "এখানে কোনো task নেই" : "এখনো কোনো task নেই"}</p>
            <p className="mt-1 text-sm text-slate-500">{(tasksQuery.data ?? []).length ? "অন্য filter বেছে দেখুন।" : "আজ কী পড়বেন, একটা task লিখে শুরু করুন।"}</p>
            {(tasksQuery.data ?? []).length ? null : <button type="button" onClick={() => setCreateOpen(true)} className="mt-3 inline-flex h-10 items-center gap-1 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white"><Plus className="size-4" /> নতুন task</button>}
          </div>
        ) : (
          <SortableList items={visible} enabled={sort === "manual"} className="space-y-2" onReorder={saveOrder}>
            {(task, handle) => <TaskCard
              handle={handle}
              task={task}
              todayStart={todayStart}
              now={now}
              timerRunning={timerRunning}
              onStart={() => startStudying(task)}
              onStatus={(status) => statusMutation.mutate({ id: task.id, status })}
              onEdit={() => setEditing(task)}
              onDelete={() => setDeleting(task)}
            />}
          </SortableList>
        )}
      </> : (
        <RevisionManager tasks={tasksQuery.data} todayMs={now} />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>নতুন task</DialogTitle>
          </DialogHeader>
          <TaskForm
            subjects={subjects}
            topics={topics}
            onSuccess={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Task বদলান</DialogTitle>
          </DialogHeader>
          {editing ? (
            <TaskForm
              task={editing}
              subjects={subjects}
              topics={topics}
              onSuccess={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Task মুছে ফেলবেন?</AlertDialogTitle>
          <AlertDialogDescription>“{deleting?.title}” মুছে গেলে আর ফেরানো যাবে না।</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>রাখুন</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              মুছে ফেলুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
