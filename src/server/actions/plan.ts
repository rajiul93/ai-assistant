"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { studyPlanSchema } from "@/lib/validations";
import { startOfDay } from "@/lib/dayjs";

function revalidateAll() {
  revalidatePath("/dashboard");
  revalidatePath("/plan");
  revalidatePath("/progress");
}

export async function saveStudyPlan(input: unknown) {
  const user = await requireUser();
  const data = studyPlanSchema.parse(input);

  const longTermDeadline = startOfDay(data.longTermDeadline).toDate();
  const preparationDeadline = startOfDay(data.preparationDeadline).toDate();
  const dateOfBirth = data.dateOfBirth ? startOfDay(data.dateOfBirth).toDate() : null;

  await prisma.studyPlan.upsert({
    where: { userId: user.id },
    update: {
      longTermDeadline,
      preparationDeadline,
      dailyStudyTargetMinutes: Math.round(data.dailyStudyTargetHours * 60),
      dateOfBirth,
      ageLimitYears: data.ageLimitYears,
    },
    create: {
      userId: user.id,
      longTermDeadline,
      preparationDeadline,
      dailyStudyTargetMinutes: Math.round(data.dailyStudyTargetHours * 60),
      dateOfBirth,
      ageLimitYears: data.ageLimitYears,
    },
  });

  revalidateAll();
}

/**
 * Records that the user started today's plan. Only called from the "Start Today's Plan" button;
 * pressing it again the same day keeps the first start time.
 */
export async function startTodayPlan() {
  const user = await requireUser();
  const date = startOfDay().toDate();
  const start = await prisma.dailyPlanStart.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: {},
    create: { userId: user.id, date },
  });
  revalidatePath("/dashboard");
  return start.startedAt.toISOString();
}
