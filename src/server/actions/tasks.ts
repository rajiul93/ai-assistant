"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { taskSchema } from "@/lib/validations";
import { startOfDay } from "@/lib/dayjs";

function revalidateTasks() {
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/progress");
  revalidatePath("/revisions");
}

async function assertOwnedSubject(userId: string, subjectId?: string) {
  if (!subjectId) return null;
  const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId } });
  if (!subject) throw new Error("Subject not found.");
  return subject.id;
}

async function assertOwnedTopic(userId: string, topicId?: string) {
  if (!topicId) return null;
  const topic = await prisma.topic.findFirst({ where: { id: topicId, userId } });
  if (!topic) throw new Error("Topic not found.");
  return topic;
}

export async function createTask(input: unknown) {
  const user = await requireUser();
  const data = taskSchema.parse(input);
  const subjectId = await assertOwnedSubject(user.id, data.subjectId || undefined);
  const topic = await assertOwnedTopic(user.id, data.topicId || undefined);

  const task = await prisma.task.create({
    data: {
      userId: user.id,
      title: data.title,
      description: data.description || null,
      subjectId,
      topicId: topic?.id ?? null,
      estimatedMinutes: data.estimatedMinutes,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      priority: data.priority,
      status: data.status,
    },
  });

  if (data.status === "REVISION" && topic) {
    await prisma.revision.create({
      data: {
        userId: user.id,
        topicId: topic.id,
        subjectId: topic.subjectId,
        revisionDate: startOfDay(data.dueDate || undefined).toDate(),
        notes: data.description || null,
      },
    });
  }

  revalidateTasks();
  return task.id;
}

export async function updateTask(taskId: string, input: unknown) {
  const user = await requireUser();
  const existing = await prisma.task.findFirst({ where: { id: taskId, userId: user.id } });
  if (!existing) throw new Error("Task not found.");

  const data = taskSchema.parse(input);
  const subjectId = await assertOwnedSubject(user.id, data.subjectId || undefined);
  const topic = await assertOwnedTopic(user.id, data.topicId || undefined);

  await prisma.task.update({
    where: { id: existing.id },
    data: {
      title: data.title,
      description: data.description || null,
      subjectId,
      topicId: topic?.id ?? null,
      estimatedMinutes: data.estimatedMinutes,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      priority: data.priority,
      status: data.status,
    },
  });

  if (data.status === "REVISION" && topic && existing.status !== "REVISION") {
    await prisma.revision.create({
      data: {
        userId: user.id,
        topicId: topic.id,
        subjectId: topic.subjectId,
        revisionDate: startOfDay(data.dueDate || undefined).toDate(),
        notes: data.description || null,
      },
    });
  }

  revalidateTasks();
}

export async function updateTaskStatus(taskId: string, status: string) {
  const user = await requireUser();
  const existing = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id },
    include: { topic: true },
  });
  if (!existing) throw new Error("Task not found.");

  const parsed = taskSchema.shape.status.parse(status);
  await prisma.task.update({
    where: { id: existing.id },
    data: { status: parsed },
  });

  if (parsed === "REVISION" && existing.topic && existing.status !== "REVISION") {
    await prisma.revision.create({
      data: {
        userId: user.id,
        topicId: existing.topic.id,
        subjectId: existing.topic.subjectId,
        revisionDate: startOfDay().toDate(),
      },
    });
  }

  revalidateTasks();
}

export async function deleteTask(taskId: string) {
  const user = await requireUser();
  const existing = await prisma.task.findFirst({ where: { id: taskId, userId: user.id } });
  if (!existing) throw new Error("Task not found.");
  await prisma.task.delete({ where: { id: existing.id } });
  revalidateTasks();
}
