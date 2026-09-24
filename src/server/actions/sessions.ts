"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { studySessionSchema } from "@/lib/validations";

export async function saveStudySession(input: unknown) {
  const user = await requireUser();
  const data = studySessionSchema.parse(input);

  let subjectId: string | null = null;
  let topicId: string | null = null;

  if (data.subjectId) {
    const subject = await prisma.subject.findFirst({
      where: { id: data.subjectId, userId: user.id },
    });
    if (!subject) throw new Error("Subject not found.");
    subjectId = subject.id;
  }

  if (data.topicId) {
    const topic = await prisma.topic.findFirst({
      where: { id: data.topicId, userId: user.id },
    });
    if (!topic) throw new Error("Topic not found.");
    topicId = topic.id;
    subjectId = topic.subjectId;
  }

  await prisma.studySession.create({
    data: {
      userId: user.id,
      subjectId,
      topicId,
      startedAt: new Date(data.startedAt),
      endedAt: new Date(data.endedAt),
      durationSeconds: data.durationSeconds,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/progress");
  revalidatePath("/timer");
}
