"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { now, startOfDay } from "@/lib/dayjs";
import { prisma } from "@/lib/prisma";
import { BANK_CHECK_BATCH, BANK_EDITED, BANK_IMPORT_BATCH, categorySlug, groupByYear, placementForSet, questionFingerprint, rowContentHash, rowSetKey, yearFromName } from "@/lib/question-bank";
import { assertCanTakeFromBank, canOpenBankSet, categoryAccess, FREE_SET_UNLOCKS, LOCKED_SET_PREVIEW, unlocksUsed } from "@/server/bank-access";
import { placeFor } from "@/server/collaboration/share-copy";
import { gateNotes, hasPremium } from "@/server/premium";
import { can } from "@/server/roles";

/**
 * Question Bank (docs/question-bank-plan.md, v2: docs/question-bank-v2-plan.md). This file is the
 * "বিগত বছরের প্রশ্ন" half — categories → years → past-year sets — and the sheet upload; the General
 * half (subject → chapter) is in question-bank-general.ts. Users read a set and send a copy to their
 * own Preliminary. Staff with the `question_bank` permission upload, edit, move and price sets.
 */

const examSchema = z.enum(["BCS", "PRIMARY", "GRADE_11_20"]);
const idSchema = z.string().min(1).max(64);
/** Preliminary's own limit for one set. */
const SET_MAX = 300;

/** The first page: what each half holds. */
export async function bankHome() {
  await requireUser();
  const [categories, sets, subjects, chapters, articles, questions, shorts] = await Promise.all([
    prisma.bankCategory.count(), prisma.bankSet.count(), prisma.bankSubject.count(), prisma.bankChapter.count(),
    prisma.bankArticle.count(), prisma.bankQuestion.count({ where: { chapterId: { not: null } } }), prisma.bankShortQuestion.count(),
  ]);
  return { previous: { categories, sets }, general: { subjects, chapters, items: articles + questions + shorts } };
}

/** The categories of "বিগত বছরের প্রশ্ন" with how many sets and questions each holds. */
export async function listBankCategories() {
  const me = await requireUser();
  const [categories, counts, canEdit] = await Promise.all([
    prisma.bankCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, slug: true, exam: true, _count: { select: { sets: true } } } }),
    prisma.$queryRaw<Array<{ categoryId: string; questions: bigint }>>`
      SELECT s."categoryId", COUNT(q.id)::bigint AS questions FROM "BankSet" s JOIN "BankQuestion" q ON q."setId" = s.id GROUP BY s."categoryId"`,
    can(me, "question_bank"),
  ]);
  const questions = new Map(counts.map((row) => [row.categoryId, Number(row.questions)]));
  return { canEdit, categories: categories.map(({ _count, ...category }) => ({ ...category, sets: _count.sets, questions: questions.get(category.id) ?? 0 })) };
}

/**
 * One category: its sets grouped by year (newest first, no year last) with question counts, whether
 * each is open to me and whether I already sent it. Staff also get the other categories (to move to).
 */
export async function getBankCategory(slug: string) {
  const me = await requireUser();
  const category = await prisma.bankCategory.findUnique({
    where: { slug: z.string().min(1).max(80).parse(slug) },
    select: {
      id: true, name: true, slug: true, exam: true,
      sets: {
        orderBy: [{ name: "asc" }],
        select: { id: true, section: true, name: true, year: true, free: true, _count: { select: { questions: true } }, copies: { where: { userId: me.id }, select: { id: true } } },
      },
    },
  });
  if (!category) return null;
  const [canEdit, access, canSend, used] = await Promise.all([can(me, "question_bank"), categoryAccess(me, category, category.sets.map((set) => set.id)), hasPremium(me), unlocksUsed(me)]);
  const sets = category.sets.map((set) => ({
    id: set.id, section: set.section, name: set.name, year: set.year, free: set.free, questionCount: set._count.questions, copyId: set.copies[0]?.id ?? null,
    locked: !set.free && !access.paid && !access.unlocked.has(set.id),
    picked: !set.free && !access.paid && access.unlocked.has(set.id),
  }));
  const others = canEdit ? await prisma.bankCategory.findMany({ where: { id: { not: category.id } }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }) : [];
  return {
    id: category.id, name: category.name, slug: category.slug, builtIn: Boolean(category.exam), years: groupByYear(sets), canEdit, others,
    // Without a plan: open any 3 sets and read them, but not send them to Preliminary.
    canSend, unlocks: { used, limit: FREE_SET_UNLOCKS },
  };
}

