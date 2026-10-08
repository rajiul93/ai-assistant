"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QuestionSetStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { APP_TIMEZONE, dayjs } from "@/lib/dayjs";
import { prisma } from "@/lib/prisma";
import { answersMatch, withoutDuplicateShorts, type ShortAttemptDetail } from "@/lib/short-questions";

/**
 * Short Question: question–answer sets, moved Todo → Doing (study, answers shown) → Testing (exam,
 * answers hidden) → Done, like Preliminary. A test is written, not picked, so it is marked by the
 * user afterwards: an answer that says exactly the answer is marked right at once, the rest by hand.
 */

const questionSchema = z.object({
  text: z.string().trim().min(1, "প্রশ্ন লেখো").max(2000),
  answer: z.string().trim().min(1, "উত্তর লেখো").max(4000),
});

const setSchema = z.object({
  subjectId: z.string().min(1, "Subject বেছে নাও"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "তারিখ দাও"),
  topicName: z.string().trim().min(1, "Topic-এর নাম দাও").max(160),
  questions: z.array(questionSchema).min(1, "অন্তত একটা প্রশ্ন দাও").max(300),
});

const statuses = ["TODO", "DOING", "TESTING", "DONE"] as const;

async function ownedSet(userId: string, id: string) {
  const set = await prisma.shortQuestionSet.findFirst({ where: { id, userId } });
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
  revalidatePath("/short-questions");
  if (id) revalidatePath(`/short-questions/${id}`);
}

