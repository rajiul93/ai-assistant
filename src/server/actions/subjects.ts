"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
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
    await prisma.subject.create({
      data: { userId: user.id, name: data.name },
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

  await prisma.topic.create({
    data: {
      userId: user.id,
      subjectId: subject.id,
      parentId,
      name: data.name,
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