/**
 * One set with every question and answer, and whether I may edit it. Without access (a paid set and
 * no plan for it) only the first few questions come, as a preview. Solutions and explanations come
 * only with access.
 */
export async function getBankSet(id: string) {
  const me = await requireUser();
  const set = await prisma.bankSet.findUnique({
    where: { id: idSchema.parse(id) },
    select: {
      id: true, section: true, name: true, year: true, free: true, category: { select: { name: true, slug: true, exam: true } },
      questions: { orderBy: [{ serial: "asc" }, { id: "asc" }], select: { id: true, text: true, options: true, correctIndex: true, solution: true, explanation: true, editedAt: true } },
      copies: { where: { userId: me.id }, select: { id: true } },
    },
  });
  if (!set) return null;
  const [canEdit, premium, canSend, used] = await Promise.all([can(me, "question_bank"), canOpenBankSet(me, set), hasPremium(me), unlocksUsed(me)]);
  const { copies, questions, ...rest } = set;
  const shown = premium ? questions : questions.slice(0, LOCKED_SET_PREVIEW);
  return {
    ...rest, total: questions.length, questions: shown.map((question) => gateNotes(question, premium)), copyId: copies[0]?.id ?? null, canEdit, premium,
    canSend, unlocks: { used, limit: FREE_SET_UNLOCKS },
  };
}

/**
 * Without access, a user may open any FREE_SET_UNLOCKS past-year sets of their choice, for good
 * (owner, 2026-10-16): the whole set with solutions, to read — sending still needs a plan.
 */
export async function unlockBankSet(id: string) {
  const me = await requireUser();
  const set = await prisma.bankSet.findUnique({ where: { id: idSchema.parse(id) }, select: { id: true, free: true, category: { select: { exam: true } } } });
  if (!set) throw new Error("Set পাওয়া যায়নি।");
  if (await canOpenBankSet(me, set)) return { used: await unlocksUsed(me) };
  // Counted and added in one transaction, so two quick taps can't open a fourth.
  const used = await prisma.$transaction(async (tx) => {
    const count = await tx.bankSetUnlock.count({ where: { userId: me.id } });
    if (count >= FREE_SET_UNLOCKS) throw new Error(`বিনা plan-এ ${FREE_SET_UNLOCKS}টা set খোলা হয়ে গেছে — আরও খুলতে একটা plan নাও।`);
    await tx.bankSetUnlock.create({ data: { userId: me.id, setId: set.id } });
    return count + 1;
  }, { isolationLevel: "Serializable" });
  revalidatePath("/question-bank", "layout");
  return { used };
}

/**
 * Copies a bank set into my Preliminary (Todo, dated today) — needs a running plan and a free slot (bank-access
 * `assertCanTakeFromBank`: two at a time until 60%), filed under the subject its questions
 * share (a mixed past paper goes under its section). One copy per user: sending again returns the
 * copy I already have; deleting that copy lets me send it afresh.
 */
export async function sendBankSetToPreliminary(id: string) {
  const me = await requireUser();
  const bankSetId = idSchema.parse(id);
  const target = await prisma.bankSet.findUnique({ where: { id: bankSetId }, select: { id: true, free: true, category: { select: { exam: true } } } });
  if (target && !(await canOpenBankSet(me, target))) throw new Error("Preliminary-তে পাঠাতে এই পরীক্ষাসহ একটা চালু plan লাগবে।");
  const existing = await prisma.questionSet.findFirst({ where: { userId: me.id, bankSetId }, select: { id: true } });
  if (existing) return { id: existing.id, alreadySent: true };
  // A plan, and fewer than two sets from the bank still short of 60%.
  await assertCanTakeFromBank(me, "mcq");

  const set = await prisma.bankSet.findUnique({
    where: { id: bankSetId },
    select: { section: true, name: true, questions: { orderBy: [{ serial: "asc" }, { id: "asc" }], select: { text: true, options: true, correctIndex: true, solution: true, explanation: true, sources: true } } },
  });
  if (!set) throw new Error("Set পাওয়া যায়নি।");
  if (!set.questions.length) throw new Error("এই set-এ কোনো প্রশ্ন নেই।");
  if (set.questions.length > SET_MAX) throw new Error(`একটা Preliminary set-এ সর্বোচ্চ ${SET_MAX}টি প্রশ্ন রাখা যায় — এখানে ${set.questions.length}টি।`);

  const place = placementForSet(set.section, set.questions.map((question) => question.sources));
  try {
    const copy = await prisma.$transaction(async (tx) => {
      const { subjectId, topicId } = await placeFor(tx, me.id, place.subjectName, place.topicName);
      return tx.questionSet.create({
        data: {
          userId: me.id, subjectId, topicId, bankSetId, fromBank: true, topicName: set.name.slice(0, 160), date: startOfDay(now()).toDate(),
          questions: { create: set.questions.map((question, position) => ({ position, text: question.text, options: question.options, correctIndex: question.correctIndex, solution: question.solution, explanation: question.explanation })) },
        },
        select: { id: true },
      });
    });
    revalidatePath("/preliminary");
    revalidatePath("/question-bank");
    return { id: copy.id, alreadySent: false };
  } catch (error) {
    // Two taps at once: the unique (user, bank set) index lets only one copy through.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const copy = await prisma.questionSet.findFirst({ where: { userId: me.id, bankSetId }, select: { id: true } });
      if (copy) return { id: copy.id, alreadySent: true };
    }
    throw error;
  }
}