/** The board: every set with its counts and latest score — no questions, no answers. */
export async function listShortQuestionSets() {
  const user = await requireUser();
  const sets = await prisma.shortQuestionSet.findMany({
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

export async function createShortQuestionSet(input: unknown) {
  const user = await requireUser();
  const data = setSchema.parse(input);
  const subjectId = await ownedSubject(user.id, data.subjectId);
  const set = await prisma.shortQuestionSet.create({
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
export async function updateShortQuestionSet(id: string, input: unknown) {
  const user = await requireUser();
  const set = await ownedSet(user.id, id);
  if (set.status === "TESTING") throw new Error("Test চলার সময় প্রশ্ন বদলানো যাবে না। আগে Doing-এ ফেরাও।");
  const data = setSchema.parse(input);
  const subjectId = await ownedSubject(user.id, data.subjectId);
  await prisma.$transaction([
    prisma.shortQuestion.deleteMany({ where: { setId: set.id } }),
    prisma.shortQuestionSet.update({
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
 * A question that appears more than once (same question and answer) is kept only the first time.
 */
export async function mergeShortQuestionSets(input: unknown) {
  const user = await requireUser();
  const data = mergeSchema.parse(input);
  const ids = [...new Set(data.setIds)];
  const subjectId = await ownedSubject(user.id, data.subjectId);
  const sets = await prisma.shortQuestionSet.findMany({
    where: { id: { in: ids }, userId: user.id },
    select: { id: true, questions: { orderBy: { position: "asc" }, select: { text: true, answer: true } } },
  });
  if (sets.length !== ids.length) throw new Error("Question set not found.");
  const all = ids.flatMap((id) => sets.find((set) => set.id === id)!.questions);
  const questions = withoutDuplicateShorts(all);
  if (!questions.length) throw new Error("বেছে নেওয়া set-গুলোতে কোনো প্রশ্ন নেই।");
  if (questions.length > 300) throw new Error(`একটা set-এ সর্বোচ্চ ৩০০ প্রশ্ন রাখা যায় — এখানে ${questions.length}টি।`);
  const [created] = await prisma.$transaction([
    prisma.shortQuestionSet.create({
      data: {
        userId: user.id,
        subjectId,
        topicName: data.topicName,
        date: toDate(data.date),
        questions: { create: questions.map((question, position) => ({ position, ...question })) },
      },
    }),
    ...(data.deleteOriginals ? [prisma.shortQuestionSet.deleteMany({ where: { id: { in: ids }, userId: user.id } })] : []),
  ]);
  revalidate();
  return { id: created.id, questionCount: questions.length, duplicates: all.length - questions.length };
}

export async function deleteShortQuestionSet(id: string) {
  const user = await requireUser();
  const set = await ownedSet(user.id, id);
  await prisma.shortQuestionSet.delete({ where: { id: set.id } });
  revalidate();
}

export async function setShortQuestionSetStatus(id: string, status: QuestionSetStatus) {
  const user = await requireUser();
  const next = z.enum(statuses).parse(status);
  const set = await ownedSet(user.id, id);
  if (next === "TESTING" && !(await prisma.shortQuestion.count({ where: { setId: set.id } }))) throw new Error("প্রশ্ন ছাড়া test হয় না।");
  if (next === "DONE" && !(await prisma.shortTestAttempt.count({ where: { setId: set.id } }))) throw new Error("আগে একবার test দাও, তারপর Done।");
  await prisma.shortQuestionSet.update({ where: { id: set.id }, data: { status: next } });
  revalidate(set.id);
}

/** One set for its page. The answers are included only outside Testing. */
export async function getShortQuestionSet(id: string) {
  const user = await requireUser();
  const set = await prisma.shortQuestionSet.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true, topicName: true, date: true, status: true, subjectId: true,
      subject: { select: { name: true } },
      questions: { orderBy: { position: "asc" }, select: { id: true, text: true, answer: true } },
      attempts: { orderBy: { submittedAt: "desc" }, take: 10, select: { id: true, correct: true, total: true, submittedAt: true } },
    },
  });
  if (!set) return null;
  const testing = set.status === "TESTING";
  return { ...set, questions: set.questions.map((question) => (testing ? { id: question.id, text: question.text, answer: null } : question)) };
}

/** Keeps a copy of the written test; exact answers are marked right now, the rest wait for the user. */
export async function submitShortTest(id: string, answers: Record<string, string>) {
  const user = await requireUser();
  const set = await ownedSet(user.id, id);
  if (set.status !== "TESTING") throw new Error("এই set এখন Testing-এ নেই।");
  const given = z.record(z.string(), z.string().max(4000)).parse(answers);
  const questions = await prisma.shortQuestion.findMany({ where: { setId: set.id }, orderBy: { position: "asc" } });
  if (!questions.length) throw new Error("প্রশ্ন নেই।");
  const details: ShortAttemptDetail[] = questions.map((question) => {
    const written = (given[question.id] ?? "").trim();
    // Blank is wrong; an exact answer is right; anything else is for the user to judge.
    return { text: question.text, answer: question.answer, given: written, right: !written ? false : answersMatch(written, question.answer) ? true : null };
  });
  const attempt = await prisma.shortTestAttempt.create({
    data: { setId: set.id, userId: user.id, total: details.length, correct: details.filter((detail) => detail.right).length, details },
  });
  revalidate(set.id);
  return attempt.id;
}

/** The user marks one written answer right or wrong after seeing the real one. */
export async function markShortAnswer(attemptId: string, index: number, right: boolean) {
  const user = await requireUser();
  const attempt = await prisma.shortTestAttempt.findFirst({ where: { id: attemptId, userId: user.id } });
  if (!attempt) throw new Error("Result not found.");
  const details = attempt.details as ShortAttemptDetail[];
  const position = z.number().int().min(0).max(details.length - 1).parse(index);
  const next = details.map((detail, at) => (at === position ? { ...detail, right: z.boolean().parse(right) } : detail));
  await prisma.shortTestAttempt.update({ where: { id: attempt.id }, data: { details: next, correct: next.filter((detail) => detail.right).length } });
  revalidate(attempt.setId);
}

export async function getShortAttempt(attemptId: string) {
  const user = await requireUser();
  const attempt = await prisma.shortTestAttempt.findFirst({
    where: { id: attemptId, userId: user.id },
    select: { id: true, setId: true, total: true, correct: true, details: true, submittedAt: true, set: { select: { topicName: true, status: true, subject: { select: { name: true } } } } },
  });
  if (!attempt) return null;
  return { ...attempt, details: attempt.details as ShortAttemptDetail[] };
}
