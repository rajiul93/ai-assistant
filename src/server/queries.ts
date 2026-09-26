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

// The user's own order (drag and drop on the Subjects page), then by name.
const byPosition = [{ position: "asc" as const }, { name: "asc" as const }];

export async function getSubjects(userId: string) {
  return prisma.subject.findMany({
    where: { userId },
    orderBy: byPosition,
    include: {
      topics: {
        orderBy: byPosition,
        include: {
          children: {
            orderBy: byPosition,
            include: { children: { orderBy: byPosition } },
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
    orderBy: [{ position: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
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

/** Tasks in the revision list (finished or marked "Revision"): never-revised first, then least recently revised. */
export async function getTasksToRevise(userId: string, take?: number) {
  return prisma.task.findMany({
    where: { userId, status: { in: ["FINISHED", "REVISION"] satisfies TaskStatus[] } },
    include: taskInclude,
    orderBy: [{ lastRevisedAt: { sort: "asc", nulls: "first" } }, { updatedAt: "desc" }],
    ...(take ? { take } : {}),
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
  const [completedTasks, pendingTasks, tasksToRevise, revisionTotals, totalTasks] = await Promise.all([
    prisma.task.count({ where: { userId, status: "FINISHED" } }),
    prisma.task.count({ where: { userId, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } } }),
    prisma.task.count({ where: { userId, status: { in: ["FINISHED", "REVISION"] } } }),
    prisma.task.aggregate({ where: { userId }, _sum: { timesRevised: true } }),
    prisma.task.count({ where: { userId } }),
  ]);

  return {
    completedTasks,
    pendingTasks,
    /** Tasks in the revision list (finished or marked "Revision"). */
    tasksToRevise,
    /** How many revisions have been done across all tasks. */
    timesRevised: revisionTotals._sum.timesRevised ?? 0,
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

type TokenCounts = { tokens: number; inputTokens: number; outputTokens: number };
export type AiUsageBreakdown = { key: string; requests: number } & TokenCounts;
export type AiUserUsage = { userId: string | null; name: string; email: string; requests: number; failed: number; lastUsedAt: Date | null } & TokenCounts;

/**
 * AI usage for the usage page. `userId` limits it to one user; omit it (admins only) for everyone.
 * Daily buckets are app-timezone days from `from` (or the first recorded call) to today.
 */
export async function getAiUsage({ userId, from }: { userId?: string; from: Date | null }) {
  const where = { ...(userId ? { userId } : {}), ...(from ? { createdAt: { gte: from } } : {}) };
  const [rows, byUser] = await Promise.all([
    prisma.aiUsage.findMany({
      where,
      select: { createdAt: true, feature: true, model: true, status: true, totalTokens: true, inputTokens: true, outputTokens: true, latencyMs: true },
      orderBy: { createdAt: "asc" },
      take: 50_000,
    }),
    prisma.aiUsage.groupBy({
      by: ["userId"],
      where,
      _count: { _all: true },
      _sum: { totalTokens: true, inputTokens: true, outputTokens: true },
      _max: { createdAt: true },
    }),
  ]);

  const failedByUser = await prisma.aiUsage.groupBy({ by: ["userId"], where: { ...where, status: { not: "ok" } }, _count: { _all: true } });
  const users = await prisma.user.findMany({
    where: { id: { in: byUser.map((row) => row.userId).filter((id): id is string => Boolean(id)) } },
    select: { id: true, name: true, email: true },
  });

  const sum = (pick: (row: (typeof rows)[number]) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const ok = rows.filter((row) => row.status === "ok");
  const group = (key: (row: (typeof rows)[number]) => string): AiUsageBreakdown[] => {
    const map = new Map<string, AiUsageBreakdown>();
    for (const row of rows) {
      const entry = map.get(key(row)) ?? { key: key(row), requests: 0, tokens: 0, inputTokens: 0, outputTokens: 0 };
      entry.requests += 1;
      entry.tokens += row.totalTokens;
      entry.inputTokens += row.inputTokens;
      entry.outputTokens += row.outputTokens;
      map.set(entry.key, entry);
    }
    return [...map.values()].sort((a, b) => b.requests - a.requests);
  };

  const firstDay = startOfDay(from ?? rows[0]?.createdAt ?? new Date());
  const today = startOfDay();
  const daily: Array<{ day: string; requests: number; failed: number } & TokenCounts> = [];
  for (let day = firstDay; !day.isAfter(today); day = day.add(1, "day")) daily.push({ day: day.format("YYYY-MM-DD"), requests: 0, tokens: 0, inputTokens: 0, outputTokens: 0, failed: 0 });
  const dayIndex = new Map(daily.map((entry, index) => [entry.day, index]));
  for (const row of rows) {
    const bucket = daily[dayIndex.get(startOfDay(row.createdAt).format("YYYY-MM-DD")) ?? -1];
    if (!bucket) continue;
    bucket.requests += 1;
    bucket.tokens += row.totalTokens;
    bucket.inputTokens += row.inputTokens;
    bucket.outputTokens += row.outputTokens;
    if (row.status !== "ok") bucket.failed += 1;
  }

  const failed = new Map(failedByUser.map((row) => [row.userId, row._count._all]));
  const perUser: AiUserUsage[] = byUser
    .map((row) => {
      const user = users.find((item) => item.id === row.userId);
      return {
        userId: row.userId,
        name: user?.name ?? (row.userId ? "Unknown user" : "Deleted user"),
        email: user?.email ?? "",
        requests: row._count._all,
        failed: failed.get(row.userId) ?? 0,
        tokens: row._sum.totalTokens ?? 0,
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        lastUsedAt: row._max.createdAt,
      };
    })
    .sort((a, b) => b.requests - a.requests);

  return {
    totals: {
      requests: rows.length,
      succeeded: ok.length,
      failed: rows.length - ok.length,
      inputTokens: sum((row) => row.inputTokens),
      outputTokens: sum((row) => row.outputTokens),
      totalTokens: sum((row) => row.totalTokens),
      averageLatencyMs: ok.length ? Math.round(ok.reduce((total, row) => total + row.latencyMs, 0) / ok.length) : 0,
    },
    daily,
    byFeature: group((row) => row.feature),
    byModel: group((row) => row.model),
    byStatus: group((row) => row.status),
    perUser,
  };
}
