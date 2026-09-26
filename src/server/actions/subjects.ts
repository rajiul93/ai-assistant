"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subjectSchema, topicSchema } from "@/lib/validations";

function revalidateSubjects() {
  revalidatePath("/subjects");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
}

export async function createSubject(input: unknown) {
  const user = await requireUser();
  const data = subjectSchema.parse(input);
  try {
    // New subjects go to the end of the user's order.
    const last = await prisma.subject.aggregate({ where: { userId: user.id }, _max: { position: true } });
    await prisma.subject.create({
      data: { userId: user.id, name: data.name, position: (last._max.position ?? -1) + 1 },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("A subject with this name already exists.");
    }
    throw error;
  }
  revalidateSubjects();
}

export async function updateSubject(subjectId: string, input: unknown) {
  const user = await requireUser();
  const data = subjectSchema.parse(input);
  const existing = await prisma.subject.findFirst({
    where: { id: subjectId, userId: user.id },
  });
  if (!existing) throw new Error("Subject not found.");
  await prisma.subject.update({
    where: { id: existing.id },
    data: { name: data.name },
  });
  revalidateSubjects();
}

export async function deleteSubject(subjectId: string) {
  const user = await requireUser();
  const existing = await prisma.subject.findFirst({
    where: { id: subjectId, userId: user.id },
  });
  if (!existing) throw new Error("Subject not found.");
  await prisma.subject.delete({ where: { id: existing.id } });
  revalidateSubjects();
}

export async function createTopic(input: unknown) {
  const user = await requireUser();
  const data = topicSchema.parse(input);
  const subject = await prisma.subject.findFirst({
    where: { id: data.subjectId, userId: user.id },
  });
  if (!subject) throw new Error("Subject not found.");

  let parentId: string | null = null;
  if (data.parentId) {
    const parent = await prisma.topic.findFirst({
      where: { id: data.parentId, userId: user.id, subjectId: subject.id },
    });
    if (!parent) throw new Error("Parent topic not found.");
    parentId = parent.id;
  }

  // New topics go to the end of their level.
  const last = await prisma.topic.aggregate({ where: { subjectId: subject.id, parentId }, _max: { position: true } });
  await prisma.topic.create({
    data: {
      userId: user.id,
      subjectId: subject.id,
      parentId,
      name: data.name,
      position: (last._max.position ?? -1) + 1,
    },
  });
  revalidateSubjects();
}

export async function deleteTopic(topicId: string) {
  const user = await requireUser();
  const existing = await prisma.topic.findFirst({
    where: { id: topicId, userId: user.id },
  });
  if (!existing) throw new Error("Topic not found.");
  await prisma.topic.delete({ where: { id: existing.id } });
  revalidateSubjects();
}

const idsSchema = z.array(z.string().min(1)).min(1).max(500);

/** Saves the order after a drag on the Subjects page: `ids` are the user's subjects, top to bottom. */
export async function reorderSubjects(input: unknown) {
  const user = await requireUser();
  const ids = idsSchema.parse(input);
  const owned = await prisma.subject.count({ where: { userId: user.id, id: { in: ids } } });
  if (owned !== new Set(ids).size) throw new Error("Subject not found.");
  await prisma.$transaction(ids.map((id, position) => prisma.subject.update({ where: { id }, data: { position } })));
  revalidateSubjects();
}

/** Saves the order of topics that share one parent (or the subject's top level when parentId is empty). */
export async function reorderTopics(input: unknown) {
  const user = await requireUser();
  const data = z.object({ subjectId: z.string().min(1), parentId: z.string().nullable(), ids: idsSchema }).parse(input);
  // Only siblings of one level may be reordered together.
  const owned = await prisma.topic.count({ where: { userId: user.id, subjectId: data.subjectId, parentId: data.parentId, id: { in: data.ids } } });
  if (owned !== new Set(data.ids).size) throw new Error("Topic not found.");
  await prisma.$transaction(data.ids.map((id, position) => prisma.topic.update({ where: { id }, data: { position } })));
  revalidateSubjects();
}
