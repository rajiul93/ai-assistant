"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { taskSchema } from "@/lib/validations";

function revalidateTasks() {
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/progress");
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

  // New tasks go to the top of the user's own order.
  const first = await prisma.task.aggregate({ where: { userId: user.id }, _min: { position: true } });
  const task = await prisma.task.create({
    data: {
      userId: user.id,
      position: (first._min.position ?? 1) - 1,
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

  revalidateTasks();
}

export async function updateTaskStatus(taskId: string, status: string) {
  const user = await requireUser();
  const existing = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id },
  });
  if (!existing) throw new Error("Task not found.");

  const parsed = taskSchema.shape.status.parse(status);
  await prisma.task.update({
    where: { id: existing.id },
    data: { status: parsed },
  });

  revalidateTasks();
}

/**
 * Revision lives on the task: +1 records another revision of a finished task (and when), −1 undoes
 * a mistaken tap. Atomic in the database so quick repeated taps all count; never below zero.
 */
export async function changeTaskRevisionCount(taskId: string, delta: 1 | -1) {
  const user = await requireUser();
  const existing = await prisma.task.findFirst({ where: { id: taskId, userId: user.id }, select: { id: true } });
  if (!existing) throw new Error("Task not found.");
  if (delta === 1) {
    const updated = await prisma.task.update({ where: { id: existing.id }, data: { timesRevised: { increment: 1 }, lastRevisedAt: new Date() } });
    revalidateTasks();
    return updated.timesRevised;
  }
  await prisma.task.updateMany({ where: { id: existing.id, timesRevised: { gt: 0 } }, data: { timesRevised: { decrement: 1 } } });
  revalidateTasks();
  return (await prisma.task.findUnique({ where: { id: existing.id }, select: { timesRevised: true } }))?.timesRevised ?? 0;
}

export async function deleteTask(taskId: string) {
  const user = await requireUser();
  const existing = await prisma.task.findFirst({ where: { id: taskId, userId: user.id } });
  if (!existing) throw new Error("Task not found.");
  await prisma.task.delete({ where: { id: existing.id } });
  revalidateTasks();
}

/** Saves the user's own task order after a drag: `ids` are all their tasks, top to bottom. */
export async function reorderTasks(input: unknown) {
  const user = await requireUser();
  const ids = z.array(z.string().min(1)).min(1).max(2000).parse(input);
  const owned = await prisma.task.count({ where: { userId: user.id, id: { in: ids } } });
  if (owned !== new Set(ids).size) throw new Error("Task not found.");
  await prisma.$transaction(ids.map((id, position) => prisma.task.update({ where: { id }, data: { position } })));
  revalidateTasks();
}
