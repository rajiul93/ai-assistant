"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { now, startOfDay } from "@/lib/dayjs";
import { sanitizeNoteHtml } from "@/lib/note-html";
import { prisma } from "@/lib/prisma";
import { BANK_IMPORT_BATCH, questionFingerprint } from "@/lib/question-bank";
import { assertCanTakeFromBank } from "@/server/bank-access";
import { placeFor } from "@/server/collaboration/share-copy";
import { gateNotes, hasPremium } from "@/server/premium";
import { can } from "@/server/roles";

/**
 * The General half of the Question Bank (docs/question-bank-v2-plan.md): subject → chapter →
 * articles, MCQs and short questions, shared by everyone. Each item is free or paid (defaults:
 * articles free, the rest paid); a paid item reaches the page only for a running plan or staff.
 * Staff with the `question_bank` permission add, edit, move, price and delete.
 */

const idSchema = z.string().min(1).max(64);
const nameSchema = z.string().trim().min(1, "নাম লেখো").max(120, "নাম খুব লম্বা");
const kindSchema = z.enum(["article", "mcq", "short"]);
export type BankItemKind = z.infer<typeof kindSchema>;
/** Preliminary and Short Question both cap a set at 300. */
const SET_MAX = 300;

async function requireBankEditor() {
  const me = await requireUser();
  if (!(await can(me, "question_bank"))) throw new Error("এটা করতে প্রশ্ন ব্যাংক permission লাগবে।");
  return me;
}

function revalidateBank() {
  revalidatePath("/question-bank", "layout");
}

const duplicate = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/* ---------- Reading ---------- */

export async function listBankSubjects() {
  const me = await requireUser();
  const [subjects, canEdit] = await Promise.all([
    prisma.bankSubject.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, _count: { select: { chapters: true } } } }),
    can(me, "question_bank"),
  ]);
  return { canEdit, subjects: subjects.map(({ _count, ...subject }) => ({ ...subject, chapters: _count.chapters })) };
}

/** One subject and its chapters, each with how many articles, MCQs and short questions it has. */
export async function getBankSubject(id: string) {
  const me = await requireUser();
  const subject = await prisma.bankSubject.findUnique({
    where: { id: idSchema.parse(id) },
    select: {
      id: true, name: true,
      chapters: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, _count: { select: { articles: true, questions: true, shortQuestions: true } } } },
    },
  });
  if (!subject) return null;
  const canEdit = await can(me, "question_bank");
  const others = canEdit ? await prisma.bankSubject.findMany({ where: { id: { not: subject.id } }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }) : [];
  return {
    id: subject.id, name: subject.name, canEdit, others,
    chapters: subject.chapters.map(({ _count, ...chapter }) => ({ ...chapter, articles: _count.articles, mcqs: _count.questions, shorts: _count.shortQuestions })),
  };
}

/**
 * One chapter with its articles, MCQs and short questions as I may see them: a paid item without a
 * plan comes as its id and title only (`locked`).
 */
export async function getBankChapter(id: string) {
  const me = await requireUser();
  const chapter = await prisma.bankChapter.findUnique({
    where: { id: idSchema.parse(id) },
    select: {
      id: true, name: true, subject: { select: { id: true, name: true } },
      articles: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, content: true, free: true } },
      questions: { orderBy: [{ serial: "asc" }, { id: "asc" }], select: { id: true, text: true, options: true, correctIndex: true, solution: true, explanation: true, editedAt: true, free: true } },
      shortQuestions: { orderBy: [{ serial: "asc" }, { id: "asc" }], select: { id: true, question: true, answer: true, free: true } },
    },
  });
  if (!chapter) return null;
  const [canEdit, premium] = await Promise.all([can(me, "question_bank"), hasPremium(me)]);
  const open = (item: { free: boolean }) => premium || item.free;
  return {
    id: chapter.id, name: chapter.name, subject: chapter.subject, canEdit, premium,
    articles: chapter.articles.map((article) => (open(article) ? { ...article, locked: false } : { ...article, content: "", locked: true })),
    questions: chapter.questions.map((question) => (open(question)
      ? { ...gateNotes(question, true), locked: false }
      : { ...gateNotes({ ...question, text: "", options: [], correctIndex: -1 }, false), locked: true })),
    shorts: chapter.shortQuestions.map((short) => (open(short) ? { ...short, locked: false } : { ...short, question: "", answer: "", locked: true })),
  };
}

