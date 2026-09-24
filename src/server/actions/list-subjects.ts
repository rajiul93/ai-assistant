"use server";

import { requireUser } from "@/lib/auth";
import { endOfDay, startOfMonth } from "@/lib/dayjs";
import { prisma } from "@/lib/prisma";

/** Subjects (with topics and this month's study time) for the "Which subject?" picker. */
export async function listSubjectsForTimer() {
  const user = await requireUser();
  const [subjects, monthTotals] = await Promise.all([
    prisma.subject.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, topics: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
    }),
    prisma.studySession.groupBy({
      by: ["subjectId"],
      where: { userId: user.id, startedAt: { gte: startOfMonth().toDate(), lte: endOfDay().toDate() } },
      _sum: { durationSeconds: true },
    }),
  ]);
  const secondsBySubject = new Map(monthTotals.map((row) => [row.subjectId, row._sum.durationSeconds ?? 0]));
  return subjects.map((subject) => ({ ...subject, monthSeconds: secondsBySubject.get(subject.id) ?? 0 }));
}
