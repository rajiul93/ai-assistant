"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QuestionSetStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { APP_TIMEZONE, dayjs } from "@/lib/dayjs";
import { withoutDuplicates } from "@/lib/preliminary";
import { prisma } from "@/lib/prisma";

/**
 * Preliminary: MCQ sets on a topic, moved Todo → Doing (study, answers shown) → Testing (exam,
 * answers hidden) → Done. While a set is in Testing its answer key never leaves the server:
 * the exam view gets questions and options only, and answers are marked here on submit.
 */

const questionSchema = z.object({
  text: z.string().trim().min(1, "প্রশ্ন লেখো").max(2000),
  options: z.array(z.string().trim().min(1, "৪টা option-ই লাগবে").max(500)).length(4),
  correctIndex: z.number().int().min(0).max(3),
});

const setSchema = z.object({
  subjectId: z.string().min(1, "Subject বেছে নাও"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "তারিখ দাও"),
  topicName: z.string().trim().min(1, "Topic-এর নাম দাও").max(160),
  questions: z.array(questionSchema).min(1, "অন্তত একটা প্রশ্ন দাও").max(300),
});

export type QuestionSetInput = z.infer<typeof setSchema>;
export type AttemptDetail = { text: string; options: string[]; correctIndex: number; chosen: number };

const statuses = ["TODO", "DOING", "TESTING", "DONE"] as const;

async function ownedSet(userId: string, id: string) {
  const set = await prisma.questionSet.findFirst({ where: { id, userId } });
  if (!set) throw new Error("Question set not found.");
  return set;
}

async function ownedSubject(userId: string, subjectId: string) {
  const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId }, select: { id: true } });
  if (!subject) throw new Error("Subject not found.");
  return subject.id;
}

const toDate = (value: string) => dayjs.tz(value, "YYYY-MM-DD", APP_TIMEZONE).toDate();

function revalidate(id?: string) {
  revalidatePath("/preliminary");
  if (id) revalidatePath(`/preliminary/${id}`);
}

/** The board: every set with its counts and latest score — no questions, no answers. */
export async function listQuestionSets() {
  const user = await requireUser();
  const sets = await prisma.questionSet.findMany({
    where: { userId: user.id },
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
    select: {
      id: true, topicName: true, date: true, status: true, updatedAt: true, subjectId: true,
      subject: { select: { name: true } },
      _count: { select: { questions: true, attempts: true } },
      attempts: { orderBy: { submittedAt: "desc" }, take: 1, select: { id: true, correct: true, total: true, submittedAt: true } },
    },
  });
  return sets.map(({ attempts, _count, ...set }) => ({ ...set, questionCount: _count.questions, attemptCount: _count.attempts, lastAttempt: attempts[0] ?? null }));
}

export async function createQuestionSet(input: unknown) {
  const user = await requireUser();
  const data = setSchema.parse(input);
  const subjectId = await ownedSubject(user.id, data.subjectId);
  const set = await prisma.questionSet.create({
    data: {
      userId: user.id,
      subjectId,
      topicName: data.topicName,
      date: toDate(data.date),
      questions: { create: data.questions.map((question, position) => ({ position, ...question })) },
    },
  });
  revalidate();
  return set.id;
}

/** Editing shows the answers, so it isn't allowed while the set is being tested. */
export async function updateQuestionSet(id: string, input: unknown) {
  const user = await requireUser();
  const set = await ownedSet(user.id, id);
  if (set.status === "TESTING") throw new Error("Test চলার সময় প্রশ্ন বদলানো যাবে না। আগে Doing-এ ফেরাও।");
  const data = setSchema.parse(input);
  const subjectId = await ownedSubject(user.id, data.subjectId);
  await prisma.$transaction([
    prisma.question.deleteMany({ where: { setId: set.id } }),
    prisma.questionSet.update({
      where: { id: set.id },
      data: {
        subjectId,
        topicName: data.topicName,
        date: toDate(data.date),
        questions: { create: data.questions.map((question, position) => ({ position, ...question })) },
      },
    }),
  ]);
  revalidate(set.id);
}

const mergeSchema = z.object({
  setIds: z.array(z.string().min(1)).min(2, "অন্তত ২টা set বেছে নাও"),
  subjectId: z.string().min(1, "Subject বেছে নাও"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "তারিখ দাও"),
  topicName: z.string().trim().min(1, "Topic-এর নাম দাও").max(160),
  deleteOriginals: z.boolean(),
});

/**
 * Several sets → one new Todo set holding their questions in the order the sets were picked.
 * A question that appears more than once (same wording and options) is kept only the first time.
 */
