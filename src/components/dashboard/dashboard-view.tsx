import Link from "next/link";
import { DeadlineCountdown } from "@/components/dashboard/deadline-countdown";
import { TodayPlanStarter } from "@/components/dashboard/today-plan-starter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { formatDateTime, formatHoursMinutes, formatRemaining } from "@/lib/dayjs";
import type { TaskWithRelations } from "@/server/queries";
import type { Revision, Subject, Topic } from "@prisma/client";

export function DashboardView({
  longTermDeadline,
  dateOfBirth,
  ageLimitYears,
  preparationDeadline,
  dailyTargetMinutes,
  studiedSeconds,
  todayTasks,
  pendingCount,
  finishedCount,
  revisionCount,
  revisions,
  progressPercent,
  planStartedAt,
  firstTask,
}: {
  longTermDeadline: Date | null;
  dateOfBirth: Date | null;
  ageLimitYears: number;
  preparationDeadline: Date | null;
  dailyTargetMinutes: number;
  studiedSeconds: number;
  todayTasks: TaskWithRelations[];
  pendingCount: number;
  finishedCount: number;
  revisionCount: number;
  revisions: Array<Revision & { topic: Topic; subject: Subject | null }>;
  progressPercent: number;
  planStartedAt: string | null;
  firstTask: { title: string; subjectId: string; topicId: string; subjectName: string } | null;
}) {
  const prep = preparationDeadline ? formatRemaining(preparationDeadline) : null;
  const studiedMinutes = Math.floor(studiedSeconds / 60);
  const studyPercent = dailyTargetMinutes
    ? Math.min(100, Math.round((studiedMinutes / dailyTargetMinutes) * 100))
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">Stay on the deadline. Study what matters today.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/tasks">Add Task</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/timer">Start Study</Link>
          </Button>
        </div>
      </div>

      <DeadlineCountdown
        deadline={longTermDeadline ? longTermDeadline.toISOString() : null}
        dateOfBirth={dateOfBirth ? dateOfBirth.toISOString() : null}
        ageLimitYears={ageLimitYears}
      />

      <TodayPlanStarter
        startedAt={planStartedAt}
        firstTask={firstTask}
        taskCount={todayTasks.filter((task) => task.status !== "FINISHED").length}
        revisionCount={revisions.filter((revision) => revision.status !== "COMPLETED").length}
        dailyTargetMinutes={dailyTargetMinutes}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Job preparation countdown</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">🔥</p>
            <p className={`mt-2 text-2xl font-semibold ${prep?.overdue ? "text-red-600" : ""}`}>
              {prep?.label ?? "Set a deadline"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s study target</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">📚</p>
            <p className="mt-2 text-2xl font-semibold">{formatHoursMinutes(dailyTargetMinutes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Studied today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">⏱️</p>
            <p className="mt-2 text-2xl font-semibold">
              {formatHoursMinutes(studiedMinutes)} / {formatHoursMinutes(dailyTargetMinutes)}
            </p>
            <Progress className="mt-4" value={studyPercent} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardTitle>Pending tasks</CardTitle>
          <p className="mt-3 text-3xl font-semibold">{pendingCount}</p>
        </Card>
        <Card>
          <CardTitle>Completed tasks</CardTitle>
          <p className="mt-3 text-3xl font-semibold text-green-700">{finishedCount}</p>
        </Card>
        <Card>
          <CardTitle>Revision tasks</CardTitle>
          <p className="mt-3 text-3xl font-semibold text-yellow-700">{revisionCount}</p>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Today&apos;s tasks</h2>
            <Link href="/tasks" className="text-sm text-zinc-500 hover:text-zinc-950">
              View all
            </Link>
          </div>
          {todayTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-6 py-12 text-center text-sm text-zinc-500">
              No tasks due today.
            </div>
          ) : (
            <div className="space-y-3">
              {todayTasks.map((task) => (
                <article key={task.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{task.title}</h3>
                    <StatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
                  </div>
                  <p className="mt-2 text-sm text-zinc-500">
                    {task.subject?.name ?? "No subject"}
                    {task.topic ? ` · ${task.topic.name}` : ""}
                    {` · ${task.estimatedMinutes}m`}
                    {task.dueDate ? ` · ${formatDateTime(task.dueDate)}` : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link href="/tasks">Finish task</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/revisions">Revision</Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">🔄 Revision today</h2>
            <Link href="/revisions" className="text-sm text-zinc-500 hover:text-zinc-950">
              Manage
            </Link>
          </div>
          <Card>
            {revisions.length === 0 ? (
              <p className="text-sm text-zinc-500">Nothing to revise today.</p>
            ) : (
              <ul className="space-y-3">
                {revisions.map((revision) => (
                  <li key={revision.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{revision.topic.name}</p>
                      <p className="text-xs text-zinc-500">{revision.subject?.name}</p>
                    </div>
                    <span className={revision.status === "COMPLETED" ? "text-green-700 text-xs" : "text-yellow-700 text-xs"}>
                      {revision.status === "COMPLETED" ? "Done" : "Pending"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Overall preparation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{progressPercent}%</p>
              <Progress className="mt-4" value={progressPercent} />
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link href="/progress">View progress</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
