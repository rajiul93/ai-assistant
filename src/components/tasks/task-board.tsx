"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { TaskStatus } from "@prisma/client";
import { ArrowUpDown, Check, Clock, ListTodo, MoreHorizontal, Pencil, Play, Plus, RefreshCcw, Search, Trash2 } from "lucide-react";
import { RevisionManager } from "@/components/revisions/revision-manager";
import { dueRevisionCount } from "@/lib/revisions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
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
import { APP_TIMEZONE, dayjs, formatDateTime, startOfDay } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/store/timer";
import { useTimerStartStore } from "@/store/timer-start";
import type { TaskWithRelations } from "@/server/queries";

const filters = [
  { id: "ALL", label: "All" },
  { id: "TODAY", label: "Today" },
  { id: "OVERDUE", label: "Overdue" },
  { id: "NOT_STARTED", label: "Not Started" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "FINISHED", label: "Finished" },
  { id: "REVISION", label: "Revision" },
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

/** "Today, 5:00 PM", "Tomorrow", "Overdue · 3 Oct" — short enough for a phone's meta line. */
function dueLabel(dueDate: Date, todayStart: number, now: number, finished: boolean) {
  const due = dayjs(dueDate).tz(APP_TIMEZONE);
  const at = due.valueOf();
  const time = due.format("h:mm A") === "12:00 AM" ? "" : `, ${due.format("h:mm A")}`;
  if (!finished && at < now) return { text: `Overdue · ${due.format("D MMM")}${time}`, tone: "text-red-600 font-medium" };
  if (at >= todayStart && at < todayStart + DAY_MS) return { text: `Today${time}`, tone: "text-amber-700 font-medium" };
  if (at >= todayStart + DAY_MS && at < todayStart + 2 * DAY_MS) return { text: `Tomorrow${time}`, tone: "text-zinc-600" };
  return { text: formatDateTime(dueDate), tone: "text-zinc-500" };
}

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: "NOT_STARTED", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "FINISHED", label: "Finished" },
  { value: "REVISION", label: "Revision" },
];
const statusDot: Record<TaskStatus, string> = { NOT_STARTED: "bg-zinc-300", IN_PROGRESS: "bg-amber-400", FINISHED: "bg-emerald-500", REVISION: "bg-rose-400" };
const priorityStyle = { HIGH: "bg-red-50 text-red-700 ring-red-100", MEDIUM: "bg-amber-50 text-amber-800 ring-amber-100", LOW: "bg-zinc-50 text-zinc-600 ring-zinc-200" } as const;

