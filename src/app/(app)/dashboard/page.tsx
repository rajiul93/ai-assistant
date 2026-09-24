import { DashboardView } from "@/components/dashboard/dashboard-view";
import { now } from "@/lib/dayjs";
import { dueRevisionCount } from "@/lib/revisions";
import { requireUser } from "@/lib/auth";
import {
  getPendingTasks,
  getProgressCounts,
  getStudyPlan,
  getTodayPlanStart,
  getTasksToRevise,
  getTodayStudySeconds,
  getTodayTasks,
} from "@/server/queries";

export default async function DashboardPage() {
  const user = await requireUser();
  const [plan, todayTasks, studiedSeconds, toRevise, counts, planStartedAt, pendingTasks] = await Promise.all([
    getStudyPlan(user.id),
    getTodayTasks(user.id),
    getTodayStudySeconds(user.id),
    getTasksToRevise(user.id),
    getProgressCounts(user.id),
    getTodayPlanStart(user.id),
    getPendingTasks(user.id),
  ]);
  const todayMs = now().valueOf();
  // The timer starts on the first unfinished task due today, else the next pending one.
  const firstTask = todayTasks.find((task) => task.status !== "FINISHED") ?? pendingTasks[0] ?? null;

  const progressPercent =
    counts.totalTasks === 0
      ? 0
      : Math.round((counts.completedTasks / counts.totalTasks) * 100);

  return (
    <DashboardView
      longTermDeadline={plan?.longTermDeadline ?? null}
      dateOfBirth={plan?.dateOfBirth ?? null}
      ageLimitYears={plan?.ageLimitYears ?? 34}
      preparationDeadline={plan?.preparationDeadline ?? null}
      dailyTargetMinutes={plan?.dailyStudyTargetMinutes ?? 180}
      studiedSeconds={studiedSeconds}
      todayTasks={todayTasks}
      pendingCount={counts.pendingTasks}
      finishedCount={counts.completedTasks}
      revisionCount={dueRevisionCount(toRevise, todayMs)}
      toRevise={toRevise.slice(0, 5)}
      todayMs={todayMs}
      progressPercent={progressPercent}
      planStartedAt={planStartedAt ? planStartedAt.toISOString() : null}
      firstName={user.name?.split(" ")[0] ?? ""}
      firstTask={firstTask ? { title: firstTask.title, subjectId: firstTask.subjectId ?? "", topicId: firstTask.topicId ?? "", subjectName: firstTask.subject?.name ?? "" } : null}
    />
  );
}
