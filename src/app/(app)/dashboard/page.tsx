import Link from "next/link";
import { UserRound } from "lucide-react";
import { RequestsPanel } from "@/components/collaboration/requests-panel";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { now } from "@/lib/dayjs";
import { dueRevisionCount } from "@/lib/revisions";
import { requireUser } from "@/lib/auth";
import { freshUserFlags } from "@/server/user-flags";
import {
  getPendingTasks,
  getProgressCounts,
  getStudyStreak,
  getStudyPlan,
  getTodayPlanStart,
  getTasksToRevise,
  getTodayStudySeconds,
  getTodayTasks,
} from "@/server/queries";

export default async function DashboardPage() {
  const user = await requireUser();
  const [plan, todayTasks, studiedSeconds, toRevise, counts, planStartedAt, pendingTasks, profile, streak] = await Promise.all([
    getStudyPlan(user.id),
    getTodayTasks(user.id),
    getTodayStudySeconds(user.id),
    getTasksToRevise(user.id),
    getProgressCounts(user.id),
    getTodayPlanStart(user.id),
    getPendingTasks(user.id),
    freshUserFlags(user.id),
    getStudyStreak(user.id),
  ]);
  const name = profile?.name ?? user.name;
  const todayMs = now().valueOf();
  // The timer starts on the first unfinished task due today, else the next pending one.
  const firstTask = todayTasks.find((task) => task.status !== "FINISHED") ?? pendingTasks[0] ?? null;

  const progressPercent =
    counts.totalTasks === 0
      ? 0
      : Math.round((counts.completedTasks / counts.totalTasks) * 100);

  return (
    <>
    {/* Friend requests and shared items waiting for an answer; renders nothing when there are none. */}
    <div className="mb-5 empty:hidden"><RequestsPanel compact /></div>
    {/* The profile is optional; this reminder stays until name and phone are both filled. */}
    {!name?.trim() || !profile?.phone ? (
      <Link href="/profile" className="mb-5 flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 transition hover:bg-sky-100">
        <UserRound className="size-5 shrink-0" />
        <span><span className="font-semibold">প্রোফাইল সম্পূর্ণ করুন</span> — আপনার নাম আর মোবাইল নম্বর দিন।</span>
      </Link>
    ) : null}
    <DashboardView
      dateOfBirth={plan?.dateOfBirth ?? null}
      ageLimitYears={plan?.ageLimitYears ?? 34}
      preparationDeadline={plan?.preparationDeadline ?? null}
      dailyTargetMinutes={plan?.dailyStudyTargetMinutes ?? 180}
      studiedSeconds={studiedSeconds}
      streak={streak}
      pendingCount={counts.pendingTasks}
      finishedCount={counts.completedTasks}
      todayTasks={todayTasks}
      revisionCount={dueRevisionCount(toRevise, todayMs)}
      toRevise={toRevise.slice(0, 5)}
      todayMs={todayMs}
      progressPercent={progressPercent}
      planStartedAt={planStartedAt ? planStartedAt.toISOString() : null}
      firstName={name?.split(" ")[0] ?? ""}
      firstTask={firstTask ? { title: firstTask.title, subjectId: firstTask.subjectId ?? "", topicId: firstTask.topicId ?? "", subjectName: firstTask.subject?.name ?? "" } : null}
    />
    </>
  );
}
