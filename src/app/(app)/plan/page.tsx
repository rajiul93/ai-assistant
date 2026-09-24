import { StudyPlanForm } from "@/components/plan/study-plan-form";
import { requireUser } from "@/lib/auth";
import { getStudyPlan } from "@/server/queries";

export default async function PlanPage() {
  const user = await requireUser();
  const plan = await getStudyPlan(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Study plan</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Deadlines and daily target. Countdowns are calculated automatically.
        </p>
      </div>
      <StudyPlanForm
        longTermDeadline={plan?.longTermDeadline ?? null}
        preparationDeadline={plan?.preparationDeadline ?? null}
        dailyStudyTargetMinutes={plan?.dailyStudyTargetMinutes ?? 180}
        dateOfBirth={plan?.dateOfBirth ?? null}
        ageLimitYears={plan?.ageLimitYears ?? 34}
      />
    </div>
  );
}