/* ---------- Staff with the Question Bank permission ---------- */

async function requireBankEditor() {
  const me = await requireUser();
  if (!(await can(me, "question_bank"))) throw new Error("এটা করতে প্রশ্ন ব্যাংক permission লাগবে।");
  return me;
}

const editSchema = z.object({
  id: idSchema,
  text: z.string().trim().min(1, "প্রশ্ন লেখো").max(2000),
  options: z.array(z.string().trim().min(1, "কোনো option ফাঁকা রাখা যাবে না").max(500)).min(4, "অন্তত ৪টা option লাগবে").max(5, "সর্বোচ্চ ৫টা option"),
  correctIndex: z.number().int().min(0).max(4),
  solution: z.string().trim().max(5000).nullish().transform((value) => value || null),
  explanation: z.string().trim().max(5000).nullish().transform((value) => value || null),
}).refine((question) => question.correctIndex < question.options.length, { message: "সঠিক উত্তর বেছে নাও" });

/**
 * An admin's edit of one bank question (typed, or an AI clean-up they accepted). Marked edited, so
 * uploading the sheet again won't bring the old text back. Copies already sent to Preliminary keep
 * the text they were sent with.
 */
export async function updateBankQuestion(input: unknown) {
  const me = await requireUser();
  if (!(await can(me, "question_bank"))) throw new Error("প্রশ্ন বদলাতে প্রশ্ন ব্যাংক permission লাগবে।");
  const { id, ...data } = editSchema.parse(input);
  const saved = await prisma.bankQuestion.update({
    where: { id },
    data: { ...data, editedAt: new Date() },
    select: { id: true, text: true, options: true, correctIndex: true, solution: true, explanation: true, editedAt: true },
  }).catch(() => null);
  if (!saved) throw new Error("প্রশ্নটা পাওয়া যায়নি।");
  revalidatePath("/question-bank", "layout");
  return saved;
}

/** The built-in categories by their exam (the sheet names the exam). */
async function categoryByExam() {
  const rows = await prisma.bankCategory.findMany({ where: { exam: { not: null } }, select: { id: true, exam: true } });
  return new Map(rows.map((row) => [row.exam!, row.id]));
}

const rowSchema = z.object({
  exam: examSchema,
  section: z.string().trim().min(1).max(200),
  session: z.string().trim().min(1).max(300),
  serial: z.number().int().min(0).max(1_000_000),
  text: z.string().trim().min(1).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).min(4).max(5),
  correctIndex: z.number().int().min(0).max(4),
  solution: z.string().trim().max(5000).nullable(),
  explanation: z.string().trim().max(5000).nullable(),
  sources: z.string().trim().max(1000).nullable(),
}).refine((row) => row.correctIndex < row.options.length, { message: "উত্তরের অক্ষর অপশনের বাইরে" });

/**
 * One batch of checked sheet rows. Sets are found by exam + section + session (created when new);
 * a question is found by its fingerprint inside its set, so uploading the same sheet again updates
 * questions instead of adding them twice. Questions missing from the sheet are left as they are.
 */
