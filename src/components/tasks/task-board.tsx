"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { TaskStatus } from "@prisma/client";
import { Plus } from "lucide-react";
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
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { TaskForm } from "@/components/tasks/task-form";
import { deleteTask, updateTaskStatus } from "@/server/actions/tasks";
import { listMyTasks } from "@/server/actions/list-tasks";
import { formatDateTime, startOfDay } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterId>("ALL");
  const [sort, setSort] = useState<"dueDate" | "priority" | "createdAt">("dueDate");
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

  const visible = useMemo(() => {
    const tasks = tasksQuery.data ?? [];
    const todayStart = startOfDay().toDate().getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;
    const filtered = tasks.filter((task) => {
      const haystack = `${task.title} ${task.subject?.name ?? ""} ${task.topic?.name ?? ""}`.toLowerCase();
      if (search && !haystack.includes(search.toLowerCase())) return false;
      if (filter === "ALL") return true;
      if (filter === "TODAY") {
        if (!task.dueDate) return false;
        const due = new Date(task.dueDate).getTime();
        return due >= todayStart && due <= todayEnd;
      }
      if (filter === "OVERDUE") {
        return Boolean(task.dueDate) && new Date(task.dueDate!).getTime() < now && task.status !== "FINISHED";
      }
      return task.status === filter;
    });

    const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return [...filtered].sort((a, b) => {
      if (sort === "priority") return priorityRank[a.priority] - priorityRank[b.priority];
      if (sort === "createdAt") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) -
        (b.dueDate ? new Date(b.dueDate).getTime() : Infinity);
    });
  }, [tasksQuery.data, search, filter, sort, now]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => updateTaskStatus(id, status),
    onSuccess: async () => {
      toast.success("Status updated");
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="mt-1 text-sm text-zinc-500">Create, filter, and finish your preparation work.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Add Task
        </Button>
      </div>

      <div className="space-y-3">
        <Input
          placeholder="Search tasks, subjects, topics"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                filter === item.id ? "bg-zinc-950 text-white" : "bg-white text-zinc-700 border border-zinc-200",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <NativeSelect
          className="max-w-xs"
          value={sort}
          onChange={(event) => setSort(event.target.value as typeof sort)}
        >
          <option value="dueDate">Sort by due date</option>
          <option value="priority">Sort by priority</option>
          <option value="createdAt">Sort by created</option>
        </NativeSelect>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-6 py-16 text-center">
          <p className="font-medium">No tasks found</p>
          <p className="mt-1 text-sm text-zinc-500">Create a task to start tracking today&apos;s work.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((task) => (
            <article key={task.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{task.title}</h2>
                    <StatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
                  </div>
                  <p className="text-sm text-zinc-500">
                    {task.subject?.name ?? "No subject"}
                    {task.topic ? ` · ${task.topic.name}` : ""}
                    {` · ${task.estimatedMinutes}m`}
                    {task.dueDate ? ` · ${formatDateTime(task.dueDate)}` : ""}
                  </p>
                  {task.description ? (
                    <p className="text-sm text-zinc-600">{task.description}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <NativeSelect
                    className="w-auto"
                    value={task.status}
                    onChange={(event) =>
                      statusMutation.mutate({
                        id: task.id,
                        status: event.target.value as TaskStatus,
                      })
                    }
                  >
                    <option value="NOT_STARTED">Not started</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="FINISHED">Finished</option>
                    <option value="REVISION">Revision</option>
                  </NativeSelect>
                  <Button variant="outline" size="sm" onClick={() => setEditing(task)}>
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDeleting(task)}>
                    Delete
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
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
