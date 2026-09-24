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

export async function getSubjectStudySeconds(userId: string) {
  const groups = await prisma.studySession.groupBy({
    by: ["subjectId"],
    where: { userId },
    _sum: { durationSeconds: true },
  });
  const subjects = await prisma.subject.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const nameById = new Map(subjects.map((subject) => [subject.id, subject.name]));
  return groups
    .map((group) => ({
      subjectId: group.subjectId,
      name: group.subjectId ? nameById.get(group.subjectId) ?? "Unassigned" : "Unassigned",
      seconds: group._sum.durationSeconds ?? 0,
    }))
    .sort((a, b) => b.seconds - a.seconds);
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