export async function importBankRows(input: unknown) {
  await requireBankEditor();
  const rows = z.array(rowSchema).min(1).max(BANK_IMPORT_BATCH).parse(input);
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = JSON.stringify([row.exam, row.section, row.session]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const categories = await categoryByExam();
  let created = 0, updated = 0, unchanged = 0;
  for (const group of groups.values()) {
    const { exam, section, session } = group[0];
    const categoryId = categories.get(exam);
    if (!categoryId) throw new Error("পরীক্ষার category পাওয়া যায়নি — migration চালানো হয়েছে কি?");
    // A set someone moved to another category is still found by its exam mirror + section + name.
    const moved = await prisma.bankSet.findFirst({ where: { exam, section, name: session }, select: { id: true } });
    const set = moved ?? await prisma.bankSet.upsert({
      where: { categoryId_section_name: { categoryId, section, name: session } },
      create: { categoryId, exam, section, name: session, year: yearFromName(session) },
      update: {},
      select: { id: true },
    });
    // The same question twice in one batch: the later row wins.
    const byPrint = new Map(group.map((row) => [questionFingerprint(row.text, row.options), row]));
    const existing = await prisma.bankQuestion.findMany({
      where: { setId: set.id, fingerprint: { in: [...byPrint.keys()] } },
      select: { id: true, fingerprint: true, serial: true, text: true, options: true, correctIndex: true, solution: true, explanation: true, sources: true, editedAt: true },
    });
    const found = new Map(existing.map((question) => [question.fingerprint, question]));
    const fresh = [...byPrint].filter(([print]) => !found.has(print));
    if (fresh.length) {
      const result = await prisma.bankQuestion.createMany({
        data: fresh.map(([fingerprint, row]) => ({ setId: set.id, fingerprint, serial: row.serial, text: row.text, options: row.options, correctIndex: row.correctIndex, solution: row.solution, explanation: row.explanation, sources: row.sources })),
        skipDuplicates: true,
      });
      created += result.count;
    }
    for (const [print, row] of byPrint) {
      const old = found.get(print);
      if (!old) continue;
      // An admin fixed this one in the app; the sheet still has the old text.
      if (old.editedAt) { unchanged++; continue; }
      const data = { serial: row.serial, text: row.text, options: row.options, correctIndex: row.correctIndex, solution: row.solution, explanation: row.explanation, sources: row.sources };
      const same = old.serial === data.serial && old.text === data.text && old.correctIndex === data.correctIndex && old.solution === data.solution
        && old.explanation === data.explanation && old.sources === data.sources && JSON.stringify(old.options) === JSON.stringify(data.options);
      if (same) { unchanged++; continue; }
      await prisma.bankQuestion.update({ where: { id: old.id }, data });
      updated++;
    }
  }
  revalidatePath("/question-bank");
  return { created, updated, unchanged };
}

const checkSchema = z.array(z.object({ exam: examSchema, section: z.string().max(200), session: z.string().max(300), fingerprint: z.string().regex(/^[0-9a-f]{16}$/) })).max(BANK_CHECK_BATCH);

/**
 * Before an upload: which of these questions are already in the bank, each with a hash of what is
 * stored, so the page can skip the unchanged ones and update only the edited ones. Questions an
 * admin edited in the app come back as BANK_EDITED: the upload leaves them alone.
 * Keyed `<set key>|<fingerprint>`.
 */
export async function checkBankRows(input: unknown) {
  await requireBankEditor();
  const rows = checkSchema.parse(input);
  const bySet = new Map<string, { exam: z.infer<typeof examSchema>; section: string; session: string; prints: string[] }>();
  for (const row of rows) {
    const key = rowSetKey(row);
    const entry = bySet.get(key) ?? { exam: row.exam, section: row.section, session: row.session, prints: [] };
    entry.prints.push(row.fingerprint);
    bySet.set(key, entry);
  }
  const found: Record<string, string> = {};
  for (const [key, entry] of bySet) {
    const set = await prisma.bankSet.findFirst({ where: { exam: entry.exam, section: entry.section, name: entry.session }, select: { id: true } });
    if (!set) continue;
    const stored = await prisma.bankQuestion.findMany({
      where: { setId: set.id, fingerprint: { in: entry.prints } },
      select: { fingerprint: true, serial: true, text: true, options: true, correctIndex: true, solution: true, explanation: true, sources: true, editedAt: true },
    });
    for (const question of stored) found[`${key}|${question.fingerprint}`] = question.editedAt ? BANK_EDITED : rowContentHash(question);
  }
  return found;
}

/** All sets for the admin page, every category. */
export async function listAllBankSets() {
  await requireBankEditor();
  const sets = await prisma.bankSet.findMany({
    orderBy: [{ category: { sortOrder: "asc" } }, { section: "asc" }, { name: "asc" }],
    select: { id: true, exam: true, section: true, name: true, updatedAt: true, category: { select: { name: true } }, _count: { select: { questions: true, copies: true } } },
  });
  return sets.map(({ _count, category, ...set }) => ({ ...set, categoryName: category.name, questionCount: _count.questions, copyCount: _count.copies }));
}

/** Removes sets from the bank (one, or many ticked at once). Copies already in people's Preliminary stay theirs. */
export async function deleteBankSets(ids: string[]) {
  await requireBankEditor();
  const which = z.array(idSchema).min(1, "কোনো set বাছা হয়নি").max(5000).parse(ids);
  const { count } = await prisma.bankSet.deleteMany({ where: { id: { in: which } } });
  revalidatePath("/question-bank");
  return count;
}

/* ---------- Categories and sets (staff) ---------- */

const nameSchema = z.string().trim().min(1, "নাম লেখো").max(80, "নাম খুব লম্বা");

function revalidateBank() {
  revalidatePath("/question-bank", "layout");
}

/** A new category under "বিগত বছরের প্রশ্ন" (e.g. "ব্যাংক জব"); its sets need any running plan. */
export async function createBankCategory(name: string) {
  await requireBankEditor();
  const value = nameSchema.parse(name);
  const last = await prisma.bankCategory.aggregate({ _max: { sortOrder: true } });
  try {
    const category = await prisma.bankCategory.create({ data: { name: value, slug: categorySlug(value), sortOrder: (last._max.sortOrder ?? 0) + 1 }, select: { id: true, slug: true } });
    revalidateBank();
    return category;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("এই নামে category আগেই আছে।");
    throw error;
  }
}

export async function renameBankCategory(id: string, name: string) {
  await requireBankEditor();
  try {
    await prisma.bankCategory.update({ where: { id: idSchema.parse(id) }, data: { name: nameSchema.parse(name) } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("এই নামে category আগেই আছে।");
    throw error;
  }
  revalidateBank();
}

/** Only an admin-added, empty category: the built-ins carry the exam prices, and sets must not be lost. */
export async function deleteBankCategory(id: string) {
  await requireBankEditor();
  const category = await prisma.bankCategory.findUnique({ where: { id: idSchema.parse(id) }, select: { id: true, exam: true, _count: { select: { sets: true } } } });
  if (!category) throw new Error("Category পাওয়া যায়নি।");
  if (category.exam) throw new Error("মূল তিনটা পরীক্ষার category মুছা যায় না।");
  if (category._count.sets) throw new Error("আগে ভেতরের set-গুলো অন্য category-তে সরাও বা মুছো।");
  await prisma.bankCategory.delete({ where: { id: category.id } });
  revalidateBank();
}

const setEditSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1, "নাম লেখো").max(300),
  year: z.number().int().min(1950).max(2100).nullable(),
  free: z.boolean(),
});

