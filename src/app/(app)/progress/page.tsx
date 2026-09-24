import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth";
import { formatDurationFromSeconds, formatHoursMinutes } from "@/lib/dayjs";
import {
  getMonthlyStudySeconds,
  getProgressCounts,
  getStudyPlan,
  getSubjectStudySeconds,
  getTodayStudySeconds,
  getWeeklyStudySeconds,
} from "@/server/queries";

export default async function ProgressPage() {
  const user = await requireUser();
  const [plan, today, weekly, monthly, bySubject, counts] = await Promise.all([
    getStudyPlan(user.id),
    getTodayStudySeconds(user.id),
    getWeeklyStudySeconds(user.id),
    getMonthlyStudySeconds(user.id),
    getSubjectStudySeconds(user.id),
    getProgressCounts(user.id),
  ]);

  const target = plan?.dailyStudyTargetMinutes ?? 180;
  const todayMinutes = Math.floor(today / 60);
  const todayPercent = Math.min(100, Math.round((todayMinutes / target) * 100));
  const totalSeconds = bySubject.reduce((sum, item) => sum + item.seconds, 0);
  const maxSeconds = Math.max(...bySubject.map((item) => item.seconds), 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="mt-1 text-sm text-zinc-500">Study time and completion, calculated from your records.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-zinc-500">Today</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatHoursMinutes(todayMinutes)} / {formatHoursMinutes(target)}
          </p>
          <Progress className="mt-4" value={todayPercent} />
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">This week</p>
          <p className="mt-2 text-2xl font-semibold">{formatDurationFromSeconds(weekly)}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">This month</p>
          <p className="mt-2 text-2xl font-semibold">{formatDurationFromSeconds(monthly)}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">Completed / pending</p>
          <p className="mt-2 text-2xl font-semibold">
            {counts.completedTasks} / {counts.pendingTasks}
          </p>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-zinc-500">Revision completed</p>
          <p className="mt-2 text-2xl font-semibold text-green-700">{counts.completedRevisions}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">Revision pending</p>
          <p className="mt-2 text-2xl font-semibold text-yellow-700">{counts.pendingRevisions}</p>
        </Card>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">Subject-wise study time</h2>
        {bySubject.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-500">No study sessions yet.</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {bySubject.map((item) => (
              <li key={item.subjectId ?? item.name}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="text-zinc-500">{formatDurationFromSeconds(item.seconds)}</span>
                </div>
                <Progress value={(item.seconds / maxSeconds) * 100} />
              </li>
            ))}
            <li className="flex items-center justify-between border-t border-zinc-200 pt-4 font-medium">
              <span>Total</span>
              <span>{formatDurationFromSeconds(totalSeconds)}</span>
            </li>
          </ul>
        )}
      </section>
    </div>
  );
}
