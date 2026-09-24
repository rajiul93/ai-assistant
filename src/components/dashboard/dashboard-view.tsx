import Link from "next/link";
import { DailyTargetCard } from "@/components/dashboard/daily-target-card";
import { DeadlineCountdown } from "@/components/dashboard/deadline-countdown";
import { TodayPlanStarter } from "@/components/dashboard/today-plan-starter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { ChevronRight, Plus } from "lucide-react";
import { APP_TIMEZONE, dayjs, formatRemaining } from "@/lib/dayjs";
import { lastRevisedLabel, needsRevision } from "@/lib/revisions";
import type { TaskWithRelations } from "@/server/queries";

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
  toRevise,
  todayMs,
  progressPercent,
  planStartedAt,
  firstTask,
  firstName,
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
  /** Revision-list tasks that need revising (never, or not for a week). */
  revisionCount: number;
  /** Up to five revision-list tasks, most in need of revision first. */
  toRevise: TaskWithRelations[];
  todayMs: number;
  progressPercent: number;
  planStartedAt: string | null;
  firstTask: { title: string; subjectId: string; topicId: string; subjectName: string } | null;
  firstName: string;
}) {
  const prep = preparationDeadline ? formatRemaining(preparationDeadline) : null;
  const hour = dayjs(todayMs).tz(APP_TIMEZONE).hour();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const stats = [
    { label: "Pending", value: pendingCount, href: "/tasks", tone: "text-zinc-950" },
    { label: "Done", value: finishedCount, href: "/tasks", tone: "text-emerald-700" },
    { label: "To revise", value: revisionCount, href: "/tasks?view=revisions", tone: revisionCount ? "text-amber-700" : "text-zinc-950" },
  ];
  const priorityDot = { HIGH: "bg-red-500", MEDIUM: "bg-amber-400", LOW: "bg-zinc-300" } as const;

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* Greeting + one primary action (phones scroll less, desktop keeps both actions). */}
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-zinc-500">{dayjs(todayMs).tz(APP_TIMEZONE).format("dddd, D MMMM")}</p>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
        </div>
        <Button asChild size="sm" className="h-10 shrink-0 gap-1.5 rounded-xl sm:h-9">
          <Link href="/tasks?add=1"><Plus className="size-4" /> Add task</Link>
        </Button>
      </header>

      <DeadlineCountdown
        deadline={longTermDeadline ? longTermDeadline.toISOString() : null}
        dateOfBirth={dateOfBirth ? dateOfBirth.toISOString() : null}
        ageLimitYears={ageLimitYears}
      />

      {/* Phones: today's work first, then the numbers. Desktop: two columns. */}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start lg:gap-6">
        <div className="space-y-5">
          <TodayPlanStarter
            startedAt={planStartedAt}
            firstTask={firstTask}
            taskCount={todayTasks.filter((task) => task.status !== "FINISHED").length}
            revisionCount={revisionCount}
            dailyTargetMinutes={dailyTargetMinutes}
          />
          <DailyTargetCard dailyTargetMinutes={dailyTargetMinutes} savedSeconds={studiedSeconds} />

          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Today&apos;s tasks</h2>
              <Link href="/tasks" className="flex items-center text-sm text-zinc-500 hover:text-zinc-950">All tasks <ChevronRight className="size-4" /></Link>
            </div>
            {todayTasks.length === 0 ? (
              <Link href="/tasks?add=1" className="block rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500">
                Nothing due today — tap to add a task
              </Link>
            ) : (
              <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                {todayTasks.map((task) => (
                  <li key={task.id}>
                    <Link href="/tasks" className="flex min-h-14 items-center gap-3 px-4 py-3 transition active:bg-zinc-50">
                      <span className={`size-2.5 shrink-0 rounded-full ${priorityDot[task.priority]}`} aria-label={`${task.priority.toLowerCase()} priority`} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate font-medium ${task.status === "FINISHED" ? "text-zinc-400 line-through" : ""}`}>{task.title}</p>
                        <p className="truncate text-xs text-zinc-500">
                          {task.subject?.name ?? "No subject"} · {task.estimatedMinutes}m{task.dueDate ? ` · ${dayjs(task.dueDate).tz(APP_TIMEZONE).format("h:mm A")}` : ""}
                        </p>
                      </div>
                      <StatusBadge status={task.status} />
                      <ChevronRight className="size-4 shrink-0 text-zinc-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="grid grid-cols-3 gap-2 sm:gap-2.5" aria-label="Task counts">
            {stats.map((stat) => (
              <Link key={stat.label} href={stat.href} className="min-w-0 rounded-xl border border-zinc-200 bg-white px-1.5 py-2.5 text-center transition active:scale-[0.98] sm:px-3 sm:py-3">
                {/* Scales with the screen so all three stay on one line on small phones. */}
                <p className={`text-xl font-semibold leading-tight tabular-nums sm:text-2xl ${stat.tone}`}>{stat.value}</p>
                <p className="truncate text-[11px] text-zinc-500 sm:text-xs">{stat.label}</p>
              </Link>
            ))}
          </section>

          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">To revise</h2>
              <Link href="/tasks?view=revisions" className="flex items-center text-sm text-zinc-500 hover:text-zinc-950">Revisions <ChevronRight className="size-4" /></Link>
            </div>
            {toRevise.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-5 text-center text-sm text-zinc-500">Finished tasks show up here for revision.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                {toRevise.map((task) => (
                  <li key={task.id}>
                    <Link href="/tasks?view=revisions" className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 transition active:bg-zinc-50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-zinc-500">{task.subject?.name ?? "No subject"}</p>
                      </div>
                      <span className={needsRevision(task, todayMs) ? "shrink-0 text-xs font-medium text-amber-700" : "shrink-0 text-xs text-zinc-500"}>
                        {task.timesRevised}× · {lastRevisedLabel(task.lastRevisedAt, todayMs).replace("last: ", "")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Link href="/progress" className="block rounded-xl border border-zinc-200 bg-white p-4 transition active:scale-[0.99]">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium">Overall preparation</p>
              <p className="text-lg font-semibold tabular-nums">{progressPercent}%</p>
            </div>
            <Progress className="mt-2.5" value={progressPercent} />
            <p className={`mt-3 text-xs ${prep?.overdue ? "font-medium text-red-600" : "text-zinc-500"}`}>
              🔥 Job preparation: {prep?.label ?? "set a deadline in Study Plan"}
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