/** A set's name, year (null = "অন্যান্য") and whether it is open to everyone. */
export async function updateBankSet(input: unknown) {
  await requireBankEditor();
  const { id, ...data } = setEditSchema.parse(input);
  try {
    await prisma.bankSet.update({ where: { id }, data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("এই category-তে এই নামে set আগেই আছে।");
    throw error;
  }
  revalidateBank();
}

/** Free or paid for many sets at once. */
export async function setBankSetsFree(ids: string[], free: boolean) {
  await requireBankEditor();
  const { count } = await prisma.bankSet.updateMany({ where: { id: { in: z.array(idSchema).min(1).max(5000).parse(ids) } }, data: { free: z.boolean().parse(free) } });
  revalidateBank();
  return count;
}

/**
 * Moves sets to another category; their exam mirror follows (so pricing and a later sheet upload
 * follow too). A set whose name is already in the target is left where it is and counted.
 */
export async function moveBankSets(ids: string[], categoryId: string) {
  await requireBankEditor();
  const which = z.array(idSchema).min(1, "কোনো set বাছা হয়নি").max(5000).parse(ids);
  const target = await prisma.bankCategory.findUnique({ where: { id: idSchema.parse(categoryId) }, select: { id: true, exam: true } });
  if (!target) throw new Error("Category পাওয়া যায়নি।");
  let moved = 0, skipped = 0;
  for (const id of which) {
    try {
      await prisma.bankSet.update({ where: { id }, data: { categoryId: target.id, exam: target.exam } });
      moved++;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2025")) { skipped++; continue; }
      throw error;
    }
  }
  revalidateBank();
  return { moved, skipped };
}
