"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revisionSchema } from "@/lib/validations";
import { startOfDay } from "@/lib/dayjs";

function revalidateRevisions() {
  revalidatePath("/dashboard");
  revalidatePath("/revisions");
  revalidatePath("/progress");
}

export async function createRevision(input: unknown) {
  const user = await requireUser();
  const data = revisionSchema.parse(input);
  const topic = await prisma.topic.findFirst({
    where: { id: data.topicId, userId: user.id },
  });
  if (!topic) throw new Error("Topic not found.");

  await prisma.revision.create({
    data: {
      userId: user.id,
      topicId: topic.id,
      subjectId: topic.subjectId,
      revisionDate: startOfDay(data.revisionDate).toDate(),
      notes: data.notes || null,
    },
  });

  revalidateRevisions();
}

export async function completeRevision(revisionId: string) {
  const user = await requireUser();
  const existing = await prisma.revision.findFirst({
    where: { id: revisionId, userId: user.id },
  });
  if (!existing) throw new Error("Revision not found.");

  await prisma.revision.update({
    where: { id: existing.id },
    data: { status: "COMPLETED" },
  });

  revalidateRevisions();
}

export async function deleteRevision(revisionId: string) {
  const user = await requireUser();
  const existing = await prisma.revision.findFirst({
    where: { id: revisionId, userId: user.id },
  });
  if (!existing) throw new Error("Revision not found.");
  await prisma.revision.delete({ where: { id: existing.id } });
  revalidateRevisions();
}