/** Every chapter as "Subject › Chapter", for staff moving items (also MCQs out of a past-year set). */
export async function listChapterTargets() {
  await requireBankEditor();
  const subjects = await prisma.bankSubject.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true, chapters: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true } } } });
  return subjects.flatMap((subject) => subject.chapters.map((chapter) => ({ id: chapter.id, label: `${subject.name} › ${chapter.name}` })));
}

/* ---------- Sending to my own sets ---------- */

/**
 * The chapter's MCQs as a new set in my Preliminary (Todo, today), filed under the subject (created
 * if missing) and the chapter as topic when I have one by that name. Needs a plan and a free slot
 * (two sets from the bank at a time until 60%, bank-access `assertCanTakeFromBank`).
 */
export async function sendChapterToPreliminary(chapterId: string) {
  const me = await requireUser();
  const chapter = await prisma.bankChapter.findUnique({
    where: { id: idSchema.parse(chapterId) },
    select: { name: true, subject: { select: { name: true } }, questions: { orderBy: [{ serial: "asc" }, { id: "asc" }], select: { text: true, options: true, correctIndex: true, solution: true, explanation: true, free: true } } },
  });
  if (!chapter) throw new Error("Chapter পাওয়া যায়নি।");
  if (!chapter.questions.length) throw new Error("এই chapter-এ কোনো MCQ নেই।");
  // A plan, and fewer than two sets from the bank still short of 60%.
  await assertCanTakeFromBank(me, "mcq");
  const premium = await hasPremium(me);
  const questions = chapter.questions.filter((question) => premium || question.free);
  if (!questions.length) throw new Error(chapter.questions.length ? "এই chapter-এর MCQ পেতে একটা চালু plan লাগবে।" : "এই chapter-এ কোনো MCQ নেই।");
  if (questions.length > SET_MAX) throw new Error(`একটা Preliminary set-এ সর্বোচ্চ ${SET_MAX}টি প্রশ্ন রাখা যায় — এখানে ${questions.length}টি।`);
  const copy = await prisma.$transaction(async (tx) => {
    const { subjectId, topicId } = await placeFor(tx, me.id, chapter.subject.name, chapter.name);
    return tx.questionSet.create({
      data: {
        userId: me.id, subjectId, topicId, fromBank: true, topicName: `${chapter.name} — MCQ`.slice(0, 160), date: startOfDay(now()).toDate(),
        // Solutions travel only with a plan, as in the bank itself.
        questions: { create: questions.map((question, position) => ({ position, text: question.text, options: question.options, correctIndex: question.correctIndex, solution: premium ? question.solution : null, explanation: premium ? question.explanation : null })) },
      },
      select: { id: true },
    });
  });
  revalidatePath("/preliminary");
  return { id: copy.id, count: questions.length, partial: questions.length < chapter.questions.length };
}

/** The chapter's short questions I may open, as a new set in my Short Question (Todo, today). */
export async function sendChapterToShortQuestions(chapterId: string) {
  const me = await requireUser();
  const chapter = await prisma.bankChapter.findUnique({
    where: { id: idSchema.parse(chapterId) },
    select: { name: true, subject: { select: { name: true } }, shortQuestions: { orderBy: [{ serial: "asc" }, { id: "asc" }], select: { question: true, answer: true, free: true } } },
  });
  if (!chapter) throw new Error("Chapter পাওয়া যায়নি।");
  if (!chapter.shortQuestions.length) throw new Error("এই chapter-এ কোনো Short Question নেই।");
  await assertCanTakeFromBank(me, "short");
  const premium = await hasPremium(me);
  const shorts = chapter.shortQuestions.filter((short) => premium || short.free);
  if (!shorts.length) throw new Error(chapter.shortQuestions.length ? "এই chapter-এর Short Question পেতে একটা চালু plan লাগবে।" : "এই chapter-এ কোনো Short Question নেই।");
  if (shorts.length > SET_MAX) throw new Error(`একটা set-এ সর্বোচ্চ ${SET_MAX}টি প্রশ্ন রাখা যায় — এখানে ${shorts.length}টি।`);
  const copy = await prisma.$transaction(async (tx) => {
    const { subjectId, topicId } = await placeFor(tx, me.id, chapter.subject.name, chapter.name);
    return tx.shortQuestionSet.create({
      data: {
        userId: me.id, subjectId, topicId, fromBank: true, topicName: `${chapter.name} — Short Question`.slice(0, 160), date: startOfDay(now()).toDate(),
        questions: { create: shorts.map((short, position) => ({ position, text: short.question.slice(0, 2000), answer: short.answer.slice(0, 4000) })) },
      },
      select: { id: true },
    });
  });
  revalidatePath("/short-questions");
  return { id: copy.id, count: shorts.length, partial: shorts.length < chapter.shortQuestions.length };
}

