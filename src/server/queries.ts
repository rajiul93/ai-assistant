import { Prisma, type TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay, startOfMonth, startOfWeek } from "@/lib/dayjs";

const taskInclude = {
  subject: true,
  topic: true,
} satisfies Prisma.TaskInclude;

export async function getStudyPlan(userId: string) {
  return prisma.studyPlan.findUnique({ where: { userId } });
}

export async function getSubjects(userId: string) {
  return prisma.subject.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: {
      topics: {
        orderBy: { name: "asc" },
        include: {
          children: {
            orderBy: { name: "asc" },
            include: { children: { orderBy: { name: "asc" } } },
          },
        },
      },
    },
  });
}

export async function getFlatTopics(userId: string) {
  return prisma.topic.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: { subject: true, parent: true },
  });
}

export async function getTasks(userId: string) {
  return prisma.task.findMany({
    where: { userId },
    include: taskInclude,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });
}

/** Every unfinished task, lightly loaded — for finding the one the user names ("physics chapter 3"). */
export async function getOpenTasks(userId: string) {
  return prisma.task.findMany({
    where: { userId, status: { not: "FINISHED" } },
    select: { id: true, title: true, subject: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

/** When today's plan was started, or null if the user hasn't pressed "Start Today's Plan" yet. */
export async function getTodayPlanStart(userId: string) {
  const start = await prisma.dailyPlanStart.findUnique({
    where: { userId_date: { userId, date: startOfDay().toDate() } },
  });
  return start?.startedAt ?? null;
}

export async function getTodayTasks(userId: string) {
  const start = startOfDay().toDate();
  const end = endOfDay().toDate();
  return prisma.task.findMany({
    where: {
      userId,
      dueDate: { gte: start, lte: end },
    },
    include: taskInclude,
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
  });
}

export async function getPendingTasks(userId: string) {
  return prisma.task.findMany({
    where: {
      userId,
      status: { in: ["NOT_STARTED", "IN_PROGRESS"] satisfies TaskStatus[] },
    },
    include: taskInclude,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 8,
  });
}

export async function getTodayRevisions(userId: string) {
  const start = startOfDay().toDate();
  const end = endOfDay().toDate();
  return prisma.revision.findMany({
    where: {
      userId,
      revisionDate: { gte: start, lte: end },
    },
    include: { topic: true, subject: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getRevisions(userId: string) {
  return prisma.revision.findMany({
    where: { userId },
    include: { topic: true, subject: true },
    orderBy: [{ revisionDate: "asc" }, { createdAt: "desc" }],
  });
}

export async function getStudySecondsInRange(
  userId: string,
  from: Date,
  to: Date,
) {
  const aggregate = await prisma.studySession.aggregate({
    where: {
      userId,
      startedAt: { gte: from, lte: to },
    },
    _sum: { durationSeconds: true },
  });
  return aggregate._sum.durationSeconds ?? 0;
}

export async function getTodayStudySeconds(userId: string) {
  return getStudySecondsInRange(userId, startOfDay().toDate(), endOfDay().toDate());
}

export async function getWeeklyStudySeconds(userId: string) {
  return getStudySecondsInRange(userId, startOfWeek().toDate(), endOfDay().toDate());
}

export async function getMonthlyStudySeconds(userId: string) {
  return getStudySecondsInRange(
    userId,
    startOfMonth().toDate(),
    endOfDay().toDate(),
  );
}

export async function getProgressCounts(userId: string) {
  const [completedTasks, pendingTasks, completedRevisions, pendingRevisions, totalTasks] =
    await Promise.all([
      prisma.task.count({ where: { userId, status: "FINISHED" } }),
      prisma.task.count({
        where: { userId, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } },
      }),
      prisma.revision.count({ where: { userId, status: "COMPLETED" } }),
      prisma.revision.count({ where: { userId, status: "PENDING" } }),
      prisma.task.count({ where: { userId } }),
    ]);

  return {
    completedTasks,
    pendingTasks,
    completedRevisions,
    pendingRevisions,
    totalTasks,
  };
}

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;
export type SubjectWithTopics = Prisma.SubjectGetPayload<{
  include: {
    topics: {
      include: { children: { include: { children: true } } };
    };
  };
}>;

export type SubjectStat = {
  subjectId: string | null;
  name: string;
  seconds: number;
  sessions: number;
  activeDays: number;
  previousSeconds: number;
  finishedTasks: number;
  openTasks: number;
  lastStudiedAt: Date | null;
};

/**
 * Per-subject study analysis for [from, to], compared with [previousFrom, previousTo].
 * Every subject is included (even with no study time) so neglected subjects show up.
 * "Finished tasks" counts tasks marked finished in the period (by their last update time).
 */
export async function getSubjectAnalysis(userId: string, from: Date | null, to: Date, previous: { from: Date; to: Date } | null) {
  const range = from ? { gte: from, lte: to } : { lte: to };
  const [subjects, sessions, previousTotals, lastStudied, finished, open] = await Promise.all([
    prisma.subject.findMany({ where: { userId }, select: { id: true, name: true } }),
    prisma.studySession.findMany({ where: { userId, startedAt: range }, select: { subjectId: true, startedAt: true, durationSeconds: true } }),
    previous
      ? prisma.studySession.groupBy({ by: ["subjectId"], where: { userId, startedAt: { gte: previous.from, lte: previous.to } }, _sum: { durationSeconds: true } })
      : Promise.resolve([]),
    prisma.studySession.groupBy({ by: ["subjectId"], where: { userId }, _max: { startedAt: true } }),
    prisma.task.groupBy({ by: ["subjectId"], where: { userId, status: "FINISHED", updatedAt: range }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["subjectId"], where: { userId, status: { not: "FINISHED" } }, _count: { _all: true } }),
  ]);

  const stats = new Map<string | null, SubjectStat>();
  const statFor = (subjectId: string | null) => {
    let stat = stats.get(subjectId);
    if (!stat) {
      const name = subjectId ? subjects.find((subject) => subject.id === subjectId)?.name ?? "Deleted subject" : "No subject";
      stat = { subjectId, name, seconds: 0, sessions: 0, activeDays: 0, previousSeconds: 0, finishedTasks: 0, openTasks: 0, lastStudiedAt: null };
      stats.set(subjectId, stat);
    }
    return stat;
  };
  subjects.forEach((subject) => statFor(subject.id));

  const days = new Map<string | null, Set<string>>();
  for (const session of sessions) {
    const stat = statFor(session.subjectId);
    stat.seconds += session.durationSeconds;
    stat.sessions += 1;
    const day = startOfDay(session.startedAt).format("YYYY-MM-DD");
    days.set(session.subjectId, (days.get(session.subjectId) ?? new Set()).add(day));
  }
  days.forEach((set, subjectId) => { statFor(subjectId).activeDays = set.size; });
  previousTotals.forEach((row) => { if (stats.has(row.subjectId)) statFor(row.subjectId).previousSeconds = row._sum.durationSeconds ?? 0; });
  lastStudied.forEach((row) => { if (stats.has(row.subjectId)) statFor(row.subjectId).lastStudiedAt = row._max.startedAt; });
  finished.forEach((row) => { if (stats.has(row.subjectId)) statFor(row.subjectId).finishedTasks = row._count._all; });
  open.forEach((row) => { if (stats.has(row.subjectId)) statFor(row.subjectId).openTasks = row._count._all; });

  // "No subject" only matters when old, unassigned sessions exist in the period.
  const noSubject = stats.get(null);
  if (noSubject && noSubject.seconds === 0) stats.delete(null);
  return [...stats.values()].sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name));
}
