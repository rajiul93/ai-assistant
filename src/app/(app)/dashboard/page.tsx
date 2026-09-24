import { DashboardView } from "@/components/dashboard/dashboard-view";
import { requireUser } from "@/lib/auth";
import {
  getProgressCounts,
  getStudyPlan,
  getTodayRevisions,
  getTodayStudySeconds,
  getTodayTasks,
} from "@/server/queries";

export default async function DashboardPage() {
  const user = await requireUser();
  const [plan, todayTasks, studiedSeconds, revisions, counts] = await Promise.all([
    getStudyPlan(user.id),
    getTodayTasks(user.id),
    getTodayStudySeconds(user.id),
    getTodayRevisions(user.id),
    getProgressCounts(user.id),
  ]);

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
      revisionCount={counts.pendingRevisions}
      revisions={revisions}
      progressPercent={progressPercent}
    />
  );
}
