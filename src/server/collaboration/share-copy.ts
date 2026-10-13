import type { Prisma } from "@prisma/client";
import { payloadSchemas, type SharePayload, type ShareType } from "@/lib/collaboration";
import { htmlToPlainText, sanitizeNoteHtml, toRichHtml } from "@/lib/note-html";
import { prisma } from "@/lib/prisma";

/**
 * Sharing copies, both ways (docs/collaboration-plan.md D2–D4):
 * - `snapshotForShare` reads one of the sender's own items and freezes it into a payload;
 * - `createFromPayload` turns an accepted payload into a new item owned by the recipient, placed
 *   under the recipient's own subject (found by name, created if missing) and topic (by name).
 * Status, attempts, revision counts and linked notes/tasks are not carried over.
 */

type Snapshot = { title: string; payload: SharePayload[ShareType] };

/** The sender's item as a payload, or null if it isn't theirs (the caller says "not found"). */
export async function snapshotForShare(userId: string, type: ShareType, itemId: string): Promise<Snapshot | null> {
  const placement = { subject: { select: { name: true } }, topic: { select: { name: true } } } as const;
  switch (type) {
    case "NOTE": {
      const note = await prisma.note.findFirst({ where: { id: itemId, userId }, select: { title: true, content: true, ...placement } });
      if (!note) return null;
      return { title: note.title, payload: { title: note.title, content: note.content, subjectName: note.subject?.name ?? null, topicName: note.topic?.name ?? null } };
    }
    case "TASK": {
      const task = await prisma.task.findFirst({ where: { id: itemId, userId }, select: { title: true, description: true, estimatedMinutes: true, dueDate: true, priority: true, ...placement } });
      if (!task) return null;
      return {
        title: task.title,
        payload: {
          title: task.title, description: task.description, estimatedMinutes: task.estimatedMinutes, dueDate: task.dueDate?.toISOString() ?? null,
          priority: task.priority, subjectName: task.subject?.name ?? null, topicName: task.topic?.name ?? null,
        },
      };
    }
    case "PRELIMINARY_SET": {
      const set = await prisma.questionSet.findFirst({
        where: { id: itemId, userId },
        select: { topicName: true, date: true, subject: { select: { name: true } }, questions: { orderBy: { position: "asc" }, select: { text: true, options: true, correctIndex: true, solution: true, explanation: true } } },
      });
      if (!set || !set.questions.length) return null;
      return { title: set.topicName, payload: { topicName: set.topicName, date: set.date.toISOString(), subjectName: set.subject?.name ?? null, questions: set.questions } };
    }
    case "SHORT_QUESTION_SET": {
      const set = await prisma.shortQuestionSet.findFirst({
        where: { id: itemId, userId },
        select: { topicName: true, date: true, subject: { select: { name: true } }, questions: { orderBy: { position: "asc" }, select: { text: true, answer: true } } },
      });
      if (!set || !set.questions.length) return null;
      return { title: set.topicName, payload: { topicName: set.topicName, date: set.date.toISOString(), subjectName: set.subject?.name ?? null, questions: set.questions } };
    }
  }
}

/** The user's subject with this name (any case), created if missing; and their topic under it, if one matches. Also used for Question Bank copies. */
export async function placeFor(tx: Prisma.TransactionClient, userId: string, subjectName: string | null, topicName: string | null) {
  const name = subjectName?.trim();
  if (!name) return { subjectId: null, topicId: null };
  let subject = await tx.subject.findFirst({ where: { userId, name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  if (!subject) {
    const last = await tx.subject.aggregate({ where: { userId }, _max: { position: true } });
    subject = await tx.subject.create({ data: { userId, name, position: (last._max.position ?? -1) + 1 }, select: { id: true } });
  }
  const topic = topicName?.trim()
    ? await tx.topic.findFirst({ where: { userId, subjectId: subject.id, name: { equals: topicName.trim(), mode: "insensitive" } }, select: { id: true } })
    : null;
  return { subjectId: subject.id, topicId: topic?.id ?? null };
}

/** The recipient's new item from an accepted payload; returns its id. Re-validates and re-sanitizes everything. */
export async function createFromPayload(tx: Prisma.TransactionClient, recipientId: string, type: ShareType, rawPayload: unknown) {
  switch (type) {
    case "NOTE": {
      const data = payloadSchemas.NOTE.parse(rawPayload);
      const place = await placeFor(tx, recipientId, data.subjectName, data.topicName);
      const content = sanitizeNoteHtml(data.content);
      const note = await tx.note.create({ data: { userId: recipientId, title: data.title || "Shared note", content, plainText: htmlToPlainText(content).slice(0, 100_000), ...place }, select: { id: true } });
      return note.id;
    }
    case "TASK": {
      const data = payloadSchemas.TASK.parse(rawPayload);
      const place = await placeFor(tx, recipientId, data.subjectName, data.topicName);
      // New tasks go to the top of the recipient's own order, like tasks they create.
      const first = await tx.task.aggregate({ where: { userId: recipientId }, _min: { position: true } });
      const task = await tx.task.create({
        data: {
          userId: recipientId, position: (first._min.position ?? 1) - 1, title: data.title, description: toRichHtml(data.description),
          estimatedMinutes: data.estimatedMinutes, dueDate: data.dueDate ? new Date(data.dueDate) : null, priority: data.priority, ...place,
        },
        select: { id: true },
      });
      return task.id;
    }
    case "PRELIMINARY_SET": {
      const data = payloadSchemas.PRELIMINARY_SET.parse(rawPayload);
      const { subjectId } = await placeFor(tx, recipientId, data.subjectName ?? "Shared", null);
      const set = await tx.questionSet.create({
        data: { userId: recipientId, subjectId, topicName: data.topicName, date: new Date(data.date), questions: { create: data.questions.map((question, position) => ({ position, ...question })) } },
        select: { id: true },
      });
      return set.id;
    }
    case "SHORT_QUESTION_SET": {
      const data = payloadSchemas.SHORT_QUESTION_SET.parse(rawPayload);
      const { subjectId } = await placeFor(tx, recipientId, data.subjectName ?? "Shared", null);
      const set = await tx.shortQuestionSet.create({
        data: { userId: recipientId, subjectId, topicName: data.topicName, date: new Date(data.date), questions: { create: data.questions.map((question, position) => ({ position, ...question })) } },
        select: { id: true },
      });
      return set.id;
    }
  }
}