/* ---------- Subjects and chapters (staff) ---------- */

export async function createBankSubject(name: string) {
  await requireBankEditor();
  const last = await prisma.bankSubject.aggregate({ _max: { sortOrder: true } });
  try {
    const subject = await prisma.bankSubject.create({ data: { name: nameSchema.parse(name), sortOrder: (last._max.sortOrder ?? 0) + 1 }, select: { id: true } });
    revalidateBank();
    return subject;
  } catch (error) {
    if (duplicate(error)) throw new Error("এই নামে subject আগেই আছে।");
    throw error;
  }
}

export async function renameBankSubject(id: string, name: string) {
  await requireBankEditor();
  try {
    await prisma.bankSubject.update({ where: { id: idSchema.parse(id) }, data: { name: nameSchema.parse(name) } });
  } catch (error) {
    if (duplicate(error)) throw new Error("এই নামে subject আগেই আছে।");
    throw error;
  }
  revalidateBank();
}

/** Deletes the subject with every chapter and item in it (the page asks first, showing the counts). */
export async function deleteBankSubject(id: string) {
  await requireBankEditor();
  await prisma.bankSubject.delete({ where: { id: idSchema.parse(id) } }).catch(() => { throw new Error("Subject পাওয়া যায়নি।"); });
  revalidateBank();
}

export async function createBankChapter(subjectId: string, name: string) {
  await requireBankEditor();
  const subject = idSchema.parse(subjectId);
  const last = await prisma.bankChapter.aggregate({ where: { subjectId: subject }, _max: { sortOrder: true } });
  try {
    const chapter = await prisma.bankChapter.create({ data: { subjectId: subject, name: nameSchema.parse(name), sortOrder: (last._max.sortOrder ?? 0) + 1 }, select: { id: true } });
    revalidateBank();
    return chapter;
  } catch (error) {
    if (duplicate(error)) throw new Error("এই subject-এ এই নামে chapter আগেই আছে।");
    throw error;
  }
}

export async function renameBankChapter(id: string, name: string) {
  await requireBankEditor();
  try {
    await prisma.bankChapter.update({ where: { id: idSchema.parse(id) }, data: { name: nameSchema.parse(name) } });
  } catch (error) {
    if (duplicate(error)) throw new Error("এই subject-এ এই নামে chapter আগেই আছে।");
    throw error;
  }
  revalidateBank();
}

/** Moves a chapter (with everything in it) to another subject. */
export async function moveBankChapter(id: string, subjectId: string) {
  await requireBankEditor();
  try {
    await prisma.bankChapter.update({ where: { id: idSchema.parse(id) }, data: { subjectId: idSchema.parse(subjectId) } });
  } catch (error) {
    if (duplicate(error)) throw new Error("ওই subject-এ এই নামে chapter আগেই আছে — আগে নাম বদলাও।");
    throw error;
  }
  revalidateBank();
}

export async function deleteBankChapter(id: string) {
  await requireBankEditor();
  await prisma.bankChapter.delete({ where: { id: idSchema.parse(id) } }).catch(() => { throw new Error("Chapter পাওয়া যায়নি।"); });
  revalidateBank();
}

/* ---------- Items (staff) ---------- */

const articleSchema = z.object({
  id: idSchema.nullish(),
  chapterId: idSchema,
  title: z.string().trim().min(1, "শিরোনাম লেখো").max(200),
  content: z.string().max(200_000),
  free: z.boolean(),
});