/**
 * One task, compact enough for phones: tap the circle to finish it, ▶ to study it, and everything
 * else (status, edit, delete) lives in the ⋯ menu.
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
  const finished = task.status === "FINISHED";
  const due = task.dueDate ? dueLabel(task.dueDate, todayStart, now, finished) : null;
  const status = statusOptions.find((option) => option.value === task.status)!;
  return <article className={cn("rounded-2xl border bg-white p-3 transition sm:p-4", handle && "pl-1 sm:pl-2", finished ? "border-zinc-100" : "border-zinc-200")}>
    <div className={cn("flex items-start", handle ? "gap-1.5 sm:gap-2" : "gap-3")}>
      {handle ? <div className="-my-1">{handle}</div> : null}
      <button
        type="button"
        onClick={() => onStatus(finished ? "NOT_STARTED" : "FINISHED")}
        aria-label={finished ? `Mark “${task.title}” not done` : `Mark “${task.title}” done`}
        title={finished ? "Mark not done" : "Mark done"}
        className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90", finished ? "border-emerald-500 bg-emerald-500 text-white" : "border-zinc-300 text-transparent hover:border-emerald-500 hover:text-emerald-500")}
      ><Check className="size-4" strokeWidth={3} /></button>

      <div className="min-w-0 flex-1">
        <h2 className={cn("line-clamp-2 text-[15px] font-semibold leading-snug", finished && "text-zinc-400 line-through")}>{task.title}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
          <span className="flex items-center gap-1"><span className={cn("size-2 rounded-full", statusDot[task.status])} aria-hidden />{status.label}</span>
          <span className={cn("rounded-full px-1.5 py-px text-[11px] font-medium ring-1", priorityStyle[task.priority])}>{task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}</span>
          <span className="flex items-center gap-1"><Clock className="size-3" aria-hidden />{task.estimatedMinutes}m</span>
          {due ? <span className={due.tone}>{due.text}</span> : null}
        </p>
        {task.subject || task.topic ? <p className="mt-1 truncate text-xs text-zinc-500">{task.subject?.name ?? "No subject"}{task.topic ? ` › ${task.topic.name}` : ""}</p> : null}
        {task.description ? <p className="mt-1.5 line-clamp-2 text-sm text-zinc-600">{task.description}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {!finished ? <button
          type="button"
          onClick={onStart}
          disabled={timerRunning}
          aria-label={`Start studying “${task.title}”`}
          title="Start a study session"
          className="flex h-9 items-center gap-1 rounded-lg bg-zinc-950 px-2.5 text-xs font-semibold text-white transition hover:bg-zinc-800 active:scale-95 disabled:opacity-40"
        ><Play className="size-3.5" /><span className="hidden sm:inline">Start</span></button> : null}
        <div className="relative">
          <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={`More for “${task.title}”`} aria-expanded={menuOpen} className="flex size-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
            <MoreHorizontal className="size-4" />
          </button>
          {menuOpen ? <>
            <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} />
            <div role="menu" className="absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
              <p className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">Status</p>
              {statusOptions.map((option) => <button key={option.value} type="button" role="menuitemradio" aria-checked={task.status === option.value} onClick={() => { setMenuOpen(false); if (option.value !== task.status) onStatus(option.value); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50">
                <span className={cn("size-2 rounded-full", statusDot[option.value])} aria-hidden />{option.label}{task.status === option.value ? <Check className="ml-auto size-4 text-zinc-500" /> : null}
              </button>)}
              <div className="my-1 border-t border-zinc-100" />
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEdit(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-zinc-50"><Pencil className="size-4" /> Edit</button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 className="size-4" /> Delete</button>
            </div>
          </> : null}
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
      toast.success("Status updated");
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const timerRunning = useTimerStore((state) => state.running);

  /** Study a task: pick/confirm its subject and a goal, then the session bar takes over. */
  function startStudying(task?: TaskWithRelations) {
    if (useTimerStore.getState().running) {
      toast.info("A study session is already running — save it from the bar at the bottom first.");
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
      toast.success("Task deleted");
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* Phones: the tab row is the heading, so the title and blurb only show from sm up. */}
      <div className="sr-only sm:not-sr-only">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="mt-1 text-sm text-zinc-500">{view === "tasks" ? "Create, filter, and finish your preparation work." : "Finished tasks to revise — tap + each time you revise one."}</p>
      </div>

      <div className="flex items-center gap-2">
        <div role="tablist" aria-label="Tasks or revisions" className="grid min-w-0 flex-1 grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 sm:w-80 sm:flex-none">
          {([
            { id: "tasks", label: "Tasks", icon: ListTodo, count: openTaskCount },
            { id: "revisions", label: "Revisions", icon: RefreshCcw, count: dueRevisions },
          ] as const).map((tab) => {
            const Icon = tab.icon;
            const active = view === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(tab.id)}
                className={cn("flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition", active ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}
              >
                <Icon className="hidden size-4 shrink-0 min-[380px]:block" />
                <span className="truncate">{tab.label}</span>
                {tab.count ? (
                  <span className={cn("min-w-5 rounded-full px-1.5 text-[11px] font-semibold tabular-nums", tab.id === "revisions" ? "bg-amber-100 text-amber-800" : "bg-zinc-200 text-zinc-700")}>{tab.count}</span>
                ) : null}
              </button>
            );
          })}
        </div>
        {view === "tasks" ? <div className="flex shrink-0 gap-2 sm:ml-auto">
          <Button variant="secondary" onClick={() => startStudying()} disabled={timerRunning} aria-label="Start a study session" title="Start a study session" className="h-11 w-11 px-0 sm:w-auto sm:px-4">
            <Play className="size-4" />
            <span className="hidden sm:inline">Start session</span>
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="h-11 px-3.5 sm:px-4">
            <Plus className="size-4" />
            Add<span className="hidden sm:inline"> Task</span>
          </Button>
        </div> : null}
      </div>

      {view === "tasks" ? <>
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <Input
              placeholder="Search tasks, subjects, topics"
              aria-label="Search tasks"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 pl-9"
            />
          </div>
          {/* Phones: just a ⇅ button (the invisible select on top opens the native picker); sm+: a labelled select. */}
          <label className="relative flex size-11 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white sm:size-auto sm:border-0 sm:bg-transparent" title="Sort">
            <span className="sr-only">Sort</span>
            <ArrowUpDown className="pointer-events-none size-4 text-zinc-600 sm:absolute sm:left-3 sm:text-zinc-500" aria-hidden />
            <NativeSelect
              className="absolute inset-0 h-11 w-11 cursor-pointer opacity-0 sm:static sm:w-auto sm:pl-9 sm:pr-7 sm:opacity-100"
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
            >
              <option value="manual">My order</option>
              <option value="dueDate">Due date</option>
              <option value="priority">Priority</option>
              <option value="createdAt">Newest</option>
            </NativeSelect>
          </label>
        </div>
        {/* One scrollable row on phones instead of three wrapped rows of buttons. */}
        <div role="tablist" aria-label="Filter tasks" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition",
                filter === item.id ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300",
              )}
            >
              {item.label}
              <span className={cn("text-xs tabular-nums", filter === item.id ? "text-white/70" : item.id === "OVERDUE" && filterCounts.OVERDUE ? "font-semibold text-red-600" : "text-zinc-400")}>{filterCounts[item.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-6 py-16 text-center">
          <p className="font-medium">No tasks found</p>
          <p className="mt-1 text-sm text-zinc-500">Create a task to start tracking today&apos;s work.</p>
        </div>
      ) : (
        <SortableList items={visible} enabled={sort === "manual"} className="space-y-2.5" onReorder={saveOrder}>
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
            <DialogTitle>Add task</DialogTitle>
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
            <DialogTitle>Edit task</DialogTitle>
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
          <AlertDialogTitle>Delete this task?</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
