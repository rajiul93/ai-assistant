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