/** A new article, or an edit of one; the HTML is sanitized like a note's. */
export async function saveBankArticle(input: unknown) {
  await requireBankEditor();
  const { id, chapterId, title, free, content } = articleSchema.parse(input);
  const html = sanitizeNoteHtml(content);
  if (id) {
    await prisma.bankArticle.update({ where: { id }, data: { title, content: html, free } }).catch(() => { throw new Error("Article পাওয়া যায়নি।"); });
  } else {
    const last = await prisma.bankArticle.aggregate({ where: { chapterId }, _max: { sortOrder: true } });
    await prisma.bankArticle.create({ data: { chapterId, title, content: html, free, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  }
  revalidateBank();
}

const mcqSchema = z.object({
  id: idSchema.nullish(),
  chapterId: idSchema,
  text: z.string().trim().min(1, "প্রশ্ন লেখো").max(2000),
  options: z.array(z.string().trim().min(1, "কোনো option ফাঁকা রাখা যাবে না").max(500)).min(4, "অন্তত ৪টা option লাগবে").max(5, "সর্বোচ্চ ৫টা option"),
  correctIndex: z.number().int().min(0).max(4),
  solution: z.string().trim().max(5000).nullish().transform((value) => value || null),
  explanation: z.string().trim().max(5000).nullish().transform((value) => value || null),
  free: z.boolean(),
}).refine((question) => question.correctIndex < question.options.length, { message: "সঠিক উত্তর বেছে নাও" });

/** A chapter MCQ typed in the app (new), or the free flag / text of an existing one. */
export async function saveChapterQuestion(input: unknown) {
  await requireBankEditor();
  const { id, chapterId, ...data } = mcqSchema.parse(input);
  try {
    if (id) {
      await prisma.bankQuestion.update({ where: { id }, data: { ...data, editedAt: new Date() } });
    } else {
      const last = await prisma.bankQuestion.aggregate({ where: { chapterId }, _max: { serial: true } });
      await prisma.bankQuestion.create({ data: { ...data, chapterId, serial: (last._max.serial ?? 0) + 1, fingerprint: questionFingerprint(data.text, data.options), editedAt: new Date() } });
    }
  } catch (error) {
    if (duplicate(error)) throw new Error("এই প্রশ্নটা এই chapter-এ আগেই আছে।");
    throw error;
  }
  revalidateBank();
}

const shortSchema = z.object({
  id: idSchema.nullish(),
  chapterId: idSchema,
  question: z.string().trim().min(1, "প্রশ্ন লেখো").max(2000),
  answer: z.string().trim().min(1, "উত্তর লেখো").max(4000),
  free: z.boolean(),
});

export async function saveBankShortQuestion(input: unknown) {
  await requireBankEditor();
  const { id, chapterId, question, answer, free } = shortSchema.parse(input);
  const fingerprint = questionFingerprint(question, []);
  try {
    if (id) {
      await prisma.bankShortQuestion.update({ where: { id }, data: { question, answer, free, fingerprint } });
    } else {
      const last = await prisma.bankShortQuestion.aggregate({ where: { chapterId }, _max: { serial: true } });
      await prisma.bankShortQuestion.create({ data: { chapterId, question, answer, free, fingerprint, serial: (last._max.serial ?? 0) + 1 } });
    }
  } catch (error) {
    if (duplicate(error)) throw new Error("এই প্রশ্নটা এই chapter-এ আগেই আছে।");
    throw error;
  }
  revalidateBank();
}

const itemsSchema = z.object({ kind: kindSchema, ids: z.array(idSchema).min(1, "কিছু বাছা হয়নি").max(2000) });

export async function deleteBankItems(input: unknown) {
  await requireBankEditor();
  const { kind, ids } = itemsSchema.parse(input);
  const where = { id: { in: ids } };
  // Chapter MCQs only: a past-year set's questions are edited on the set's page.
  const { count } = kind === "article" ? await prisma.bankArticle.deleteMany({ where })
    : kind === "mcq" ? await prisma.bankQuestion.deleteMany({ where: { ...where, chapterId: { not: null } } })
    : await prisma.bankShortQuestion.deleteMany({ where });
  revalidateBank();
  return count;
}

export async function setBankItemsFree(input: unknown) {
  await requireBankEditor();
  const { kind, ids, free } = itemsSchema.extend({ free: z.boolean() }).parse(input);
  const where = { id: { in: ids } };
  const { count } = kind === "article" ? await prisma.bankArticle.updateMany({ where, data: { free } })
    : kind === "mcq" ? await prisma.bankQuestion.updateMany({ where, data: { free } })
    : await prisma.bankShortQuestion.updateMany({ where, data: { free } });
  revalidateBank();
  return count;
}

/**
 * Moves items to another chapter (any subject). An MCQ or short question already in the target
 * (same wording) stays where it is and is counted as skipped.
 */
export async function moveBankItems(input: unknown) {
  await requireBankEditor();
  const { kind, ids, chapterId } = itemsSchema.extend({ chapterId: idSchema }).parse(input);
  const target = await prisma.bankChapter.findUnique({ where: { id: chapterId }, select: { id: true } });
  if (!target) throw new Error("Chapter পাওয়া যায়নি।");
  if (kind === "article") {
    const { count } = await prisma.bankArticle.updateMany({ where: { id: { in: ids } }, data: { chapterId } });
    revalidateBank();
    return { moved: count, skipped: 0 };
  }
  let moved = 0, skipped = 0;
  for (const id of ids) {
    try {
      // An MCQ can also come out of a past-year set into a chapter.
      if (kind === "mcq") await prisma.bankQuestion.update({ where: { id }, data: { chapterId, setId: null } });
      else await prisma.bankShortQuestion.update({ where: { id }, data: { chapterId } });
      moved++;
    } catch (error) {
      if (duplicate(error) || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")) { skipped++; continue; }
      throw error;
    }
  }
  revalidateBank();
  return { moved, skipped };
}

/* ---------- Past-year questions into a chapter (staff) ---------- */

/** A set's question ids, to check them against a chapter before moving (staff). */
export async function bankSetQuestionIds(setId: string) {
  await requireBankEditor();
  const questions = await prisma.bankQuestion.findMany({ where: { setId: idSchema.parse(setId) }, orderBy: [{ serial: "asc" }, { id: "asc" }], select: { id: true } });
  return questions.map((question) => question.id);
}

const moveToChapterSchema = z.object({
  ids: z.array(idSchema).max(5000),
  chapterId: idSchema,
  /** Moving a whole set: it is removed afterwards, with the duplicates left behind in it. */
  removeSetId: idSchema.nullish(),
});

/**
 * Moves MCQs (from a past-year set or another chapter) into a chapter, after the page has checked
 * them for duplicates (/api/question-bank/duplicates) and the admin left those out. One the
 * chapter already has word for word is skipped here too. When a whole set moves, the set is then
 * deleted; copies people already sent to their Preliminary stay theirs.
 */
export async function moveQuestionsToChapter(input: unknown) {
  await requireBankEditor();
  const { ids, chapterId, removeSetId } = moveToChapterSchema.parse(input);
  const chapter = await prisma.bankChapter.findUnique({ where: { id: chapterId }, select: { id: true, subjectId: true } });
  if (!chapter) throw new Error("Chapter পাওয়া যায়নি।");
  let moved = 0, skipped = 0;
  for (const id of ids) {
    try {
      await prisma.bankQuestion.update({ where: { id }, data: { chapterId, setId: null } });
      moved++;
    } catch (error) {
      if (duplicate(error) || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")) { skipped++; continue; }
      throw error;
    }
  }
  if (removeSetId) await prisma.bankSet.deleteMany({ where: { id: removeSetId } });
  revalidateBank();
  return { moved, skipped, href: `/question-bank/general/${chapter.subjectId}/${chapter.id}?tab=mcq` };
}

/* ---------- A chapter's sheet (staff) ---------- */

const mcqRowSchema = z.object({
  serial: z.number().int().min(0).max(1_000_000),
  text: z.string().trim().min(1).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).min(4).max(5),
  correctIndex: z.number().int().min(0).max(4),
  solution: z.string().trim().max(5000).nullable(),
  explanation: z.string().trim().max(5000).nullable(),
}).refine((row) => row.correctIndex < row.options.length);
const shortRowSchema = z.object({ serial: z.number().int().min(0).max(1_000_000), question: z.string().trim().min(1).max(2000), answer: z.string().trim().min(1).max(4000) });

/**
 * One batch of a chapter's checked sheet rows (lib/question-bank `checkChapterMcqRow` /
 * `checkChapterShortRow`, or pasted text sorted by /api/question-bank/paste). A question already in
 * the chapter (same wording) is skipped, so the same sheet can be uploaded again. New items are paid
 * unless `free` is passed.
 */
export async function importChapterRows(input: unknown) {
  await requireBankEditor();
  const data = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("mcq"), chapterId: idSchema, free: z.boolean().default(false), rows: z.array(mcqRowSchema).min(1).max(BANK_IMPORT_BATCH) }),
    z.object({ kind: z.literal("short"), chapterId: idSchema, free: z.boolean().default(false), rows: z.array(shortRowSchema).min(1).max(BANK_IMPORT_BATCH) }),
  ]).parse(input);
  const chapter = await prisma.bankChapter.findUnique({ where: { id: data.chapterId }, select: { id: true } });
  if (!chapter) throw new Error("Chapter পাওয়া যায়নি।");
  const result = data.kind === "mcq"
    ? await prisma.bankQuestion.createMany({ data: data.rows.map((row) => ({ ...row, free: data.free, chapterId: chapter.id, fingerprint: questionFingerprint(row.text, row.options) })), skipDuplicates: true })
    : await prisma.bankShortQuestion.createMany({ data: data.rows.map((row) => ({ ...row, free: data.free, chapterId: chapter.id, fingerprint: questionFingerprint(row.question, []) })), skipDuplicates: true });
  revalidateBank();
  return { created: result.count, skipped: data.rows.length - result.count };
}