export async function mergeQuestionSets(input: unknown) {
  const user = await requireUser();
  const data = mergeSchema.parse(input);
  const ids = [...new Set(data.setIds)];
  const subjectId = await ownedSubject(user.id, data.subjectId);
  const sets = await prisma.questionSet.findMany({
    where: { id: { in: ids }, userId: user.id },
    select: { id: true, questions: { orderBy: { position: "asc" }, select: { text: true, options: true, correctIndex: true } } },
  });
  if (sets.length !== ids.length) throw new Error("Question set not found.");
  const all = ids.flatMap((id) => sets.find((set) => set.id === id)!.questions);
  const questions = withoutDuplicates(all);
  if (!questions.length) throw new Error("বেছে নেওয়া set-গুলোতে কোনো প্রশ্ন নেই।");
  if (questions.length > 300) throw new Error(`একটা set-এ সর্বোচ্চ ৩০০ প্রশ্ন রাখা যায় — এখানে ${questions.length}টি।`);
  const [created] = await prisma.$transaction([
    prisma.questionSet.create({
      data: {
        userId: user.id,
        subjectId,
        topicName: data.topicName,
        date: toDate(data.date),
        questions: { create: questions.map((question, position) => ({ position, ...question })) },
      },
    }),
    ...(data.deleteOriginals ? [prisma.questionSet.deleteMany({ where: { id: { in: ids }, userId: user.id } })] : []),
  ]);
  revalidate();
  return { id: created.id, questionCount: questions.length, duplicates: all.length - questions.length };
}

export async function deleteQuestionSet(id: string) {
  const user = await requireUser();
  const set = await ownedSet(user.id, id);
  await prisma.questionSet.delete({ where: { id: set.id } });
  revalidate();
}

export async function setQuestionSetStatus(id: string, status: QuestionSetStatus) {
  const user = await requireUser();
  const next = z.enum(statuses).parse(status);
  const set = await ownedSet(user.id, id);
  if (next === "TESTING" && !(await prisma.question.count({ where: { setId: set.id } }))) throw new Error("প্রশ্ন ছাড়া test হয় না।");
  // Done comes after a test.
  if (next === "DONE" && !(await prisma.testAttempt.count({ where: { setId: set.id } }))) throw new Error("আগে একবার test দাও, তারপর Done।");
  await prisma.questionSet.update({ where: { id: set.id }, data: { status: next } });
  revalidate(set.id);
}

/**
 * One set for its page. The answer key is included only outside Testing; during a test the page
 * gets question text and options alone.
 */
export async function getQuestionSet(id: string) {
  const user = await requireUser();
  const set = await prisma.questionSet.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true, topicName: true, date: true, status: true, subjectId: true,
      subject: { select: { name: true } },
      questions: { orderBy: { position: "asc" }, select: { id: true, text: true, options: true, correctIndex: true } },
      attempts: { orderBy: { submittedAt: "desc" }, take: 10, select: { id: true, correct: true, total: true, submittedAt: true } },
    },
  });
  if (!set) return null;
  const testing = set.status === "TESTING";
  return {
    ...set,
    questions: set.questions.map((question) => (testing ? { id: question.id, text: question.text, options: question.options, correctIndex: null } : question)),
  };
}

/** Marks a test on the server and keeps a copy of it; the set stays in Testing until moved to Done. */
export async function submitTest(id: string, answers: Record<string, number>) {
  const user = await requireUser();
  const set = await ownedSet(user.id, id);
  if (set.status !== "TESTING") throw new Error("এই set এখন Testing-এ নেই।");
  const chosen = z.record(z.string(), z.number().int().min(-1).max(3)).parse(answers);
  const questions = await prisma.question.findMany({ where: { setId: set.id }, orderBy: { position: "asc" } });
  if (!questions.length) throw new Error("প্রশ্ন নেই।");
  const details: AttemptDetail[] = questions.map((question) => ({ text: question.text, options: question.options, correctIndex: question.correctIndex, chosen: chosen[question.id] ?? -1 }));
  const correct = details.filter((detail) => detail.chosen === detail.correctIndex).length;
  const attempt = await prisma.testAttempt.create({ data: { setId: set.id, userId: user.id, total: details.length, correct, details } });
  revalidate(set.id);
  return attempt.id;
}

export async function getAttempt(attemptId: string) {
  const user = await requireUser();
  const attempt = await prisma.testAttempt.findFirst({
    where: { id: attemptId, userId: user.id },
    select: { id: true, setId: true, total: true, correct: true, details: true, submittedAt: true, set: { select: { topicName: true, status: true, subject: { select: { name: true } } } } },
  });
  if (!attempt) return null;
  return { ...attempt, details: attempt.details as AttemptDetail[] };
}
