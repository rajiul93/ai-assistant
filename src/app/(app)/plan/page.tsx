import { StudyPlanForm } from "@/components/plan/study-plan-form";
import { requireUser } from "@/lib/auth";
import { getStudyPlan } from "@/server/queries";

export default async function PlanPage() {
  const user = await requireUser();
  const plan = await getStudyPlan(user.id);

  return (
    <StudyPlanForm
      saved={Boolean(plan)}
      updatedAt={plan?.updatedAt ?? null}
      longTermDeadline={plan?.longTermDeadline ?? null}
      preparationDeadline={plan?.preparationDeadline ?? null}
      dailyStudyTargetMinutes={plan?.dailyStudyTargetMinutes ?? 180}
      dateOfBirth={plan?.dateOfBirth ?? null}
      ageLimitYears={plan?.ageLimitYears ?? 34}
    />
  );
}
