import type { TaskPriority, TaskStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: TaskStatus }) {
  const styles: Record<TaskStatus, string> = {
    NOT_STARTED: "bg-zinc-100 text-zinc-700",
    IN_PROGRESS: "bg-yellow-100 text-yellow-800",
    FINISHED: "bg-green-100 text-green-800",
    REVISION: "bg-red-50 text-red-700",
  };
  const labels: Record<TaskStatus, string> = {
    NOT_STARTED: "Not started",
    IN_PROGRESS: "In progress",
    FINISHED: "Finished",
    REVISION: "Revision",
  };
  return <Badge className={styles[status]}>{labels[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const styles: Record<TaskPriority, string> = {
    LOW: "bg-zinc-100 text-zinc-600",
    MEDIUM: "bg-yellow-100 text-yellow-800",
    HIGH: "bg-red-100 text-red-700",
  };
  return <Badge className={styles[priority]}>{priority}</Badge>;
}
